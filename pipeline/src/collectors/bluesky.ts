/**
 * Bluesky — public AT Protocol AppView (no auth required).
 *
 *  1. app.bsky.unspecced.getTrendingTopics  → trending topics (social_topic)
 *  2. app.bsky.feed.getFeed (topic feed)     → posts inside each topic, video embeds become `video` evidence
 *  3. app.bsky.feed.searchPosts (creator-format queries, sort=top) → native videos + YouTube/TikTok links
 *
 * Verified live on 2026-10-28. Engagement counts (likeCount, repostCount, replyCount,
 * quoteCount) are real; Bluesky does not expose view counts.
 */
import type { Observation } from '../types.js';
import { fetchJson } from '../lib/http.js';
import { extractHashtags, hasUnsafeMarkers, isUnsafeLabel, isVideoUrl, normalizeKey, nowIso, youtubeId } from '../lib/util.js';

const API = 'https://api.bsky.app/xrpc';

export const BLUESKY_FORMAT_QUERIES = (
  process.env.VR_BSKY_QUERIES ||
  'animation,short film,comedy skit,cat video,dog video,ai video,music video,cover song,parody,sketch comedy,satisfying,asmr,minecraft,cooking video,street interview,storytime,pov,explainer,timelapse,puppet'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export interface BskyTopic {
  topic: string;
  displayName?: string;
  description?: string;
  link: string;
}
interface BskyPost {
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
  // link: /profile/did:plc:xxx/feed/<rkey>
  const m = link.match(/^\/profile\/([^/]+)\/feed\/([^/?#]+)/);
  if (!m) return undefined;
  return `at://${m[1]}/app.bsky.feed.generator/${m[2]}`;
}

export function postWebUrl(p: BskyPost): string {
  const rkey = p.uri.split('/').pop();
  return `https://bsky.app/profile/${p.author.handle}/post/${rkey}`;
}

function isSafe(p: BskyPost): boolean {
  if ((p.labels || []).some((l) => isUnsafeLabel(l.val))) return false;
  const txt = `${p.record?.text || ''} ${p.author.displayName || ''}`;
  return !hasUnsafeMarkers(txt);
}

/** Extract video evidence (native or external link) from a post embed. */
function videoFromEmbed(embed?: Record<string, unknown>): { url: string; thumb?: string; title?: string; native: boolean } | undefined {
  if (!embed) return undefined;
  const type = String(embed['$type'] || '');
  if (type === 'app.bsky.embed.video#view') {
    return { url: String(embed['playlist'] || ''), thumb: embed['thumbnail'] ? String(embed['thumbnail']) : undefined, native: true };
  }
  if (type === 'app.bsky.embed.external#view') {
    const ext = embed['external'] as Record<string, unknown> | undefined;
    const uri = ext ? String(ext['uri'] || '') : '';
    if (uri && isVideoUrl(uri)) return { url: uri, thumb: ext?.['thumb'] ? String(ext['thumb']) : undefined, title: ext?.['title'] ? String(ext['title']) : undefined, native: false };
  }
  if (type === 'app.bsky.embed.recordWithMedia#view') {
    return videoFromEmbed(embed['media'] as Record<string, unknown>);
  }
  return undefined;
}

export function postToObservation(p: BskyPost, query: string, observedAt = nowIso()): Observation | undefined {
  if (!isSafe(p)) return undefined;
  const text = p.record?.text || '';
  const vid = videoFromEmbed(p.embed);
  const webUrl = postWebUrl(p);
  const title = (vid?.title || text.split('\n')[0] || '').slice(0, 140) || '(untitled post)';
  const yt = vid && !vid.native ? youtubeId(vid.url) : undefined;
  const key = yt ? `yt:${yt}` : normalizeKey(p.uri.split('/').pop() || p.uri);
  return {
    id: vid ? `bluesky:video:${key}` : `bluesky:post:${key}`,
    source: 'bluesky',
    kind: vid ? 'video' : 'post',
    key,
    title,
    // For an external video link we point at the original video; otherwise the post.
    url: vid && !vid.native ? vid.url : webUrl,
    observedAt,
    publishedAt: p.record?.createdAt,
    metrics: { likes: p.likeCount ?? 0, reposts: p.repostCount ?? 0, comments: p.replyCount ?? 0, quotes: p.quoteCount ?? 0 },
    creator: { name: p.author.displayName || p.author.handle, url: `https://bsky.app/profile/${p.author.handle}` },
    thumbnail: vid?.thumb,
    text,
    tags: extractHashtags(text),
    links: vid && !vid.native ? [{ title: 'Bluesky post', url: webUrl, source: 'Bluesky' }] : undefined,
    query,
  };
}

export function topicToObservation(t: BskyTopic, rank: number, observedAt = nowIso()): Observation {
  const key = normalizeKey(t.topic);
  const feed = topicFeedUri(t.link);
  return {
    id: `bluesky:social_topic:${key}`,
    source: 'bluesky',
    kind: 'social_topic',
    key,
    title: t.displayName || t.topic,
    url: `https://bsky.app${t.link}`,
    observedAt,
    metrics: { rank },
    text: t.description || '',
    query: feed ? `feed ${feed}` : 'trending',
  };
}

export async function collectBluesky(opts: { formatQueries?: string[]; topicFeedLimit?: number } = {}): Promise<{ items: Observation[]; errors: string[] }> {
  const items: Observation[] = [];
  const errors: string[] = [];
  const observedAt = nowIso();

  // 1. trending topics
  let topics: BskyTopic[] = [];
  try {
    const res = await fetchJson<{ topics: BskyTopic[] }>(`${API}/app.bsky.unspecced.getTrendingTopics?limit=25`);
    topics = res.topics || [];
    topics.forEach((t, i) => items.push(topicToObservation(t, i + 1, observedAt)));
  } catch (e) {
    errors.push(`trendingTopics: ${(e as Error).message}`);
  }

  // 2. posts inside each topic (gives engagement + videos per topic)
  const topicFeedLimit = opts.topicFeedLimit ?? 15;
  for (const t of topics.slice(0, 25)) {
    const feed = topicFeedUri(t.link);
    if (!feed) continue;
    try {
      const res = await fetchJson<{ feed: { post: BskyPost }[] }>(`${API}/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}&limit=${topicFeedLimit}`);
      for (const f of res.feed || []) {
        const o = postToObservation(f.post, `topic:${normalizeKey(t.topic)}`, observedAt);
        if (o) items.push(o);
      }
    } catch (e) {
      errors.push(`feed ${t.topic}: ${(e as Error).message}`);
    }
  }

  // 3. creator-format searches
  for (const q of opts.formatQueries ?? BLUESKY_FORMAT_QUERIES) {
    try {
      const res = await fetchJson<{ posts: BskyPost[] }>(`${API}/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&limit=25`);
      for (const p of res.posts || []) {
        const o = postToObservation(p, `search:${q}`, observedAt);
        if (o) items.push(o);
      }
    } catch (e) {
      errors.push(`search ${q}: ${(e as Error).message}`);
    }
  }
  return { items, errors };
}
