/**
 * Clustering v2 — observations → trend clusters of three kinds.
 *
 *  topic       seeded by audience-interest signals (Google Trends terms, Bluesky topics, trending hashtags) with the
 *              posts/videos that discuss them. Audience interest, not necessarily a video format.
 *  microtrend  VIDEO-FIRST: a distinctive phrase, hashtag or character/subject shared by videos from ≥3 independent
 *              creators inside the window. This is where "animated animal courtroom skits" would surface.
 *  format      a predefined, relevance-validated format pool (cooking, cat videos, …). Describes category activity;
 *              generic formats are never emerging trends by themselves.
 *
 * Independence: creators are counted by channel/author; the same video shared by many accounts is one example.
 */
import type { Observation } from '../types.js';
import { normalizeKey, tokenize, uniq } from '../lib/util.js';
import { FORMATS, FORMAT_BY_ID, videoText } from './relevance.js';

export interface Cluster {
  id: string;
  kind: 'topic' | 'microtrend' | 'format';
  name: string;
  origin: 'seed' | 'hashtag' | 'phrase' | 'format';
  keywords: string[];
  members: Observation[];
  formatId?: string;
  /** a broad subject hashtag (#anime, #roblox): topic activity, not a format — generic unless growth is measured */
  broadTopic?: boolean;
}

export const MIN_CREATORS = Number(process.env.VR_MIN_CREATORS || 3);

/** Who made this? Channel for verified videos, author for native posts, the sharer (prefixed) when unverified. */
export function creatorKey(o: Observation): string {
  if (o.creator?.url) return o.creator.url.toLowerCase();
  if (o.creator?.name) return `name:${o.creator.name.toLowerCase()}`;
  if (o.sharedBy?.url) return `share:${o.sharedBy.url.toLowerCase()}`;
  return `item:${o.id}`;
}
export function isVerifiedCreator(o: Observation): boolean {
  return !!o.creator;
}
/** One example = one distinct video (or one distinct non-video item). */
export function exampleKey(o: Observation): string {
  return o.video ? `${o.video.platform}:${o.video.id}` : o.id;
}

export function independentCreators(members: Observation[]): number {
  const seenExample = new Set<string>();
  const creators = new Set<string>();
  for (const m of members) {
    const ek = exampleKey(m);
    if (seenExample.has(ek)) continue;
    seenExample.add(ek);
    creators.add(creatorKey(m));
  }
  return creators.size;
}

/** platform boilerplate and engagement-bait tags: never a microtrend (they describe the platform, not a format) */
const GENERIC_TAGS = new Set(['art', 'video', 'videos', 'shorts', 'short', 'fyp', 'fypシ', 'foryou', 'foryoupage', 'viral', 'viralvideo', 'viralshorts', 'viralvideos', 'trending', 'trend', 'trendingshorts', 'bsky', 'bskyart', 'bluesky', 'oc', 'gif', 'sketch', 'commission', 'commissions', 'comms', 'commsopen', 'nsfw', 'youtube', 'youtubeshorts', 'ytshorts', 'yt', 'shortsfeed', 'shortsvideo', 'shortvideo', 'youtubeshort', 'tiktok', 'reels', 'reel', 'instagram', 'new', 'live', 'animation', 'animated', 'music', 'comedy', 'funny', 'funnyvideo', 'funnyvideos', 'cute', 'love', 'cat', 'cats', 'dog', 'dogs', 'gaming', 'game', 'games', 'film', 'movie', 'asmr', 'satisfying', 'subscribe', 'like', 'follow', 'share', 'comment', 'explore', 'explorepage', 'memes', 'meme', 'lol', 'lmao', 'status', 'whatsappstatus', 'edit', 'edits', 'fy', 'viralreels', 'reelsinstagram', 'instagood', 'trendingreels', 'ytshort', 'shortsyoutube', 'short_video', 'video_viral', 'fun', 'entertainment', 'vlog', 'daily', 'life', 'motivation', 'facts', 'fact', 'news', 'india', 'usa', 'uk', 'pakistan', 'bangladesh', 'ai', 'funnyshorts', 'comedyvideo', 'comedyshorts', 'cartoon', 'anime', 'pets', 'animals', 'sports', 'football', 'cricket', 'song', 'songs', 'dance', 'cover', 'minecraft', 'roblox', 'fortnite', 'gta', 'freefire', 'pubg', 'bgmi', 'valorant']);
/** broad topic tags: real subjects, but a subject is not a format — they cluster as "topic activity", never as a wave without measured growth */
const BROAD_TOPICS = new Set(['anime', 'cartoon', 'pets', 'animals', 'sports', 'football', 'cricket', 'song', 'songs', 'dance', 'cover', 'minecraft', 'roblox', 'fortnite', 'gta', 'freefire', 'pubg', 'bgmi', 'valorant', 'cat', 'cats', 'dog', 'dogs', 'gaming', 'music', 'comedy', 'animation', 'ai', 'news', 'memes']);
export function isBroadTopicTag(tag: string): boolean { return BROAD_TOPICS.has(tag.replace(/^#/, '').toLowerCase()); }
const PHRASE_STOP = new Set(['official', 'video', 'videos', 'episode', 'part', 'full', 'new', 'best', 'top', 'first', 'last', 'day', 'days', 'week', 'today', 'live', 'stream', 'shorts', 'short', 'trailer', 'teaser', 'season', 'update', 'reaction', 'reacts', 'review', 'explained', 'ft', 'feat', 'remix', 'lyrics', 'audio', 'hd', '4k', 'vlog', 'tutorial', 'bsky', 'social', 'com', 'www', 'http', 'https', 'youtube', 'youtu', 'watch', 'tiktok', 'instagram', 'twitch', 'link', 'thread', 'rt', 'via', 'credit', 'commission', 'commissions', 'comm', 'cmm', 'comms', 'open', 'please', 'thanks', 'thank', 'love', 'like', 'got', 'made', 'make', 'making', 'amazing', 'check', 'out', 'really', 'just', 'one', 'two', 'three', 'guys', 'everyone', 'wait', 'still']);

/** 4.0.1: phrases that come from description boilerplate, credits and legal disclaimers — never a microtrend name */
const BOILERPLATE_GRAM = /\b(fair use|abonne[- ]?toi|abonnez[- ]?vous|inscreva[- ]?se|suscr[ií]bete|auto[- ]?generated|generated by|provided to|entertainment purposes|educational purposes|purposes only|copyright (?:disclaimer|act|infringement|owner|owners|notice)|no copyright|all rights|rights reserved|section 107|link in (?:bio|description|the description)|join (?:my|our|the) discord|discord server|use code|business inquiries|business inquires|second channel|like (?:and|&) subscribe|subscribe (?:for|to|now|and)|hit the bell|notification bell|turn on notifications|thanks for watching|thank you for watching|hope you enjoy|don'?t forget|make sure to|let me know|in the comments|comment below|comments below|down below|check out|stay tuned|coming soon|next video|last video|previous video|full video|new video|watch till|watch until|music by|edited by|filmed by|credit to|credits to|dm for|follow me|follow us|follow for|for more|more videos|my socials|our socials|support the channel|buy me a|patreon|merch|sponsored by|paid promotion|affiliate link|no copyright intended|copyright intended|any copyright|contact (?:us|me)|email (?:us|me)|for business)\b/i;
/** Tokens for phrase mining: video-level text without handles, URLs and platform boilerplate. */
export function phraseTokens(o: Observation): string[] {
  const text = videoText(o)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@[\w.-]+/g, ' ')
    .replace(/\b[\w-]+\.(?:bsky\.social|com|net|org|tv|app|io)\b/gi, ' ');
  return tokenize(text).filter((t) => !PHRASE_STOP.has(t) && !/^\d+$/.test(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

export function buildClusters(observations: Observation[]): Cluster[] {
  const topicLike = observations.filter((o) => o.kind === 'search_interest' || o.kind === 'social_topic' || o.kind === 'hashtag');
  const videos = uniqBy(observations.filter((o) => o.kind === 'video'), (o) => o.id);
  const posts = observations.filter((o) => o.kind === 'post');

  // ---------- 1. topic clusters ----------
  const seeds = new Map<string, Cluster>();
  for (const o of topicLike) {
    const k = o.key;
    if (!seeds.has(k)) seeds.set(k, { id: `t_${k.replace(/\s+/g, '_').slice(0, 60)}`, kind: 'topic', name: o.title.replace(/^#/, ''), origin: 'seed', keywords: uniq(tokenize(`${o.title} ${o.text || ''}`)), members: [] });
    seeds.get(k)!.members.push(o);
  }
  let topics = Array.from(seeds.values());
  // Merge topics whose seed titles overlap. Token sets are computed ONCE per topic and updated on merge; candidate
  // pairs come from an inverted token index, so the pass is near-linear in the number of seeds. (The previous
  // version re-tokenised every member of every pair and restarted after each merge — quadratic-times-merges — and
  // grew from seconds to many minutes as the 7-day window filled up; it was the reason collections hit the job timeout.)
  const tokSet = new Map<Cluster, Set<string>>();
  for (const c of topics) tokSet.set(c, new Set(c.members.flatMap((m) => tokenize(m.title))));
  const byTok = new Map<string, Set<Cluster>>();
  for (const c of topics) for (const t of tokSet.get(c)!) (byTok.get(t) || byTok.set(t, new Set()).get(t)!).add(c);
  const gone = new Set<Cluster>();
  const mergeInto = (a: Cluster, b: Cluster) => {
    a.members.push(...b.members);
    a.keywords = uniq([...a.keywords, ...b.keywords]);
    const sa = tokSet.get(a)!;
    for (const t of tokSet.get(b)!) { sa.add(t); byTok.get(t)!.add(a); byTok.get(t)!.delete(b); }
    tokSet.delete(b);
    gone.add(b);
  };
  const similar = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return false;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const contain = inter / Math.min(a.size, b.size);
    return inter / (a.size + b.size - inter) >= 0.5 || (contain >= 0.99 && Math.min(a.size, b.size) >= 2);
  };
  for (const a of topics) {
    if (gone.has(a)) continue;
    let again = true;
    while (again) {
      again = false;
      const sa = tokSet.get(a)!;
      const cands = new Set<Cluster>();
      for (const t of sa) for (const c of byTok.get(t) || []) if (c !== a && !gone.has(c)) cands.add(c);
      for (const b of cands) {
        if (similar(sa, tokSet.get(b)!)) { mergeInto(a, b); again = true; break; }
      }
    }
  }
  topics = topics.filter((c) => !gone.has(c));
  // attach posts/videos that cover a topic's core tokens, or came from its feed — seed token sets precomputed once,
  // candidate topics looked up through the inverted index (only topics sharing a token can reach the coverage bar)
  const seedTokSet = new Map<Cluster, Set<string>>();
  const seedByTok = new Map<string, Set<Cluster>>();
  const hashtagTopics = new Map<string, Cluster[]>();
  const socialTopics = new Map<string, Cluster>();
  for (const c of topics) {
    const st = new Set(c.members.filter((m) => m.kind !== 'video' && m.kind !== 'post').flatMap((m) => tokenize(m.title)));
    seedTokSet.set(c, st);
    for (const t of st) (seedByTok.get(t) || seedByTok.set(t, new Set()).get(t)!).add(c);
    for (const m of c.members) {
      if (m.kind === 'hashtag') { const k = m.key.replace(/\s+/g, ''); (hashtagTopics.get(k) || hashtagTopics.set(k, []).get(k)!).push(c); }
      if (m.kind === 'social_topic') socialTopics.set(m.key, c);
    }
  }
  const inTopic = new Set<string>();
  for (const o of [...posts, ...videos]) {
    const toks = new Set(tokenize(`${o.title} ${o.text || ''}`));
    let best: Cluster | undefined;
    let bestCov = 0;
    const cands = new Set<Cluster>();
    for (const t of toks) for (const c of seedByTok.get(t) || []) cands.add(c);
    for (const tag of o.tags || []) for (const c of hashtagTopics.get(tag) || []) cands.add(c);
    for (const c of cands) {
      const seedToks = seedTokSet.get(c)!;
      if (!seedToks.size) continue;
      let hit = 0;
      for (const t of seedToks) if (toks.has(t)) hit++;
      const cov = hit / seedToks.size;
      const ok = cov >= 0.6 || (cov >= 0.5 && seedToks.size >= 3) || (o.tags || []).some((tag) => (hashtagTopics.get(tag) || []).includes(c));
      if (ok && cov > bestCov) {
        best = c;
        bestCov = cov;
      }
    }
    if (!best && o.query?.startsWith('topic:')) best = socialTopics.get(o.query.slice(6));
    if (best) {
      best.members.push(o);
      inTopic.add(o.id);
    }
  }

  // ---------- 2. video-first microtrends ----------
  const videoById = new Map(videos.map((v) => [v.id, v]));
  const N = Math.max(1, videos.length);
  const df = new Map<string, number>();
  const tokensByVideo = new Map<string, string[]>();
  for (const v of videos) {
    const toks = phraseTokens(v);
    tokensByVideo.set(v.id, toks);
    for (const t of uniq(toks)) df.set(t, (df.get(t) || 0) + 1);
  }
  // candidate keys: hashtags and bigrams/trigrams from video-level text
  const cand = new Map<string, { label: string; origin: 'hashtag' | 'phrase'; members: Set<string> }>();
  const addCand = (key: string, label: string, origin: 'hashtag' | 'phrase', id: string) => {
    if (!cand.has(key)) cand.set(key, { label, origin, members: new Set() });
    cand.get(key)!.members.add(id);
  };
  const queryTokens = new Set(FORMATS.flatMap((f) => f.queries.flatMap((q) => tokenize(q))));
  for (const v of videos) {
    for (const tag of uniq(v.tags || [])) {
      if ((GENERIC_TAGS.has(tag) && !BROAD_TOPICS.has(tag)) || tag.length < 4 || queryTokens.has(tag)) continue;
      addCand(`#${tag}`, `#${tag}`, 'hashtag', v.id);
    }
    const toks = tokensByVideo.get(v.id) || [];
    const seen = new Set<string>();
    for (let n = 3; n >= 2; n--) {
      for (let i = 0; i + n <= toks.length; i++) {
        const gram = toks.slice(i, i + n);
        // skip grams that are just generic/format words or too common across all videos
        if (gram.every((t) => queryTokens.has(t) || GENERIC_TAGS.has(t))) continue;
        // 4.0.1: description boilerplate ("fair use", "abonne toi", "auto generated", "all rights reserved") never names a trend
        if (BOILERPLATE_GRAM.test(gram.join(' '))) continue;
        // a token present in >40% of a sizeable corpus is a theme of the corpus, not of a microtrend
        if (N >= 20 && gram.some((t) => (df.get(t) || 0) / N > 0.4)) continue;
        const key = gram.join(' ');
        if (seen.has(key)) continue;
        seen.add(key);
        addCand(key, titleCase(key), 'phrase', v.id);
      }
    }
  }
  const taken = new Set<string>();
  let micro: Cluster[] = [];
  const ranked = [...cand.entries()]
    .map(([key, c]) => ({ key, ...c, creators: independentCreators([...c.members].map((id) => videoById.get(id)!)) }))
    .filter((c) => c.creators >= MIN_CREATORS)
    // prefer more creators, then longer (more specific) phrases
    .sort((a, b) => b.creators - a.creators || b.key.split(' ').length - a.key.split(' ').length || b.members.size - a.members.size);
  for (const c of ranked) {
    const fresh = [...c.members].filter((id) => !taken.has(id)).map((id) => videoById.get(id)!);
    if (independentCreators(fresh) < MIN_CREATORS) continue;
    fresh.forEach((m) => taken.add(m.id));
    const kws = c.origin === 'hashtag' ? [c.key.slice(1)] : c.key.split(' ');
    micro.push({ id: `m_${normalizeKey(c.key).replace(/\s+/g, '_').slice(0, 60)}`, kind: 'microtrend', name: c.label, origin: c.origin, keywords: kws, members: fresh, broadTopic: c.origin === 'hashtag' && BROAD_TOPICS.has(c.key.slice(1)) });
  }
  // merge microtrends whose member sets overlap heavily (e.g. "pumpkin carving" and "carving timelapse"); candidate
  // pairs come from a member-id index (clusters sharing no member cannot overlap), so this is linear, not quadratic
  {
    const idSet = new Map<Cluster, Set<string>>();
    const owners = new Map<string, Cluster[]>();
    for (const c of micro) { const ids = new Set(c.members.map((m) => m.id)); idSet.set(c, ids); for (const id of ids) (owners.get(id) || owners.set(id, []).get(id)!).push(c); }
    const dead = new Set<Cluster>();
    for (const a of micro) {
      if (dead.has(a)) continue;
      const seen = new Set<Cluster>();
      for (const id of idSet.get(a)!) for (const b of owners.get(id) || []) {
        if (b === a || dead.has(b) || seen.has(b)) continue;
        seen.add(b);
        if (jaccard(idSet.get(a)!, idSet.get(b)!) >= 0.6) {
          a.members = uniqBy([...a.members, ...b.members], (m) => m.id);
          a.keywords = uniq([...a.keywords, ...b.keywords]);
          for (const id of idSet.get(b)!) { idSet.get(a)!.add(id); (owners.get(id) || owners.set(id, []).get(id)!).push(a); }
          dead.add(b);
        }
      }
    }
    micro = micro.filter((c) => !dead.has(c));
  }
  // corroborate microtrends with topic signals that share tokens (adds audience-interest evidence)
  // a topic corroborates a microtrend only when it covers the microtrend's keywords (≥50% and ≥2 of them, or the
  // single keyword) — one shared token ("series" in "World Series" vs "anime series finale") is not corroboration
  // (seed token sets computed once per topic; only topics with 1–4 seed tokens can corroborate)
  const corro = topics.map((t) => { const seeds = t.members.filter((x) => x.kind !== 'video' && x.kind !== 'post'); return { seeds, toks: new Set(seeds.flatMap((x) => tokenize(x.title))) }; }).filter((c) => c.toks.size > 0 && c.toks.size <= 4);
  const corroByTok = new Map<string, typeof corro>();
  for (const c of corro) for (const t of c.toks) (corroByTok.get(t) || corroByTok.set(t, []).get(t)!).push(c);
  for (const m of micro) {
    const kw = uniq(m.keywords.map((k) => normalizeKey(k)).filter(Boolean));
    if (!kw.length) continue;
    const cands = new Set<(typeof corro)[number]>();
    for (const k of kw) for (const c of corroByTok.get(k) || []) cands.add(c);
    let added = false;
    for (const c of cands) {
      const hit = kw.filter((k) => c.toks.has(k)).length;
      const covered = kw.length === 1 ? hit === 1 : hit >= 2 && hit / kw.length >= 0.5;
      if (covered) { m.members.push(...c.seeds); added = true; }
    }
    if (added) m.members = uniqBy(m.members, (x) => x.id);
  }

  // ---------- 3. format pools (validated videos only) ----------
  const formats: Cluster[] = [];
  for (const f of FORMATS) {
    const members = videos.filter((v) => (v.formats || []).includes(f.id));
    if (!members.length) continue;
    formats.push({ id: `f_${f.id}`, kind: 'format', name: f.name, origin: 'format', keywords: uniq(f.queries.flatMap((q) => tokenize(q))), members, formatId: f.id });
  }

  const all = [...micro, ...topics, ...formats].map((c) => ({ ...c, members: uniqBy(c.members, (m) => m.id) })).filter((c) => c.members.length > 0);
  return all;
}

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

export function formatLabel(id?: string): string | undefined {
  return id ? FORMAT_BY_ID.get(id)?.name : undefined;
}
