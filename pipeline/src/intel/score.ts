/**
 * Trend Momentum Engine — evidence-based scoring. Every number here is explained in SCORING.md.
 *
 * Scores (all 0-100):
 *   momentum      how fast attention is building (recency, growth, acceleration, breadth, level)
 *   confidence    how much verifiable evidence supports the trend
 *   monetization  how well the category/evidence converts to creator revenue
 *   creator       how attractive this is for an original creator to ride (base score; the web app
 *                 re-weights with the user's preferences)
 *
 * Growth is only called "observed" when ≥2 measurements exist (prior pipeline runs or source-supplied
 * history such as Mastodon's 7-day hashtag series). Otherwise the growth component is neutral and the
 * trend is flagged "provisional". No growth percentages are invented.
 */
import type { Lifecycle, Observation, Platform, ScoreBreakdown } from '../types.js';
import type { Cluster } from './cluster.js';
import { clamp, hoursBetween, logNorm, round } from '../lib/util.js';
import { profileFor } from './taxonomy.js';
import type { ScoreRecord } from '../lib/store.js';

export interface ScoreInput {
  cluster: Cluster;
  category: string;
  isNewsEvent: boolean;
  now: string;
  /** earlier score records for this cluster id (chronological) */
  history: ScoreRecord[];
}

/** Attention level 0..1 for a single observation, normalized per evidence kind. */
export function observationLevel(o: Observation): number {
  const m = o.metrics;
  switch (o.kind) {
    case 'search_interest':
      return logNorm(m.approxTraffic || 0, 100, 1_000_000);
    case 'hashtag':
      return Math.max(logNorm(m.uses || 0, 10, 5_000), logNorm(m.views || 0, 100_000, 1_000_000_000));
    case 'social_topic':
      return m.rank ? 0.35 + 0.45 * (1 - (m.rank - 1) / 25) : 0.4;
    case 'video':
      if (m.views != null) return logNorm(m.views, 10_000, 50_000_000);
      return logNorm((m.likes || 0) + 2 * (m.reposts || 0), 20, 5_000);
    case 'post':
      return 0.6 * logNorm((m.likes || 0) + 2 * (m.reposts || 0), 20, 5_000);
  }
}

/** Aggregate signal for the cluster (0..1): strongest item + breadth bonus. */
export function clusterSignal(members: Observation[]): number {
  if (!members.length) return 0;
  const levels = members.map(observationLevel).sort((a, b) => b - a);
  const top = levels[0];
  const breadth = logNorm(members.length, 1, 40) * 0.25;
  const second = levels[1] ? levels[1] * 0.15 : 0;
  return clamp(top + breadth + second, 0, 1);
}

/** Map a growth ratio (now/before) to 0..1 (1.0x → 0.5). */
function growthToScore(ratio: number): number {
  if (!isFinite(ratio) || ratio <= 0) return 0.5;
  // log2 scale: 0.25x → 0, 1x → 0.5, 4x → 1
  return clamp(0.5 + Math.log2(ratio) / 4, 0, 1);
}

/** Source-supplied history (e.g. Mastodon 7-day uses): latest day vs mean of previous non-zero days. */
function sourceHistoryGrowth(members: Observation[]): { ratio: number; windowHours: number } | undefined {
  const withHist = members.filter((m) => m.history && m.history.length >= 2);
  if (!withHist.length) return undefined;
  let best: { ratio: number; windowHours: number } | undefined;
  for (const m of withHist) {
    const h = [...m.history!].sort((a, b) => a.t.localeCompare(b.t));
    const latest = h[h.length - 1].value;
    const prev = h.slice(0, -1).map((p) => p.value);
    const prevMean = prev.reduce((a, b) => a + b, 0) / prev.length;
    const ratio = (latest + 1) / (prevMean + 1);
    const windowHours = hoursBetween(h[0].t, h[h.length - 1].t) || 24;
    if (!best || ratio > best.ratio) best = { ratio, windowHours };
  }
  return best;
}

export function scoreCluster(input: ScoreInput): { scores: ScoreBreakdown; lifecycle: Lifecycle; signal: number } {
  const { cluster, category, isNewsEvent, now, history } = input;
  const members = cluster.members;
  const notes: string[] = [];
  const components: Record<string, number> = {};

  const sources = new Set<Platform>(members.map((m) => m.source));
  const videos = members.filter((m) => m.kind === 'video');
  const signal = clusterSignal(members);

  // --- recency: how fresh is the latest evidence (24h half-life on observed; 48h on published) ---
  const lastSeen = members.map((m) => m.observedAt).sort().pop() || now;
  const latestPublished = members.map((m) => m.publishedAt).filter(Boolean).sort().pop();
  const hSeen = hoursBetween(lastSeen, now);
  const hPub = latestPublished ? hoursBetween(latestPublished, now) : 48;
  const recency = clamp(0.6 * Math.pow(0.5, hSeen / 24) + 0.4 * Math.pow(0.5, hPub / 48), 0, 1);
  components.recency = round(recency, 3);

  // --- growth: observed from run history, else from source-supplied series, else provisional ---
  let growth = 0.5;
  let accel = 0.5;
  let momentumBasis: ScoreBreakdown['momentumBasis'] = 'provisional';
  let growthRatio: number | undefined;
  let growthWindowHours: number | undefined;
  const past = history.filter((h) => hoursBetween(h.t, now) >= 2).sort((a, b) => a.t.localeCompare(b.t));
  if (past.length >= 1) {
    const prev = past[past.length - 1];
    growthRatio = (signal + 0.05) / (prev.signal + 0.05);
    growthWindowHours = round(hoursBetween(prev.t, now), 1);
    growth = growthToScore(growthRatio);
    momentumBasis = 'observed';
    notes.push(`Observed growth: signal ${round(prev.signal, 2)} → ${round(signal, 2)} over ${growthWindowHours}h (${round(growthRatio, 2)}x).`);
    if (past.length >= 2) {
      const prev2 = past[past.length - 2];
      const r1 = (prev.signal + 0.05) / (prev2.signal + 0.05);
      accel = clamp(0.5 + (Math.log2(growthRatio) - Math.log2(r1)) / 4, 0, 1);
    }
    // blend in source-supplied history (e.g. a 7-day hashtag series) — a longer window than run-to-run
    const sh = sourceHistoryGrowth(members);
    if (sh) {
      growth = clamp(0.6 * growth + 0.4 * growthToScore(sh.ratio), 0, 1);
      notes.push(`Source history: ${round(sh.ratio, 2)}x vs prior-day average over ${round(sh.windowHours, 0)}h (blended 40%).`);
    }
  } else {
    const sh = sourceHistoryGrowth(members);
    if (sh) {
      growthRatio = sh.ratio;
      growthWindowHours = round(sh.windowHours, 1);
      growth = growthToScore(sh.ratio);
      momentumBasis = 'observed';
      notes.push(`Observed growth from source history: ${round(sh.ratio, 2)}x vs prior-day average over ${growthWindowHours}h.`);
    } else {
      notes.push('No prior measurement yet — growth is provisional (neutral) until the next collection run.');
    }
  }
  components.growth = round(growth, 3);
  components.acceleration = round(accel, 3);

  // --- breadth: independent sources and number of supporting items ---
  const breadth = clamp(0.5 * (sources.size === 1 ? 0.3 : sources.size === 2 ? 0.7 : 1) + 0.5 * logNorm(members.length, 1, 30), 0, 1);
  components.breadth = round(breadth, 3);
  components.level = round(signal, 3);

  const momentum = clamp(100 * (0.25 * recency + 0.30 * growth + 0.10 * accel + 0.20 * breadth + 0.15 * signal));

  // --- confidence ---
  const creators = new Set(members.map((m) => m.creator?.name).filter(Boolean));
  const videoWithStats = videos.filter((v) => v.metrics.views != null || (v.metrics.likes || 0) > 0).length;
  const runsObserved = new Set(history.map((h) => h.runId)).size + 1;
  // source-supplied history points (e.g. Mastodon 7-day series) count as extra measurements
  const historyPoints = Math.max(0, ...members.map((m) => m.history?.length || 0));
  // hashtags carry "accounts" (distinct posters) — each 15 accounts ≈ one extra supporting item (cap 6)
  const support = members.length + Math.min(6, Math.max(0, ...members.map((m) => (m.metrics.accounts || 0) / 15)));
  const confidence = clamp(
    100 *
      (0.30 * logNorm(support, 1, 25) +
        0.25 * (sources.size === 1 ? 0.35 : sources.size === 2 ? 0.75 : 1) +
        0.25 * clamp(videoWithStats / 5, 0, 1) +
        0.10 * logNorm(creators.size + 1, 1, 15) +
        0.10 * logNorm(runsObserved + historyPoints, 1, 48)),
  );
  components.evidence = members.length;
  components.sources = sources.size;
  components.videosWithStats = videoWithStats;
  components.runsObserved = runsObserved;

  // --- monetization ---
  const p = profileFor(category);
  const hasYouTube = videos.some((v) => v.source === 'youtube' || /youtube\.com|youtu\.be/.test(v.url));
  let monetization =
    100 *
    (0.30 * p.advertiser + 0.20 * p.sponsorship + 0.15 * p.affiliate + 0.15 * p.longevity + 0.10 * p.demand + 0.10 * (1 - p.cost));
  if (hasYouTube) monetization += 5;
  if (isNewsEvent) {
    monetization *= 0.55;
    notes.push('Flagged as a news/person event: low repeatability and weak brand-safety → monetization and creator scores reduced.');
  }
  monetization = clamp(monetization);
  components.profile_advertiser = p.advertiser;
  components.profile_sponsorship = p.sponsorship;
  components.profile_affiliate = p.affiliate;
  components.profile_longevity = p.longevity;
  components.profile_cost = p.cost;

  // --- creator opportunity (base; preferences applied client-side) ---
  const saturation = clamp(signal >= 0.75 && growth <= 0.55 ? (signal - 0.75) * 4 : 0, 0, 1);
  components.saturation = round(saturation, 3);
  let creator = 100 * (0.35 * (momentum / 100) + 0.20 * p.repeatable + 0.15 * (1 - saturation) + 0.15 * (1 - p.cost) + 0.15 * (monetization / 100));
  if (isNewsEvent) creator *= 0.45;
  creator = clamp(creator);

  // --- lifecycle ---
  const firstSeen = members.map((m) => m.observedAt).sort()[0] || now;
  const firstPublished = members.map((m) => m.publishedAt).filter(Boolean).sort()[0];
  const ageHours = Math.max(hoursBetween(firstSeen, now), firstPublished ? Math.min(hoursBetween(firstPublished, now), 24 * 14) : 0);
  const lifecycle = decideLifecycle({ momentum, confidence, signal, growth, accel, basis: momentumBasis, ageHours, hSeen, evidence: members.length, sources: sources.size });

  // overall opportunity rank: rewards momentum + creator fit + monetization, discounted by confidence
  const opportunity = clamp((0.4 * momentum + 0.35 * creator + 0.25 * monetization) * (0.3 + 0.7 * (confidence / 100)));

  const scores: ScoreBreakdown = {
    opportunity: round(opportunity, 0),
    momentum: round(momentum, 0),
    confidence: round(confidence, 0),
    monetization: round(monetization, 0),
    creator: round(creator, 0),
    momentumBasis,
    growth: growthRatio != null ? round(growthRatio, 3) : undefined,
    growthWindowHours,
    components,
    notes,
  };
  return { scores, lifecycle, signal: round(signal, 4) };
}

export function decideLifecycle(x: {
  momentum: number; confidence: number; signal: number; growth: number; accel: number;
  basis: 'observed' | 'provisional'; ageHours: number; hSeen: number; evidence: number; sources: number;
}): Lifecycle {
  if (x.confidence < 20 || x.evidence < 2) return 'insufficient_data';
  if (x.hSeen > 36) return 'cooling';
  if (x.basis === 'observed') {
    if (x.growth < 0.42) return 'cooling';
    if (x.momentum >= 70 && x.sources >= 2 && x.growth >= 0.53) return 'breaking_out';
    if (x.growth >= 0.6 && x.accel >= 0.45) return 'accelerating';
    if (x.signal >= 0.65 && x.growth >= 0.42 && x.growth <= 0.6) return 'peaking';
    if (x.ageHours <= 48) return 'emerging';
    return 'peaking';
  }
  // provisional
  if (x.momentum >= 70 && x.sources >= 2) return 'breaking_out';
  if (x.ageHours <= 48 && x.momentum >= 40) return 'emerging';
  if (x.signal >= 0.65) return 'peaking';
  if (x.momentum >= 50) return 'accelerating';
  return 'emerging';
}
