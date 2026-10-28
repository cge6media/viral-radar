/**
 * Core data model for the Viral Radar pipeline.
 *
 * Observation  = one raw, verifiable piece of evidence collected from a source
 *                (a trending search, a hashtag, a post, a video) with a URL and timestamp.
 * Trend        = a cluster of related observations across sources, with scores.
 */

export type Platform =
  | 'google_trends'
  | 'youtube'
  | 'bluesky'
  | 'mastodon'
  | 'tiktok';

/** What kind of evidence this is. Search interest ≠ verified video performance. */
export type EvidenceKind =
  | 'search_interest' // Google Trends trending searches
  | 'social_topic'    // Bluesky trending topic (editorial/algorithmic topic cluster)
  | 'hashtag'         // Mastodon / TikTok trending hashtag
  | 'video'           // A real video with a URL (YouTube video, Bluesky native video, external video link)
  | 'post';           // A social post with engagement counts but no video

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

export interface Observation {
  /** stable id: `${source}:${kind}:${normalizedKey}` */
  id: string;
  source: Platform;
  kind: EvidenceKind;
  /** normalized term/hashtag/video id used for clustering */
  key: string;
  title: string;
  url: string;
  /** when the collector saw it (ISO) */
  observedAt: string;
  /** when the item was published / started trending, if the source tells us */
  publishedAt?: string;
  metrics: Metrics;
  region?: string;
  creator?: { name: string; url?: string };
  thumbnail?: string;
  /** description / snippet / post text used for classification */
  text?: string;
  /** hashtags found on the item, lowercase, no '#' */
  tags?: string[];
  /** supporting links (news articles etc.) */
  links?: { title: string; url: string; source?: string }[];
  /** a time series supplied by the source itself (e.g. Mastodon 7-day history) */
  history?: { t: string; value: number }[];
  /** which collector query produced this (for provenance) */
  query?: string;
}

export interface SourceStatus {
  source: Platform;
  label: string;
  ok: boolean;
  /** 'live' = fetched this run; 'cached' = served from previous snapshot after failure; 'disabled' = not configured */
  mode: 'live' | 'cached' | 'disabled' | 'fixture';
  items: number;
  fetchedAt?: string;
  error?: string;
  note?: string;
}

export type Lifecycle =
  | 'emerging'
  | 'accelerating'
  | 'breaking_out'
  | 'peaking'
  | 'cooling'
  | 'insufficient_data';

export interface ScoreBreakdown {
  /** composite rank used for the Top 20 (momentum/creator/monetization discounted by confidence) */
  opportunity: number;     // 0-100
  momentum: number;        // 0-100
  confidence: number;      // 0-100
  monetization: number;    // 0-100
  creator: number;         // 0-100
  /** 'observed' when growth is computed from ≥2 historical measurements; otherwise 'provisional' */
  momentumBasis: 'observed' | 'provisional';
  /** observed growth ratio (current/previous) when available */
  growth?: number;
  growthWindowHours?: number;
  components: Record<string, number>;
  notes: string[];
}

export interface Trend {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  microtrend: string;
  lifecycle: Lifecycle;
  platforms: Platform[];
  evidenceKinds: EvidenceKind[];
  firstSeen: string;
  lastSeen: string;
  /** count of observations in this cluster */
  evidenceCount: number;
  /** number of distinct sources */
  sourceCount: number;
  /** count of observations that are actual videos */
  videoCount: number;
  scores: ScoreBreakdown;
  /** top evidence (sorted by usefulness), capped */
  evidence: Observation[];
  /** tokens that define the cluster */
  keywords: string[];
  /** momentum series across runs (from scoring history) */
  series: { t: string; momentum: number; signal: number }[];
  /** true if the trend is about a specific named person / news event rather than a repeatable format */
  isNewsEvent: boolean;
  /** whether the trend has creator-safe content (no adult labels, etc.) */
  safe: boolean;
}

export interface Snapshot {
  version: number;
  generatedAt: string;
  runId: string;
  sources: SourceStatus[];
  trends: Trend[];
  stats: {
    observationsThisRun: number;
    observationsTotal: number;
    historyDays: number;
    earliestObservation?: string;
  };
}
