// Shared data model: single source of truth lives in the pipeline package.
export type { Trend, Observation, Snapshot, SourceStatus, SourceQuality, Lifecycle, Platform, EvidenceKind, EvidenceGrade, WindowScores, Window, CategoryActivity, QualitySummary, TrendKind } from '../../../pipeline/src/types';
export { WINDOWS, WINDOW_HOURS } from '../../../pipeline/src/types';

export const WINDOW_LABEL: Record<string, string> = { '24h': 'Last 24 hours', '48h': 'Last 48 hours', '7d': 'Last 7 days' };

export const PLATFORM_LABEL: Record<string, string> = {
  google_trends: 'Google Trends', youtube: 'YouTube', bluesky: 'Bluesky', mastodon: 'Mastodon', tiktok: 'TikTok',
};
export const KIND_LABEL: Record<string, string> = {
  search_interest: 'Search spike', social_topic: 'Social topic', hashtag: 'Hashtag', video: 'Video', post: 'Post',
};
export const STAGE: Record<string, { label: string; desc: string }> = {
  emerging: { label: 'Emerging', desc: 'New examples in the last 48 hours; evidence still forming.' },
  accelerating: { label: 'Accelerating', desc: 'Measured growth in creators or video velocity.' },
  breaking_out: { label: 'Breaking out', desc: 'High momentum across more than one platform.' },
  peaking: { label: 'Peaking', desc: 'High attention but flat growth — crowded.' },
  cooling: { label: 'Cooling', desc: 'Attention falling or no fresh examples.' },
  insufficient_data: { label: 'Insufficient data', desc: 'Not enough corroboration to recommend.' },
};
export const STAGE_ORDER = ['emerging', 'accelerating', 'breaking_out', 'peaking', 'cooling', 'insufficient_data'] as const;
export const GRADE: Record<string, { label: string; desc: string }> = {
  strong: { label: 'Strong evidence', desc: 'Multiple independent, verified examples with direct measurements over several runs.' },
  developing: { label: 'Developing evidence', desc: 'Several verified examples; measurement history still short.' },
  early: { label: 'Early signal', desc: 'A potential opportunity with limited corroboration.' },
  insufficient: { label: 'Insufficient evidence', desc: 'Not reliable enough for a recommendation.' },
};
export const KIND_OF_TREND: Record<string, string> = { microtrend: 'Microtrend', format: 'Proven format', topic: 'Audience topic', category: 'Category' };

export interface Preferences {
  interests: string[];
  tools: string[];
  platforms: string[];
  appetite: 'early' | 'balanced' | 'proven';
  hideNews: boolean;
  showGeneric: boolean;
  githubRepo?: string;
}
export const DEFAULT_PREFS: Preferences = {
  interests: ['Entertainment', 'Animation & Art', 'Comedy', 'Music', 'Animals & Pets'],
  tools: ['editing', 'animation', 'ai-video', 'image', 'audio'],
  platforms: ['youtube_shorts', 'youtube', 'tiktok'],
  appetite: 'balanced',
  hideNews: true,
  showGeneric: false,
};

export type WatchStatus = 'watching' | 'planning' | 'producing' | 'published';
export interface SavedConcept { title: string; hook: string; opening: string; structure: string[]; length: string; approach: string; platform: string; difficulty: string; budget: string; monetization: string }
export interface WatchItem {
  trendId: string;
  name: string;
  category: string;
  status: WatchStatus;
  addedAt: string;
  notes?: string;
  concept?: SavedConcept;
  actual?: { views?: number; cost?: number; revenue?: number; url?: string };
}
