/**
 * Bluesky — public AT Protocol AppView (no auth required).
 *
 *  1. app.bsky.unspecced.getTrendingTopics  → trending topics (social_topic, indirect audience interest)
 *  2. app.bsky.feed.getFeed (topic feed)     → posts inside each topic (post / video evidence for that topic)
 *  3. app.bsky.feed.searchPosts (format discovery queries, sort=top, since=7d) → DISCOVERY POOL of recent videos.
 *     A search for a predefined format is never itself a trend: its results only become evidence after the
 *     relevance stage validates them, and the pool is reported as category activity, not as an opportunity.
 *
 * Evidence rules (v2):
 *   - native Bluesky video  → kind video, level DIRECT (engagement is measured on the platform hosting the video),
 *                             publishedAt = post time (a native upload is published by the post)
 *   - external video link   → kind video, level INDIRECT; the VIDEO's stats are unknown (metrics = {}) until the
 *                             YouTube stage verifies them; the post's engagement lives in postMetrics; publishedAt
 *                             is left empty (the share time is NOT the video's publication time)
 *   - text-only post        → kind post (topic feeds only — search results without a video are not evidence)
 *   - adult-labelled or 🔞 posts and posts older than VR_BSKY_MAX_AGE_DAYS are dropped
 */
import type { Observation } from '../types.js';
import { fetchJson } from '../lib/http.js';
import { extractHashtags, hasUnsafeMarkers, isUnsafeLabel, isVideoUrl, normalizeKey, nowIso, youtubeId } from '../lib/util.js';
import { FORMATS } from '../intel/relevance.js';

const API = 'https://api.bsky.app/xrpc';

export const BLUESKY_FORMAT_QUERIES: string[] = process.env.VR_BSKY_QUERIES
  ? process.env.VR_BSKY_QUERIES.split(',').map((s) => s.trim()).filter(Boolean)
  : Array.from(new Set(FORMATS.flatMap((f) => f.queries)));

/** Search results (sort=top) include old evergreen posts; a trend radar only wants recent ones. */
export const MAX_POST_AGE_DAYS = Number(process.env.VR_BSKY_MAX_AGE_DAYS || 14);

export interface BskyTopic { topic: string; displayName?: string; description?: string; link: string }
export interface BskyPost {
  uri: string;
  cid: string;
  author: { did: string; handle: string; displayName?: string; avatar?: string };
  record: { text?: string; createdAt?: string };
  embed?: Record<string, unknown>;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  labels?: { val: string }[];
  indexedAt?: string;
}

export function topicFeedUri(link: string): string | undefined {
  const m = link.match(/^\/profile\/([^/]+)\/feed\/([^/?#]+)/);
  return m ? `at://${m[1]}/app.bsky.feed.generator/${m[2]}` : undefined;
}

export function postWebUrl(p: BskyPost): string {
  return `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split('/').pop()}`;
}

function isSafe(p: BskyPost): boolean {
  if ((p.labels || []).some((l) => isUnsafeLabel(l.val))) return false;
  return !hasUnsafeMarkers(`${p.record?.text || ''} ${p.author.displayName || ''}`);
}

interface EmbedVideo { url: string; thumb?: string; title?: string; native: boolean; alt?: string }
function videoFromEmbed(embed?: Record<string, unknown>): EmbedVideo | undefined {
  if (!embed) return undefined;
  const type = String(embed['$type'] || '');
  if (type === 'app.bsky.embed.video#view') {
    return { url: String(embed['playlist'] || ''), thumb: embed['thumbnail'] ? String(embed['thumbnail']) : undefined, native: true, alt: embed['alt'] ? String(embed['alt']) : undefined };
  }
  if (type === 'app.bsky.embed.external#view') {
    const ext = embed['external'] as Record<string, unknown> | undefined;
    const uri = ext ? String(ext['uri'] || '') : '';
    if (uri && isVideoUrl(uri)) return { url: uri, thumb: ext?.['thumb'] ? String(ext['thumb']) : undefined, title: ext?.['title'] ? String(ext['title']) : undefined, native: false };
  }
  if (type === 'app.bsky.embed.recordWithMedia#view') return videoFromEmbed(embed['media'] as Record<string, unknown>);
  return undefined;
}

function externalPlatform(url: string): { platform: 'youtube' | 'tiktok' | 'instagram' | 'other'; id: string } {
  const yt = youtubeId(url);
  if (yt) return { platform: 'youtube', id: yt };
  const tt = url.match(/tiktok\.com\/.*video\/(\d+)/);
  if (tt) return { platform: 'tiktok', id: tt[1] };
  const ig = url.match(/instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
  if (ig) return { platform: 'instagram', id: ig[1] };
  return { platform: 'other', id: normalizeKey(url).slice(0, 60) };
}

export function postToObservation(p: BskyPost, query: string, observedAt = nowIso(), opts: { allowTextPosts?: boolean } = {}): Observation | undefined {
  if (!isSafe(p)) return undefined;
  const text = p.record?.text || '';
  const createdAt = p.record?.createdAt;
  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!isNaN(created) && Date.now() - created > MAX_POST_AGE_DAYS * 864e5) return undefined;
  const vid = videoFromEmbed(p.embed);
  if (!vid && !text.trim()) return undefined;
  if (!vid && !opts.allowTextPosts) return undefined;
  const webUrl = postWebUrl(p);
  const author = { name: p.author.displayName || p.author.handle, url: `https://bsky.app/profile/${p.author.handle}` };
  const engagement = { likes: p.likeCount ?? 0, reposts: p.repostCount ?? 0, comments: p.replyCount ?? 0, quotes: p.quoteCount ?? 0 };
  const tags = extractHashtags(text);

  if (vid && vid.native) {
    const rkey = p.uri.split('/').pop() || p.uri;
    const key = `bsky:${rkey}`;
    return {
      id: `bluesky:video:${key}`, source: 'bluesky', kind: 'video', level: 'direct', key,
      title: (vid.alt && vid.alt.length > 8 ? vid.alt : text.split('\n')[0]).slice(0, 140) || '(video)',
      url: webUrl, observedAt, publishedAt: createdAt, postPublishedAt: createdAt, videoPublishedAt: createdAt,
      metrics: engagement, video: { platform: 'bluesky', id: rkey, statsDirect: true },
      creator: author, thumbnail: vid.thumb, text, tags, query,
    };
  }
  if (vid) {
    const ext = externalPlatform(vid.url);
    const key = `${ext.platform === 'youtube' ? 'yt' : ext.platform}:${ext.id}`;
    return {
      id: `bluesky:video:${key}`, source: 'bluesky', kind: 'video', level: 'indirect', key,
      title: (vid.title || text.split('\n')[0] || '').slice(0, 140) || '(linked video)',
      url: ext.platform === 'youtube' ? `https://www.youtube.com/watch?v=${ext.id}` : vid.url,
      observedAt, postPublishedAt: createdAt, // publishedAt intentionally unknown until verified on the video platform
      metrics: {}, postMetrics: { ...engagement, accounts: 1 }, video: { platform: ext.platform, id: ext.id, statsDirect: false },
      sharedBy: author, thumbnail: vid.thumb || (ext.platform === 'youtube' ? `https://i.ytimg.com/vi/${ext.id}/hqdefault.jpg` : undefined),
      text, tags, links: [{ title: 'Shared on Bluesky', url: webUrl, source: 'Bluesky' }], query,
    };
  }
  const rkey = p.uri.split('/').pop() || p.uri;
  return {
    id: `bluesky:post:${rkey}`, source: 'bluesky', kind: 'post', level: 'indirect', key: rkey,
    title: text.split('\n')[0].slice(0, 140), url: webUrl, observedAt, publishedAt: createdAt, postPublishedAt: createdAt,
    metrics: engagement, creator: author, text, tags, query,
  };
}

export function topicToObservation(t: BskyTopic, rank: number, observedAt = nowIso()): Observation {
  const key = normalizeKey(t.topic);
  const feed = topicFeedUri(t.link);
  return {
    id: `bluesky:social_topic:${key}`, source: 'bluesky', kind: 'social_topic', level: 'indirect', key,
    title: t.displayName || t.topic, url: `https://bsky.app${t.link}`, observedAt, publishedAt: observedAt,
    metrics: { rank }, text: t.description || '', query: feed ? `feed ${feed}` : 'trending',
  };
}

/** Merge duplicate external-video shares: one record per video, counting distinct sharers. */
export function mergeShares(items: Observation[]): Observation[] {
  const byId = new Map<string, Observation>();
  for (const o of items) {
    const cur = byId.get(o.id);
    if (!cur) {
      byId.set(o.id, o);
      continue;
    }
    if (o.kind === 'video' && o.level === 'indirect' && cur.postMetrics) {
      const a = cur.postMetrics, b = o.postMetrics || {};
      cur.postMetrics = {
        likes: (a.likes || 0) + (b.likes || 0), reposts: (a.reposts || 0) + (b.reposts || 0), comments: (a.comments || 0) + (b.comments || 0), quotes: (a.quotes || 0) + (b.quotes || 0),
        accounts: (a.accounts || 1) + (o.sharedBy?.name !== cur.sharedBy?.name ? 1 : 0),
      };
      if (o.postPublishedAt && cur.postPublishedAt && o.postPublishedAt > cur.postPublishedAt) cur.postPublishedAt = o.postPublishedAt;
      if (o.query && cur.query && !cur.query.includes(o.query)) cur.query = `${cur.query},${o.query}`;
    }
  }
  return Array.from(byId.values());
}

export async function collectBluesky(opts: { formatQueries?: string[]; topicFeedLimit?: number } = {}): Promise<{ items: Observation[]; errors: string[]; subrequests: number }> {
  const items: Observation[] = [];
  const errors: string[] = [];
  let subrequests = 0;
  const observedAt = nowIso();

  let topics: BskyTopic[] = [];
  try {
    subrequests++;
    const res = await fetchJson<{ topics: BskyTopic[] }>(`${API}/app.bsky.unspecced.getTrendingTopics?limit=25`);
    topics = res.topics || [];
    topics.forEach((t, i) => items.push(topicToObservation(t, i + 1, observedAt)));
  } catch (e) {
    errors.push(`trendingTopics: ${(e as Error).message}`);
  }

  const topicFeedLimit = opts.topicFeedLimit ?? 15;
  for (const t of topics.slice(0, 25)) {
    const feed = topicFeedUri(t.link);
    if (!feed) continue;
    try {
      subrequests++;
      const res = await fetchJson<{ feed: { post: BskyPost }[] }>(`${API}/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}&limit=${topicFeedLimit}`);
      for (const f of res.feed || []) {
        const o = postToObservation(f.post, `topic:${normalizeKey(t.topic)}`, observedAt, { allowTextPosts: true });
        if (o) items.push(o);
      }
    } catch (e) {
      errors.push(`feed ${t.topic}: ${(e as Error).message}`);
    }
  }

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  for (const q of opts.formatQueries ?? BLUESKY_FORMAT_QUERIES) {
    try {
      subrequests++;
      const res = await fetchJson<{ posts: BskyPost[] }>(`${API}/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&limit=25&since=${encodeURIComponent(since)}`);
      for (const p of res.posts || []) {
        const o = postToObservation(p, `search:${q}`, observedAt);
        if (o) items.push(o);
      }
    } catch (e) {
      errors.push(`search ${q}: ${(e as Error).message}`);
    }
  }
  return { items: mergeShares(items), errors, subrequests };
}
