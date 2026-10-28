/**
 * Video-native intelligence (Viral Radar 3.0).
 *
 * One VideoRecord per unique video (platform + id) built from every observation of it: the platform record (direct
 * statistics, publish date) and the social shares (post engagement, kept apart). From the observation history we
 * compute what can actually be measured:
 *   - lifetime rate      = views ÷ hours since publication (an average, never presented as recent velocity)
 *   - velocity           = views gained between two real observations ÷ elapsed hours (≥ 1h apart)
 *   - acceleration       = latest interval rate ÷ previous interval rate (needs ≥ 3 observations)
 *   - gained[window]     = views gained inside trailing windows, only where observations bracket the window
 *   - age percentile     = lifetime rate vs. the videos we track of comparable age on the same platform
 *   - creator outlier    = views ÷ channel median (uploads baseline) or ÷ subscribers
 * and assign one of the evidence classes:
 *   verified_hit       convincing verified popularity for its age
 *   early_breakout     credible abnormal growth (measured, or a very young video with an exceptional average)
 *   unverified_signal  shared/mentioned but no platform statistics (TikTok/Instagram/Facebook links, etc.)
 *   rejected           below thresholds, stale, duplicate, unsupported — with the rule that rejected it
 * The thresholds are absolute AND relative, per platform: 4 → 8 likes is never a breakout.
 */
import type { ConfidenceBand, CrossPlatformLink, Metrics, Observation, VideoCard, VideoRecord, VideoState, VideoWindow, VelocityPoint } from '../types.js';
import { VIDEO_WINDOWS, VIDEO_WINDOW_HOURS } from '../types.js';
import { clamp, hoursBetween, logNorm, round } from '../lib/util.js';
import { classifyVideo } from './taxonomy.js';
import { ratioToScore, median, type MetricPoint } from './score.js';
import { exampleKey } from './cluster.js';
import { detectLanguage } from './language.js';

/**
 * 4.0 — age-appropriate hit floor (YouTube views). A video is "already viral" when its verified views clear the
 * floor for its age: 1M inside the first day, 2M by 3 days, 3M by a week, 5M by 30 days (log-linear in between).
 * Below the floor a video can still be an *early* breakout (abnormal rise) — the two are different kinds of evidence.
 */
const HIT_FLOOR: [number, number][] = [[24, 1_000_000], [72, 2_000_000], [168, 3_000_000], [720, 5_000_000]];
export function hitFloorViews(ageHours: number | undefined): number {
  const a = ageHours == null || !isFinite(ageHours) ? 720 : Math.max(1, ageHours);
  if (a <= HIT_FLOOR[0][0]) return HIT_FLOOR[0][1];
  for (let i = 1; i < HIT_FLOOR.length; i++) {
    const [h0, v0] = HIT_FLOOR[i - 1], [h1, v1] = HIT_FLOOR[i];
    if (a <= h1) {
      const f = (Math.log(a) - Math.log(h0)) / (Math.log(h1) - Math.log(h0));
      return Math.round(v0 * Math.pow(v1 / v0, f));
    }
  }
  return HIT_FLOOR[HIT_FLOOR.length - 1][1];
}

/** minimum views an interval must gain before its rate is used for acceleration (small samples are noise) */
const MIN_INTERVAL_GAIN = { views: 1_000, likes: 20 } as const;

export function confidenceBandOf(confidence: number): ConfidenceBand {
  return confidence >= 70 ? 'high' : confidence >= 45 ? 'medium' : 'low';
}

export interface ChannelStats { subscribers?: number; videos?: number; views?: number; medianRecentViews?: number; baselineSampled?: number; baselineAt?: string }

export interface VideoBuildInput {
  observations: Observation[];
  metricHistory: Map<string, MetricPoint[]>;
  channels?: Map<string, ChannelStats>;
  /** video observation id → trend ids it supports */
  trendIndex?: Map<string, string[]>;
  now: string;
}

/** Platform thresholds. YouTube counts views; Bluesky has no view counts, so it is measured in likes at its own scale. */
export const THRESHOLDS = {
  youtube: {
    candidateViews: 10_000,
    hitViews: 5_000_000,
    hitViewsWithRate: 1_000_000, hitRate: 50_000,
    breakoutVelocity: 10_000, breakoutVelocityViews: 50_000,
    accelVelocity: 3_000, accelRatio: 1.5, accelViews: 20_000,
    youngHours: 48, youngRate: 10_000, youngViews: 100_000,
    outlierRatio: 20, outlierViews: 100_000, outlierMaxHours: 24 * 14,
    resurgeVelocity: 5_000,
    maxAgeHours: 24 * 30,
  },
  bluesky: {
    candidateLikes: 100,
    hitLikes: 5_000,
    breakoutVelocity: 100, breakoutLikes: 500,
    youngHours: 48, youngRate: 50, youngLikes: 500,
    maxAgeHours: 24 * 30,
  },
} as const;

const GAIN_WINDOWS: { key: keyof NonNullable<VideoRecord['gained']>; hours: number }[] = [
  { key: '1h', hours: 1 }, { key: '3h', hours: 3 }, { key: '6h', hours: 6 }, { key: '12h', hours: 12 }, { key: '24h', hours: 24 }, { key: '48h', hours: 48 }, { key: '72h', hours: 72 }, { key: '7d', hours: 168 },
];

function platformOf(o: Observation): VideoRecord['platform'] {
  return o.video?.platform || (o.source === 'bluesky' ? 'bluesky' : 'other');
}

/** Measured velocity intervals (latest first), acceleration and windowed gains from real observation points. */
export function measureVelocity(points: MetricPoint[] | undefined, now: string, metric: 'views' | 'likes'): { velocity: VelocityPoint[]; acceleration?: number; gained: VideoRecord['gained'] } {
  const pts = (points || []).filter((p) => p.metrics[metric] != null).sort((a, b) => a.t.localeCompare(b.t));
  const velocity: VelocityPoint[] = [];
  if (pts.length >= 2) {
    // walk backwards building intervals of ≥ 1h (merge closer points into the same interval)
    let end = pts.length - 1;
    while (end > 0 && velocity.length < 6) {
      let start = end - 1;
      while (start > 0 && hoursBetween(pts[start].t, pts[end].t) < 1) start--;
      const hours = hoursBetween(pts[start].t, pts[end].t);
      if (hours < 1) break;
      const gained = (pts[end].metrics[metric] || 0) - (pts[start].metrics[metric] || 0);
      velocity.push({ hours: round(hours, 2), perHour: round(Math.max(0, gained) / hours, 1), metric, measuredAt: pts[end].t });
      end = start;
    }
  }
  // acceleration only when both intervals gained enough to be more than counting noise
  const minGain = MIN_INTERVAL_GAIN[metric];
  const acceleration = velocity.length >= 2 && velocity[1].perHour > 0 && velocity[0].perHour * velocity[0].hours >= minGain && velocity[1].perHour * velocity[1].hours >= minGain
    ? round(velocity[0].perHour / velocity[1].perHour, 2) : undefined;
  const gained: VideoRecord['gained'] = {};
  if (pts.length >= 2) {
    const last = pts[pts.length - 1];
    for (const w of GAIN_WINDOWS) {
      // the earliest point at or before (last − window); only when an observation brackets the window within 25 % slack
      const target = new Date(last.t).getTime() - w.hours * 36e5;
      const before = pts.filter((p) => new Date(p.t).getTime() <= target + w.hours * 36e5 * 0.25 && p !== last);
      if (!before.length) continue;
      const base = before.reduce((a, b) => (Math.abs(new Date(b.t).getTime() - target) < Math.abs(new Date(a.t).getTime() - target) ? b : a));
      if (Math.abs(new Date(base.t).getTime() - target) > w.hours * 36e5 * 0.25) continue;
      gained[w.key] = Math.max(0, (last.metrics[metric] || 0) - (base.metrics[metric] || 0));
    }
  }
  void now;
  return { velocity, acceleration, gained: Object.keys(gained).length ? gained : undefined };
}

export function buildVideoRecords(input: VideoBuildInput): VideoRecord[] {
  const { observations, metricHistory, channels, trendIndex, now } = input;
  const byKey = new Map<string, Observation[]>();
  for (const o of observations) {
    if (o.kind !== 'video') continue;
    const k = exampleKey(o);
    (byKey.get(k) || byKey.set(k, []).get(k)!).push(o);
  }
  const records: VideoRecord[] = [];
  for (const [, group] of byKey) {
    const direct = group.filter((o) => o.level === 'direct').sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
    const shares = group.filter((o) => o.level !== 'direct');
    const primary = direct || shares.sort((a, b) => ((b.postMetrics?.likes || 0) - (a.postMetrics?.likes || 0)))[0];
    if (!primary) continue;
    const platform = platformOf(primary);
    const platformId = primary.video?.id || primary.key;
    const publishedAt = direct ? (direct.videoPublishedAt || direct.publishedAt) : primary.videoPublishedAt;
    const ageHours = publishedAt ? round(hoursBetween(publishedAt, now), 1) : undefined;
    const metrics: Metrics = direct ? { ...direct.metrics } : {};
    const shareMetrics = shares.length
      ? shares.reduce((acc, s) => {
          const pm = s.postMetrics || {};
          acc.likes = (acc.likes || 0) + (pm.likes || 0);
          acc.reposts = (acc.reposts || 0) + (pm.reposts || 0);
          acc.comments = (acc.comments || 0) + (pm.comments || 0);
          acc.accounts = (acc.accounts || 0) + (pm.accounts || 1);
          acc.posts = (acc.posts || 0) + 1;
          if (!acc.platforms!.includes(s.source)) acc.platforms!.push(s.source);
          return acc;
        }, { platforms: [] as string[] } as Metrics & { posts?: number; platforms?: string[] })
      : undefined;
    const verified = !!direct && (metrics.views != null || metrics.likes != null);
    const metricKey: 'views' | 'likes' = metrics.views != null ? 'views' : 'likes';
    const primaryCount = metrics[metricKey];
    const lifetimeRate = verified && primaryCount != null && ageHours != null && ageHours > 0 ? round(primaryCount / Math.max(ageHours, 0.5), 1) : undefined;
    const vel = direct ? measureVelocity(metricHistory.get(direct.id), now, metricKey) : { velocity: [], gained: undefined };
    const latest = vel.velocity[0];
    const velocityRatio = latest && lifetimeRate ? round(latest.perHour / Math.max(lifetimeRate, 0.1), 2) : undefined;
    const text = `${primary.title} ${primary.text || ''}`;
    const cls = classifyVideo(text, primary.tags || [], primary.platformCategory);
    const ch = direct?.video?.channelId ? channels?.get(direct.video.channelId) : undefined;
    const likeRate = metrics.views && metrics.likes != null ? round(metrics.likes / metrics.views, 4) : undefined;
    // Shorts: the strongest available evidence wins — a verified /shorts/ URL check, then the share URL, then duration
    const dur = primary.video?.durationSec;
    const shortsEvidence: VideoRecord['shortsEvidence'] = primary.video?.shortForm === 'verified' ? 'verified'
      : primary.video?.shortForm === 'not_short' ? 'not_short'
        : platform === 'youtube' && /shorts\//.test(shares.find((s) => /shorts\//.test(s.url))?.url || '') ? 'url'
          : dur != null && dur <= 180 ? 'duration' : 'none';
    const isShort = shortsEvidence === 'verified' || shortsEvidence === 'url' ? true : shortsEvidence === 'not_short' ? false : dur != null ? dur <= 180 : undefined;
    const rec: VideoRecord = {
      id: primary.id, platform, platformId,
      url: primary.url, title: primary.title, thumbnail: primary.thumbnail || shares.find((s) => s.thumbnail)?.thumbnail,
      creator: primary.creator ? { ...primary.creator, channelId: direct?.video?.channelId, subscribers: ch?.subscribers } : undefined,
      durationSec: dur, isShort, shortsEvidence,
      isLive: !!primary.video?.live || (primary.video?.durationSec === 0 && /\blive\b|🔴/i.test(primary.title)) || undefined,
      publishedAt, ageHours,
      language: detectLanguage(`${primary.title} ${(primary.text || '').slice(0, 200)}`, primary.language),
      firstSeenAt: group.map((o) => o.firstSeenAt || o.observedAt).sort()[0],
      observedAt: group.map((o) => o.observedAt).sort().pop()!,
      verifiedAt: direct?.verifiedAt || shares.find((s) => s.verifiedAt)?.verifiedAt,
      metrics, shareMetrics, verified,
      sources: Array.from(new Set(group.flatMap((o) => (o.query || o.source).split(',')).map((q) => q.trim()).filter(Boolean))).slice(0, 12),
      category: cls.category, subcategory: cls.subcategory, formats: Array.from(new Set(group.flatMap((o) => o.formats || []))),
      platformCategory: primary.platformCategory,
      lifetimeRate, velocity: vel.velocity.length ? vel.velocity : undefined, acceleration: vel.acceleration, velocityRatio, gained: vel.gained,
      likeRate,
      baselineRatio: ch?.medianRecentViews && metrics.views ? round(metrics.views / Math.max(ch.medianRecentViews, 1), 1) : undefined,
      subscriberRatio: ch?.subscribers && metrics.views ? round(metrics.views / Math.max(ch.subscribers, 1), 2) : undefined,
      state: 'rejected', reasons: [], viralScore: 0, breakoutScore: 0, engagementScore: 0, outlierScore: 0, confidence: 0, confidenceBand: 'low',
      crossPlatform: [], trends: trendIndex?.get(primary.id) || [], observations: group.length + (metricHistory.get(direct?.id || '')?.length || 0),
    };
    records.push(rec);
  }
  computeAgePercentiles(records);
  for (const r of records) decideVideo(r);
  return records;
}

/** Lifetime-rate percentile among verified videos of the same platform and comparable age. */
export function computeAgePercentiles(records: VideoRecord[]): void {
  const buckets = [6, 24, 72, 168, 720, Infinity];
  const groups = new Map<string, VideoRecord[]>();
  for (const r of records) {
    if (!r.verified || r.lifetimeRate == null || r.ageHours == null) continue;
    const b = buckets.findIndex((h) => r.ageHours! < h);
    const k = `${r.platform}:${b}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(r);
  }
  for (const [, g] of groups) {
    if (g.length < 8) continue; // too few comparable videos → no percentile claim
    const rates = g.map((r) => r.lifetimeRate!).sort((a, b) => a - b);
    for (const r of g) {
      const below = rates.filter((x) => x < r.lifetimeRate!).length;
      r.agePercentile = round(below / rates.length, 2);
    }
  }
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `${Math.round(n)}`);
const ageLabel = (h?: number) => (h == null ? 'unknown age' : h < 48 ? `${Math.round(h)}h old` : `${Math.round(h / 24)}d old`);

/** State machine + scores + plain-language reasons. */
export function decideVideo(r: VideoRecord): void {
  const reasons: string[] = [];
  const latest = r.velocity?.[0];
  const measured = latest && latest.hours >= 1 ? latest : undefined;
  const cooling = !!measured && r.velocityRatio != null && r.velocityRatio <= 0.3 && r.velocity!.reduce((a, v) => a + v.hours, 0) >= 6;

  if (!r.verified) {
    const sm = r.shareMetrics;
    const accounts = sm?.accounts || 0;
    if (accounts >= 3 || (sm?.likes || 0) >= 500) {
      r.state = 'unverified_signal';
      reasons.push(`Shared by ${accounts} account${accounts === 1 ? '' : 's'} on ${(sm?.platforms || []).join('/')} (${fmt(sm?.likes || 0)} post likes) — no ${r.platform === 'youtube' ? 'platform' : r.platform} statistics available, so this is an indirect signal only.`);
    } else {
      r.state = 'rejected';
      r.rejectedBy = r.platform === 'youtube' ? 'no platform statistics yet (awaiting verification)' : `no ${r.platform} statistics available (no public API)`;
      reasons.push(`Only ${accounts || 1} share${accounts === 1 ? '' : 's'} and no platform statistics.`);
    }
    r.viralScore = 0; r.breakoutScore = 0; r.engagementScore = 0; r.outlierScore = 0;
    r.confidence = clamp(10 + 10 * Math.min(accounts, 5), 0, 60);
    r.confidenceBand = confidenceBandOf(r.confidence);
    r.reasons = reasons;
    return;
  }

  if (r.platform === 'bluesky') { decideBluesky(r, measured, cooling, reasons); r.confidenceBand = confidenceBandOf(r.confidence); return; }

  const T = THRESHOLDS.youtube;
  const views = r.metrics.views || 0;
  const age = r.ageHours ?? Infinity;
  const L = r.lifetimeRate || 0;
  const V = measured?.perHour;
  const A = r.acceleration;
  // auto-generated "<Artist> - Topic" channels have no real subscriber base; their ratios mean nothing
  const topicChannel = /\s-\sTopic$/.test(r.creator?.name || '');
  if (topicChannel) { r.baselineRatio = undefined; r.subscriberRatio = undefined; r.outlierScore = 0; }
  const base = r.baselineRatio ?? r.subscriberRatio;

  const floor = hitFloorViews(r.ageHours);
  // facts first — the same wording everywhere, so the UI never has to invent a sentence
  reasons.push(`${fmt(views)} verified views${r.metrics.likes != null ? `, ${fmt(r.metrics.likes)} likes` : ''} on YouTube, ${ageLabel(r.ageHours)}${r.agePercentile != null ? ` (top ${Math.max(1, Math.round((1 - r.agePercentile) * 100))}% of tracked videos of similar age)` : ''}; the hit floor for this age is ${fmt(floor)} views.`);
  if (L) reasons.push(`Lifetime average ${fmt(L)} views/hour since publication (an average, not a measured recent rate).`);
  if (measured) reasons.push(`Measured: +${fmt(measured.perHour)} views/hour over the last ${measured.hours}h (${r.velocityRatio}× the lifetime average)${A != null ? `, ${A >= 1.2 ? 'accelerating' : A <= 0.8 ? 'slowing' : 'steady'} vs the previous interval (${A}×)` : ''}.`);
  else if (r.observations <= 1) reasons.push('Seen once so far — recent velocity will be measured on the next collections.');
  if (r.baselineRatio != null) reasons.push(`${r.baselineRatio}× the creator's median recent upload${r.creator?.subscribers ? ` (${fmt(r.creator.subscribers)} subscribers)` : ''}.`);
  else if (r.subscriberRatio != null && r.creator?.subscribers) reasons.push(`${r.subscriberRatio}× the channel's subscriber count (${fmt(r.creator.subscribers)}).`);
  if (r.shareMetrics?.posts) reasons.push(`Also shared on ${(r.shareMetrics.platforms || []).join('/')} by ${r.shareMetrics.accounts} account${r.shareMetrics.accounts === 1 ? '' : 's'} (${fmt(r.shareMetrics.likes || 0)} post likes, kept separate from the video's own statistics).`);
  if (cooling) reasons.push(`Cooling: the measured rate is ${r.velocityRatio}× the lifetime average over ${r.velocity!.reduce((a, v) => a + v.hours, 0).toFixed(0)}h.`);

  let state: VideoState = 'rejected';
  let rejectedBy: string | undefined;
  // paid promotion: millions of views with almost no engagement (organic like rates sit at 0.3–5 %; 0.05 % is 6× below
  // the 5th percentile of our verified videos). Hidden like counts (null) are not evidence either way.
  const promoted = views >= 500_000 && r.metrics.likes != null && r.likeRate != null && r.likeRate < 0.0005 && (r.metrics.comments ?? 0) < views * 0.00005;
  if (promoted) {
    r.state = 'rejected';
    r.rejectedBy = 'engagement far below organic levels (likely paid promotion)';
    reasons.push(`Not featured: ${fmt(views)} views but only ${fmt(r.metrics.likes!)} likes (${((r.likeRate || 0) * 100).toFixed(3)}%) — a paid-reach pattern, not organic virality.`);
    r.viralScore = 0; r.breakoutScore = 0; r.engagementScore = 0; r.outlierScore = 0; r.confidence = 40;
    r.reasons = reasons;
    return;
  }
  if (r.isLive || (r.durationSec != null && r.durationSec > 3 * 3600)) {
    r.state = 'rejected';
    r.rejectedBy = r.isLive ? 'live stream / premiere (views accrue while live; not a video format)' : 'stream recording longer than 3 hours (not a video format)';
    reasons.push('Not featured: live stream or premiere.');
    r.viralScore = 0; r.breakoutScore = 0; r.engagementScore = 0; r.outlierScore = 0; r.confidence = 30;
    r.reasons = reasons;
    return;
  }
  // established virality: the age-appropriate floor, or ≥1M views with a ≥50K/h rate (measured or lifetime)
  const isHit = views >= floor || (views >= T.hitViewsWithRate && ((V ?? 0) >= T.hitRate || L >= T.hitRate));
  // a big channel's ordinary clip gaining fast is that channel's normal, not a breakout — when the creator's range is
  // known, measured growth must at least reach it (looser than the young-video rule, which has no measurement)
  const notBelowNormal = r.baselineRatio != null ? r.baselineRatio >= 1.2 : r.subscriberRatio != null ? r.subscriberRatio >= 0.2 : true;
  const recent = age <= 168; // the "early" window: a week
  const breakoutMeasured = recent && V != null && notBelowNormal && ((V >= T.breakoutVelocity && views >= T.breakoutVelocityViews) || (V >= T.accelVelocity && (A ?? 0) >= T.accelRatio && views >= T.accelViews));
  // a big channel's ordinary upload is not a breakout: when the creator's normal range is known, the video must exceed it
  const aboveNormal = r.baselineRatio != null ? r.baselineRatio >= 2 : r.subscriberRatio != null ? r.subscriberRatio >= 0.5 : true;
  const breakoutYoung = V == null && age <= T.youngHours && L >= T.youngRate && views >= T.youngViews && aboveNormal;
  const outlier = base != null && base >= T.outlierRatio && views >= T.outlierViews && age <= T.outlierMaxHours;
  // delayed breakout: older than a week and gaining measurably faster than its own lifetime average (×3; ×5 past 30 days)
  const resurging = !recent && V != null && V >= T.resurgeVelocity && (r.velocityRatio ?? 0) >= (age > T.maxAgeHours ? 5 : 3) && views >= T.outlierViews;

  if (age > T.maxAgeHours && !resurging) {
    rejectedBy = 'older than 30 days without measured resurgence';
  } else if (isHit && !cooling) {
    state = 'verified_hit';
    r.kind = 'established';
  } else if (isHit && cooling) {
    state = 'verified_hit';
    r.kind = 'established';
    reasons.push('Still a verified hit by total views, but past its peak.');
  } else if (resurging) {
    state = 'early_breakout';
    r.kind = 'delayed';
    reasons.push(`Delayed breakout: a ${Math.round(age / 24)}-day-old video gaining ${fmt(V!)} views/hour now (${r.velocityRatio}× its lifetime average) — resurfacing, not a new upload.`);
  } else if (breakoutMeasured && !cooling) {
    state = 'early_breakout';
    r.kind = 'early';
    reasons.push(`Early breakout: ${fmt(views)} views is below the ${fmt(floor)} hit floor for its age, but the measured rate is abnormal.`);
  } else if (breakoutYoung) {
    state = 'early_breakout';
    r.kind = 'early';
    reasons.push('Young video with an exceptional average rate — provisional until a second measurement confirms it.');
  } else if (outlier && !cooling) {
    state = 'early_breakout';
    r.kind = 'early';
    reasons.push('Creator outlier: performing far above this channel\'s normal range.');
  } else if (views < T.candidateViews) {
    rejectedBy = `below candidate floor (${fmt(T.candidateViews)} views)`;
  } else if ((V == null && age <= T.youngHours && L >= T.youngRate && views >= T.youngViews && !aboveNormal) || (V != null && !notBelowNormal && V >= T.accelVelocity)) {
    rejectedBy = `within the creator's normal range (${r.baselineRatio != null ? `${r.baselineRatio}× median upload` : `${r.subscriberRatio}× subscribers`})`;
  } else if (cooling) {
    rejectedBy = 'cooling and below hit threshold';
  } else if (V != null && !recent) {
    rejectedBy = `older than a week without measured resurgence (${fmt(V)}/h, ${r.velocityRatio}× lifetime)`;
  } else if (V != null) {
    rejectedBy = `measured velocity ${fmt(V)}/h below breakout thresholds`;
  } else {
    rejectedBy = `below popularity thresholds for its age (${fmt(views)} views vs a ${fmt(floor)} hit floor, ${fmt(L)}/h average)`;
  }
  r.state = state;
  r.rejectedBy = rejectedBy;
  if (rejectedBy) reasons.push(`Not featured: ${rejectedBy}.`);

  // scores
  const velFactor = V != null ? ratioToScore(r.velocityRatio || 1) : 0.5;
  r.viralScore = round(100 * clamp(0.45 * logNorm(views, 1e5, 5e7) + 0.25 * logNorm(L, 1e3, 3e5) + 0.15 * velFactor + 0.15 * clamp((r.likeRate || 0) / 0.06, 0, 1)), 0);
  const growthRate = V ?? (age <= T.youngHours ? L : 0);
  const youth = 1 - clamp(age / 168, 0, 1);
  const outlierTerm = base != null ? logNorm(base, 1, 100) : 0.25;
  const breakoutRaw = 0.4 * logNorm(growthRate, 1e3, 2e5) + 0.25 * (A != null ? ratioToScore(A) : V != null ? ratioToScore(r.velocityRatio || 1) : 0.4) + 0.2 * outlierTerm + 0.15 * youth;
  r.breakoutScore = round(100 * clamp(V != null ? breakoutRaw : 0.8 * breakoutRaw, 0, 1) * (views >= T.accelViews ? 1 : 0), 0);
  r.engagementScore = views >= T.candidateViews && r.likeRate != null ? round(100 * clamp(0.8 * logNorm(r.likeRate, 0.005, 0.1) + 0.2 * logNorm((r.metrics.comments || 0) / Math.max(views, 1), 0.0002, 0.01), 0, 1), 0) : 0;
  r.outlierScore = views >= T.candidateViews && base != null ? round(100 * logNorm(base, 1, 200), 0) : 0;
  r.confidence = round(clamp(25 + 20 * Math.min(r.observations, 3) / 3 + (V != null ? 25 : 0) + (r.baselineRatio != null ? 10 : r.subscriberRatio != null ? 5 : 0) + (r.shareMetrics?.posts ? 10 : 0) + (r.ageHours != null ? 5 : 0), 0, 100), 0);
  r.confidenceBand = confidenceBandOf(r.confidence);
  r.reasons = reasons;
}

function decideBluesky(r: VideoRecord, measured: VelocityPoint | undefined, cooling: boolean, reasons: string[]): void {
  const T = THRESHOLDS.bluesky;
  const likes = r.metrics.likes || 0;
  const age = r.ageHours ?? Infinity;
  const L = r.lifetimeRate || 0;
  const V = measured?.perHour;
  reasons.push(`${fmt(likes)} likes on Bluesky (Bluesky has no view counts; its scale is ~1000× smaller than YouTube's), ${ageLabel(r.ageHours)}.`);
  if (measured) reasons.push(`Measured: +${fmt(V!)} likes/hour over the last ${measured.hours}h (${r.velocityRatio}× the lifetime average).`);
  let state: VideoState = 'rejected';
  let rejectedBy: string | undefined;
  if (age > T.maxAgeHours) rejectedBy = 'older than 30 days';
  else if (likes >= T.hitLikes) { state = 'verified_hit'; r.kind = 'established'; }
  else if (V != null && V >= T.breakoutVelocity && likes >= T.breakoutLikes && !cooling) { state = 'early_breakout'; r.kind = age > 168 ? 'delayed' : 'early'; }
  else if (V == null && age <= T.youngHours && L >= T.youngRate && likes >= T.youngLikes) { state = 'early_breakout'; r.kind = 'early'; reasons.push('Young post with an exceptional average rate — provisional until a second measurement confirms it.'); }
  else if (likes < T.candidateLikes) rejectedBy = `below Bluesky candidate floor (${T.candidateLikes} likes)`;
  else rejectedBy = `Bluesky engagement below viral thresholds (${fmt(likes)} likes)`;
  r.state = state;
  r.rejectedBy = rejectedBy;
  if (rejectedBy) reasons.push(`Not featured: ${rejectedBy}.`);
  r.viralScore = round(100 * clamp(0.5 * logNorm(likes, 300, 20_000) + 0.3 * logNorm(L, 5, 1000) + 0.2 * (V != null ? ratioToScore(r.velocityRatio || 1) : 0.5)), 0);
  const growthRate = V ?? (age <= T.youngHours ? L : 0);
  r.breakoutScore = likes >= T.candidateLikes ? round(100 * clamp(0.5 * logNorm(growthRate, 10, 2000) + 0.3 * (V != null ? ratioToScore(r.velocityRatio || 1) : 0.4) + 0.2 * (1 - clamp(age / 168, 0, 1)), 0, 1) * (V != null ? 1 : 0.8), 0) : 0;
  r.engagementScore = 0;
  r.outlierScore = 0;
  r.confidence = round(clamp(20 + 15 * Math.min(r.observations, 3) / 3 + (V != null ? 25 : 0), 0, 100), 0);
  r.reasons = reasons;
}

export function toCard(r: VideoRecord): VideoCard {
  const v = r.velocity?.[0];
  return {
    id: r.id, platform: r.platform, platformId: r.platformId, url: r.url, title: r.title, thumbnail: r.thumbnail,
    creator: r.creator?.name, creatorUrl: r.creator?.url, publishedAt: r.publishedAt, ageHours: r.ageHours, durationSec: r.durationSec, isShort: r.isShort,
    views: r.metrics.views, likes: r.metrics.likes, comments: r.metrics.comments, shares: r.shareMetrics?.accounts,
    state: r.state, viralScore: r.viralScore, breakoutScore: r.breakoutScore, engagementScore: r.engagementScore, outlierScore: r.outlierScore,
    velocityPerHour: v?.perHour, velocityHours: v?.hours, velocityRatio: r.velocityRatio, acceleration: r.acceleration, lifetimeRate: r.lifetimeRate,
    baselineRatio: r.baselineRatio, subscriberRatio: r.subscriberRatio,
    category: r.category, formats: r.formats, reasons: r.reasons, crossPlatform: r.crossPlatform.length, verified: r.verified,
    kind: r.kind, band: r.confidenceBand, language: r.language, shortsEvidence: r.shortsEvidence, gained24h: r.gained?.['24h'],
  };
}

/** Viral Now lists: verified hits (and breakouts that are also big) published inside each window, by viralScore. */
/** platforms whose statistics are view counts (comparable with each other); Bluesky is like-based and listed apart */
export const VIEW_PLATFORMS = new Set<VideoRecord['platform']>(['youtube', 'tiktok', 'instagram', 'facebook']);

export function viralNowLists(records: VideoRecord[], now: string, limit = 40, platforms: Set<VideoRecord['platform']> = VIEW_PLATFORMS): Record<VideoWindow, VideoCard[]> {
  const out = {} as Record<VideoWindow, VideoCard[]>;
  for (const w of VIDEO_WINDOWS) {
    const h = VIDEO_WINDOW_HOURS[w];
    out[w] = diversifyByCreator(records
      .filter((r) => platforms.has(r.platform) && r.state === 'verified_hit' && r.publishedAt && hoursBetween(r.publishedAt, now) <= h)
      .sort((a, b) => b.viralScore - a.viralScore || (b.metrics.views || 0) - (a.metrics.views || 0)), 2)
      .slice(0, limit)
      .map(toCard);
  }
  return out;
}

/** Early Radar: breakouts by breakout score (measured growth first). */
export function earlyRadarList(records: VideoRecord[], limit = 40, platforms: Set<VideoRecord['platform']> = VIEW_PLATFORMS): VideoCard[] {
  return diversifyByCreator(records
    .filter((r) => platforms.has(r.platform) && r.state === 'early_breakout')
    .sort((a, b) => b.breakoutScore - a.breakoutScore || b.viralScore - a.viralScore), 2)
    .slice(0, limit)
    .map(toCard);
}

/** at most `max` videos per creator in a ranked list (a channel spamming re-cuts is one signal, not five) */
export function diversifyByCreator(list: VideoRecord[], max: number): VideoRecord[] {
  const seen = new Map<string, number>();
  const out: VideoRecord[] = [];
  const rest: VideoRecord[] = [];
  for (const r of list) {
    const k = r.creator?.channelId || r.creator?.url || r.creator?.name || r.id;
    const n = seen.get(k) || 0;
    if (n < max) { seen.set(k, n + 1); out.push(r); } else rest.push(r);
  }
  return [...out, ...rest];
}

/** Cross-platform relationships with explicit evidence. Never merges on a generic word. */
export function linkCrossPlatform(records: VideoRecord[], observations: Observation[]): void {
  const byId = new Map(records.map((r) => [r.id, r]));
  // Type A: a share on another network of the identical video (canonical id)
  for (const r of records) {
    if (r.shareMetrics?.posts && r.platform !== 'bluesky') {
      for (const p of r.shareMetrics.platforms || []) {
        r.crossPlatform.push({ type: 'A', platform: p as CrossPlatformLink['platform'], ref: r.id, confidence: 1, basis: `canonical ${r.platform} id ${r.platformId} linked from ${p} posts` });
      }
    }
  }
  // Type B: same normalized title (≥ 4 tokens) on different platforms or by a different creator, within 30 days
  const norm = (t: string) => t.toLowerCase().replace(/#\w+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  const titleIndex = new Map<string, VideoRecord[]>();
  for (const r of records) {
    const t = norm(r.title);
    if (t.split(' ').length < 4) continue;
    (titleIndex.get(t) || titleIndex.set(t, []).get(t)!).push(r);
  }
  for (const [, group] of titleIndex) {
    if (group.length < 2) continue;
    for (const a of group) for (const b of group) {
      if (a === b || a.platform === b.platform && a.creator?.name === b.creator?.name) continue;
      const sameCreator = !!a.creator?.name && a.creator?.name === b.creator?.name;
      a.crossPlatform.push({ type: 'B', platform: b.platform, ref: b.id, url: b.url, title: b.title, creator: b.creator?.name, at: b.publishedAt, confidence: sameCreator ? 0.8 : 0.6, basis: sameCreator ? 'identical title, same creator, another platform' : 'identical title by another account (repost)' });
    }
  }
  // Type D: membership in the same microtrend/format cluster (related trend) — recorded as a count via `trends`
  void observations;
  void byId;
}

/** Trend index: video observation id → trend ids (from the clustered trends). */
export function trendIndexFrom(trends: { id: string; kind: string; evidence: Observation[] }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const t of trends) for (const e of t.evidence) if (e.kind === 'video') (m.get(e.id) || m.set(e.id, []).get(e.id)!).push(t.id);
  return m;
}

export function medianOf(xs: number[]): number { return median(xs); }
