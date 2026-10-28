import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, looksLikeNewsEvent, profileFor } from '../src/intel/taxonomy.js';
import { buildClusters } from '../src/intel/cluster.js';
import { scoreCluster, decideLifecycle, clusterSignal } from '../src/intel/score.js';
import type { Observation } from '../src/types.js';
import { normalizeKey, parseApproxTraffic, youtubeId, isVideoUrl, extractHashtags, tokenize } from '../src/lib/util.js';

const NOW = '2026-10-28T00:30:00.000Z';
const obs = (p: Partial<Observation> & { title: string; kind: Observation['kind']; source: Observation['source'] }): Observation => ({
  id: `${p.source}:${p.kind}:${normalizeKey(p.title)}`,
  key: normalizeKey(p.title),
  url: 'https://example.invalid/' + normalizeKey(p.title).replace(/\s/g, '-'),
  observedAt: NOW,
  metrics: {},
  ...p,
});

test('util: normalizeKey, traffic parsing, YouTube ids, hashtags', () => {
  assert.equal(normalizeKey('  Héllo, WORLD!  '), 'hello world');
  assert.equal(parseApproxTraffic('2,000+'), 2000);
  assert.equal(parseApproxTraffic('1K+'), 1000);
  assert.equal(youtubeId('https://youtu.be/vEtbfzMLVWU?si=x'), 'vEtbfzMLVWU');
  assert.equal(youtubeId('https://youtube.com/shorts/H87gnRNXARI?si=y'), 'H87gnRNXARI');
  assert.equal(youtubeId('https://m.youtube.com/watch?v=DmAOBosGlHY&list=RD'), 'DmAOBosGlHY');
  assert.equal(youtubeId('https://example.com/watch?v=abc'), undefined);
  assert.ok(isVideoUrl('https://www.tiktok.com/@u/video/7301234567890123456'));
  assert.ok(!isVideoUrl('https://twitch.tv/someone'));
  assert.deepEqual(extractHashtags('#EmojiSounds #MusicChallenge day 26 #musicchallenge'), ['emojisounds', 'musicchallenge']);
  assert.deepEqual(tokenize('The Rolling Stones - Stray Cat Blues (Official Lyric Video)'), ['rolling', 'stones', 'stray', 'cat', 'blues', 'lyric']);
});

test('taxonomy: classification picks the right parent/subcategory', () => {
  assert.equal(classify('Rapping cats: an AI animated cat raps about Mondays').category, 'Animals & Pets');
  assert.equal(classify('Fox World Series broadcast: viewers criticize AI videos and pregame segments').category, 'Sports');
  const c = classify('Spooky month stream schedules: creators share lineups of horror games like Phasmophobia');
  assert.equal(c.category, 'Gaming');
  assert.equal(c.subcategory, 'Horror Games');
  assert.equal(classify('#EmojiSounds #MusicChallenge day 26').category, 'Music');
  assert.equal(classify('zzqx qwpl').category, 'Other');
  assert.ok(profileFor('News & Politics').advertiser < profileFor('Food & Cooking').advertiser);
});

test('taxonomy: news/person events are flagged', () => {
  assert.ok(looksLikeNewsEvent('nz vs ind live score prediction', 'Sports'));
  assert.ok(looksLikeNewsEvent('Trump speaks in Corpus Christi', 'News & Politics'));
  assert.ok(looksLikeNewsEvent('M6 crash live updates', 'Other'));
  assert.ok(!looksLikeNewsEvent('cat video compilation', 'Animals & Pets'));
});

test('cluster: posts attach to the matching topic seed; format query posts form a format cluster; same term merges across regions', () => {
  const list: Observation[] = [
    obs({ title: 'Spooky month stream schedules', kind: 'social_topic', source: 'bluesky', text: 'Creators share weekly lineups of horror games', metrics: { rank: 4 } }),
    obs({ title: 'My spooky month stream schedule is up!', kind: 'post', source: 'bluesky', id: 'bluesky:post:p1', key: 'p1', creator: { name: 'a' }, query: 'topic:spooky month stream schedules', metrics: { likes: 10 } }),
    obs({ title: 'nz vs ind', kind: 'search_interest', source: 'google_trends', region: 'US', id: 'google_trends:search_interest:nz vs ind:US', metrics: { approxTraffic: 2000 } }),
    obs({ title: 'nz vs ind', kind: 'search_interest', source: 'google_trends', region: 'GB', id: 'google_trends:search_interest:nz vs ind:GB', metrics: { approxTraffic: 5000 } }),
    ...['a', 'b', 'c', 'd'].map((c, i) => obs({ title: `New animation ${i}`, kind: 'video', source: 'bluesky', id: `bluesky:video:v${i}`, key: `v${i}`, creator: { name: c }, query: 'search:animation', metrics: { likes: 100 + i }, tags: ['animation'] })),
  ];
  const clusters = buildClusters(list);
  const spooky = clusters.find((c) => c.name === 'Spooky month stream schedules')!;
  assert.ok(spooky);
  assert.equal(spooky.members.length, 2, 'topic feed post attached to its topic');
  const nz = clusters.find((c) => c.name === 'nz vs ind')!;
  assert.equal(nz.members.length, 2, 'US+GB merged');
  const fmt = clusters.find((c) => c.origin === 'format')!;
  assert.equal(fmt.name, 'Animation (format)');
  assert.equal(fmt.members.length, 4);
  assert.ok(!clusters.some((c) => c.name === '#animation'), 'tag restating the query is not a separate cluster');
});

test('cluster: a hashtag used by ≥3 creators becomes its own microtrend', () => {
  const list: Observation[] = ['x', 'y', 'z'].map((c, i) =>
    obs({ title: `Day 26 song ${i}`, kind: 'video', source: 'bluesky', id: `bluesky:video:e${i}`, key: `e${i}`, creator: { name: c }, query: 'search:cat video', tags: ['emojisounds', 'musicchallenge'], metrics: { likes: 40 } }),
  );
  const clusters = buildClusters(list);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].origin, 'hashtag');
  assert.equal(clusters[0].name, '#emojisounds');
});

test('score: provisional on first sight, observed growth when history exists, lifecycle responds', () => {
  const members: Observation[] = [
    obs({ title: 'rapping cats', kind: 'search_interest', source: 'google_trends', metrics: { approxTraffic: 20000 } }),
    obs({ title: 'Rapping cat remix', kind: 'video', source: 'bluesky', id: 'bluesky:video:r1', key: 'r1', creator: { name: 'a' }, metrics: { likes: 800, reposts: 100 }, publishedAt: '2026-10-27T20:00:00.000Z' }),
    obs({ title: 'Rapping cat remix 2', kind: 'video', source: 'bluesky', id: 'bluesky:video:r2', key: 'r2', creator: { name: 'b' }, metrics: { likes: 300 }, publishedAt: '2026-10-27T22:00:00.000Z' }),
  ];
  const cluster = { id: 't_rapping_cats', name: 'rapping cats', origin: 'seed' as const, keywords: ['rapping', 'cats'], members };
  const first = scoreCluster({ cluster, category: 'Animals & Pets', isNewsEvent: false, now: NOW, history: [] });
  assert.equal(first.scores.momentumBasis, 'provisional');
  assert.equal(first.scores.growth, undefined, 'no invented growth');
  assert.equal(first.scores.components.growth, 0.5);
  assert.ok(first.scores.momentum > 0 && first.scores.momentum <= 100);
  assert.ok(first.scores.confidence > 20);
  assert.ok(['emerging', 'breaking_out', 'accelerating', 'peaking'].includes(first.lifecycle));

  const prev = { runId: 'r0', t: '2026-10-27T18:00:00.000Z', trendId: cluster.id, name: 'rapping cats', momentum: 40, confidence: 30, monetization: 70, creator: 60, signal: first.signal / 2, lifecycle: 'emerging', evidenceCount: 2 };
  const second = scoreCluster({ cluster, category: 'Animals & Pets', isNewsEvent: false, now: NOW, history: [prev] });
  assert.equal(second.scores.momentumBasis, 'observed');
  assert.ok(second.scores.growth! > 1.5, `growth ratio ${second.scores.growth}`);
  assert.ok(second.scores.momentum > first.scores.momentum, 'growing trend scores higher momentum than provisional');

  const falling = { ...prev, signal: first.signal * 4 };
  const third = scoreCluster({ cluster, category: 'Animals & Pets', isNewsEvent: false, now: NOW, history: [falling] });
  assert.equal(third.lifecycle, 'cooling');
});

test('score: news events are penalised on monetization and creator fit', () => {
  const members: Observation[] = [obs({ title: 'election results', kind: 'search_interest', source: 'google_trends', metrics: { approxTraffic: 500000 } }), obs({ title: 'election results live', kind: 'social_topic', source: 'bluesky', metrics: { rank: 1 } })];
  const cluster = { id: 't_e', name: 'election results', origin: 'seed' as const, keywords: [], members };
  const a = scoreCluster({ cluster, category: 'News & Politics', isNewsEvent: true, now: NOW, history: [] });
  const b = scoreCluster({ cluster, category: 'Animals & Pets', isNewsEvent: false, now: NOW, history: [] });
  assert.ok(a.scores.monetization < b.scores.monetization / 2);
  assert.ok(a.scores.creator < b.scores.creator);
});

test('score: signal normalisation is monotonic and bounded', () => {
  const lo = clusterSignal([obs({ title: 'x', kind: 'video', source: 'youtube', metrics: { views: 20_000 } })]);
  const hi = clusterSignal([obs({ title: 'x', kind: 'video', source: 'youtube', metrics: { views: 20_000_000 } })]);
  assert.ok(lo < hi && hi <= 1 && lo >= 0);
  assert.equal(decideLifecycle({ momentum: 10, confidence: 5, signal: 0.1, growth: 0.5, accel: 0.5, basis: 'provisional', ageHours: 1, hSeen: 0, evidence: 1, sources: 1 }), 'insufficient_data');
  assert.equal(decideLifecycle({ momentum: 60, confidence: 50, signal: 0.5, growth: 0.5, accel: 0.5, basis: 'observed', ageHours: 10, hSeen: 40, evidence: 5, sources: 2 }), 'cooling');
});
