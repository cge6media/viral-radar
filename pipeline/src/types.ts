/**
 * Core data model for the Viral Radar pipeline (v2).
 *
 * Observation  = one raw, verifiable piece of evidence collected from a source (a trending search, a hashtag,
 *                a post, a video) with a URL and explicit, separate timestamps.
 * Trend        = a cluster of related observations across sources, scored per time window.
 *
 * Timestamps are kept apart on purpose:
 *   videoPublishedAt  when the VIDEO was published on its platform (only when the platform told us)
 *   postPublishedAt   when the SOCIAL POST that carried it was published
 *   publishedAt       the content time used for ordering = videoPublishedAt ?? (native post time) ?? spike time;
 *                     never the share time of an external video
 *   firstSeenAt       first discovery by this pipeline
 *   observedAt        latest sighting (metrics as of this time)
 *   verifiedAt        last time the record was fetched directly from its own platform (API / oEmbed)
 */

export type Platform = 'google_trends' | 'youtube' | 'bluesky' | 'mastodon' | 'tiktok';

/** What kind of evidence this is. Search interest ≠ verified video performance. */
export type EvidenceKind =
  | 'search_interest' // Google Trends trending searches
  | 'social_topic'    // Bluesky trending topic
  | 'hashtag'         // Mastodon / TikTok trending hashtag
  | 'video'           // A real video with a URL (YouTube video, Bluesky native video, external video link)
  | 'post';           // A social post with engagement counts but no video

/** direct = measured on the video platform itself; indirect = a share, a search spike, a hashtag */
export type EvidenceLevel = 'direct' | 'indirect';

export interface Metrics {
  views?: number;
  likes?: number;
  reposts?: number;
  comments?: number;
  quotes?: number;
  /** Google Trends "approx traffic" lower bound (e.g. "2000+" → 2000) */
  approxTraffic?: number;
  /** hashtag uses in the latest day bucket */
  uses?: number;
  /** distinct accounts using a hashtag in the latest day bucket */
  accounts?: number;
  /** rank within its source list (1 = top) */
  rank?: number;
}

export interface VideoRef {
  platform: 'youtube' | 'bluesky' | 'tiktok' | 'instagram' | 'other';
  id: string;
  durationSec?: number;
  channelId?: string;
  /** true when the video's own platform statistics are in `metrics` */
  statsDirect: boolean;
}

export interface Observation {
  /** stable id: `${source}:${kind}:${normalizedKey}` */
  id: string;
  source: Platform;
  kind: EvidenceKind;
  level: EvidenceLevel;
  /** normalized term/hashtag/video id used for clustering */
  key: string;
  title: string;
  url: string;
  observedAt: string;
  firstSeenAt?: string;
  verifiedAt?: string;
  /** content time used for windows/ordering (see header) */
  publishedAt?: string;
  videoPublishedAt?: string;
  postPublishedAt?: string;
  /** metrics of the item itself (for an external video link: the VIDEO's stats, empty until verified) */
  metrics: Metrics;
  /** engagement of the social post that carried the item (kept apart from the video's own stats) */
  postMetrics?: Metrics;
  video?: VideoRef;
  region?: string;
  /** creator of the item (for a video: the channel; for a share: see `sharedBy`) */
  creator?: { name: string; url?: string };
  /** account that shared an external item */
  sharedBy?: { name: string; url?: string };
  thumbnail?: string;
  /** description / snippet / post text used for classification */
  text?: string;
  tags?: string[];
  links?: { title: string; url: string; source?: string }[];
  /** a time series supplied by the source itself (e.g. Mastodon 7-day history) */
  history?: { t: string; value: number }[];
  /** which collector query produced this (provenance) */
  query?: string;
  /** relevance validation results, by format id (filled by the relevance stage) */
  formats?: string[];
  /** YouTube category label etc. */
  platformCategory?: string;
}

export interface SourceStatus {
  source: Platform;
  label: string;
  ok: boolean;
  mode: 'live' | 'cached' | 'disabled' | 'fixture';
  items: number;
  fetchedAt?: string;
  error?: string;
  note?: string;
}

/** Source Quality framework: quality over quantity. */
export interface SourceQuality {
  source: Platform;
  label: string;
  status: SourceStatus['mode'] | 'error';
  lastSuccess?: string;
  /** items collected this run */
  items: number;
  /** unique video records contributed (7-day window) */
  uniqueVideos: number;
  /** of which with direct platform statistics */
  directVideos: number;
  /** items that passed relevance validation for at least one format */
  relevantItems: number;
  /** metrics this source can supply */
  metrics: string[];
  /** median age of this run's items (hours since content time) */
  medianAgeHours?: number;
  /** days of history available for this source */
  historyDays: number;
  /** share of sub-requests that failed this run */
  errorRate: number;
  /** editorial weight used in scoring (direct video sources count more) */
  weight: number;
  notes: string[];
}

export type Lifecycle = 'emerging' | 'accelerating' | 'breaking_out' | 'peaking' | 'cooling' | 'insufficient_data';
export type EvidenceGrade = 'strong' | 'developing' | 'early' | 'insufficient';
export type TrendKind = 'microtrend' | 'format' | 'topic' | 'category';
export type Window = '24h' | '48h' | '7d';
export const WINDOWS: Window[] = ['24h', '48h', '7d'];
export const WINDOW_HOURS: Record<Window, number> = { '24h': 24, '48h': 48, '7d': 168 };

export interface WindowScores {
  window: Window;
  /** evidence items whose content time falls inside the window */
  items: number;
  videos: number;
  directVideos: number;
  creators: number;
  /** creators whose first example in this cluster appeared in the last 48h of the window */
  newCreators: number;
  /** 0-100 measured views/engagement on the video platform, age-normalized (null when no direct stats) */
  videoPerformance: number | null;
  /** 0-100 measured change of the same videos' statistics across observations (null without ≥2 observations) */
  videoMomentum: number | null;
  /** 0-100 independent creators producing similar videos */
  adoption: number;
  /** 0-100 supporting searches / hashtags / discussion */
  audienceInterest: number;
  /** 0-100 reliability & independence of the evidence */
  confidence: number;
  /** 0-100 usefulness for producing original content */
  creatorOpportunity: number;
  /** 0-100 composite used for ordering within the window */
  momentum: number;
  opportunity: number;
  grade: EvidenceGrade;
  lifecycle: Lifecycle;
  /** growth facts (ratio etc. only when measured) */
  growth: { basis: 'measured'; ratio: number; windowHours: number; metric: string } | { basis: 'provisional'; ratio?: undefined; windowHours?: undefined; metric?: undefined };
  /** per-video velocity facts */
  velocity?: { viewsPerHour?: number; likesPerHour?: number; videosMeasured: number };
  components: Record<string, number>;
  notes: string[];
}

export interface Trend {
  id: string;
  kind: TrendKind;
  name: string;
  category: string;
  subcategory: string;
  /** the specific format / microtrend label */
  format: string;
  platforms: Platform[];
  evidenceKinds: EvidenceKind[];
  firstDetected: string;
  lastSeen: string;
  evidenceCount: number;
  videoCount: number;
  directVideoCount: number;
  creatorCount: number;
  /** scores for the default window (7d) */
  scores: WindowScores;
  windows: Record<Window, WindowScores>;
  /** validated, most relevant evidence first (capped) */
  evidence: Observation[];
  keywords: string[];
  series: { t: string; momentum: number; adoption: number; signal: number }[];
  isNewsEvent: boolean;
  /** generic evergreen category rather than a specific format (never a top recommendation on its own) */
  isGeneric: boolean;
  /** passes the bar for a recommendation: grade ≥ early, not news, not generic */
  qualified: boolean;
  /** monetization suitability of the category (editorial profile, 0-100) */
  monetizationSuitability: number;
  /** one-paragraph, evidence-backed explanation */
  summary: string;
}

export interface CategoryActivity {
  category: string;
  videos7d: number;
  videos24h: number;
  creators7d: number;
  /** median engagement/views level of validated videos (0-1) */
  level: number;
  /** measured change of 24h volume vs the prior 24h (null when unmeasurable) */
  change24h: number | null;
  qualifiedTrends: number;
  topTrendId?: string;
}

export interface QualitySummary {
  relevance: { sampled: number; relevant: number; rate: number };
  duplicates: number;
  wrongDates: number;
  brokenLinks: number;
  emptyRecommendations: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

export interface Snapshot {
  version: 2;
  generatedAt: string;
  runId: string;
  sources: SourceStatus[];
  sourceQuality: SourceQuality[];
  trends: Trend[];
  categories: CategoryActivity[];
  quality: QualitySummary;
  stats: {
    observationsThisRun: number;
    observationsTotal: number;
    qualifiedTrends: number;
    newTrends24h: number;
    historyDays: number;
    earliestObservation?: string;
    youtube?: { quotaUnitsToday: number; searchCallsToday: number; trackedVideos: number };
  };
}
