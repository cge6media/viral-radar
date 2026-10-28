/**
 * TikTok Creative Center — OPT-IN, best-effort, NOT a critical dependency.
 *
 * The public Creative Center pages (https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en)
 * are JavaScript-rendered and backed by an undocumented JSON endpoint that TikTok changes
 * without notice. We therefore:
 *   - keep this collector disabled unless VR_TIKTOK=1,
 *   - treat any failure as "source unavailable" (never fatal),
 *   - label its evidence as `hashtag` (search/hashtag interest, not verified video performance).
 *
 * Status: NOT verified live in this session (the Creative Center was not reachable from the
 * build sandbox). Verify from the GitHub Actions runner before relying on it.
 */
import type { Observation } from '../types.js';
import { fetchJson } from '../lib/http.js';
import { normalizeKey, nowIso } from '../lib/util.js';

interface TtHashtag {
  hashtag_name: string;
  hashtag_id?: string;
  publish_cnt?: number;
  video_views?: number;
  rank?: number;
  rank_diff?: number;
  rank_diff_type?: number;
  industry_info?: { value?: string };
  is_promoted?: boolean;
  trend?: { time: number; value: number }[];
}

export function hashtagToObservation(h: TtHashtag, region: string, idx: number, observedAt = nowIso()): Observation {
  const key = normalizeKey(h.hashtag_name);
  return {
    id: `tiktok:hashtag:${key}`,
    source: 'tiktok',
    kind: 'hashtag',
    key,
    title: `#${h.hashtag_name}`,
    url: `https://www.tiktok.com/tag/${encodeURIComponent(h.hashtag_name)}`,
    observedAt,
    metrics: { uses: h.publish_cnt, views: h.video_views, rank: h.rank ?? idx + 1 },
    region,
    text: `${h.hashtag_name.replace(/([a-z])([A-Z])/g, '$1 $2')} ${h.industry_info?.value || ''}`,
    tags: [h.hashtag_name.toLowerCase()],
    history: (h.trend || []).map((p) => ({ t: new Date(p.time * 1000).toISOString(), value: p.value })),
    query: `creative-center hashtags ${region}`,
  };
}

export async function collectTikTok(): Promise<{ items: Observation[]; errors: string[]; disabled?: boolean }> {
  if (process.env.VR_TIKTOK !== '1') return { items: [], errors: ['disabled (set VR_TIKTOK=1 to enable best-effort collection)'], disabled: true };
  const items: Observation[] = [];
  const errors: string[] = [];
  const region = process.env.VR_TIKTOK_REGION || 'US';
  try {
    const url = `https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?page=1&limit=50&period=7&country_code=${region}&sort_by=popular`;
    const res = await fetchJson<{ code: number; data?: { list?: TtHashtag[] } }>(url, {
      headers: { referer: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en', 'accept-language': 'en-US,en;q=0.9' },
      retries: 0,
    });
    if (res.code !== 0 || !res.data?.list) throw new Error(`unexpected response code ${res.code}`);
    res.data.list.forEach((h, i) => items.push(hashtagToObservation(h, region, i)));
  } catch (e) {
    errors.push(`creative center: ${(e as Error).message}`);
  }
  return { items, errors };
}
