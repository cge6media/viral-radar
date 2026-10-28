// Shared data model: single source of truth lives in the pipeline package.
export type { Trend, Observation, Snapshot, SourceStatus, Lifecycle, Platform, EvidenceKind, ScoreBreakdown, Metrics } from '../../../pipeline/src/types';

export type TimeWindow = '4h' | '24h' | '48h' | '7d' | '30d';
export const TIME_WINDOWS: { id: TimeWindow; label: string; hours: number }[] = [
  { id: '4h', label: 'Last 4 hours', hours: 4 },
  { id: '24h', label: 'Last 24 hours', hours: 24 },
  { id: '48h', label: 'Last 48 hours', hours: 48 },
  { id: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { id: '30d', label: 'Last 30 days', hours: 24 * 30 },
];

export const PLATFORM_LABEL: Record<string, string> = {
  google_trends: 'Google Trends',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  tiktok: 'TikTok',
};

export const KIND_LABEL: Record<string, string> = {
  search_interest: 'Search spike',
  social_topic: 'Social topic',
  hashtag: 'Hashtag',
  video: 'Video',
  post: 'Post',
};

export const STAGE: Record<string, { label: string; short: string; desc: string; glyph: string }> = {
  emerging: { label: 'Emerging', short: 'Emerging', desc: 'New in the last 48 hours; evidence still thin.', glyph: '◔' },
  accelerating: { label: 'Accelerating', short: 'Accel.', desc: 'Measured attention is growing run over run.', glyph: '◑' },
  breaking_out: { label: 'Breaking out', short: 'Breakout', desc: 'High momentum on more than one platform.', glyph: '◕' },
  peaking: { label: 'Peaking', short: 'Peaking', desc: 'High attention but flat growth — crowded.', glyph: '●' },
  cooling: { label: 'Cooling', short: 'Cooling', desc: 'Attention falling or evidence going stale.', glyph: '◌' },
  insufficient_data: { label: 'Insufficient data', short: 'Thin', desc: 'A single signal — wait for corroboration.', glyph: '○' },
};
export const STAGE_ORDER = ['emerging', 'accelerating', 'breaking_out', 'peaking', 'cooling', 'insufficient_data'] as const;

export interface Preferences {
  interests: string[];          // category names
  tools: string[];              // 'animation' | 'ai-video' | 'music' | 'editing' | 'image' | 'audio' | 'camera'
  platforms: string[];          // preferred publishing platforms
  appetite: 'early' | 'balanced' | 'proven';
  hideNews: boolean;
  githubRepo?: string;          // owner/repo for manual refresh dispatch
  githubToken?: string;         // fine-grained PAT (actions: write), stored locally only
}

export const DEFAULT_PREFS: Preferences = {
  interests: ['Entertainment', 'Animation & Art', 'Comedy', 'Music', 'Animals & Pets'],
  tools: ['editing', 'animation', 'ai-video', 'image', 'audio'],
  platforms: ['youtube_shorts', 'youtube', 'tiktok'],
  appetite: 'balanced',
  hideNews: true,
};

export type WatchStatus = 'watching' | 'planning' | 'producing' | 'published';
export interface WatchItem {
  trendId: string;
  name: string;
  category: string;
  status: WatchStatus;
  addedAt: string;
  notes?: string;
  concept?: string;
  actual?: { views?: number; cost?: number; revenue?: number; url?: string };
}
