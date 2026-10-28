/**
 * Discovery funnel, platform coverage and category waves — the diagnostics that say where good videos are lost.
 * Every number is computed from the records of this run; nothing is hard-coded.
 */
import type { CategoryWaveState, DiscoveryFunnel, Observation, PlatformCoverage, SourceStatus, Trend, VideoCard, VideoIntel, VideoRecord, VideoWindow } from '../types.js';
import { VIDEO_WINDOWS } from '../types.js';
import { hoursBetween, round } from '../lib/util.js';
import { THRESHOLDS, earlyRadarList, viralNowLists } from './videos.js';
import { contentTime } from './score.js';

export function isCandidate(r: VideoRecord): boolean {
  if (!r.verified) return false;
  if (r.platform === 'bluesky') return (r.metrics.likes || 0) >= THRESHOLDS.bluesky.candidateLikes;
  return (r.metrics.views || 0) >= THRESHOLDS.youtube.candidateViews;
}

/** Reposts: an identical-title copy that is smaller than another copy is a duplicate, not a second hit. */
export function markDuplicates(records: VideoRecord[]): number {
  const byId = new Map(records.map((r) => [r.id, r]));
  let n = 0;
  for (const r of records) {
    for (const l of r.crossPlatform) {
      if (l.type !== 'B') continue;
      const other = byId.get(l.ref);
      if (!other) continue;
      const mine = r.metrics.views ?? r.metrics.likes ?? 0;
      const theirs = other.metrics.views ?? other.metrics.likes ?? 0;
      if (theirs > mine && (r.state === 'verified_hit' || r.state === 'early_breakout')) {
        r.state = 'rejected';
        r.rejectedBy = 'duplicate of a larger upload (identical title)';
        r.reasons.push(`Not featured: a larger copy exists (${other.platform} ${other.platformId}).`);
        n++;
        break;
      }
    }
  }
  return n;
}

export function buildFunnel(records: VideoRecord[], inFeedIds: Set<string>): DiscoveryFunnel {
  const withMetadata = records.filter((r) => r.title && (r.publishedAt || r.creator));
  const verified = withMetadata.filter((r) => r.verified);
  const candidates = verified.filter(isCandidate);
  const relevant = candidates.filter((r) => r.rejectedBy !== 'duplicate of a larger upload (identical title)');
  const qualified = relevant.filter((r) => r.state === 'verified_hit' || r.state === 'early_breakout');
  const rejections: Record<string, number> = {};
  for (const r of records) {
    if (r.state === 'verified_hit' || r.state === 'early_breakout') continue;
    // aggregate by rule, not by the specific numbers in the sentence
    const key = (r.rejectedBy || (r.state === 'unverified_signal' ? 'unverified signal (no platform statistics)' : 'other')).replace(/\s*\([^)]*\)/g, '').trim();
    rejections[key] = (rejections[key] || 0) + 1;
  }
  return {
    discovered: records.length, withMetadata: withMetadata.length, verified: verified.length, candidates: candidates.length,
    relevant: relevant.length, qualified: qualified.length, inFeed: qualified.filter((r) => inFeedIds.has(r.id)).length,
    rejections: Object.fromEntries(Object.entries(rejections).sort((a, b) => b[1] - a[1]).slice(0, 20)),
  };
}

const PLATFORM_META: Record<string, { collector: string; direct: boolean; note: string }> = {
  youtube: { collector: 'YouTube Data API v3 (charts, tracking, rationed discovery) + Bluesky links', direct: true, note: 'Verified views, likes, comments, publish dates, durations, channels; velocity from repeated measurements.' },
  bluesky: { collector: 'Bluesky public AppView (topics, feeds, searches, link discovery)', direct: true, note: 'Native videos carry like/repost counts (no view counts). Scale is ~1000× smaller than YouTube; ranked on its own scale.' },
  tiktok: { collector: 'Links shared on Bluesky + TikTok oEmbed', direct: false, note: 'Creative Center answers "no permission" without a session; no public statistics API. Titles/authors/thumbnails verified via oEmbed; views unknown.' },
  instagram: { collector: 'Links shared on Bluesky', direct: false, note: 'No public read API; oEmbed requires an approved Meta app token. Only share evidence.' },
  facebook: { collector: 'Links shared on Bluesky', direct: false, note: 'No public read API. Only share evidence.' },
  other: { collector: 'Links shared on Bluesky', direct: false, note: 'Unrecognised video hosts.' },
};

export function buildCoverage(records: VideoRecord[], sources: SourceStatus[], inFeedIds: Set<string>, now: string, youtubeQuota?: { used: number; limit: number; searches: number; searchLimit: number }): PlatformCoverage[] {
  const out: PlatformCoverage[] = [];
  for (const platform of ['youtube', 'bluesky', 'tiktok', 'instagram', 'facebook', 'other'] as const) {
    const rs = records.filter((r) => r.platform === platform);
    const meta = PLATFORM_META[platform];
    const src = sources.find((s) => s.source === (platform === 'youtube' ? 'youtube' : platform === 'bluesky' ? 'bluesky' : 'bluesky'));
    const verified = rs.filter((r) => r.verified);
    const shares = rs.filter((r) => !r.verified);
    const latest = rs.map((r) => r.observedAt).sort().pop();
    const status: PlatformCoverage['status'] = meta.direct && verified.length ? 'direct' : rs.length ? 'indirect' : 'unavailable';
    out.push({
      platform, status, collector: meta.collector,
      lastSuccess: src?.ok ? src.fetchedAt : undefined,
      uniqueVideos: rs.length, verifiedVideos: verified.length, unverifiedShares: shares.length,
      directStatistics: meta.direct && verified.length > 0,
      freshnessHours: latest ? round(hoursBetween(latest, now), 1) : undefined,
      errors: src && !src.ok ? 1 : 0,
      quota: platform === 'youtube' && youtubeQuota ? { used: youtubeQuota.used, limit: youtubeQuota.limit, searches: youtubeQuota.searches, searchLimit: youtubeQuota.searchLimit } : undefined,
      candidates: rs.filter(isCandidate).length,
      inFeed: rs.filter((r) => inFeedIds.has(r.id)).length,
      rejected: rs.filter((r) => r.state === 'rejected').length,
      note: platform === 'youtube' && src?.mode === 'disabled' ? 'YouTube key not configured — no direct statistics.' : meta.note,
    });
  }
  return out;
}

/** Category waves: cluster-level states — a wave needs independent creators, not one big video. */
export function buildWaves(trends: Trend[], records: VideoRecord[], now: string): VideoIntel['waves'] {
  const byObs = new Map(records.map((r) => [r.id, r]));
  const out: VideoIntel['waves'] = [];
  for (const t of trends) {
    if (t.kind !== 'microtrend' && t.kind !== 'format') continue;
    const w = t.windows['7d'];
    if (w.grade === 'insufficient' || t.isNewsEvent) continue;
    const videos = t.evidence.filter((e) => e.kind === 'video');
    const platforms = Array.from(new Set(videos.map((e) => byObs.get(e.id)?.platform || e.video?.platform || e.source)));
    // propagation sequence: earliest verified content time per platform (shares use the post time, labelled as such)
    const firstBy = new Map<string, string>();
    for (const e of videos) {
      const p = byObs.get(e.id)?.platform || e.video?.platform || e.source;
      const at = contentTime(e);
      if (!at) continue;
      if (!firstBy.has(p) || at < firstBy.get(p)!) firstBy.set(p, at);
    }
    const sequence = Array.from(firstBy.entries()).map(([platform, at]) => ({ platform, at })).sort((a, b) => a.at.localeCompare(b.at));
    const growth = w.growth.basis === 'measured' ? w.growth.ratio : undefined;
    let state: CategoryWaveState = 'insufficient';
    if (w.creators >= 3 && w.newCreators >= 2 && (growth == null || growth >= 1.15) && w.lifecycle !== 'cooling') state = 'promising_wave';
    else if (w.creators >= 30 && (w.videoPerformance ?? 0) < 50) state = 'crowded';
    else if (w.lifecycle === 'cooling' || (growth != null && growth < 0.8)) state = 'declining';
    else if (w.creators >= 6) state = 'established';
    if (t.isGeneric && state === 'promising_wave' && !(growth != null && growth >= 1.5)) state = 'established';
    out.push({ trendId: t.id, name: t.name, category: t.category, state, creators: w.creators, videos: w.videos, newCreators48h: w.newCreators, growth, platforms, firstSeen: t.firstDetected, sequence });
  }
  void now;
  const order: CategoryWaveState[] = ['promising_wave', 'established', 'crowded', 'declining', 'insufficient'];
  return out.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.newCreators48h - a.newCreators48h || b.creators - a.creators).slice(0, 40);
}

export function buildVideoIntel(opts: { records: VideoRecord[]; trends: Trend[]; sources: SourceStatus[]; observations: Observation[]; now: string; youtubeQuota?: { used: number; limit: number; searches: number; searchLimit: number } }): VideoIntel {
  const { records, trends, sources, now } = opts;
  const viralNow = viralNowLists(records, now);
  const earlyRadar = earlyRadarList(records);
  const bskyOnly = new Set<VideoRecord['platform']>(['bluesky']);
  const bluesky = { viralNow: viralNowLists(records, now, 30, bskyOnly)['7d'], earlyRadar: earlyRadarList(records, 30, bskyOnly) };
  const inFeed = new Set<string>([...VIDEO_WINDOWS.flatMap((w: VideoWindow) => viralNow[w].slice(0, 50).map((c: VideoCard) => c.id)), ...earlyRadar.slice(0, 50).map((c) => c.id), ...bluesky.viralNow.map((c) => c.id), ...bluesky.earlyRadar.map((c) => c.id)]);
  const counts = { verified_hit: 0, early_breakout: 0, unverified_signal: 0, rejected: 0 } as VideoIntel['counts'];
  const platforms: Record<string, number> = {};
  for (const r of records) {
    counts[r.state]++;
    platforms[r.platform] = (platforms[r.platform] || 0) + 1;
  }
  return {
    generatedAt: now, counts, platforms, viralNow, earlyRadar, bluesky,
    waves: buildWaves(trends, records, now),
    funnel: buildFunnel(records, inFeed),
    coverage: buildCoverage(records, sources, inFeed, now, opts.youtubeQuota),
  };
}
