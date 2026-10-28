import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOpportunity, isDescriptorTag, nameShape, trendFeatures } from '../src/intel/formats.js';
import { buildDesk } from '../src/intel/desk.js';
import { buildAlerts } from '../src/intel/alerts.js';
import { buildVideoRecords } from '../src/intel/videos.js';
import type { Observation, Trend, WindowScores } from '../src/types.js';

const NOW = '2026-10-28T12:00:00.000Z';
const h = (ago: number) => new Date(new Date(NOW).getTime() - ago * 36e5).toISOString();
const vid = (id: string, title: string, views: number, hoursOld: number, channel: string, extra: Partial<Observation> = {}): Observation => ({
  id: `youtube:video:${id}`, source: 'youtube', kind: 'video', level: 'direct', key: `yt:${id}`, title, url: `https://www.youtube.com/shorts/${id}`,
  observedAt: NOW, verifiedAt: NOW, firstSeenAt: h(Math.min(hoursOld, 10)), publishedAt: h(hoursOld), videoPublishedAt: h(hoursOld),
  metrics: { views, likes: Math.round(views * 0.03), comments: Math.round(views * 0.001) }, tags: [],
  video: { platform: 'youtube', id, durationSec: 40, channelId: `UC${channel}`, statsDirect: true }, creator: { name: channel, url: `https://www.youtube.com/channel/UC${channel}` }, platformCategory: 'Comedy', ...extra,
});
const win = (over: Partial<WindowScores>): WindowScores => ({ window: '7d', items: 5, videos: 5, directVideos: 5, creators: 5, newCreators: 2, videoPerformance: 60, videoMomentum: null, adoption: 50, audienceInterest: 20, confidence: 70, creatorOpportunity: 60, momentum: 60, opportunity: 60, grade: 'developing', lifecycle: 'accelerating', growth: { basis: 'measured', ratio: 1.6, windowHours: 24, metric: 'creators' }, components: {}, notes: [], ...over });
const trend = (id: string, name: string, evidence: Observation[], over: Partial<Trend> = {}, w: Partial<WindowScores> = {}): Trend => {
  const s7 = win({ videos: evidence.length, directVideos: evidence.length, creators: new Set(evidence.map((e) => e.creator?.name)).size, ...w });
  return { id, kind: 'microtrend', name, category: 'Comedy', subcategory: 'Skits', format: name, platforms: ['youtube'], evidenceKinds: ['video'], firstDetected: h(60), lastSeen: NOW, evidenceCount: evidence.length, videoCount: evidence.length, directVideoCount: evidence.length, creatorCount: s7.creators, scores: s7, windows: { '24h': s7, '48h': s7, '7d': s7 }, evidence, keywords: [], series: [], isNewsEvent: false, isGeneric: false, qualified: true, monetizationSuitability: 70, summary: '', ...over };
};

test('formats: name shapes and descriptor tags', () => {
  assert.equal(nameShape('National Black Cat Day'), 'calendar');
  assert.equal(nameShape('from season 5'), 'fragment');
  assert.equal(nameShape('Siapa Yang'), 'fragment');
  assert.equal(nameShape('Kids Kids'), 'fragment');
  assert.equal(nameShape('#aianimation'), 'hashtag');
  assert.equal(nameShape('Mass Effect'), 'entity');
  assert.equal(nameShape('talking cat courtroom'), 'phrase');
  assert.equal(isDescriptorTag('#aianimation'), true);
  assert.equal(isDescriptorTag('#digitalart'), true);
  assert.equal(isDescriptorTag('#おもしろ'), true);
  assert.equal(isDescriptorTag('#huggywuggy'), false);
  assert.equal(isDescriptorTag('#iphoneduo'), false);
});

test('formats: event vs meme vs format vs uncertain from independent adoption, dominance, structure and boilerplate', () => {
  const now = NOW;
  // a repeatable format: 5 creators, same structure in the titles, no dominant video, spread over days
  const fmtEv = [
    vid('a1', 'POV: my cat runs the courtroom (part 1)', 900_000, 100, 'alice'), vid('b1', 'POV: my dog runs the courtroom', 400_000, 70, 'bob'),
    vid('c1', 'POV: the hamster runs the courtroom', 350_000, 50, 'carol'), vid('d1', 'POV: my parrot runs the courtroom #skit', 300_000, 30, 'dan'), vid('e1', 'POV: our goat runs the courtroom', 250_000, 10, 'eve'),
  ];
  const records = buildVideoRecords({ observations: fmtEv, metricHistory: new Map(), now });
  const byObs = new Map(records.map((r) => [r.id, r]));
  const tf = trend('m_courtroom', 'runs the courtroom', fmtEv);
  const f = trendFeatures(tf, byObs, now);
  assert.equal(f.creators, 5);
  assert.ok(f.dominance < 0.5);
  assert.ok(f.signature.includes('courtroom') && f.signature.includes('runs'));
  assert.ok(f.hooks.pov === 5);
  assert.equal(f.titleShare, 1);
  const cls = classifyOpportunity(tf, f);
  assert.equal(cls.type, 'format');
  tf.opportunity = cls;
  // one giant video + incidental others → event
  const evEv = [vid('g1', 'Angry grandpa kicks me out of my fishing spot', 20_000_000, 60, 'bird'), vid('g2', 'reacting to the grandpa fishing spot', 40_000, 20, 'x'), vid('g3', 'fishing spot grandpa explained', 30_000, 10, 'y')];
  const te = trend('m_grandpa', 'fishing spot', evEv);
  const ce = classifyOpportunity(te, trendFeatures(te, new Map(buildVideoRecords({ observations: evEv, metricHistory: new Map(), now }).map((r) => [r.id, r])), now));
  assert.equal(ce.type, 'event');
  assert.ok(ce.basis.some((b) => /one video is the whole story/.test(b)));
  te.opportunity = ce;
  // a phrase that lives only in descriptions is boilerplate → uncertain
  const boil = [vid('j1', 'My new setup tour', 300_000, 50, 'p', { text: 'join discord for more' }), vid('j2', 'Crazy goal', 200_000, 40, 'q', { text: 'join discord' }), vid('j3', 'Cooking rice', 150_000, 30, 'r', { text: 'join discord' }), vid('j4', 'Cat does a thing', 100_000, 20, 's', { text: 'join discord' })];
  const tb = trend('m_discord', 'Join Discord', boil);
  const cb = classifyOpportunity(tb, trendFeatures(tb, new Map(), now));
  assert.equal(cb.type, 'uncertain');
  assert.ok(cb.basis.some((b) => /description boilerplate/.test(b)));
  tb.opportunity = cb;
  // a news/sports moment covered by several creators is an event, not a meme
  const sport = [vid('s1', 'Harry Kane wins the Ballon d\'Or 🏅', 4_000_000, 20, 'u', { platformCategory: 'Sports' }), vid('s2', 'Ballon d\'Or winner reaction', 2_000_000, 18, 'v', { platformCategory: 'Sports' }), vid('s3', 'Kane Ballon d\'Or ceremony', 1_000_000, 16, 'w', { platformCategory: 'Sports' }), vid('s4', 'Kane crying after the award', 500_000, 12, 'z', { platformCategory: 'Sports' })];
  const ts = trend('m_kane', 'Harry Kane', sport, { category: 'Entertainment' });
  const cs = classifyOpportunity(ts, trendFeatures(ts, new Map(buildVideoRecords({ observations: sport, metricHistory: new Map(), now }).map((r) => [r.id, r])), now));
  assert.equal(cs.type, 'event');
  ts.opportunity = cs;
  // the desk: the format is actionable, the event is not
  const desk = buildDesk([tf, te, tb, ts], [...records], now);
  const names = desk.opportunities.map((o) => o.name);
  assert.ok(names.includes('runs the courtroom'));
  const op = desk.opportunities.find((o) => o.name === 'runs the courtroom')!;
  assert.equal(op.type, 'format');
  assert.ok(['create_today', 'research'].includes(op.action), op.action);
  assert.ok(op.evidence.length >= 4 && op.evidence[0].views! >= op.evidence[1].views!);
  assert.ok(op.monetization.eligibility.length >= 2 && op.monetization.platforms.includes('YouTube Shorts'));
  assert.ok(op.production.approach.length >= 1);
  assert.ok(!names.includes('Join Discord'));
  assert.ok(desk.excluded['no recognisable structure yet'] >= 1 || desk.excluded['generic tag or category'] >= 1);
  // alerts: format spreading needs ≥3 new creators; dedupe within 48h
  const spreading = { ...op, facts: { ...op.facts, newCreators48h: 3 }, action: 'create_today' as const };
  const a1 = buildAlerts({ records, desk: { ...desk, opportunities: [spreading] }, waves: [], crossings: [], history: [], now });
  assert.ok(a1.some((a) => a.kind === 'format_spreading' && /3 new independent creators/.test(a.evidence)));
  const a2 = buildAlerts({ records, desk: { ...desk, opportunities: [spreading] }, waves: [], crossings: [], history: a1, now: h(-1) });
  assert.equal(a2.filter((a) => a.kind === 'format_spreading').length, 1, 'no duplicate alert inside the 48h cooldown');
});
