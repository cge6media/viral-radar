/**
 * Trend scoring v2 — evidence-based, per time window. Every number is explained in docs/SCORING.md.
 *
 * Separated components (all 0-100, null when the underlying measurement does not exist):
 *   videoPerformance  measured views/engagement on the video platform, age-normalized (views per hour since publish)
 *   videoMomentum     measured change of the SAME videos' statistics across our observations (velocity vs. average)
 *   adoption          independent creators producing genuinely similar videos inside the window
 *   audienceInterest  supporting searches / hashtags / discussion
 *   confidence        reliability & independence of the evidence
 *   creatorOpportunity usefulness for producing original content
 * plus composite `momentum` / `opportunity` for ordering, an evidence grade and a lifecycle stage.
 *
 * Nothing is invented: growth is "measured" only from ≥2 observations ≥2h apart (or a source-supplied daily
 * series); otherwise it is marked provisional and the growth component is neutral.
 */
import type { EvidenceGrade, Lifecycle, Observation, Platform, Window, WindowScores } from '../types.js';
import { WINDOW_HOURS } from '../types.js';
import { clamp, hoursBetween, logNorm, nowIso, round } from '../lib/util.js';
import type { Cluster } from './cluster.js';
import { creatorKey, exampleKey, independentCreators } from './cluster.js';
import { profileFor } from './taxonomy.js';
import type { ScoreRecord } from '../lib/store.js';

export interface MetricPoint { t: string; metrics: Observation['metrics'] }

export interface ScoreInput {
  /** active-source signature of this run; growth baselines must come from runs with the same signature */
  sourceSignature?: string;
  cluster: Cluster;
  category: string;
  isNewsEvent: boolean;
  isGeneric: boolean;
  now: string;
  window: Window;
  /** earlier score records for this cluster id (chronological) */
  history: ScoreRecord[];
  /** metric history per observation id (for velocity) */
  metricHistory: Map<string, MetricPoint[]>;
}

/** Content time used for window membership and age. */
export function contentTime(o: Observation): string | undefined {
  return o.publishedAt || o.postPublishedAt || (o.kind !== 'video' ? o.observedAt : undefined);
}

export function inWindow(o: Observation, window: Window, now: string): boolean {
  const t = contentTime(o) || o.firstSeenAt || o.observedAt;
  return hoursBetween(t, now) <= WINDOW_HOURS[window] && new Date(t).getTime() <= new Date(now).getTime() + 3600e3;
}

/** Age-normalized performance of one direct video, 0..1. */
export function videoRate(o: Observation, now: string): { rate: number; metric: 'views' | 'engagement'; perHour: number } | undefined {
  if (o.kind !== 'video' || o.level !== 'direct') return undefined;
  const pub = o.videoPublishedAt || o.publishedAt;
  if (!pub) return undefined;
  const hours = Math.max(1, hoursBetween(pub, o.observedAt || now));
  if (o.metrics.views != null) {
    const perHour = o.metrics.views / hours;
    return { rate: logNorm(perHour, 50, 100_000), metric: 'views', perHour };
  }
  const eng = (o.metrics.likes || 0) + 2 * (o.metrics.reposts || 0) + (o.metrics.comments || 0);
  if (!eng) return undefined;
  const perHour = eng / hours;
  return { rate: logNorm(perHour, 0.5, 300), metric: 'engagement', perHour };
}

/** Indirect attention of a non-video item (or of the post carrying an external video), 0..1. */
export function interestLevel(o: Observation): number {
  const m = o.metrics;
  switch (o.kind) {
    case 'search_interest': return logNorm(m.approxTraffic || 0, 100, 1_000_000);
    case 'hashtag': return Math.max(logNorm(m.uses || 0, 10, 5_000), logNorm(m.views || 0, 100_000, 1_000_000_000));
    case 'social_topic': return m.rank ? clamp(0.35 + 0.45 * (1 - (m.rank - 1) / 25), 0.2, 0.8) : 0.4;
    case 'post': return 0.6 * logNorm((m.likes || 0) + 2 * (m.reposts || 0), 20, 5_000);
    case 'video': {
      const pm = o.postMetrics;
      return pm ? 0.5 * logNorm((pm.likes || 0) + 2 * (pm.reposts || 0) + 20 * ((pm.accounts || 1) - 1), 20, 5_000) : 0;
    }
  }
}

/** Velocity of one video from its metric history: current rate vs. its lifetime average (1 = steady). */
export function videoVelocity(o: Observation, points: MetricPoint[] | undefined, now: string): { perHour: number; ratio: number; metric: 'views' | 'likes' } | undefined {
  if (!points || points.length < 2) return undefined;
  const key: 'views' | 'likes' = points[points.length - 1].metrics.views != null ? 'views' : 'likes';
  const pts = points.filter((p) => p.metrics[key] != null);
  if (pts.length < 2) return undefined;
  const last = pts[pts.length - 1];
  let prev = pts[pts.length - 2];
  for (let i = pts.length - 2; i >= 0; i--) {
    prev = pts[i];
    if (hoursBetween(prev.t, last.t) >= 1) break;
  }
  const dh = hoursBetween(prev.t, last.t);
  if (dh < 1) return undefined;
  const dv = (last.metrics[key] || 0) - (prev.metrics[key] || 0);
  const perHour = Math.max(0, dv / dh);
  const pub = o.videoPublishedAt || o.publishedAt;
  const lifetimeHours = pub ? Math.max(1, hoursBetween(pub, last.t)) : undefined;
  const avg = lifetimeHours ? (last.metrics[key] || 0) / lifetimeHours : undefined;
  const ratio = avg && avg > 0 ? perHour / avg : perHour > 0 ? 1 : 0;
  void now;
  return { perHour, ratio, metric: key };
}

export function ratioToScore(ratio: number): number {
  if (!isFinite(ratio) || ratio <= 0) return 0;
  return clamp(0.5 + Math.log2(ratio) / 4, 0, 1);
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Source-supplied daily series (Mastodon): last complete day vs. earlier complete days. */
export function sourceHistoryGrowth(members: Observation[], now = nowIso()): { ratio: number; windowHours: number } | undefined {
  const withHist = members.filter((m) => m.history && m.history.length >= 3);
  if (!withHist.length) return undefined;
  const nowMs = new Date(now).getTime();
  let best: { ratio: number; windowHours: number } | undefined;
  for (const m of withHist) {
    const h = [...m.history!].sort((a, b) => a.t.localeCompare(b.t));
    const last = h[h.length - 1];
    const bucketMs = h.length >= 2 ? Math.max(36e5, new Date(h[1].t).getTime() - new Date(h[0].t).getTime()) : 864e5;
    const elapsed = nowMs - new Date(last.t).getTime();
    const lastIsPartial = elapsed >= 0 && elapsed < bucketMs;
    const complete = lastIsPartial ? h.slice(0, -1) : h;
    if (complete.length < 2) continue;
    let latest = complete[complete.length - 1].value;
    const earlier = complete.slice(0, -1).map((p) => p.value);
    if (lastIsPartial && elapsed >= 8 * 36e5) latest = Math.max(latest, last.value * (bucketMs / elapsed));
    const prevMean = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    const ratio = (latest + 1) / (prevMean + 1);
    const windowHours = hoursBetween(complete[0].t, complete[complete.length - 1].t) || 24;
    if (!best || ratio > best.ratio) best = { ratio, windowHours };
  }
  return best;
}

export function scoreWindow(input: ScoreInput): WindowScores {
  const { cluster, category, isNewsEvent, isGeneric, now, window, history, metricHistory, sourceSignature } = input;
  const notes: string[] = [];
  const components: Record<string, number> = {};
  const members = cluster.members.filter((m) => inWindow(m, window, now));
  const videos = uniqByExample(members.filter((m) => m.kind === 'video'));
  const direct = videos.filter((v) => v.level === 'direct');
  const creators = independentCreators(videos.length ? videos : members.filter((m) => m.kind === 'post'));
  const sources = new Set<Platform>(members.map((m) => m.source));
  const whours = WINDOW_HOURS[window];

  // "new" creators and the cluster's age are properties of the whole cluster, not of the window being viewed —
  // otherwise every creator looks new and every trend looks emerging in the 24h view
  const allVideos = uniqByExample(cluster.members.filter((m) => m.kind === 'video'));
  const firstByCreator = new Map<string, string>();
  for (const v of allVideos) {
    const ck = creatorKey(v);
    const t = contentTime(v) || v.firstSeenAt || v.observedAt;
    if (!firstByCreator.has(ck) || t < firstByCreator.get(ck)!) firstByCreator.set(ck, t);
  }
  const windowCreatorKeys = new Set(videos.map(creatorKey));
  const newCreators = [...firstByCreator].filter(([ck, t]) => windowCreatorKeys.has(ck) && hoursBetween(t, now) <= Math.min(48, whours)).length;

  // --- video performance (direct only, age-normalized) ---
  let videoPerformance: number | null = null;
  const rates = direct.map((v) => videoRate(v, now)).filter((r): r is NonNullable<typeof r> => !!r);
  if (rates.length) {
    const rs = rates.map((r) => r.rate).sort((a, b) => b - a);
    videoPerformance = round(100 * clamp(0.7 * rs[0] + 0.3 * median(rs), 0, 1), 0);
    const top = rates.reduce((a, b) => (b.perHour > a.perHour ? b : a));
    components.topPerHour = round(top.perHour, 1);
    components.topIsViews = top.metric === 'views' ? 1 : 0;
    notes.push(`${direct.length} directly measured video${direct.length > 1 ? 's' : ''}; the strongest runs at ${fmt(top.perHour)} ${top.metric === 'views' ? 'views' : 'engagements'}/hour since publish.`);
  }

  // --- video momentum (same videos across observations) ---
  let videoMomentum: number | null = null;
  const vels = direct.map((v) => videoVelocity(v, metricHistory.get(v.id), now)).filter((x): x is NonNullable<typeof x> => !!x);
  let velocity: WindowScores['velocity'];
  if (vels.length) {
    const ratios = vels.map((x) => x.ratio);
    videoMomentum = round(100 * ratioToScore(median(ratios)), 0);
    const views = vels.filter((x) => x.metric === 'views').map((x) => x.perHour);
    const likes = vels.filter((x) => x.metric === 'likes').map((x) => x.perHour);
    velocity = { viewsPerHour: views.length ? round(median(views), 1) : undefined, likesPerHour: likes.length ? round(median(likes), 2) : undefined, videosMeasured: vels.length };
    notes.push(`Velocity measured on ${vels.length} video${vels.length > 1 ? 's' : ''}: the current rate is ${round(median(ratios), 2)}× the lifetime average.`);
  }

  // --- adoption ---
  const adoption = round(100 * clamp(0.75 * logNorm(creators, 1, 12) + 0.25 * clamp(newCreators / 4, 0, 1), 0, 1), 0);
  components.creators = creators;
  components.newCreators = newCreators;

  // --- audience interest ---
  const interest = members.filter((m) => m.kind !== 'video' || m.level === 'indirect').map(interestLevel).sort((a, b) => b - a);
  const audienceInterest = round(100 * clamp((interest[0] || 0) + 0.15 * (interest[1] || 0) + 0.1 * logNorm(interest.length, 1, 30), 0, 1), 0);

  // --- confidence ---
  const runsObserved = new Set(history.map((h) => h.runId)).size + 1;
  const historySpanHours = history.length ? hoursBetween(history.map((h) => h.t).sort()[0], now) : 0;
  components.historySpanHours = round(historySpanHours, 1);
  const historyPoints = Math.max(0, ...members.map((m) => m.history?.length || 0));
  const verifiedCreators = videos.filter((v) => !!v.creator).length;
  const confidence = round(
    100 *
      clamp(
        0.25 * logNorm(videos.length || (members.length > 0 ? 0.5 : 0), 1, 15) +
          0.25 * clamp(direct.length / 4, 0, 1) +
          0.2 * logNorm(creators, 1, 10) * (videos.length ? clamp(verifiedCreators / videos.length, 0.5, 1) : 0.6) +
          0.15 * (sources.size <= 1 ? 0.3 : sources.size === 2 ? 0.7 : 1) +
          0.15 * logNorm(runsObserved + historyPoints, 1, 48),
        0,
        1,
      ),
    0,
  );

  // --- recency ---
  const times = members.map((m) => contentTime(m) || m.firstSeenAt || m.observedAt).sort();
  const latest = times[times.length - 1] || now;
  const ref = times.length >= 5 ? times[Math.floor(times.length / 2)] : latest;
  const recency = clamp(0.5 * Math.pow(0.5, hoursBetween(latest, now) / 24) + 0.5 * Math.pow(0.5, hoursBetween(ref, now) / 48), 0, 1);
  components.recency = round(recency, 3);

  // --- growth of the cluster itself (run history ≥2h apart; or source daily series) ---
  let growth: WindowScores['growth'] = { basis: 'provisional' };
  let growthScore = 0.5;
  // compare this window's creator count with the same window at an earlier run (never 24h-now vs 7d-then);
  // v1 records carry no creator counts and are skipped — a missing measurement stays provisional
  const prevCreatorsOf = (h: ScoreRecord): number | undefined => (window === '24h' ? h.creators24 : window === '48h' ? h.creators48 : h.adoption);
  const past = history.filter((h) => hoursBetween(h.t, now) >= 2 && prevCreatorsOf(h) != null && (!sourceSignature || !h.sources || h.sources === sourceSignature)).sort((a, b) => a.t.localeCompare(b.t));
  if (history.some((h) => hoursBetween(h.t, now) >= 2 && prevCreatorsOf(h) != null) && !past.length) notes.push('Growth baseline skipped: the set of active sources changed since the earlier runs (a new source is not growth).');
  if (past.length) {
    const prev = past[past.length - 1];
    const prevCreators = prevCreatorsOf(prev)!;
    const ratio = Math.max(1, creators) / Math.max(1, prevCreators);
    growth = { basis: 'measured', ratio: round(ratio, 3), windowHours: round(hoursBetween(prev.t, now), 1), metric: 'independent creators' };
    growthScore = ratioToScore(ratio);
    notes.push(`Measured: independent creators in the ${window} window ${prevCreators} → ${creators} over ${growth.windowHours}h (${round(ratio, 2)}×).`);
  }
  const sh = sourceHistoryGrowth(members, now);
  if (sh) {
    if (growth.basis === 'provisional') {
      growth = { basis: 'measured', ratio: round(sh.ratio, 3), windowHours: round(sh.windowHours, 0), metric: 'daily hashtag use' };
      growthScore = ratioToScore(sh.ratio);
    } else growthScore = clamp(0.6 * growthScore + 0.4 * ratioToScore(sh.ratio), 0, 1);
    notes.push(`Hashtag series: ${round(sh.ratio, 2)}× vs the prior-day average.`);
  }
  if (growth.basis === 'provisional') notes.push('Cluster growth not yet measured — needs a second collection run ≥2h apart.');
  components.growth = round(growthScore, 3);

  // --- composites ---
  const measuredSignal = videoMomentum ?? videoPerformance ?? audienceInterest;
  const momentum = round(clamp(0.3 * adoption + 0.25 * measuredSignal + 0.2 * 100 * recency + 0.15 * audienceInterest + 0.1 * 100 * growthScore), 0);

  const p = profileFor(category);
  const monetization = round(100 * (0.3 * p.advertiser + 0.2 * p.sponsorship + 0.15 * p.affiliate + 0.15 * p.longevity + 0.1 * p.demand + 0.1 * (1 - p.cost)) * (isNewsEvent ? 0.55 : 1), 0);
  const saturation = clamp(videos.length >= 10 && growthScore <= 0.55 && (videoPerformance ?? 0) >= 70 ? 0.5 : 0, 0, 1);
  let creatorOpportunity = 0.35 * momentum + 100 * (0.2 * p.repeatable + 0.15 * (1 - saturation) + 0.15 * (1 - p.cost)) + 0.15 * monetization;
  if (isNewsEvent) creatorOpportunity *= 0.45;
  if (isGeneric) creatorOpportunity *= 0.8;
  creatorOpportunity = round(clamp(creatorOpportunity), 0);
  components.saturation = saturation;

  // --- grade ---
  // Only videos measured (or verified) on their own platform prove a format; unverified shares corroborate at most.
  const verified = videos.filter((v) => v.level === 'direct' || v.verifiedAt);
  const verifiedCreatorCount = independentCreators(verified);
  components.verifiedCreators = verifiedCreatorCount;
  // shares-only clusters (no video measured on its platform and no verified publish date) cannot prove a format:
  // people passing around existing videos is audience interest, not creator adoption
  const sharesOnly = videos.length > 0 && direct.length === 0 && !videos.some((v) => v.videoPublishedAt);
  let grade: EvidenceGrade =
    verifiedCreatorCount >= 3 && direct.length >= 3 && runsObserved >= 3 && historySpanHours >= 6 ? 'strong'
      : verifiedCreatorCount >= 3 && verified.length >= 3 ? 'developing'
        : videos.length >= 1 && (creators >= 2 || audienceInterest >= 50) ? 'early'
          : members.length >= 2 && audienceInterest >= 60 && videos.length === 0 ? 'early'
            : 'insufficient';
  if (sharesOnly && (grade === 'strong' || grade === 'developing')) {
    grade = 'early';
    notes.push('All examples are social shares of videos whose own statistics and publish dates are unverified — capped at an early signal until the video platform confirms them (YouTube API key).');
  } else if (grade === 'early' && creators >= 3 && verifiedCreatorCount < 3) notes.push(`${creators} sharers but only ${verifiedCreatorCount} verified creator${verifiedCreatorCount === 1 ? '' : 's'} — needs platform verification (YouTube API) to grade higher.`);
  components.sharesOnly = sharesOnly ? 1 : 0;
  const gradeFactor = { strong: 1, developing: 0.9, early: 0.72, insufficient: 0.4 }[grade];
  const opportunity = round(clamp((0.4 * momentum + 0.35 * creatorOpportunity + 0.25 * monetization) * (0.3 + 0.7 * (confidence / 100)) * gradeFactor), 0);

  // --- lifecycle ---
  const firstDetected = cluster.members.map((m) => m.firstSeenAt || m.observedAt).sort()[0] || now;
  const earliestContent = cluster.members.map((m) => contentTime(m) || m.firstSeenAt || m.observedAt).sort()[0] || now;
  const ageHours = Math.max(hoursBetween(firstDetected, now), Math.min(hoursBetween(earliestContent, now), 24 * 14));
  const lifecycle = decideLifecycle({ grade, momentum, videoPerformance, growth: growthScore, growthMeasured: growth.basis === 'measured', velocityRatio: vels.length ? median(vels.map((v) => v.ratio)) : undefined, newCreators, creators, ageHours, hSinceLatest: hoursBetween(latest, now), sources: sources.size, isFormat: cluster.kind === 'format' });

  return {
    window, items: members.length, videos: videos.length, directVideos: direct.length, creators, newCreators,
    videoPerformance, videoMomentum, adoption, audienceInterest, confidence, creatorOpportunity, momentum, opportunity, grade, lifecycle,
    growth, velocity, components, notes,
  };
}

export function decideLifecycle(x: {
  grade: EvidenceGrade; momentum: number; videoPerformance: number | null; growth: number; growthMeasured: boolean;
  velocityRatio?: number; newCreators: number; creators: number; ageHours: number; hSinceLatest: number; sources: number; isFormat?: boolean;
}): Lifecycle {
  if (x.grade === 'insufficient') return 'insufficient_data';
  if (x.hSinceLatest > 72) return 'cooling';
  const accelerating = (x.velocityRatio != null && x.velocityRatio >= 1.3) || (x.growthMeasured && x.growth >= 0.6);
  const falling = (x.velocityRatio != null && x.velocityRatio <= 0.6 && x.newCreators === 0) || (x.growthMeasured && x.growth < 0.42);
  if (falling) return 'cooling';
  if (x.momentum >= 70 && x.sources >= 2 && (accelerating || x.newCreators >= 2)) return 'breaking_out';
  if (accelerating) return 'accelerating';
  // an evergreen format pool is never "emerging" — it is steady (peaking) unless measured growth says otherwise
  if (x.isFormat) return x.creators >= 3 ? 'peaking' : 'cooling';
  if (x.ageHours <= 48 || (x.newCreators >= 2 && x.ageHours <= 96)) return 'emerging';
  if ((x.videoPerformance ?? 0) >= 60 || x.creators >= 6) return 'peaking';
  return x.hSinceLatest > 36 ? 'cooling' : 'peaking';
}

export function uniqByExample(vs: Observation[]): Observation[] {
  const seen = new Map<string, Observation>();
  for (const v of vs) {
    const k = exampleKey(v);
    const cur = seen.get(k);
    if (!cur || (cur.level !== 'direct' && v.level === 'direct')) seen.set(k, v);
  }
  return Array.from(seen.values());
}

function fmt(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
