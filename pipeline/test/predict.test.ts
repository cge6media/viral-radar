import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoRecords, earlyRadarList, hitFloorViews, measureVelocity } from '../src/intel/videos.js';
import { attachHistory, buildScorecard, detectCrossings, evaluatePredictions, selectPredictions } from '../src/intel/predict.js';
import { detectLanguage } from '../src/intel/language.js';
import type { Observation, OutcomeRecord, PredictionRecord } from '../src/types.js';

const T0 = '2026-10-28T06:00:00.000Z';
const at = (base: string, hours: number) => new Date(new Date(base).getTime() + hours * 36e5).toISOString();
const yt = (id: string, title: string, views: number, hoursOld: number, now: string, channel = 'chan'): Observation => ({
  id: `youtube:video:${id}`, source: 'youtube', kind: 'video', level: 'direct', key: `yt:${id}`, title, url: `https://www.youtube.com/shorts/${id}`,
  observedAt: now, verifiedAt: now, firstSeenAt: at(now, -Math.min(hoursOld, 10)), publishedAt: at(now, -hoursOld), videoPublishedAt: at(now, -hoursOld),
  metrics: { views, likes: Math.round(views * 0.03), comments: Math.round(views * 0.001) },
  video: { platform: 'youtube', id, durationSec: 30, channelId: `UC${channel}`, statsDirect: true }, creator: { name: channel, url: `https://www.youtube.com/channel/UC${channel}` },
});

test('4.0 hit floor is age-appropriate and monotonic; kinds separate established / early / delayed', () => {
  assert.equal(hitFloorViews(1), 1_000_000);
  assert.equal(hitFloorViews(24), 1_000_000);
  assert.equal(hitFloorViews(72), 2_000_000);
  assert.equal(hitFloorViews(168), 3_000_000);
  assert.equal(hitFloorViews(720), 5_000_000);
  assert.equal(hitFloorViews(5000), 5_000_000);
  assert.ok(hitFloorViews(48) > 1_000_000 && hitFloorViews(48) < 2_000_000, 'log-linear in between');
  const rising = yt('r1', 'Rising young video', 600_000, 30, T0); // below the ~1.1M floor at 30h
  const hist = new Map([[rising.id, [{ t: at(T0, -4), metrics: { views: 400_000 } }, { t: at(T0, -2), metrics: { views: 480_000 } }, { t: T0, metrics: { views: 600_000 } }]]]);
  const old = yt('o1', 'Old video resurfacing', 2_500_000, 24 * 20, T0); // 20 days: floor ≈ 4.2M → not a hit; lifetime 5.2K/h
  hist.set(old.id, [{ t: at(T0, -3), metrics: { views: 2_440_000 } }, { t: T0, metrics: { views: 2_500_000 } }]); // +20K/h = 3.8× lifetime
  const big = yt('b1', 'Already huge', 3_000_000, 30, T0);
  const recs = buildVideoRecords({ observations: [rising, old, big], metricHistory: hist, now: T0 });
  const by = Object.fromEntries(recs.map((r) => [r.platformId, r]));
  assert.equal(by.r1.state, 'early_breakout');
  assert.equal(by.r1.kind, 'early');
  assert.equal(by.r1.acceleration, 1.5, 'latest 60K/h ÷ previous 40K/h');
  assert.equal(by.o1.state, 'early_breakout');
  assert.equal(by.o1.kind, 'delayed');
  assert.ok(by.o1.reasons.some((x) => /resurfacing, not a new upload/.test(x)));
  assert.equal(by.b1.state, 'verified_hit');
  assert.equal(by.b1.kind, 'established');
  assert.ok(['high', 'medium', 'low'].includes(by.r1.confidenceBand));
  // acceleration is not claimed from counting noise
  const noisy = measureVelocity([{ t: at(T0, -4), metrics: { views: 10_000 } }, { t: at(T0, -2), metrics: { views: 10_300 } }, { t: T0, metrics: { views: 11_200 } }], T0, 'views');
  assert.equal(noisy.acceleration, undefined, 'intervals that gained < 1,000 views do not define acceleration');
});

test('4.0 language detection: scripts and stop-words, platform hint wins, unclear Latin stays unclear', () => {
  assert.equal(detectLanguage('When your glass breaks but the song is playing'), 'en');
  assert.equal(detectLanguage('El perro que no quería salir de la casa 😂'), 'es');
  assert.equal(detectLanguage('Diwali Ki Rat Do Logon Ki 3 Parchhaiyan Kaise Bni? देखो'), 'hi');
  assert.equal(detectLanguage('주인한테 이상한걸 배운 강아지 ㅋㅋ'), 'ko');
  assert.equal(detectLanguage('後ろにトラック来てる!!'), 'ja');
  assert.equal(detectLanguage('Masya Allah, siapa yang rindu Ramadhan? #ramadan'), 'id');
  assert.equal(detectLanguage('anything at all', 'es-MX'), 'es');
  assert.equal(detectLanguage('Lightning McQueen TOXIC ALIEN'), 'latin');
});

test('4.0 predictions are recorded before outcomes, frozen, deduplicated, and evaluated only from later observations', () => {
  const now = T0;
  const fast = yt('f1', 'Fast riser', 300_000, 20, now, 'small');
  const bigNonHit = yt('v1', 'Biggest non-hit', 900_000, 40, now);
  const hit = yt('h1', 'Already a hit', 6_000_000, 40, now);
  const hist = new Map([[fast.id, [{ t: at(now, -6), metrics: { views: 100_000 } }, { t: at(now, -3), metrics: { views: 180_000 } }, { t: now, metrics: { views: 300_000 } }]]]);
  const channels = new Map([['UCsmall', { subscribers: 5_000, medianRecentViews: 4_000 }]]);
  const records = buildVideoRecords({ observations: [fast, bigNonHit, hit], metricHistory: hist, channels, now });
  const radar = records.filter((r) => earlyRadarList(records).some((c) => c.id === r.id));
  const trendCreators = new Map([['trend:x', 3]]);
  records.find((r) => r.platformId === 'f1')!.trends = ['trend:x'];
  const preds = selectPredictions({ records, radar, open: [], trendCreators, now, runId: 'run1' });
  attachHistory(preds, hist, now);
  const radarPred = preds.find((p) => p.strategy === 'radar' && p.platformId === 'f1');
  assert.ok(radarPred, 'the measured breakout is predicted by the radar');
  assert.ok(!preds.some((p) => p.platformId === 'h1'), 'an established hit is never a prediction');
  assert.ok(preds.some((p) => p.strategy === 'views' && p.platformId === 'v1'), 'the views baseline picks the biggest non-hit');
  assert.ok(preds.some((p) => p.strategy === 'velocity' && p.platformId === 'f1'));
  assert.equal(radarPred!.views, 300_000);
  assert.equal(radarPred!.velocityPerHour, 40_000);
  assert.equal(radarPred!.history.length, 3, 'history frozen at prediction time');
  assert.equal(radarPred!.hitFloorAt['24'], hitFloorViews(44), 'the floor is frozen for the age the video will have at the horizon');
  assert.deepEqual(radarPred!.trends, [{ id: 'trend:x', creators: 3 }]);
  // the same run again → nothing new while the prediction is open
  const again = selectPredictions({ records, radar, open: preds, trendCreators, now: at(now, 1), runId: 'run2' });
  assert.equal(again.length, 0);

  // 10 hours later: nothing is due → no outcomes, everything pending
  const later = evaluatePredictions({ predictions: preds, outcomes: [], metricHistory: hist, records, channels, trendCreators, now: at(now, 10) });
  assert.equal(later.length, 0);

  // 25 hours later: an observation at +24.5h shows 1.4M views (floor at 44h ≈ 1.5M → not a hit; doubled with +1.1M gained → multiplied)
  const future = new Map(hist);
  future.set(fast.id, [...hist.get(fast.id)!, { t: at(now, 12), metrics: { views: 800_000 } }, { t: at(now, 24.5), metrics: { views: 1_400_000 } }]);
  const recs2 = records.map((r) => ({ ...r, ageHours: (r.ageHours || 0) + 25 }));
  const out = evaluatePredictions({ predictions: preds, outcomes: [], metricHistory: future, records: recs2, channels, trendCreators: new Map([['trend:x', 6]]), now: at(now, 25) });
  const o24 = out.find((o) => o.predictionId === radarPred!.id && o.horizon === 24)!;
  assert.ok(o24, 'the 24h horizon is evaluated');
  assert.equal(o24.observedAt, at(now, 24.5), 'the observation closest to the horizon is used');
  assert.equal(o24.reachedHit, false);
  assert.equal(o24.multiplied, true);
  assert.equal(o24.breakout, true);
  assert.equal(o24.accelerated, true, '+1.1M over 24.5h = 45K/h ≥ the 40K/h known at prediction');
  assert.equal(o24.formatSpread, true, 'the trend gained 3 creators');
  assert.equal(o24.outperformedCohort, null, 'no cohort of ≥20 comparable videos → not claimed');
  assert.ok(!out.some((o) => o.horizon === 48), '48h is still pending');
  // the views baseline's video was never re-observed: after 1.5× the horizon it is "unobserved", not a miss
  const unob = evaluatePredictions({ predictions: preds.filter((p) => p.platformId === 'v1'), outcomes: [], metricHistory: future, records: recs2, channels, trendCreators, now: at(now, 40) });
  assert.equal(unob.find((o) => o.horizon === 24)?.unobserved, true);
  // already-evaluated horizons are never re-evaluated
  const dup = evaluatePredictions({ predictions: preds, outcomes: out, metricHistory: future, records: recs2, channels, trendCreators, now: at(now, 25) });
  assert.ok(!dup.some((o) => o.predictionId === radarPred!.id && o.horizon === 24));

  // scorecard: pending counted as pending, precision null below 10 evaluations, baselines carried
  const card = buildScorecard(preds, out, [], at(now, 25));
  assert.equal(card.predictions, preds.length);
  assert.equal(card.precision['24'], null, 'no precision claim from fewer than 10 evaluated predictions');
  assert.ok(card.pending > 0);
  assert.equal(card.byStrategy.radar.horizons['24'].breakout, 1);
  assert.equal(card.recent.find((r) => r.id === radarPred!.id)!.status['24'], 'multiplied');
  assert.equal(card.recent.find((r) => r.id === radarPred!.id)!.status['168'], 'pending');
});

test('4.0 crossings: a video that crossed the hit floor while observable counts for recall, with lead time when predicted', () => {
  const now = at(T0, 30);
  const v = yt('c1', 'Crossed the floor', 1_600_000, 50, now);
  const hist = new Map([[v.id, [{ t: at(T0, -2), metrics: { views: 200_000 } }, { t: at(T0, 10), metrics: { views: 700_000 } }, { t: at(T0, 26), metrics: { views: 1_600_000 } }]]]);
  const records = buildVideoRecords({ observations: [v], metricHistory: hist, now });
  assert.equal(records[0].state, 'verified_hit');
  const pred: PredictionRecord = { id: 'p', runId: 'r', predictedAt: at(T0, 2), strategy: 'radar', rank: 1, videoId: v.id, platform: 'youtube', platformId: 'c1', url: v.url, title: v.title, breakoutScore: 60, viralScore: 40, confidence: 50, confidenceBand: 'medium', reasons: [], history: [], horizons: [24, 48, 72, 168], hitFloorAt: {}, trends: [] };
  const cross = detectCrossings(records, hist, [pred], new Set(), now, 'run');
  assert.equal(cross.length, 1);
  assert.equal(cross[0].crossedAt, at(T0, 26));
  assert.equal(cross[0].lastBelowAt, at(T0, 10), 'the crossing happened between the last below-floor tick and the first above-floor tick');
  assert.equal(cross[0].leadHours, 8, 'lead time is measured conservatively to the last below-floor observation');
  const other: PredictionRecord = { ...pred, id: 'q', videoId: 'youtube:video:other', platformId: 'other', predictedAt: at(T0, -1) };
  const none = detectCrossings(records, hist, [other], new Set(), now, 'run');
  assert.equal(none[0].predictedAt, undefined, 'a crossing without a prior prediction is a miss');
  assert.equal(detectCrossings(records, hist, [], new Set(), now, 'run').length, 0, 'before any prediction exists nothing can be missed');
  assert.equal(detectCrossings(records, hist, [{ ...other, predictedAt: at(T0, 27) }], new Set(), now, 'run').length, 0, 'crossings before the first prediction are not counted');
  assert.equal(detectCrossings(records, hist, [{ ...other, predictedAt: at(T0, 12) }], new Set(), now, 'run').length, 0, 'a video never observed below the floor after predictions started was not predictable');
  const card = buildScorecard([pred], [] as OutcomeRecord[], cross, now);
  assert.equal(card.crossings.observed, 1);
  assert.equal(card.crossings.recall, null, 'recall is not claimed from one crossing');
  assert.equal(card.leadTimeHours?.median, 8);
});

test('4.0 outcomes are never measured before the horizon; a later observation is preferred; metric-less ticks are ignored', () => {
  const now0 = T0;
  const v = yt('h1', 'Horizon test', 300_000, 20, now0, 'small');
  const hist = new Map<string, { t: string; metrics: { views?: number; likes?: number } }[]>([[v.id, [{ t: at(now0, -3), metrics: { views: 180_000 } }, { t: now0, metrics: { views: 300_000 } }]]]);
  const channels = new Map([['UCsmall', { subscribers: 5_000, medianRecentViews: 4_000 }]]);
  const records = buildVideoRecords({ observations: [v], metricHistory: hist, channels, now: now0 });
  const preds = selectPredictions({ records, radar: records, open: [], trendCreators: new Map(), now: now0, runId: 'r' }).filter((p) => p.strategy === 'radar');
  assert.equal(preds.length, 1);
  // 20.6h later with a tick at 20.5h showing 1.1M: NOT evaluated (the horizon has not elapsed)
  const h1 = new Map(hist); h1.set(v.id, [...hist.get(v.id)!, { t: at(now0, 20.5), metrics: { views: 1_100_000 } }]);
  assert.equal(evaluatePredictions({ predictions: preds, outcomes: [], metricHistory: h1, records, channels, trendCreators: new Map(), now: at(now0, 20.6) }).length, 0, 'pending until 24h have elapsed');
  // 24.2h later with ticks at 20.5h (1.1M) and 24.1h (1.6M, above the floor): the later one is used
  const h2 = new Map(h1); h2.set(v.id, [...h1.get(v.id)!, { t: at(now0, 24.1), metrics: { likes: 1 } }, { t: at(now0, 24.15), metrics: { views: 1_600_000 } }]);
  const out = evaluatePredictions({ predictions: preds, outcomes: [], metricHistory: h2, records, channels, trendCreators: new Map(), now: at(now0, 24.2) });
  const o = out.find((x) => x.horizon === 24)!;
  assert.ok(o, 'evaluated once the horizon elapsed');
  assert.equal(o.observedAt, at(now0, 24.15), 'first observation WITH the metric at or after the horizon');
  assert.equal(o.reachedHit, true);
  // 25h later with only a 20.5h tick: still pending (an observation may still arrive), then "stand-in" after 1.5H
  const out2 = evaluatePredictions({ predictions: preds, outcomes: [], metricHistory: h1, records, channels, trendCreators: new Map(), now: at(now0, 25) });
  assert.equal(out2.length, 0, 'no observation at/after the horizon yet → pending');
  const out3 = evaluatePredictions({ predictions: preds, outcomes: [], metricHistory: h1, records, channels, trendCreators: new Map(), now: at(now0, 37) });
  assert.equal(out3.find((x) => x.horizon === 24)?.observedAt, at(now0, 20.5), 'after 1.5H the closest point inside [0.85H, H) stands in');
});
