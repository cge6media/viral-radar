/** Video-native data access for the dashboard: lazy index, platform filters, sort modes, official embeds. */
import type { VideoCard, VideoRecord, VideoWindow } from './types';
import { VIDEO_WINDOW_HOURS } from './types';
import { fmtNum } from './data';

export type PlatformFilter = 'all' | 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'other';
export type LanguageFilter = 'all' | 'en' | 'es' | 'latin' | 'nonlatin';
export const LANGUAGE_FILTERS: { id: LanguageFilter; label: string; desc: string }[] = [
  { id: 'all', label: 'All languages', desc: 'Everything, worldwide' },
  { id: 'en', label: 'English', desc: 'Titles detected as English' },
  { id: 'es', label: 'Spanish', desc: 'Titles detected as Spanish' },
  { id: 'latin', label: 'Other Latin-script', desc: 'Portuguese, French, German, Indonesian, Filipino, … and unclear Latin-script titles' },
  { id: 'nonlatin', label: 'Non-Latin scripts', desc: 'Hindi, Arabic, Japanese, Korean, Thai, Cyrillic, …' },
];
const LATIN_LANGS = new Set(['en', 'es', 'pt', 'fr', 'de', 'it', 'id', 'tl', 'vi', 'tr', 'latin']);
export function languageMatches(c: { language?: string }, f: LanguageFilter): boolean {
  if (f === 'all') return true;
  const l = c.language || 'other';
  if (f === 'en') return l === 'en';
  if (f === 'es') return l === 'es';
  if (f === 'latin') return LATIN_LANGS.has(l) && l !== 'en' && l !== 'es';
  return !LATIN_LANGS.has(l);
}
export const KIND_LABEL: Record<string, { label: string; short: string; desc: string }> = {
  established: { label: 'Established hit', short: 'Established', desc: 'Already above the age-appropriate hit floor (1M views in the first day … 5M by 30 days).' },
  early: { label: 'Early breakout', short: 'Early', desc: 'Below the hit floor for its age, but on a measured abnormal rise (or a very young video with an exceptional average, marked provisional).' },
  delayed: { label: 'Delayed breakout', short: 'Resurfacing', desc: 'Older than a week and gaining measurably faster than its own lifetime average — resurfacing, not a new upload.' },
};
export const BAND_LABEL: Record<string, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
/** honest Shorts label: verified → "Shorts"; duration/url only → "short-form"; otherwise nothing */
export function shortsLabel(c: { platform: string; isShort?: boolean; shortsEvidence?: string }): string {
  if (c.platform !== 'youtube') return '';
  if (c.shortsEvidence === 'verified' || c.shortsEvidence === 'url') return ' Shorts';
  if (c.shortsEvidence === 'not_short') return '';
  if (c.isShort) return ' short-form';
  return '';
}
export type SortMode = 'most_viral' | 'fastest_rising' | 'newest_breakouts' | 'most_engaging' | 'creator_outliers' | 'strongest_momentum';
export const PLATFORM_FILTERS: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'All platforms' }, { id: 'youtube', label: 'YouTube' }, { id: 'tiktok', label: 'TikTok' }, { id: 'instagram', label: 'Instagram' }, { id: 'facebook', label: 'Facebook' }, { id: 'other', label: 'Other sources' },
];
export const SORT_MODES: { id: SortMode; label: string; desc: string }[] = [
  { id: 'most_viral', label: 'Most viral', desc: 'Highest verified popularity for the period' },
  { id: 'fastest_rising', label: 'Fastest rising', desc: 'Strongest measured recent growth (views/hour between real observations)' },
  { id: 'newest_breakouts', label: 'Newest breakouts', desc: 'Youngest videos with credible abnormal momentum' },
  { id: 'most_engaging', label: 'Most engaging', desc: 'Likes and comments relative to views (needs ≥10K views)' },
  { id: 'creator_outliers', label: 'Creator outliers', desc: 'Performing far above the creator\'s normal range' },
];
export const STATE_LABEL: Record<string, { label: string; short: string; desc: string }> = {
  verified_hit: { label: 'Verified viral hit', short: 'Viral hit', desc: 'Convincing verified popularity on its platform for its age.' },
  early_breakout: { label: 'Early breakout', short: 'Breakout', desc: 'Credible abnormal growth: measured velocity, a young video\'s exceptional average, or a creator outlier.' },
  unverified_signal: { label: 'Unverified signal', short: 'Unverified', desc: 'Shared or mentioned, but no platform statistics are available.' },
  rejected: { label: 'Not featured', short: 'Not featured', desc: 'Below thresholds, stale, duplicate or unsupported.' },
};
export const PLATFORM_NAME: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', bluesky: 'Bluesky', other: 'Other' };

let indexPromise: Promise<{ generatedAt: string; runId: string; records: VideoRecord[] }> | null = null;
export function loadVideoIndex(): Promise<{ generatedAt: string; runId: string; records: VideoRecord[] }> {
  if (!indexPromise) {
    indexPromise = fetch(`${import.meta.env.BASE_URL}data/videos.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' }).then(async (r) => {
      if (!r.ok) throw new Error(`videos.json ${r.status}`);
      return (await r.json()) as { generatedAt: string; runId: string; records: VideoRecord[] };
    });
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
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

/** a Creator Desk evidence row as a playable card (opens the same player as everywhere else) */
export function evidenceToCard(e: { id: string; platform: string; url: string; title: string; creator?: string; thumbnail?: string; publishedAt?: string; ageHours?: number; views?: number; likes?: number; velocityPerHour?: number; velocityHours?: number; state: VideoCard['state']; kind?: VideoCard['kind']; verified: boolean; durationSec?: number; language?: string }): VideoCard {
  const platformId = e.platform === 'youtube' ? (e.url.match(/(?:v=|shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/) || [])[1] || e.id.split(':').pop() || e.id : e.id.split(':').pop() || e.id;
  return {
    id: e.id, platform: e.platform as VideoCard['platform'], platformId, url: e.url, title: e.title, thumbnail: e.thumbnail, creator: e.creator, publishedAt: e.publishedAt, ageHours: e.ageHours,
    durationSec: e.durationSec, isShort: e.platform === 'youtube' ? /shorts\//.test(e.url) || (e.durationSec != null && e.durationSec <= 180) : undefined,
    views: e.views, likes: e.likes, state: e.state, viralScore: 0, breakoutScore: 0, engagementScore: 0, outlierScore: 0,
    velocityPerHour: e.velocityPerHour, velocityHours: e.velocityHours, category: '', formats: [], reasons: [], crossPlatform: 0, verified: e.verified, kind: e.kind, language: e.language,
  };
}

export function platformOf(c: { platform: string }): PlatformFilter {
  return c.platform === 'bluesky' ? 'other' : (c.platform as PlatformFilter);
}

/** Filter + sort over cards. Platform filters reflect the record's own platform (never the platform of a share). */
export function selectCards(cards: VideoCard[], opts: { platform: PlatformFilter; sort: SortMode; window?: VideoWindow; now: number; states?: VideoCard['state'][]; language?: LanguageFilter; kinds?: string[] }): VideoCard[] {
  const hours = opts.window ? VIDEO_WINDOW_HOURS[opts.window] : Infinity;
  let list = cards.filter((c) => (opts.platform === 'all' ? c.platform !== 'bluesky' : platformOf(c) === opts.platform));
  if (opts.states) list = list.filter((c) => opts.states!.includes(c.state));
  if (opts.language && opts.language !== 'all') list = list.filter((c) => languageMatches(c, opts.language!));
  if (opts.kinds && opts.kinds.length) list = list.filter((c) => opts.kinds!.includes(c.kind || ''));
  if (isFinite(hours)) list = list.filter((c) => c.publishedAt && (opts.now - new Date(c.publishedAt).getTime()) / 36e5 <= hours);
  switch (opts.sort) {
    case 'fastest_rising':
      list = list.filter((c) => c.velocityPerHour != null).sort((a, b) => (b.velocityPerHour || 0) - (a.velocityPerHour || 0));
      break;
    case 'newest_breakouts':
      list = list.filter((c) => c.state === 'early_breakout').sort((a, b) => (a.ageHours ?? Infinity) - (b.ageHours ?? Infinity));
      break;
    case 'most_engaging':
      list = list.filter((c) => c.engagementScore > 0).sort((a, b) => b.engagementScore - a.engagementScore || (b.views || 0) - (a.views || 0));
      break;
    case 'creator_outliers':
      list = list.filter((c) => c.outlierScore > 0 || (c.subscriberRatio ?? 0) >= 2).sort((a, b) => (b.baselineRatio ?? b.subscriberRatio ?? 0) - (a.baselineRatio ?? a.subscriberRatio ?? 0));
      break;
    case 'strongest_momentum':
      list = list.sort((a, b) => b.breakoutScore - a.breakoutScore || (a.ageHours ?? 1e9) - (b.ageHours ?? 1e9));
      break;
    default:
      list = list.sort((a, b) => b.viralScore - a.viralScore || (b.views || 0) - (a.views || 0));
  }
  return list;
}

/** Official embed URL when the platform supports embedding; undefined → direct-link fallback (no fake player). */
export function embedFor(c: { platform: string; platformId: string; url: string; thumbnail?: string }): { src: string; portrait: boolean; provider: string } | undefined {
  if (c.platform === 'youtube' && /^[A-Za-z0-9_-]{6,}$/.test(c.platformId)) {
    return { src: `https://www.youtube-nocookie.com/embed/${c.platformId}?autoplay=1&playsinline=1&rel=0`, portrait: /shorts\//.test(c.url), provider: 'YouTube' };
  }
  if (c.platform === 'tiktok' && /^\d{10,}$/.test(c.platformId)) {
    return { src: `https://www.tiktok.com/player/v1/${c.platformId}?autoplay=1&music_info=1&description=1`, portrait: true, provider: 'TikTok' };
  }
  if (c.platform === 'instagram' && /^[A-Za-z0-9_-]{5,}$/.test(c.platformId)) {
    return { src: `https://www.instagram.com/reel/${c.platformId}/embed/`, portrait: true, provider: 'Instagram' };
  }
  if (c.platform === 'facebook') {
    return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(c.url)}&show_text=false&autoplay=true`, portrait: false, provider: 'Facebook' };
  }
  if (c.platform === 'bluesky') {
    // the thumbnail carries the author's DID: video.bsky.app/watch/<did>/<cid>/thumbnail.jpg; the post rkey is the record id
    const did = c.thumbnail?.match(/video\.bsky\.app\/watch\/([^/]+)\//)?.[1];
    if (did) return { src: `https://embed.bsky.app/embed/${decodeURIComponent(did)}/app.bsky.feed.post/${c.platformId}`, portrait: true, provider: 'Bluesky' };
  }
  return undefined;
}

export function fmtViews(c: { views?: number; likes?: number; platform: string }): string {
  if (c.views != null) return `${fmtNum(c.views)} views`;
  if (c.likes != null) return `${fmtNum(c.likes)} likes${c.platform === 'bluesky' ? ' (Bluesky)' : ''}`;
  return 'no statistics';
}

export function fmtAge(h?: number): string {
  if (h == null) return 'unknown date';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function fmtDuration(s?: number): string | undefined {
  if (s == null || !isFinite(s) || s <= 0) return undefined;
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Short, honest momentum line for a card. */
export function momentumLine(c: VideoCard): { text: string; measured: boolean } {
  if (c.velocityPerHour != null && c.velocityHours != null) return { text: `+${fmtNum(c.velocityPerHour)}/h measured over ${c.velocityHours < 2 ? `${c.velocityHours}h` : `${Math.round(c.velocityHours)}h`}${c.velocityRatio != null ? ` · ${c.velocityRatio}× lifetime` : ''}`, measured: true };
  if (c.lifetimeRate != null) return { text: `${fmtNum(c.lifetimeRate)}/h lifetime average`, measured: false };
  return { text: 'not measured', measured: false };
}

/** Shorts get YouTube's vertical thumbnail when it exists; everything else the landscape one. */
export function thumbSources(c: { platform: string; platformId: string; thumbnail?: string; isShort?: boolean }): string[] {
  if (c.platform === 'youtube') {
    const list = c.isShort ? [`https://i.ytimg.com/vi/${c.platformId}/oardefault.jpg`, `https://i.ytimg.com/vi/${c.platformId}/hqdefault.jpg`] : [`https://i.ytimg.com/vi/${c.platformId}/hqdefault.jpg`];
    if (c.thumbnail && !list.includes(c.thumbnail)) list.push(c.thumbnail);
    return list;
  }
  return c.thumbnail ? [c.thumbnail] : [];
}
