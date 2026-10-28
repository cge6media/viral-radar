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
  platform: 'youtube' | 'bluesky' | 'tiktok' | 'instagram' | 'facebook' | 'other';
  id: string;
  durationSec?: number;
  channelId?: string;
  /** true when the video's own platform statistics are in `metrics` */
  statsDirect: boolean;
  /** live stream / premiere state as reported by the platform */
  live?: 'live' | 'upcoming';
  /** 4.0: Shorts verification — 'verified' = youtube.com/shorts/<id> serves the Shorts player; 'not_short' = it redirects to /watch */
  shortForm?: 'verified' | 'not_short';
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
  /** language as declared by the platform (defaultAudioLanguage/defaultLanguage), when it told us */
  language?: string;
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
  /** 4.0: what kind of opportunity this cluster is (event / meme / format / uncertain), with the basis */
  opportunity?: OpportunityClass;
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

// ---------------------------------------------------------------------------------------------------------------
// 3.0 — video-native intelligence
// ---------------------------------------------------------------------------------------------------------------

export type VideoWindow = '24h' | '48h' | '72h' | '7d' | '30d';
export const VIDEO_WINDOWS: VideoWindow[] = ['24h', '48h', '72h', '7d', '30d'];
export const VIDEO_WINDOW_HOURS: Record<VideoWindow, number> = { '24h': 24, '48h': 48, '72h': 72, '7d': 168, '30d': 720 };

/** The five evidence classes. Only the first two are video rankings; the third is a cluster-level state. */
export type VideoState = 'verified_hit' | 'early_breakout' | 'unverified_signal' | 'rejected';
export type BreakoutKind = 'established' | 'early' | 'delayed';
export type ConfidenceBand = 'high' | 'medium' | 'low';
export type CategoryWaveState = 'promising_wave' | 'established' | 'crowded' | 'declining' | 'insufficient';

export interface VelocityPoint {
  /** hours covered by this measurement interval (actual elapsed time between two observations) */
  hours: number;
  /** views (or likes when views are unavailable) gained per hour over the interval */
  perHour: number;
  metric: 'views' | 'likes';
  /** end of the interval */
  measuredAt: string;
}

export interface CrossPlatformLink {
  /** A identical video, B modified repost, C derivative, D related trend */
  type: 'A' | 'B' | 'C' | 'D';
  platform: VideoRef['platform'] | 'bluesky';
  /** the other record (observation id) or a cluster id for type D */
  ref: string;
  url?: string;
  title?: string;
  creator?: string;
  /** when the related item was published/posted (never a share time standing in for a publish time) */
  at?: string;
  confidence: number;
  basis: string;
}

/** One video, with everything the pipeline knows about it. Video metrics and post metrics never mix. */
export interface VideoRecord {
  /** observation id of the primary record (platform record when one exists, else the share) */
  id: string;
  platform: VideoRef['platform'] | 'bluesky';
  platformId: string;
  url: string;
  title: string;
  thumbnail?: string;
  creator?: { name: string; url?: string; channelId?: string; subscribers?: number };
  durationSec?: number;
  isShort?: boolean;
  isLive?: boolean;
  publishedAt?: string;
  /** hours since publication at generation time (undefined when the publish date is unverified) */
  ageHours?: number;
  firstSeenAt: string;
  observedAt: string;
  verifiedAt?: string;
  /** statistics as measured on the video platform (empty when unverified) */
  metrics: Metrics;
  /** engagement of social posts that shared it, kept apart (summed over shares) */
  shareMetrics?: Metrics & { posts?: number; platforms?: string[] };
  verified: boolean;
  /** which collectors/queries surfaced it */
  sources: string[];
  category: string;
  subcategory?: string;
  formats: string[];
  platformCategory?: string;
  language?: string;
  /** views per hour averaged over the whole lifetime — NOT a recent velocity */
  lifetimeRate?: number;
  /** measured recent velocity from actual observation intervals (latest first) */
  velocity?: VelocityPoint[];
  /** latest interval rate ÷ previous interval rate (needs ≥3 observations) */
  acceleration?: number;
  /** latest interval rate ÷ lifetime average */
  velocityRatio?: number;
  /** views (or likes) gained in the trailing windows, from observation history (only where history supports it) */
  gained?: Partial<Record<'1h' | '3h' | '6h' | '12h' | '24h' | '48h' | '72h' | '7d', number>>;
  likeRate?: number;
  /** views ÷ channel median of recent uploads (when a baseline was fetched) */
  baselineRatio?: number;
  /** views ÷ subscribers */
  subscriberRatio?: number;
  /** percentile of lifetime rate among videos of comparable age on the same platform (0..1) */
  agePercentile?: number;
  state: VideoState;
  /**
   * 4.0: which kind of attention this is — established (already viral for its age), early (a young video on an
   * abnormal rise, not yet at hit level), delayed (an older video resurfacing with measured new velocity)
   */
  kind?: BreakoutKind;
  /** 4.0: descriptive confidence band — never a probability (see docs/SCORING.md) */
  confidenceBand: ConfidenceBand;
  /** 4.0: how the Shorts label was established; 'duration' alone only makes a short-form *candidate* */
  shortsEvidence?: 'verified' | 'duration' | 'url' | 'not_short' | 'none';
  /** why it is in (or out of) the feed — real metrics, honest wording */
  reasons: string[];
  rejectedBy?: string;
  /** 0-100 established virality (verified popularity for its age) */
  viralScore: number;
  /** 0-100 breakout momentum (measured growth; 0 without measurement) */
  breakoutScore: number;
  engagementScore: number;
  outlierScore: number;
  confidence: number;
  crossPlatform: CrossPlatformLink[];
  /** cluster ids this video supports (microtrends / formats / topics) */
  trends: string[];
  observations: number;
}

export interface DiscoveryFunnel {
  discovered: number;
  withMetadata: number;
  verified: number;
  candidates: number;
  relevant: number;
  qualified: number;
  inFeed: number;
  /** rejection reasons with counts (rule → videos) */
  rejections: Record<string, number>;
}

export interface PlatformCoverage {
  platform: VideoRecord['platform'];
  status: 'direct' | 'indirect' | 'unavailable';
  collector: string;
  lastSuccess?: string;
  uniqueVideos: number;
  verifiedVideos: number;
  unverifiedShares: number;
  directStatistics: boolean;
  freshnessHours?: number;
  errors: number;
  quota?: { used: number; limit: number; searches?: number; searchLimit?: number };
  candidates: number;
  inFeed: number;
  rejected: number;
  note: string;
}

export interface VideoCard {
  id: string;
  platform: VideoRecord['platform'];
  platformId: string;
  url: string;
  title: string;
  thumbnail?: string;
  creator?: string;
  creatorUrl?: string;
  publishedAt?: string;
  ageHours?: number;
  durationSec?: number;
  isShort?: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  state: VideoState;
  viralScore: number;
  breakoutScore: number;
  engagementScore: number;
  outlierScore: number;
  velocityPerHour?: number;
  velocityHours?: number;
  velocityRatio?: number;
  acceleration?: number;
  lifetimeRate?: number;
  baselineRatio?: number;
  subscriberRatio?: number;
  category: string;
  formats: string[];
  reasons: string[];
  crossPlatform: number;
  verified: boolean;
  /** 4.0 */
  kind?: BreakoutKind;
  band?: ConfidenceBand;
  language?: string;
  shortsEvidence?: VideoRecord['shortsEvidence'];
  /** views (likes) gained in the trailing 24h, when the observation history brackets it */
  gained24h?: number;
  /** 4.0.1: desk evidence tier — qualified (hit/breakout), mid_size (≥100K views below the viral floor for its age) or context (smaller) */
  tier?: 'qualified' | 'mid_size' | 'context';
  /** 4.0.1: the term of the cluster's name/signature this title carries (why it is evidence) */
  matched?: string;
}

export interface VideoIntel {
  generatedAt: string;
  counts: Record<VideoState, number>;
  platforms: Record<string, number>;
  /** Viral Now (platforms with view counts), by viralScore, per publish window */
  viralNow: Record<VideoWindow, VideoCard[]>;
  /** Early Radar (platforms with view counts), by breakoutScore */
  earlyRadar: VideoCard[];
  /** Bluesky-native lists on Bluesky's own scale (likes, no views) — never mixed into the lists above */
  bluesky: { viralNow: VideoCard[]; earlyRadar: VideoCard[] };
  /** category waves (cluster-level) */
  waves: { trendId: string; name: string; category: string; state: CategoryWaveState; creators: number; videos: number; newCreators48h: number; growth?: number; platforms: string[]; firstSeen: string; sequence: { platform: string; at: string }[] }[];
  funnel: DiscoveryFunnel;
  coverage: PlatformCoverage[];
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
  /** 3.0: video-native intelligence (top lists; the full index is in data/videos.json) */
  videos?: VideoIntel;
  /** 4.0: today's creator opportunities (Creator Desk) */
  desk?: DeskReport;
  /** 4.0: early-warning alerts (rolling 7 days; the client decides what is "new since last visit") */
  alerts?: Alert[];
  /** 4.0: collection health + freshness facts */
  health?: HealthReport;
  /** 4.0: prediction scorecard summary (full detail in data/predictions/scorecard.json) */
  scorecard?: ScorecardSummary;
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

// ---------------------------------------------------------------------------------------------------------------
// 4.0 — opportunity classes, Creator Desk, predictions, alerts, health
// ---------------------------------------------------------------------------------------------------------------

/** Three types of viral opportunity (plus uncertain). A single huge video is not a content opportunity. */
export type OpportunityType = 'event' | 'meme' | 'format' | 'uncertain';
export interface OpportunityClass {
  type: OpportunityType;
  /** 0-100 how well the evidence supports the type */
  confidence: number;
  /** facts the decision rests on (independent creators, dominance of the top video, spread, recurrence) */
  basis: string[];
  /** structural features observed in the titles/descriptions of the examples (never inferred from visuals) */
  features: TrendFeatures;
}

export interface TrendFeatures {
  creators: number;
  videos: number;
  directVideos: number;
  /** share of total verified views held by the single biggest video (1 = one video is the whole cluster) */
  dominance: number;
  /** creators with ≥2 examples in the cluster (recurring producers of the format) */
  repeatCreators: number;
  /** hours between the first and the latest example (content time) */
  spreadHours: number;
  newCreators48h: number;
  platforms: string[];
  shortsShare: number;
  medianDurationSec?: number;
  languages: Record<string, number>;
  /** title-level hooks observed, with counts: question, pov, when, versus, numbered, series, challenge, reaction, transformation, character, caps, emoji */
  hooks: Record<string, number>;
  /** words shared by ≥ 3 independent creators' titles (the recognisable signature), excluding generic tags */
  signature: string[];
  /** whether the cluster name is a calendar moment, a title fragment, a broad tag or a real phrase */
  nameShape: 'phrase' | 'hashtag' | 'fragment' | 'calendar' | 'entity';
  /** share of examples whose TITLE carries the cluster's name tokens (a phrase living only in descriptions is boilerplate) */
  titleShare: number;
  /** share of examples that are live streams / stream recordings by title */
  liveShare: number;
  /** majority platform (YouTube) category of the examples, when known */
  platformCategory?: string;
  /** a hashtag made of generic descriptor words (#aianimation, #digitalart): a subject, not a format */
  descriptor: boolean;
  /** 4.0.1: does the single biggest video's own title carry the cluster's name? (a dominant unrelated video is noise, not an event) */
  dominantMatches?: boolean;
  /** 4.0.1: share of measured examples whose current rate is below 0.8× their lifetime average (past their peak) */
  coolingShare?: number;
  /** 4.0.1: share of measured examples whose current rate is ≥1.2× their lifetime average (still accelerating) */
  acceleratingShare?: number;
  /** 4.0.2: share of examples uploaded by broadcasters / news channels (coverage, not creator formats) */
  newsChannelShare?: number;
  /** 4.0.2: qualified clean examples younger than 72h from distinct creators — the flow of new hits, the real freshness signal */
  freshQualified?: number;
}

export type DeskAction = 'create_today' | 'research' | 'monitor' | 'participate' | 'skip';
export type DeskTiming = 'emerging' | 'accelerating' | 'established' | 'resurfacing' | 'peaking' | 'cooling';

export interface DeskEvidence {
  id: string;
  platform: VideoRecord['platform'];
  url: string;
  title: string;
  creator?: string;
  thumbnail?: string;
  publishedAt?: string;
  ageHours?: number;
  views?: number;
  likes?: number;
  velocityPerHour?: number;
  velocityHours?: number;
  /** 4.0.1: measured rate ÷ lifetime average (≥1.2 accelerating, <0.8 past its peak) */
  velocityRatio?: number;
  state: VideoState;
  kind?: BreakoutKind;
  verified: boolean;
  durationSec?: number;
  language?: string;
  /** 4.0.1: the term of the cluster's name/signature found in this title (what made it evidence) */
  matched?: string;
  /** 4.0.2: channel size when known (a 14M-subscriber channel's hit says less about the format than a 20K one's) */
  subscribers?: number;
}

export interface DeskOpportunity {
  id: string;
  trendId: string;
  name: string;
  category: string;
  type: OpportunityType;
  typeConfidence: number;
  timing: DeskTiming;
  timingWhy: string;
  evidence: DeskEvidence[];
  /** concise, factual explanation of why this is an opportunity now */
  why: string[];
  /** measured facts: creators, new creators, growth, best video */
  facts: { creators: number; newCreators48h: number; videos: number; directVideos: number; /** 4.0.1: how many of the clean examples are qualified hits/breakouts (the rest are ≥100K-view successes below the viral floor) */ qualified?: number; growth?: number; growthBasis: 'measured' | 'provisional'; topViews?: number; topVelocity?: number; grade: EvidenceGrade };
  features: TrendFeatures;
  production: { feasibleIn2h: boolean; approach: string[]; why: string; effortHours: [number, number] };
  monetization: { platforms: string[]; mechanisms: string[]; eligibility: string[]; suitability: number };
  action: DeskAction;
  actionWhy: string;
  /** 0-100 fit with the creator profile (AI entertainment, animation, characters, music, en/es, ≤2h) */
  fit: number;
  /** 0-100 evidence strength */
  evidenceScore: number;
  /** 0-100 timing score (earliness × momentum) */
  timingScore: number;
  /** composite used for ordering */
  score: number;
  /** the alternative "a popular video exists" reading, to keep the recommendation honest */
  caution?: string;
  /** 4.0.1: for monitored items — the observation that would change the verdict */
  nextCheck?: string;
  /** 4.0.1: the category was taken from the verified examples' own platform category when it contradicted the cluster's label */
  categoryBasis?: 'cluster' | 'evidence';
}

/** 4.0.1: a structure visible inside a lane pool — a word or pair of words shared by ≥3 independent creators' titles */
export interface SubFormat {
  label: string;
  creators: number;
  videos: number;
  /** evidence ids (DeskEvidence.id) of the examples that carry it */
  exampleIds: string[];
  topViews?: number;
  /** up to four of those examples, ready to render */
  examples?: DeskEvidence[];
}

export interface LaneEntry {
  trendId: string;
  name: string;
  creators: number;
  videos: number;
  /** 4.0.1: how many of the examples are qualified hits/breakouts (the rest are verified mid-size videos below the thresholds for their age) */
  qualified?: number;
  newCreators48h: number;
  topViews?: number;
  signature: string[];
  evidence: DeskEvidence[];
  /** why it is not (or is) on the desk as an opportunity */
  note: string;
  /** 4.0.1: sub-formats visible in the pool's own titles (the thing to study instead of the category) */
  subFormats?: SubFormat[];
}
export interface DeskReport {
  generatedAt: string;
  opportunities: DeskOpportunity[];
  /** 4.0: the owner's own lane (AI, animation, characters, skits, music, explainers) — current clean activity whether or not it is a specific opportunity */
  lane?: LaneEntry[];
  /** how many clusters were considered and why the rest were left out (counts by reason) */
  considered: number;
  excluded: Record<string, number>;
  /** creator profile used for the server-side ranking (the client can re-rank with its own preferences) */
  profile: { languages: string[]; tools: string[]; maxHours: number; goal: string };
}

export type PredictionStrategy = 'radar' | 'views' | 'velocity';
export const PREDICTION_HORIZONS = [24, 48, 72, 168] as const;
export type PredictionHorizon = (typeof PREDICTION_HORIZONS)[number];

/** Immutable prediction record — written once, before the outcome is known. */
export interface PredictionRecord {
  id: string;
  runId: string;
  predictedAt: string;
  strategy: PredictionStrategy;
  rank: number;
  videoId: string;
  platform: VideoRecord['platform'];
  platformId: string;
  url: string;
  title: string;
  creator?: string;
  channelId?: string;
  subscribers?: number;
  ageHours?: number;
  views?: number;
  likes?: number;
  lifetimeRate?: number;
  velocityPerHour?: number;
  velocityHours?: number;
  acceleration?: number;
  baselineRatio?: number;
  subscriberRatio?: number;
  breakoutScore: number;
  viralScore: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  kind?: BreakoutKind;
  reasons: string[];
  /** observation history known at prediction time (≤ 8 points) */
  history: { t: string; views?: number; likes?: number }[];
  horizons: PredictionHorizon[];
  /** the age-appropriate hit floor the video must reach at each horizon (platform rule, frozen at prediction time) */
  hitFloorAt: Record<string, number>;
  /** trend memberships and their independent creator counts at prediction time (for the format-spread criterion) */
  trends: { id: string; creators: number }[];
}

export interface OutcomeRecord {
  predictionId: string;
  horizon: PredictionHorizon;
  evaluatedAt: string;
  /** the observation used (first one at or after the horizon, within tolerance) */
  observedAt: string;
  observedHours: number;
  views?: number;
  likes?: number;
  gained?: number;
  reachedHit: boolean;
  multiplied: boolean;
  accelerated: boolean | null;
  outperformedCohort: boolean | null;
  cohortSize: number;
  creatorJump: boolean | null;
  formatSpread: boolean | null;
  /** headline: reached the age-appropriate hit floor, or doubled with ≥100K gained */
  breakout: boolean;
  /** the horizon window passed without any observation (tracking gap) — excluded from precision, never a success */
  unobserved?: boolean;
}

export interface ScorecardSummary {
  generatedAt: string;
  predictions: number;
  pending: number;
  evaluated: number;
  /** headline precision of the radar strategy at each horizon (null until ≥ 10 evaluated) */
  precision: Record<string, number | null>;
  /** same horizons for the simple baselines */
  baselines: Record<PredictionStrategy, Record<string, number | null>>;
  leadTimeHours?: { median: number; n: number };
  crossings: { observed: number; predictedBefore: number; missed: number; recall: number | null };
  unobserved: number;
  firstPredictionAt?: string;
}

export type AlertKind = 'new_hit' | 'acceleration' | 'creator_outlier' | 'format_spreading' | 'category_momentum' | 'resurfacing';
export interface Alert {
  id: string;
  kind: AlertKind;
  at: string;
  severity: 'high' | 'medium';
  category: string;
  subject: { type: 'video' | 'trend' | 'category'; id: string; title: string; url?: string; thumbnail?: string; platform?: string };
  /** what caused it — numbers, not adjectives */
  evidence: string;
  /** threshold that was crossed */
  threshold: string;
}

export interface HealthRun {
  runId: string;
  startedAt: string;
  durationSec: number;
  sourcesOk: number;
  sourcesTotal: number;
  items: number;
  units?: number;
  searches?: number;
  published: boolean;
  trigger?: string;
}
export interface HealthReport {
  generatedAt: string;
  lastCollectionAt: string;
  lastPublishedAt?: string;
  /** collections in the last 24 h versus the schedule's slots */
  last24h: { collections: number; expectedSlots: number; startRate: number | null; meanGapMin?: number; maxGapMin?: number; failures: number };
  /** per-source last success */
  sources: { source: string; ok: boolean; lastSuccess?: string; error?: string }[];
  schedule: string;
  runs: HealthRun[];
}
