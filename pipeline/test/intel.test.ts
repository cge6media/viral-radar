import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, decideNewsEvent, looksLikeNewsEvent, profileFor } from '../src/intel/taxonomy.js';
import { validateObservation, FORMATS, videoText } from '../src/intel/relevance.js';
import { buildClusters, independentCreators } from '../src/intel/cluster.js';
import { scoreWindow, decideLifecycle, videoRate, videoVelocity, sourceHistoryGrowth, contentTime, inWindow } from '../src/intel/score.js';
import type { Observation } from '../src/types.js';
import { normalizeKey, parseApproxTraffic, youtubeId, isVideoUrl, extractHashtags, tokenize } from '../src/lib/util.js';

const NOW = '2026-10-28T00:30:00.000Z';
const h = (hoursAgo: number) => new Date(new Date(NOW).getTime() - hoursAgo * 36e5).toISOString();
const obs = (p: Partial<Observation> & { title: string; kind: Observation['kind']; source: Observation['source'] }): Observation => ({
  id: `${p.source}:${p.kind}:${normalizeKey(p.title)}`,
  key: normalizeKey(p.title),
  level: p.kind === 'video' ? 'direct' : 'indirect',
  url: 'https://example.invalid/' + normalizeKey(p.title).replace(/\s/g, '-'),
  observedAt: NOW,
  metrics: {},
  ...p,
});
/** a verified YouTube video (direct) */
const ytv = (id: string, title: string, creator: string, views: number, hoursOld: number, extra: Partial<Observation> = {}): Observation =>
  obs({ id: `youtube:video:${id}`, key: `yt:${id}`, title, kind: 'video', source: 'youtube', level: 'direct', url: `https://www.youtube.com/watch?v=${id}`, publishedAt: h(hoursOld), videoPublishedAt: h(hoursOld), metrics: { views, likes: Math.round(views / 50) }, creator: { name: creator, url: `https://www.youtube.com/@${creator}` }, video: { platform: 'youtube', id, statsDirect: true }, firstSeenAt: h(Math.min(hoursOld, 20)), ...extra });
/** an external YouTube link shared on Bluesky (indirect, unverified) */
const share = (id: string, title: string, sharer: string, likes: number, hoursOld: number, extra: Partial<Observation> = {}): Observation =>
  obs({ id: `bluesky:video:yt:${id}`, key: `yt:${id}`, title, kind: 'video', source: 'bluesky', level: 'indirect', url: `https://www.youtube.com/watch?v=${id}`, postPublishedAt: h(hoursOld), metrics: {}, postMetrics: { likes, reposts: 1, accounts: 1 }, sharedBy: { name: sharer }, video: { platform: 'youtube', id, statsDirect: false }, firstSeenAt: h(Math.min(hoursOld, 20)), ...extra });

test('util: normalizeKey, traffic parsing, YouTube ids, hashtags', () => {
  assert.equal(normalizeKey('  Héllo, WORLD!  '), 'hello world');
  assert.equal(parseApproxTraffic('2,000+'), 2000);
  assert.equal(youtubeId('https://youtu.be/vEtbfzMLVWU?si=x'), 'vEtbfzMLVWU');
  assert.equal(youtubeId('https://youtube.com/shorts/H87gnRNXARI?si=y'), 'H87gnRNXARI');
  assert.ok(isVideoUrl('https://www.tiktok.com/@u/video/7301234567890123456'));
  assert.ok(!isVideoUrl('https://twitch.tv/someone'));
  assert.deepEqual(extractHashtags('#EmojiSounds #MusicChallenge day 26 #musicchallenge'), ['emojisounds', 'musicchallenge']);
  assert.deepEqual(tokenize('The Rolling Stones - Stray Cat Blues (Official Lyric Video)'), ['rolling', 'stones', 'stray', 'cat', 'blues', 'lyric']);
});

test('taxonomy: stage-1 classification and news detection', () => {
  assert.equal(classify('Rapping cats: an AI animated cat raps about Mondays').category, 'Animals & Pets');
  assert.equal(classify('Fox World Series broadcast: viewers criticize AI videos and pregame segments').category, 'Sports');
  assert.equal(classify('Spooky month stream schedules: creators share lineups of horror games like Phasmophobia').subcategory, 'Horror Games');
  assert.equal(classify('zzqx qwpl').category, 'Other');
  assert.ok(profileFor('News & Politics').advertiser < profileFor('Food & Cooking').advertiser);
  assert.ok(looksLikeNewsEvent('nz vs ind live score prediction', 'Sports'));
  assert.ok(decideNewsEvent([{ kind: 'social_topic', title: 'Trump says solar panels fry animals', text: '' }], 'x', 'Animals & Pets'));
  assert.ok(!decideNewsEvent([], 'Animal courtroom skits', 'Animals & Pets'));
});

// ---------- relevance regression cases (the false positives found in production) ----------
const videoLink = (title: string, text = ''): Observation => share('x' + normalizeKey(title).replace(/\s/g, '').slice(0, 8), title, 'someone', 10, 5, { text });
const nativeClip = (text: string): Observation => obs({ id: `bluesky:video:bsky:${normalizeKey(text).slice(0, 10)}`, title: text.slice(0, 60), kind: 'video', source: 'bluesky', level: 'direct', text, video: { platform: 'bluesky', id: 'r1', statsDirect: true }, publishedAt: h(3), metrics: { likes: 40 } });

test('relevance: "cooking up an album" and other non-cooking videos are rejected; real cooking videos pass', () => {
  const pass = (t: string) => validateObservation(videoLink(t)).formats.includes('cooking');
  assert.ok(pass('The Last Meal of Ichabod Crane - Sleepy Hollow Cooking'));
  assert.ok(pass('Jack-O-Lantering Everything - You Suck at Cooking (episode 179)'));
  assert.ok(pass('BEST CAULIFLOWER CHEESE RECIPE EVER | Delicious Homemade Cheese Sauce'));
  assert.ok(!pass('Polyphia - LET THERE BE LIGHT (Official Video)'), 'a music video shared with "cooking up" chatter');
  assert.ok(!pass('Polyphia cooking up a new album - LET THERE BE LIGHT (Official Video)'));
  assert.ok(!pass('UK New Entry 1973 (143) Limmie & Family Cookin\' - You Can Do Magic'));
  assert.ok(!pass('He just keeps cooking them'));
  assert.ok(!pass('How to Deal with Elon Musk'));
  assert.ok(!pass('A Night With a Restaurant Deep Cleaner | On the Job | NYT Cooking'));
  // the surrounding post text never counts for an external link
  const r = validateObservation(videoLink('Polyphia - LET THERE BE LIGHT (Official Video)', 'the band is cooking in the kitchen with this recipe'));
  assert.ok(!r.formats.includes('cooking'));
  assert.equal(videoText(videoLink('Some Title', 'ignored chatter')), 'Some Title');
});

test('relevance: a song containing "cat" is not a cat video; a political "satisfying" post is not satisfying content', () => {
  const cats = (t: string) => validateObservation(videoLink(t)).formats.includes('cats');
  assert.ok(!cats('Stray Cats - Stray Cat Strut (Official Music Video)'));
  assert.ok(!cats('Yusuf / Cat Stevens - Morning Has Broken (Official Lyric Video)'));
  assert.ok(!cats("Harry Chapin - Cat's In The Cradle (Official Lyric Video)"));
  assert.ok(cats('My cat discovered the printer and now refuses to leave'));
  assert.ok(validateObservation(nativeClip('A video analysis of the difference between dog joining cat and cat joining the dog.')).formats.includes('cats'));
  const sat = (t: string) => validateObservation(nativeClip(t)).formats.includes('satisfying');
  assert.ok(!sat('So satisfying to see the senate vote go the right way tonight'));
  assert.ok(!sat('Very satisfying election result in Brazil'));
  assert.ok(sat('Oddly satisfying kinetic sand cutting, no talking'));
  assert.ok(validateObservation(nativeClip('Pressure washing a 20-year-old patio, start to finish')).formats.includes('satisfying'));
});

test('relevance: only videos can be format evidence; animal comedy format needs the comedic construction', () => {
  const post = obs({ title: 'I love cooking', kind: 'post', source: 'bluesky', text: 'cooking dinner tonight with a new recipe' });
  assert.deepEqual(validateObservation(post).formats, []);
  assert.ok(validateObservation(nativeClip('Animated cat lawyer interviews a very guilty dog in court #animation')).formats.includes('animal_comedy'));
  assert.ok(!validateObservation(nativeClip('My cat sleeping on the couch again')).formats.includes('animal_comedy'));
  assert.ok(FORMATS.every((f) => f.queries.length > 0));
});

// ---------- clustering ----------
test('cluster: a distinctive phrase shared by ≥3 independent creators becomes a microtrend; shares of the same video count once', () => {
  const list: Observation[] = [
    ytv('a1', 'Animated courtroom skit: cat lawyer vs dog', 'chanA', 50_000, 20),
    ytv('b2', 'Courtroom skit — the hamster objects (animated)', 'chanB', 30_000, 30),
    nativeClip('new animated courtroom skit, the judge is a goose #animation'),
    share('a1', 'Animated courtroom skit: cat lawyer vs dog', 'fan1', 100, 2), // same video, shared
    share('a1', 'Animated courtroom skit: cat lawyer vs dog', 'fan2', 50, 1),
    ytv('z9', 'Minecraft parkour part 4', 'chanZ', 100_000, 40),
  ];
  const clusters = buildClusters(list);
  const micro = clusters.filter((c) => c.kind === 'microtrend');
  assert.equal(micro.length, 1);
  assert.match(micro[0].name, /Courtroom Skit/i);
  assert.equal(independentCreators(micro[0].members), 3, 'two fans sharing chanA\'s video do not add creators');
});

test('cluster: topics keep their feed posts; format pools contain only validated videos', () => {
  const list: Observation[] = [
    obs({ title: 'Spooky month stream schedules', kind: 'social_topic', source: 'bluesky', text: 'Creators share weekly lineups of horror games', metrics: { rank: 4 } }),
    obs({ id: 'bluesky:post:p1', key: 'p1', title: 'My spooky month stream schedule is up!', kind: 'post', source: 'bluesky', creator: { name: 'a' }, query: 'topic:spooky month stream schedules', metrics: { likes: 10 } }),
    { ...videoLink('BEST CAULIFLOWER CHEESE RECIPE EVER'), formats: ['cooking'] },
    { ...videoLink('Polyphia - LET THERE BE LIGHT (Official Video)'), formats: ['music_video'] },
  ];
  const clusters = buildClusters(list);
  const topic = clusters.find((c) => c.kind === 'topic')!;
  assert.equal(topic.members.length, 2);
  const cooking = clusters.find((c) => c.id === 'f_cooking')!;
  assert.equal(cooking.members.length, 1);
  assert.ok(!cooking.members.some((m) => /Polyphia/.test(m.title)));
});

// ---------- scoring ----------
test('score: timestamps — an external share has no publish date, so it falls outside a 24h window by content time', () => {
  const s = share('q1', 'Some video', 'x', 10, 1);
  assert.equal(contentTime(s), s.postPublishedAt, 'post time is the only content time of a share');
  assert.equal(s.publishedAt, undefined);
  const v = ytv('q2', 'Some video', 'chan', 1000, 30);
  assert.ok(!inWindow(v, '24h', NOW) && inWindow(v, '48h', NOW));
});

test('score: separated components, grades, provisional vs measured growth, velocity', () => {
  const members = [ytv('a1', 'Cat lawyer courtroom skit', 'A', 120_000, 24), ytv('b2', 'Dog courtroom skit', 'B', 40_000, 36), ytv('c3', 'Goose judge courtroom skit', 'C', 8_000, 12), obs({ title: 'courtroom skit', kind: 'search_interest', source: 'google_trends', metrics: { approxTraffic: 5000 } })];
  const cluster = { id: 'm_courtroom_skit', kind: 'microtrend' as const, name: 'Courtroom Skit', origin: 'phrase' as const, keywords: ['courtroom', 'skit'], members };
  const base = { cluster, category: 'Comedy', isNewsEvent: false, isGeneric: false, now: NOW, window: '7d' as const, history: [], metricHistory: new Map() };
  const s = scoreWindow(base);
  assert.equal(s.creators, 3);
  assert.equal(s.directVideos, 3);
  assert.ok(s.videoPerformance! > 50, `performance ${s.videoPerformance}`);
  assert.equal(s.videoMomentum, null, 'no repeated observations yet → no momentum claim');
  assert.equal(s.growth.basis, 'provisional');
  assert.equal(s.grade, 'developing', 'three creators with direct stats but only one run → developing');
  assert.ok(s.audienceInterest > 40);
  assert.ok(['emerging', 'accelerating', 'breaking_out'].includes(s.lifecycle));

  // measured growth from history: 1 → 3 creators over 6h
  const hist = [{ runId: 'r0', t: h(6), trendId: cluster.id, name: 'x', momentum: 40, confidence: 30, monetization: 60, creator: 50, signal: 0.1, lifecycle: 'emerging', evidenceCount: 1, adoption: 1 }, { runId: 'r1', t: h(3), trendId: cluster.id, name: 'x', momentum: 45, confidence: 35, monetization: 60, creator: 52, signal: 0.3, lifecycle: 'emerging', evidenceCount: 2, adoption: 2 }];
  const s2 = scoreWindow({ ...base, history: hist });
  assert.equal(s2.growth.basis, 'measured');
  assert.equal(s2.growth.ratio, 1.5);
  assert.equal(s2.grade, 'strong');
  assert.ok(s2.momentum >= s.momentum);

  // velocity: a video that gained 20k views in the last 2h after averaging 5k/h
  const mh = new Map([[members[0].id, [{ t: h(2), metrics: { views: 100_000 } }, { t: NOW, metrics: { views: 120_000 } }]]]);
  const s3 = scoreWindow({ ...base, metricHistory: mh });
  assert.ok(s3.videoMomentum != null && s3.videoMomentum > 50, `momentum ${s3.videoMomentum}`);
  assert.equal(s3.velocity?.videosMeasured, 1);
  assert.equal(s3.velocity?.viewsPerHour, 10_000);
});

test('score: shares alone are indirect — no performance claim, interest from the post, grade limited', () => {
  const members = [share('v1', 'Cooking a 3-course meal in a dorm', 'u1', 300, 2), share('v2', 'Dorm cooking challenge', 'u2', 80, 5), share('v3', 'Dorm room recipe', 'u3', 20, 8)];
  const s = scoreWindow({ cluster: { id: 'm_dorm', kind: 'microtrend', name: 'Dorm Cooking', origin: 'phrase', keywords: ['dorm'], members }, category: 'Food & Cooking', isNewsEvent: false, isGeneric: false, now: NOW, window: '7d', history: [], metricHistory: new Map() });
  assert.equal(s.videoPerformance, null);
  assert.equal(s.directVideos, 0);
  assert.equal(s.grade, 'early', 'unverified shares corroborate but cannot prove a format');
  assert.ok(s.notes.some((n) => /needs platform verification|unverified/.test(n)));
  // even oEmbed-verified channels cannot lift a shares-only cluster above early (no platform stats, no publish dates)
  const verifiedShares = members.map((m) => ({ ...m, creator: { name: 'Chan ' + m.id, url: 'https://www.youtube.com/@x' + m.id }, verifiedAt: NOW }));
  const s2 = scoreWindow({ cluster: { id: 'm_dorm2', kind: 'microtrend', name: 'Dorm Cooking', origin: 'phrase', keywords: ['dorm'], members: verifiedShares }, category: 'Food & Cooking', isNewsEvent: false, isGeneric: false, now: NOW, window: '7d', history: [], metricHistory: new Map() });
  assert.equal(s2.grade, 'early');
  assert.equal(s2.components.sharesOnly, 1);
  assert.ok(s.audienceInterest > 0);
});

test('score: videoRate is age-normalized; velocity needs ≥1h between points', () => {
  const young = ytv('y', 'x', 'c', 10_000, 2);
  const old = ytv('o', 'x', 'c', 10_000, 200);
  assert.ok(videoRate(young, NOW)!.perHour > videoRate(old, NOW)!.perHour);
  assert.equal(videoVelocity(young, [{ t: h(0.5), metrics: { views: 9000 } }, { t: NOW, metrics: { views: 10_000 } }], NOW), undefined);
  const v = videoVelocity(young, [{ t: h(1), metrics: { views: 5000 } }, { t: NOW, metrics: { views: 10_000 } }], NOW)!;
  assert.equal(v.perHour, 5000);
  assert.equal(v.metric, 'views');
});

test('score: source history ignores the partial current day unless it is already stronger pro-rated', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 9, 21 + d)).toISOString();
  const hist = [5, 8, 20, 60, 150, 400].map((v, i) => ({ t: day(i), value: v }));
  const nowEarly = new Date(Date.UTC(2026, 9, 27, 0, 30)).toISOString();
  const quiet = obs({ title: 'x', kind: 'hashtag', source: 'mastodon', history: [...hist, { t: day(6), value: 6 }] });
  const g = sourceHistoryGrowth([quiet], nowEarly)!;
  assert.ok(g.ratio > 7 && g.ratio < 9, `ratio ${g.ratio}`);
  const strong = obs({ title: 'x', kind: 'hashtag', source: 'mastodon', history: [...hist, { t: day(6), value: 900 }] });
  assert.ok(sourceHistoryGrowth([strong], new Date(Date.UTC(2026, 9, 27, 18, 0)).toISOString())!.ratio > g.ratio);
});

test('lifecycle: never accelerating without a measurement; stale → cooling; insufficient ↔ insufficient', () => {
  const base = { grade: 'developing' as const, momentum: 55, videoPerformance: 40, growth: 0.5, growthMeasured: false, newCreators: 0, creators: 3, ageHours: 100, hSinceLatest: 2, sources: 1 };
  assert.notEqual(decideLifecycle(base), 'accelerating');
  assert.equal(decideLifecycle({ ...base, growthMeasured: true, growth: 0.7 }), 'accelerating');
  assert.equal(decideLifecycle({ ...base, velocityRatio: 1.6 }), 'accelerating');
  assert.equal(decideLifecycle({ ...base, hSinceLatest: 80 }), 'cooling');
  assert.equal(decideLifecycle({ ...base, grade: 'insufficient' }), 'insufficient_data');
  assert.equal(decideLifecycle({ ...base, ageHours: 10 }), 'emerging');
  assert.equal(decideLifecycle({ ...base, momentum: 75, sources: 2, newCreators: 3 }), 'breaking_out');
});

test('relevance: second-round regression cases from the live audit', () => {
  const link = (t: string, text = '') => share('z' + normalizeKey(t).replace(/\s/g, '').slice(0, 8), t, 'someone', 5, 3, { text });
  const f = (o: Observation) => validateObservation(o).formats;
  assert.ok(!f(nativeClip('MAMA BEAR. A new short film from the mind of Curry Barker. Premieres October 29 on YouTube.')).includes('cooking'), 'a director named Curry is not a curry');
  assert.ok(f(nativeClip('MAMA BEAR. A new short film from the mind of Curry Barker.')).includes('short_film'));
  assert.ok(f(nativeClip('Thai green curry from scratch, 20 minutes')).includes('cooking'));
  assert.ok(!f(nativeClip('Wind turbines get the birds, solar panels fry the squirrels')).includes('cooking'));
  assert.ok(!f(nativeClip('A bit in awe of level design orchestrating this kind of immensely satisfying payoff')).includes('satisfying'));
  assert.ok(!f(nativeClip('A bit in awe of level design orchestrating this kind of immensely satisfying payoff')).includes('comedy_skit'));
  assert.ok(f(nativeClip('Oddly satisfying wood planing, no talking #satisfying')).includes('satisfying'));
  assert.ok(!f(nativeClip('Indie animation about making animation [Loki IRL ep 2 Coming Soon]')).includes('music_video'), '"ep 2" is not an EP');
  assert.ok(f(link('Nightfall - Debut EP (Official Video)')).includes('music_video'));
  assert.ok(!f(nativeClip('no one ever explained why he dressed Like That')).includes('explainer'));
  assert.ok(f(nativeClip('Polyamory Explained: More Than Just Sex #Polyamory')).includes('explainer'));
  assert.ok(!f(nativeClip('NDP Opposition leader Claudia Chender spitting facts about AI data centers')).includes('explainer'));
  assert.ok(!f(nativeClip('Full speedpaint available on my YT! clip inside')).includes('gaming_clip'));
  assert.ok(f(nativeClip('Aqua and Ai perform a duet together! #tomodachilife')).includes('gaming_clip'));
  assert.ok(!f(link('Terry Gilliam - Storytime (1968)')).includes('storytime'));
  assert.ok(f(nativeClip('SCARY STORYTIME: the night my car died in the woods')).includes('storytime'));
});

// ---------- review round 2 (independent review of the 2.0 logic) ----------
test('score: creator growth compares a window with the same window at an earlier run, never 24h-now vs 7d-then', () => {
  // 10 creators over 7 days, 3 of them in the last 24h
  const members = [
    ...Array.from({ length: 7 }, (_, i) => ytv(`o${i}`, `Puppet news desk episode ${i}`, `old${i}`, 20_000, 60 + i * 10)),
    ...Array.from({ length: 3 }, (_, i) => ytv(`n${i}`, `Puppet news desk tonight ${i}`, `new${i}`, 30_000, 4 + i)),
  ];
  const cluster = { id: 'm_puppet_news', kind: 'microtrend' as const, name: 'Puppet News Desk', origin: 'phrase' as const, keywords: ['puppet', 'news', 'desk'], members };
  const rec = { runId: 'r0', t: h(3), trendId: cluster.id, name: 'x', momentum: 40, confidence: 30, monetization: 60, creator: 50, signal: 0.1, lifecycle: 'emerging', evidenceCount: 10 };
  const base = { cluster, category: 'Comedy', isNewsEvent: false, isGeneric: false, now: NOW, metricHistory: new Map() };
  // a 1.0-era record (no creator counts) must not be used as a baseline at all
  const v1 = scoreWindow({ ...base, window: '24h', history: [{ ...rec, signal: 0.976 }] });
  assert.equal(v1.growth.basis, 'provisional');
  // a record with 7d creators only: the 7d window is measured, the 24h window is not
  const h7 = [{ ...rec, adoption: 10 }];
  assert.equal(scoreWindow({ ...base, window: '7d', history: h7 }).growth.ratio, 1);
  assert.equal(scoreWindow({ ...base, window: '24h', history: h7 }).growth.basis, 'provisional', '24h creators cannot be compared with 7d creators');
  // like-for-like: 3 creators in the 24h window, 3 at the earlier run → flat, not −70 %
  const s24 = scoreWindow({ ...base, window: '24h', history: [{ ...rec, adoption: 10, creators24: 3, creators48: 5 }] });
  assert.equal(s24.growth.basis, 'measured');
  assert.equal(s24.growth.ratio, 1);
  assert.notEqual(s24.lifecycle, 'cooling');
  const s48 = scoreWindow({ ...base, window: '48h', history: [{ ...rec, adoption: 10, creators24: 3, creators48: 2 }] });
  assert.equal(s48.growth.ratio, 1.5, '48h: 2 → 3 creators');
});

test('score: new creators and cluster age come from the whole cluster, so an old trend is not "emerging" in the 48h view', () => {
  const members = [
    ...Array.from({ length: 4 }, (_, i) => ytv(`e${i}`, `Dorm cooking hack ${i}`, `early${i}`, 50_000, 100 + i)),
    ytv('l1', 'Dorm cooking hack: rice cooker ramen', 'late1', 40_000, 10),
    ytv('l2', 'Dorm cooking hack: kettle pasta', 'late2', 30_000, 12),
  ];
  const cluster = { id: 'm_dorm_cooking', kind: 'microtrend' as const, name: 'Dorm Cooking Hack', origin: 'phrase' as const, keywords: ['dorm', 'cooking', 'hack'], members };
  const base = { cluster, category: 'Food & Cooking', isNewsEvent: false, isGeneric: false, now: NOW, history: [], metricHistory: new Map() };
  const s48 = scoreWindow({ ...base, window: '48h' });
  assert.equal(s48.creators, 2);
  assert.equal(s48.newCreators, 2, 'the two creators whose first video is ≤48h old');
  assert.notEqual(s48.lifecycle, 'emerging', 'the cluster is ~4 days old even though the 48h window only holds recent videos');
  const s7 = scoreWindow({ ...base, window: '7d' });
  assert.equal(s7.newCreators, 2, 'the four early creators are not new');
  assert.ok(s48.newCreators <= s7.newCreators);
});

test('score: "strong" needs persistence — three runs five minutes apart are not enough', () => {
  const members = [ytv('a1', 'Cat lawyer courtroom skit', 'A', 120_000, 24), ytv('b2', 'Dog courtroom skit', 'B', 40_000, 36), ytv('c3', 'Goose judge courtroom skit', 'C', 8_000, 12)];
  const cluster = { id: 'm_courtroom_skit', kind: 'microtrend' as const, name: 'Courtroom Skit', origin: 'phrase' as const, keywords: ['courtroom', 'skit'], members };
  const rec = (runId: string, hoursAgo: number) => ({ runId, t: h(hoursAgo), trendId: cluster.id, name: 'x', momentum: 40, confidence: 30, monetization: 60, creator: 50, signal: 0.3, lifecycle: 'emerging', evidenceCount: 3, adoption: 3 });
  const base = { cluster, category: 'Comedy', isNewsEvent: false, isGeneric: false, now: NOW, window: '7d' as const, metricHistory: new Map() };
  assert.equal(scoreWindow({ ...base, history: [rec('r0', 0.2), rec('r1', 0.1)] }).grade, 'developing');
  assert.equal(scoreWindow({ ...base, history: [rec('r0', 7), rec('r1', 3)] }).grade, 'strong');
});

test('cluster: a topic corroborates a microtrend only when it covers its keywords, not on one shared token', () => {
  const vids = ['A', 'B', 'C'].map((c, i) => ytv(`ws${i}`, `World Series watch party reaction ${c}`, `chan${c}`, 20_000, 10 + i));
  const bleach = obs({ title: 'Bleach anime series finale', kind: 'search_interest', source: 'google_trends', metrics: { approxTraffic: 20_000 } });
  const ws = obs({ title: 'World Series game 3', kind: 'search_interest', source: 'google_trends', metrics: { approxTraffic: 50_000 } });
  const clusters = buildClusters([...vids, bleach, ws]);
  const micro = clusters.find((c) => c.kind === 'microtrend' && /world series/i.test(c.name));
  assert.ok(micro, 'world series microtrend exists');
  assert.ok(!micro!.members.some((m) => /Bleach/.test(m.title)), '"series" alone is not corroboration');
  assert.ok(micro!.members.some((m) => m.title === 'World Series game 3'), 'a seed covering both keywords corroborates');
});

test('quality: any publish date on an unverified external video is flagged, even when it differs from the share time', async () => {
  const { runQualityChecks } = await import('../src/quality.js');
  const bad = share('bad1', 'Some video', 'x', 10, 5, { publishedAt: h(9) });
  const good = share('ok1', 'Some video', 'y', 10, 5);
  const verified = share('ver1', 'Some video', 'z', 10, 5, { level: 'direct', videoPublishedAt: h(50), publishedAt: h(50), verifiedAt: NOW });
  const run = (observations: Observation[]) => runQualityChecks({ trends: [], observations, sources: [], now: NOW }).checks.find((c) => /publication dates/.test(c.name))!;
  assert.equal(run([good, verified]).ok, true);
  assert.equal(run([bad]).ok, false);
});
