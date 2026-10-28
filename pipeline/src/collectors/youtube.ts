/**
 * YouTube.
 *
 * A) Official YouTube Data API v3 (optional — needs a FREE API key in env YOUTUBE_API_KEY;
 *    default quota 10,000 units/day, no billing required):
 *      - videos.list chart=mostPopular (1 unit/call) per region → real view/like/comment counts
 *      - search.list (100 units/call) for a few trend keywords → more evidence (budgeted)
 *    Status: implemented against the documented response schema; NOT yet exercised live in this
 *    session because no key was available here. The dashboard marks the source "disabled" until a
 *    key is configured as a repository secret.
 *
 * B) oEmbed (no key; verified live 2026-10-28): https://www.youtube.com/oembed?url=...&format=json
 *    Used to enrich any YouTube video URL discovered elsewhere (Bluesky posts, news links) with the
 *    verified title, channel name and thumbnail. oEmbed does NOT return view counts.
 */
import type { Observation } from '../types.js';
import { fetchJson } from '../lib/http.js';
import { extractHashtags, nowIso, youtubeId } from '../lib/util.js';

const API = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_REGIONS = (process.env.VR_YT_REGIONS || 'US,GB,CA,AU').split(',').map((s) => s.trim()).filter(Boolean);
export const YOUTUBE_SEARCH_QUERIES = (process.env.VR_YT_QUERIES || '').split(',').map((s) => s.trim()).filter(Boolean);
/** Hard cap on search.list calls per run (100 units each). 20 calls = 2,000 units. */
const MAX_SEARCH_CALLS = Number(process.env.VR_YT_MAX_SEARCH || 20);

export interface YtVideo {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description?: string;
    thumbnails?: Record<string, { url: string }>;
    channelTitle: string;
    tags?: string[];
    categoryId?: string;
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

/** YouTube categoryId → readable label (documented, stable). */
export const YT_CATEGORY: Record<string, string> = {
  '1': 'Film & Animation', '2': 'Autos & Vehicles', '10': 'Music', '15': 'Pets & Animals', '17': 'Sports',
  '19': 'Travel & Events', '20': 'Gaming', '22': 'People & Blogs', '23': 'Comedy', '24': 'Entertainment',
  '25': 'News & Politics', '26': 'Howto & Style', '27': 'Education', '28': 'Science & Technology', '29': 'Nonprofits & Activism',
};

export function videoToObservation(v: YtVideo, region: string, rank: number, query: string, observedAt = nowIso()): Observation {
  const thumbs = v.snippet.thumbnails || {};
  const thumb = (thumbs['medium'] || thumbs['high'] || thumbs['default'])?.url;
  const dur = v.contentDetails?.duration;
  const isShort = dur ? isoDurationSeconds(dur) <= 180 : /#shorts/i.test(v.snippet.title + ' ' + (v.snippet.description || ''));
  return {
    id: `youtube:video:${v.id}`,
    source: 'youtube',
    kind: 'video',
    key: `yt:${v.id}`,
    title: v.snippet.title,
    url: isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    observedAt,
    publishedAt: v.snippet.publishedAt,
    metrics: {
      views: num(v.statistics?.viewCount),
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
      rank,
    },
    region,
    creator: { name: v.snippet.channelTitle, url: `https://www.youtube.com/channel/${v.snippet.channelId}` },
    thumbnail: thumb,
    text: `${v.snippet.title}. ${(v.snippet.description || '').slice(0, 300)} ${(v.snippet.tags || []).slice(0, 15).join(' ')} ${YT_CATEGORY[v.snippet.categoryId || ''] || ''}`,
    tags: [...extractHashtags(v.snippet.title + ' ' + (v.snippet.description || '')), ...(v.snippet.tags || []).map((t) => t.toLowerCase()).slice(0, 15)],
    query,
  };
}

function num(s?: string): number | undefined {
  if (s == null) return undefined;
  const n = Number(s);
  return isNaN(n) ? undefined : n;
}

export function isoDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

export async function collectYouTube(apiKey = process.env.YOUTUBE_API_KEY): Promise<{ items: Observation[]; errors: string[]; disabled?: boolean }> {
  const items: Observation[] = [];
  const errors: string[] = [];
  if (!apiKey) return { items, errors: ['YOUTUBE_API_KEY not set'], disabled: true };

  for (const region of YOUTUBE_REGIONS) {
    try {
      const url = `${API}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${region}&maxResults=50&key=${apiKey}`;
      const res = await fetchJson<{ items: YtVideo[] }>(url);
      (res.items || []).forEach((v, i) => items.push(videoToObservation(v, region, i + 1, `mostPopular ${region}`)));
    } catch (e) {
      errors.push(`mostPopular ${region}: ${redact((e as Error).message, apiKey)}`);
    }
  }

  let searchCalls = 0;
  for (const q of YOUTUBE_SEARCH_QUERIES) {
    if (searchCalls >= MAX_SEARCH_CALLS) break;
    try {
      searchCalls++;
      const sUrl = `${API}/search?part=id&type=video&order=viewCount&publishedAfter=${encodeURIComponent(new Date(Date.now() - 7 * 864e5).toISOString())}&q=${encodeURIComponent(q)}&maxResults=25&key=${apiKey}`;
      const s = await fetchJson<{ items: { id: { videoId: string } }[] }>(sUrl);
      const ids = (s.items || []).map((i) => i.id.videoId).filter(Boolean);
      if (!ids.length) continue;
      const vUrl = `${API}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`;
      const v = await fetchJson<{ items: YtVideo[] }>(vUrl);
      (v.items || []).forEach((vid, i) => items.push(videoToObservation(vid, 'search', i + 1, `search:${q}`)));
    } catch (e) {
      errors.push(`search ${q}: ${redact((e as Error).message, apiKey)}`);
    }
  }
  return { items, errors };
}

function redact(msg: string, key: string): string {
  return msg.split(key).join('***');
}

/** oEmbed enrichment: verified title/author/thumbnail for a YouTube URL. No key needed. */
export interface OEmbed { title: string; author_name: string; author_url: string; thumbnail_url: string }
export async function oembed(url: string): Promise<OEmbed | undefined> {
  const id = youtubeId(url);
  if (!id) return undefined;
  try {
    return await fetchJson<OEmbed>(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { retries: 0, timeoutMs: 8000 });
  } catch {
    return undefined;
  }
}

/** Enrich observations that point at YouTube videos but lack creator/thumbnail. Budgeted. */
export async function enrichYouTubeLinks(obs: Observation[], max = 40): Promise<number> {
  let n = 0;
  for (const o of obs) {
    if (n >= max) break;
    if (o.source === 'youtube' || !youtubeId(o.url)) continue;
    if (o.thumbnail && o.creator?.url?.includes('youtube.com')) continue;
    const e = await oembed(o.url);
    if (!e) continue;
    n++;
    o.title = e.title || o.title;
    o.creator = { name: e.author_name, url: e.author_url };
    o.thumbnail = o.thumbnail || e.thumbnail_url;
    o.links = [...(o.links || []), { title: 'Verified via YouTube oEmbed', url: o.url, source: 'YouTube' }];
  }
  return n;
}
