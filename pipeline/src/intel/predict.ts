/**
 * Viral prediction scorecard (4.0) — forward-looking, no hindsight.
 *
 * Every run records what the radar is claiming *now* as immutable prediction records (append-only
 * data/predictions/predictions.ndjson): the Early Radar's top entries (strategy "radar") and two simple baselines
 * drawn from the same candidate pool — the biggest non-hit videos by views ("views") and the fastest by measured
 * velocity ("velocity"). Each record freezes everything known at prediction time (views, velocity, acceleration,
 * creator baseline, score, confidence, the observation history so far) and the age-appropriate hit floor the video
 * must reach at each horizon.
 *
 * Later runs evaluate each prediction once per horizon (24h / 48h / 72h / 7d) from the first observation at or
 * after the horizon (data/predictions/outcomes.ndjson). A horizon without an observation yet is PENDING, never a
 * success; a horizon whose window passed without any observation is UNOBSERVED and excluded from precision.
 * Criteria per outcome:
 *   reachedHit          views at the horizon ≥ the frozen age-appropriate hit floor
 *   multiplied          ≥ 2× the views at prediction AND ≥ 100K gained (small numbers cannot "double" into a win)
 *   accelerated         the average rate since prediction ≥ the rate known at prediction (velocity, else lifetime)
 *   outperformedCohort  the gain ranks in the top 10 % of tracked videos of comparable age over the same window
 *   creatorJump         channel subscribers grew ≥ 5 % (when both readings exist)
 *   formatSpread        a trend the video belonged to gained ≥ 2 independent creators (when it belonged to one)
 *   breakout (headline) reachedHit OR multiplied
 * The scorecard compares the radar's precision against the baselines at every horizon, reports detection lead time
 * for predictions that later crossed the hit floor, and recall against "observable crossings": videos that crossed
 * the floor while they were already in the index ≥ 6 h earlier (so a prediction was possible).
 */
import type { BreakoutKind, OutcomeRecord, PredictionHorizon, PredictionRecord, PredictionStrategy, ScorecardSummary, VideoRecord } from '../types.js';
import { PREDICTION_HORIZONS } from '../types.js';
import { hoursBetween, round } from '../lib/util.js';
import { hitFloorViews, VIEW_PLATFORMS } from './videos.js';
import type { MetricPoint } from './score.js';

export const PREDICTIONS_PER_STRATEGY = 20;
const OPEN_HOURS = 168 * 1.5; // a prediction stays "open" (no re-prediction of the same video/strategy) for 10.5 days
const TOLERANCE = { early: 0.85, late: 1.5 }; // accept the observation closest to the horizon inside [0.85H, 1.5H]

export interface CrossingRecord {
  videoId: string;
  platformId: string;
  title: string;
  crossedAt: string;
  floor: number;
  views: number;
  /** earliest observation while still below the floor (proves it was observable before crossing) */
  observableSince: string;
  predictedAt?: string;
  leadHours?: number;
  runId: string;
}

const strategyPool = (records: VideoRecord[]) => records.filter((r) => VIEW_PLATFORMS.has(r.platform) && r.verified && r.metrics.views != null && r.ageHours != null && r.state !== 'verified_hit' && !r.isLive && r.rejectedBy !== 'engagement far below organic levels (likely paid promotion)');

/** Build this run's prediction records (one per video × strategy), skipping videos with an open prediction. */
export function selectPredictions(opts: { records: VideoRecord[]; radar: VideoRecord[]; open: PredictionRecord[]; trendCreators: Map<string, number>; now: string; runId: string }): PredictionRecord[] {
  const { records, radar, open, trendCreators, now, runId } = opts;
  const openKeys = new Set(open.filter((p) => hoursBetween(p.predictedAt, now) <= OPEN_HOURS).map((p) => `${p.strategy}:${p.videoId}`));
  const pool = strategyPool(records);
  const sets: Record<PredictionStrategy, VideoRecord[]> = {
    radar: radar.filter((r) => VIEW_PLATFORMS.has(r.platform) && r.state === 'early_breakout').slice(0, PREDICTIONS_PER_STRATEGY),
    views: pool.filter((r) => (r.ageHours ?? Infinity) <= 72).sort((a, b) => (b.metrics.views || 0) - (a.metrics.views || 0)).slice(0, PREDICTIONS_PER_STRATEGY),
    velocity: pool.filter((r) => r.velocity?.[0] && r.velocity[0].hours >= 1 && (r.ageHours ?? Infinity) <= 168).sort((a, b) => (b.velocity![0].perHour || 0) - (a.velocity![0].perHour || 0)).slice(0, PREDICTIONS_PER_STRATEGY),
  };
  const out: PredictionRecord[] = [];
  for (const strategy of Object.keys(sets) as PredictionStrategy[]) {
    sets[strategy].forEach((r, i) => {
      const key = `${strategy}:${r.id}`;
      if (openKeys.has(key)) return;
      openKeys.add(key);
      out.push(toPrediction(r, strategy, i + 1, now, runId, trendCreators));
    });
  }
  return out;
}

function toPrediction(r: VideoRecord, strategy: PredictionStrategy, rank: number, now: string, runId: string, trendCreators: Map<string, number>): PredictionRecord {
  const v = r.velocity?.[0];
  const hitFloorAt: Record<string, number> = {};
  for (const h of PREDICTION_HORIZONS) hitFloorAt[String(h)] = hitFloorViews((r.ageHours ?? 0) + h);
  return {
    id: `${runId}:${strategy}:${r.platformId}`, runId, predictedAt: now, strategy, rank,
    videoId: r.id, platform: r.platform, platformId: r.platformId, url: r.url, title: r.title.slice(0, 120), creator: r.creator?.name, channelId: r.creator?.channelId, subscribers: r.creator?.subscribers,
    ageHours: r.ageHours, views: r.metrics.views, likes: r.metrics.likes, lifetimeRate: r.lifetimeRate,
    velocityPerHour: v?.perHour, velocityHours: v?.hours, acceleration: r.acceleration, baselineRatio: r.baselineRatio, subscriberRatio: r.subscriberRatio,
    breakoutScore: r.breakoutScore, viralScore: r.viralScore, confidence: r.confidence, confidenceBand: r.confidenceBand, kind: r.kind,
    reasons: r.reasons.slice(0, 4),
    history: [], // filled by the caller from the metric history (points ≤ now only)
    horizons: [...PREDICTION_HORIZONS], hitFloorAt,
    trends: r.trends.slice(0, 6).map((id) => ({ id, creators: trendCreators.get(id) || 0 })),
  };
}

/** attach the observation history known at prediction time (never a point after `now`) */
export function attachHistory(preds: PredictionRecord[], metricHistory: Map<string, MetricPoint[]>, now: string): void {
  for (const p of preds) {
    const pts = (metricHistory.get(p.videoId) || []).filter((x) => x.t <= now);
    p.history = pts.slice(-8).map((x) => ({ t: x.t, views: x.metrics.views, likes: x.metrics.likes }));
  }
}

function pointAt(points: MetricPoint[], atIso: string, horizonHours: number): MetricPoint | undefined {
  const at = new Date(atIso).getTime();
  const lo = at + horizonHours * 36e5 * TOLERANCE.early, hi = at + horizonHours * 36e5 * TOLERANCE.late;
  let best: MetricPoint | undefined;
  for (const p of points) {
    const t = new Date(p.t).getTime();
    if (t < lo || t > hi) continue;
    if (!best || Math.abs(t - (at + horizonHours * 36e5)) < Math.abs(new Date(best.t).getTime() - (at + horizonHours * 36e5))) best = p;
  }
  return best;
}
function nearest(points: MetricPoint[], atIso: string, maxHours: number): MetricPoint | undefined {
  const at = new Date(atIso).getTime();
  let best: MetricPoint | undefined;
  for (const p of points) {
    const d = Math.abs(new Date(p.t).getTime() - at);
    if (d > maxHours * 36e5) continue;
    if (!best || d < Math.abs(new Date(best.t).getTime() - at)) best = p;
  }
  return best;
}

export interface EvalInput {
  predictions: PredictionRecord[];
  outcomes: OutcomeRecord[];
  metricHistory: Map<string, MetricPoint[]>;
  records: VideoRecord[];
  channels?: Map<string, { subscribers?: number }>;
  trendCreators: Map<string, number>;
  now: string;
}

/** Evaluate every (prediction, horizon) that is due and not yet evaluated. Returns the new outcome rows. */
export function evaluatePredictions(input: EvalInput): OutcomeRecord[] {
  const { predictions, outcomes, metricHistory, records, channels, trendCreators, now } = input;
  const done = new Set(outcomes.map((o) => `${o.predictionId}:${o.horizon}`));
  const byId = new Map(records.map((r) => [r.id, r]));
  const out: OutcomeRecord[] = [];
  // cohort index: for each horizon we need gains of comparable videos over [predictedAt, predictedAt + H]
  for (const p of predictions) {
    const pts = metricHistory.get(p.videoId) || [];
    const metric: 'views' | 'likes' = p.views != null ? 'views' : 'likes';
    const base = p[metric];
    for (const h of p.horizons) {
      const key = `${p.id}:${h}`;
      if (done.has(key)) continue;
      const elapsed = hoursBetween(p.predictedAt, now);
      if (elapsed < h * TOLERANCE.early) continue; // not due yet → pending
      const obs = pointAt(pts, p.predictedAt, h);
      if (!obs) {
        if (elapsed < h * TOLERANCE.late) continue; // still pending: an observation may still arrive inside the tolerance window
        out.push({ predictionId: p.id, horizon: h, evaluatedAt: now, observedAt: '', observedHours: 0, reachedHit: false, multiplied: false, accelerated: null, outperformedCohort: null, cohortSize: 0, creatorJump: null, formatSpread: null, breakout: false, unobserved: true } as OutcomeRecord);
        continue;
      }
      const value = obs.metrics[metric];
      const observedHours = round(hoursBetween(p.predictedAt, obs.t), 1);
      const gained = value != null && base != null ? Math.max(0, value - base) : undefined;
      const floor = p.platform === 'bluesky' ? 5_000 : p.hitFloorAt[String(h)] ?? hitFloorViews((p.ageHours ?? 0) + h);
      const reachedHit = value != null && value >= floor;
      const multiplied = value != null && base != null && value >= 2 * base && (gained || 0) >= (p.platform === 'bluesky' ? 1_000 : 100_000);
      const rate0 = p.velocityPerHour ?? p.lifetimeRate;
      const accelerated = rate0 != null && gained != null && observedHours > 0 ? gained / observedHours >= rate0 : null;
      // cohort: tracked videos of comparable age (½× … 2×) with observations near both ends of the same window
      let cohortSize = 0, better = 0;
      if (gained != null && p.ageHours != null) {
        for (const r of records) {
          if (r.id === p.videoId || r.platform !== p.platform || !r.verified) continue;
          const ageThen = (r.ageHours ?? NaN) - hoursBetween(p.predictedAt, now);
          if (!(ageThen >= p.ageHours * 0.5 && ageThen <= p.ageHours * 2)) continue;
          const rp = metricHistory.get(r.id);
          if (!rp || rp.length < 2) continue;
          const a = nearest(rp, p.predictedAt, Math.max(3, h * 0.15));
          const b = pointAt(rp, p.predictedAt, h);
          if (!a || !b || a === b) continue;
          const g = Math.max(0, (b.metrics[metric] || 0) - (a.metrics[metric] || 0));
          cohortSize++;
          if (g > gained) better++;
        }
      }
      const outperformedCohort = cohortSize >= 20 ? better / cohortSize <= 0.1 : null;
      const subsNow = p.channelId ? channels?.get(p.channelId)?.subscribers : undefined;
      const creatorJump = p.subscribers && subsNow ? subsNow >= p.subscribers * 1.05 : null;
      const spread = p.trends.length ? p.trends.some((t) => (trendCreators.get(t.id) || 0) >= t.creators + 2) : null;
      void byId;
      out.push({ predictionId: p.id, horizon: h, evaluatedAt: now, observedAt: obs.t, observedHours, views: metric === 'views' ? value : undefined, likes: metric === 'likes' ? value : obs.metrics.likes, gained, reachedHit, multiplied, accelerated, outperformedCohort, cohortSize, creatorJump, formatSpread: spread, breakout: reachedHit || multiplied });
    }
  }
  return out;
}

/** Videos that crossed the hit floor while already in the index ≥ 6 h earlier — the recall denominator. */
export function detectCrossings(records: VideoRecord[], metricHistory: Map<string, MetricPoint[]>, predictions: PredictionRecord[], known: Set<string>, now: string, runId: string): CrossingRecord[] {
  const radarByVideo = new Map<string, PredictionRecord[]>();
  for (const p of predictions) if (p.strategy === 'radar') (radarByVideo.get(p.videoId) || radarByVideo.set(p.videoId, []).get(p.videoId)!).push(p);
  const out: CrossingRecord[] = [];
  for (const r of records) {
    if (!VIEW_PLATFORMS.has(r.platform) || r.state !== 'verified_hit' || known.has(r.id) || r.publishedAt == null) continue;
    const pts = (metricHistory.get(r.id) || []).filter((p) => p.metrics.views != null);
    if (pts.length < 2) continue;
    let crossed: MetricPoint | undefined, lastBelow: MetricPoint | undefined;
    for (const p of pts) {
      const age = hoursBetween(r.publishedAt, p.t);
      if (p.metrics.views! >= hitFloorViews(age)) { crossed = p; break; }
      lastBelow = p;
    }
    if (!crossed || !lastBelow) continue;
    const firstBelow = pts[0];
    if (hoursBetween(firstBelow.t, crossed.t) < 6) continue; // not observable long enough before crossing
    const preds = (radarByVideo.get(r.id) || []).filter((p) => p.predictedAt < crossed!.t).sort((a, b) => a.predictedAt.localeCompare(b.predictedAt));
    const first = preds[0];
    out.push({ videoId: r.id, platformId: r.platformId, title: r.title.slice(0, 100), crossedAt: crossed.t, floor: hitFloorViews(hoursBetween(r.publishedAt, crossed.t)), views: crossed.metrics.views!, observableSince: firstBelow.t, predictedAt: first?.predictedAt, leadHours: first ? round(hoursBetween(first.predictedAt, crossed.t), 1) : undefined, runId });
  }
  return out;
}

export interface Scorecard extends ScorecardSummary {
  byStrategy: Record<PredictionStrategy, { predictions: number; horizons: Record<string, { evaluated: number; pending: number; unobserved: number; reachedHit: number; multiplied: number; accelerated: number; acceleratedN: number; outperformed: number; outperformedN: number; creatorJump: number; creatorJumpN: number; formatSpread: number; formatSpreadN: number; breakout: number; precision: number | null }> }>;
  calibration: { band: string; n: number; breakout48: number | null }[];
  byKind: Record<string, { predictions: number; evaluated48: number; breakout48: number }>;
  leadTimes: number[];
  recent: { id: string; title: string; url: string; platformId: string; strategy: PredictionStrategy; predictedAt: string; views?: number; velocityPerHour?: number; breakoutScore: number; confidenceBand: string; kind?: BreakoutKind; status: Record<string, 'pending' | 'unobserved' | 'hit' | 'multiplied' | 'miss'> }[];
  crossingsRecent: CrossingRecord[];
}

export function buildScorecard(predictions: PredictionRecord[], outcomes: OutcomeRecord[], crossings: CrossingRecord[], now: string): Scorecard {
  const outByPred = new Map<string, OutcomeRecord[]>();
  for (const o of outcomes) (outByPred.get(o.predictionId) || outByPred.set(o.predictionId, []).get(o.predictionId)!).push(o);
  const strategies: PredictionStrategy[] = ['radar', 'views', 'velocity'];
  const byStrategy = {} as Scorecard['byStrategy'];
  for (const s of strategies) {
    const preds = predictions.filter((p) => p.strategy === s);
    const horizons: Scorecard['byStrategy'][PredictionStrategy]['horizons'] = {};
    for (const h of PREDICTION_HORIZONS) {
      const cell = { evaluated: 0, pending: 0, unobserved: 0, reachedHit: 0, multiplied: 0, accelerated: 0, acceleratedN: 0, outperformed: 0, outperformedN: 0, creatorJump: 0, creatorJumpN: 0, formatSpread: 0, formatSpreadN: 0, breakout: 0, precision: null as number | null };
      for (const p of preds) {
        const o = (outByPred.get(p.id) || []).find((x) => x.horizon === h);
        if (!o) { cell.pending++; continue; }
        if ((o as OutcomeRecord & { unobserved?: boolean }).unobserved) { cell.unobserved++; continue; }
        cell.evaluated++;
        if (o.reachedHit) cell.reachedHit++;
        if (o.multiplied) cell.multiplied++;
        if (o.accelerated != null) { cell.acceleratedN++; if (o.accelerated) cell.accelerated++; }
        if (o.outperformedCohort != null) { cell.outperformedN++; if (o.outperformedCohort) cell.outperformed++; }
        if (o.creatorJump != null) { cell.creatorJumpN++; if (o.creatorJump) cell.creatorJump++; }
        if (o.formatSpread != null) { cell.formatSpreadN++; if (o.formatSpread) cell.formatSpread++; }
        if (o.breakout) cell.breakout++;
      }
      cell.precision = cell.evaluated >= 10 ? round(cell.breakout / cell.evaluated, 3) : null;
      horizons[String(h)] = cell;
    }
    byStrategy[s] = { predictions: preds.length, horizons };
  }
  const precision: Record<string, number | null> = {};
  const baselines = {} as ScorecardSummary['baselines'];
  for (const s of strategies) {
    baselines[s] = {};
    for (const h of PREDICTION_HORIZONS) baselines[s][String(h)] = byStrategy[s].horizons[String(h)].precision;
  }
  for (const h of PREDICTION_HORIZONS) precision[String(h)] = byStrategy.radar.horizons[String(h)].precision;
  // calibration: empirical 48h breakout rate by breakout-score band (radar only), shown only with n ≥ 20
  const bands: [string, number, number][] = [['≤50', 0, 50], ['51–65', 51, 65], ['66–80', 66, 80], ['81+', 81, 101]];
  const calibration = bands.map(([band, lo, hi]) => {
    const ps = predictions.filter((p) => p.strategy === 'radar' && p.breakoutScore >= lo && p.breakoutScore <= hi);
    const os = ps.map((p) => (outByPred.get(p.id) || []).find((o) => o.horizon === 48)).filter((o): o is OutcomeRecord => !!o && !(o as OutcomeRecord & { unobserved?: boolean }).unobserved);
    return { band, n: os.length, breakout48: os.length >= 20 ? round(os.filter((o) => o.breakout).length / os.length, 3) : null };
  });
  const byKind: Scorecard['byKind'] = {};
  for (const p of predictions.filter((x) => x.strategy === 'radar')) {
    const k = p.kind || 'unknown';
    const cell = byKind[k] || (byKind[k] = { predictions: 0, evaluated48: 0, breakout48: 0 });
    cell.predictions++;
    const o = (outByPred.get(p.id) || []).find((x) => x.horizon === 48);
    if (o && !(o as OutcomeRecord & { unobserved?: boolean }).unobserved) { cell.evaluated48++; if (o.breakout) cell.breakout48++; }
  }
  const leadTimes = crossings.map((c) => c.leadHours).filter((x): x is number => x != null).sort((a, b) => a - b);
  const observable = crossings.length;
  const predictedBefore = crossings.filter((c) => c.predictedAt).length;
  const evaluatedTotal = outcomes.filter((o) => !(o as OutcomeRecord & { unobserved?: boolean }).unobserved).length;
  const pendingTotal = predictions.reduce((a, p) => a + p.horizons.filter((h) => !(outByPred.get(p.id) || []).some((o) => o.horizon === h)).length, 0);
  const recent = predictions.slice(-60).reverse().map((p) => {
    const status: Record<string, 'pending' | 'unobserved' | 'hit' | 'multiplied' | 'miss'> = {};
    for (const h of p.horizons) {
      const o = (outByPred.get(p.id) || []).find((x) => x.horizon === h);
      status[String(h)] = !o ? 'pending' : (o as OutcomeRecord & { unobserved?: boolean }).unobserved ? 'unobserved' : o.reachedHit ? 'hit' : o.multiplied ? 'multiplied' : 'miss';
    }
    return { id: p.id, title: p.title, url: p.url, platformId: p.platformId, strategy: p.strategy, predictedAt: p.predictedAt, views: p.views, velocityPerHour: p.velocityPerHour, breakoutScore: p.breakoutScore, confidenceBand: p.confidenceBand, kind: p.kind, status };
  });
  return {
    generatedAt: now,
    predictions: predictions.length, pending: pendingTotal, evaluated: evaluatedTotal,
    precision, baselines,
    leadTimeHours: leadTimes.length ? { median: leadTimes[Math.floor(leadTimes.length / 2)], n: leadTimes.length } : undefined,
    crossings: { observed: observable, predictedBefore, missed: observable - predictedBefore, recall: observable >= 10 ? round(predictedBefore / observable, 3) : null },
    unobserved: outcomes.length - evaluatedTotal,
    firstPredictionAt: predictions[0]?.predictedAt,
    byStrategy, calibration, byKind, leadTimes: leadTimes.slice(0, 200),
    recent, crossingsRecent: crossings.slice(-40).reverse(),
  };
}

export function summaryOf(s: Scorecard): ScorecardSummary {
  const { generatedAt, predictions, pending, evaluated, precision, baselines, leadTimeHours, crossings, unobserved, firstPredictionAt } = s;
  return { generatedAt, predictions, pending, evaluated, precision, baselines, leadTimeHours, crossings, unobserved, firstPredictionAt };
}
