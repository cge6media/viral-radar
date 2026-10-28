import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOpportunity, trendFeatures } from '../src/intel/formats.js';
import { buildDesk, calendarCountdown, isCleanEvidence, isContextEvidence, subFormatsOf, timingOf } from '../src/intel/desk.js';
import { buildVideoRecords } from '../src/intel/videos.js';
import { detectLanguage } from '../src/intel/language.js';
import type { Observation, Trend, VideoRecord, WindowScores } from '../src/types.js';

const NOW = '2026-10-28T12:00:00.000Z';
const h = (ago: number) => new Date(new Date(NOW).getTime() - ago * 36e5).toISOString();
const vid = (id: string, title: string, views: number, hoursOld: number, channel: string, extra: Partial<Observation> = {}, durationSec = 40): Observation => ({
  id: `youtube:video:${id}`, source: 'youtube', kind: 'video', level: 'direct', key: `yt:${id}`, title, url: `https://www.youtube.com/shorts/${id}`,
  observedAt: NOW, verifiedAt: NOW, firstSeenAt: h(Math.min(hoursOld, 10)), publishedAt: h(hoursOld), videoPublishedAt: h(hoursOld),
  metrics: { views, likes: Math.round(views * 0.03), comments: Math.round(views * 0.001) }, tags: [],
  video: { platform: 'youtube', id, durationSec, channelId: `UC${channel}`, statsDirect: true }, creator: { name: channel, url: `https://www.youtube.com/channel/UC${channel}` }, platformCategory: 'Comedy', ...extra,
});
const win = (over: Partial<WindowScores>): WindowScores => ({ window: '7d', items: 5, videos: 5, directVideos: 5, creators: 5, newCreators: 2, videoPerformance: 60, videoMomentum: null, adoption: 50, audienceInterest: 20, confidence: 70, creatorOpportunity: 60, momentum: 60, opportunity: 60, grade: 'developing', lifecycle: 'accelerating', growth: { basis: 'measured', ratio: 1.6, windowHours: 24, metric: 'creators' }, components: {}, notes: [], ...over });
const trend = (id: string, name: string, evidence: Observation[], over: Partial<Trend> = {}, w: Partial<WindowScores> = {}): Trend => {
  const s7 = win({ videos: evidence.length, directVideos: evidence.length, creators: new Set(evidence.map((e) => e.creator?.name)).size, ...w });
  return { id, kind: 'microtrend', name, category: 'Comedy', subcategory: 'Skits', format: name, platforms: ['youtube'], evidenceKinds: ['video'], firstDetected: h(60), lastSeen: NOW, evidenceCount: evidence.length, videoCount: evidence.length, directVideoCount: evidence.length, creatorCount: s7.creators, scores: s7, windows: { '24h': s7, '48h': s7, '7d': s7 }, evidence, keywords: [], series: [], isNewsEvent: false, isGeneric: false, qualified: true, monetizationSuitability: 70, summary: '', ...over };
};
const records = (obs: Observation[]) => buildVideoRecords({ observations: obs, metricHistory: new Map(), now: NOW });
const byObs = (recs: VideoRecord[]) => new Map(recs.map((r) => [r.id, r]));

test('desk 4.0.1: clean evidence excludes streams, long recordings, news clips and small videos; mid-size successes are labelled', () => {
  const obs = [
    vid('h1', 'POV: my cat runs the courtroom', 3_000_000, 20, 'a'),
    vid('s1', '🔴 LIVE courtroom stream', 3_000_000, 20, 'b'),
    vid('l1', 'Courtroom full episode', 3_000_000, 20, 'c', {}, 5400),
    vid('n1', 'Courtroom verdict: man arrested after attack', 3_000_000, 20, 'd', { platformCategory: 'News & Politics' }),
    vid('m1', 'POV: the hamster runs the courtroom', 250_000, 80, 'e'),
    vid('t1', 'POV: tiny courtroom', 30_000, 80, 'f'),
  ];
  const recs = records(obs);
  const by = byObs(recs);
  assert.equal(isCleanEvidence(by.get('youtube:video:h1')!), true, 'a hit is clean');
  assert.equal(isCleanEvidence(by.get('youtube:video:s1')!), false, 'a live stream is never evidence');
  assert.equal(isCleanEvidence(by.get('youtube:video:l1')!), false, 'a 90-minute recording is never evidence');
  assert.equal(isCleanEvidence(by.get('youtube:video:n1')!), false, 'a news clip is never evidence');
  assert.equal(isCleanEvidence(by.get('youtube:video:m1')!), true, 'a 250K-view video inside ten days is a mid-size success');
  assert.equal(isCleanEvidence(by.get('youtube:video:t1')!), false, 'a 30K-view video is context only');
  assert.equal(isContextEvidence(by.get('youtube:video:t1')!), true);
});

test('desk 4.0.1: calendar countdown and timing from the examples\' measured rates', () => {
  assert.deepEqual(calendarCountdown('halloween', '2026-10-28T12:00:00.000Z'), { days: 3, date: '2026-10-31' });
  assert.deepEqual(calendarCountdown('#halloween', '2026-10-31T10:00:00.000Z'), { days: 0, date: '2026-10-31' });
  assert.deepEqual(calendarCountdown('halloween', '2026-11-02T10:00:00.000Z'), { days: -2, date: '2026-10-31' });
  assert.equal(calendarCountdown('Karwa Chauth', '2026-10-28T12:00:00.000Z')?.days, 1);
  assert.equal(calendarCountdown('runs the courtroom', NOW), undefined);
  // a calendar event that already passed is cooling; one that is 3 days away is accelerating
  const obs = [vid('a', 'Halloween costume ranking', 3_000_000, 20, 'a'), vid('b', 'Halloween cat costume', 2_000_000, 30, 'b'), vid('c', 'Halloween sfx makeup', 1_500_000, 10, 'c')];
  const t = trend('m_halloween', 'halloween', obs, { firstDetected: h(5) });
  const f = trendFeatures(t, byObs(records(obs)), NOW);
  assert.equal(f.nameShape, 'calendar');
  assert.equal(timingOf(t, f, NOW).timing, 'accelerating');
  assert.equal(timingOf(t, f, '2026-11-03T12:00:00.000Z').timing, 'cooling');
  // a young cluster whose measured examples are all past their peak reads as cooling, not "emerging"
  const cool = { ...f, nameShape: 'phrase' as const, coolingShare: 0.8, acceleratingShare: 0 };
  assert.equal(timingOf({ ...t, name: 'courtroom pov' }, cool, NOW).timing, 'cooling');
  const hot = { ...f, nameShape: 'phrase' as const, coolingShare: 0, acceleratingShare: 0.7 };
  assert.equal(timingOf({ ...t, name: 'courtroom pov' }, hot, NOW).timing, 'accelerating');
});

test('desk 4.0.1: the category follows the verified examples, and a sub-format shared by ≥3 creators is found inside a pool', () => {
  const obs = [
    vid('a', 'Indian Theft Auto simulator part 3', 1_200_000, 30, 'a', { platformCategory: 'Gaming' }),
    vid('b', 'Indian Theft Auto: the police chase', 900_000, 40, 'b', { platformCategory: 'Gaming' }),
    vid('c', 'INDIAN THEFT AUTO but my mom calls', 400_000, 50, 'c', { platformCategory: 'Gaming' }),
    vid('d', 'Sonic vs the cockroach #animation', 2_000_000, 20, 'd', { platformCategory: 'Film & Animation' }),
    vid('e', 'Diaper Scout flies on a magic carpet #tf2', 1_500_000, 25, 'e', { platformCategory: 'Film & Animation' }),
  ];
  const recs = records(obs);
  const t = trend('f_animation', 'Animation shorts', obs, { kind: 'format', category: 'Animation & Art', isGeneric: true });
  const f = trendFeatures(t, byObs(recs), NOW);
  t.opportunity = classifyOpportunity(t, f);
  const subs = subFormatsOf(t, obs.map((e) => ({ e, r: recs.find((r) => r.id === e.id)! })));
  assert.ok(subs.some((s) => /theft/.test(s.label) && s.creators === 3), JSON.stringify(subs));
  // the microtrend "mbappe" whose verified examples are all sports content leaves the desk, whatever the cluster label said
  const sport = [vid('s1', 'Mbappe wins the Ballon d\'Or', 5_000_000, 20, 'u', { platformCategory: 'Sports' }), vid('s2', 'Mbappe reaction', 2_000_000, 18, 'v', { platformCategory: 'Sports' }), vid('s3', 'Mbappe ceremony', 1_000_000, 16, 'w', { platformCategory: 'Sports' })];
  const ts = trend('m_mbappe', 'mbappe', sport, { category: 'Animation & Art' });
  const fs = trendFeatures(ts, byObs(records(sport)), NOW);
  ts.opportunity = classifyOpportunity(ts, fs);
  const desk = buildDesk([ts], records(sport), NOW);
  assert.ok(!desk.opportunities.some((o) => o.name === 'mbappe'));
});

test('language 4.0.1: romanised Hindi is Hindi, not English', () => {
  assert.equal(detectLanguage('Diwali Ki Rat Do Logon Ki 3 Parchhaiyan Kaise Bni?'), 'hi');
  assert.equal(detectLanguage('Karwa Chauth Ka Gift Scam 🤣'), 'hi');
  assert.equal(detectLanguage('I removed this from the swan\'s throat'), 'en');
  assert.equal(detectLanguage('Abonne toi pour la suite'), 'fr');
});
