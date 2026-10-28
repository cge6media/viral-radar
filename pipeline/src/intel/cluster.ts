/**
 * Clustering: observations → trend clusters (microtrends).
 *
 * Strategy (simplest reliable methods first):
 *  1. Seed clusters from topic-like evidence (Google Trends terms, Bluesky topics, trending hashtags).
 *     Seeds with the same normalized key across regions/sources merge automatically.
 *  2. Merge seeds whose token sets overlap heavily (Jaccard) — "nz vs ind" and "new zealand vs india".
 *  3. Attach video/post evidence to the best-matching seed by weighted token overlap (IDF-weighted).
 *  4. Discover NEW microtrends from the remaining posts: hashtags or title bigrams used by ≥ N distinct
 *     creators become their own cluster (this is where "rapping cats"-style microtrends surface).
 *  5. Remaining posts from a creator-format query (e.g. "cat video") form a format-level cluster.
 */
import type { Observation } from '../types.js';
import { normalizeKey, tokenize, uniq } from '../lib/util.js';

export interface Cluster {
  id: string;
  name: string;
  /** how the cluster was created */
  origin: 'seed' | 'hashtag' | 'bigram' | 'format';
  keywords: string[];
  members: Observation[];
}

const MIN_CREATORS_FOR_MICROTREND = Number(process.env.VR_MIN_CREATORS || 3);

function tokensOf(o: Observation): string[] {
  const base = tokenize(`${o.title} ${(o.tags || []).join(' ')}`);
  // for topic-like items also use description text (they are short); for posts, limit noise
  if (o.kind === 'search_interest' || o.kind === 'social_topic' || o.kind === 'hashtag') {
    return uniq([...base, ...tokenize(o.text || '').slice(0, 12)]);
  }
  return uniq(base);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function buildClusters(observations: Observation[]): Cluster[] {
  const topicLike = observations.filter((o) => o.kind === 'search_interest' || o.kind === 'social_topic' || o.kind === 'hashtag');
  const postLike = observations.filter((o) => o.kind === 'video' || o.kind === 'post');

  // document frequency for IDF weighting
  const df = new Map<string, number>();
  const allTokens = observations.map((o) => tokensOf(o));
  for (const toks of allTokens) for (const t of uniq(toks)) df.set(t, (df.get(t) || 0) + 1);
  const N = Math.max(1, observations.length);
  const idf = (t: string) => Math.log(1 + N / (1 + (df.get(t) || 0)));

  // 1. seeds keyed by normalized key (same term across regions merges)
  const seeds = new Map<string, Cluster>();
  for (const o of topicLike) {
    const k = o.key;
    if (!seeds.has(k)) seeds.set(k, { id: `t_${k.replace(/\s+/g, '_').slice(0, 60)}`, name: o.title.replace(/^#/, ''), origin: 'seed', keywords: tokensOf(o), members: [] });
    const c = seeds.get(k)!;
    c.members.push(o);
    c.keywords = uniq([...c.keywords, ...tokensOf(o)]);
  }

  // 2. merge overlapping seeds
  let clusters = Array.from(seeds.values());
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = new Set(clusters[i].members.flatMap((m) => tokenize(m.title)));
        const b = new Set(clusters[j].members.flatMap((m) => tokenize(m.title)));
        if (a.size === 0 || b.size === 0) continue;
        const jac = jaccard(a, b);
        const containment = [...a].filter((x) => b.has(x)).length / Math.min(a.size, b.size);
        if (jac >= 0.5 || (containment >= 0.99 && Math.min(a.size, b.size) >= 2)) {
          clusters[i].members.push(...clusters[j].members);
          clusters[i].keywords = uniq([...clusters[i].keywords, ...clusters[j].keywords]);
          clusters.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  // 3. attach posts to best seed by IDF-weighted overlap
  const unassigned: Observation[] = [];
  for (const o of postLike) {
    const toks = new Set(tokensOf(o));
    let best: Cluster | undefined;
    let bestScore = 0;
    for (const c of clusters) {
      const seedToks = new Set(c.members.filter((m) => m.kind !== 'video' && m.kind !== 'post').flatMap((m) => tokenize(m.title)));
      if (seedToks.size === 0) continue;
      let s = 0;
      for (const t of seedToks) if (toks.has(t)) s += idf(t);
      // require at least the seed's core tokens to be substantially present
      const coverage = [...seedToks].filter((t) => toks.has(t)).length / seedToks.size;
      const score = coverage >= 0.6 || (coverage >= 0.5 && seedToks.size >= 3) ? s : 0;
      // hashtag seeds: direct tag match is decisive
      const tagHit = c.origin === 'seed' && c.members.some((m) => m.kind === 'hashtag' && (o.tags || []).includes(m.key.replace(/\s+/g, '')));
      const final = tagHit ? Math.max(score, 5) : score;
      if (final > bestScore) {
        bestScore = final;
        best = c;
      }
    }
    // Topic-feed posts belong to their topic cluster by construction (query = topic:<key>)
    if (!best && o.query?.startsWith('topic:')) {
      const key = o.query.slice(6);
      best = clusters.find((c) => c.members.some((m) => m.kind === 'social_topic' && m.key === key));
      if (best) bestScore = 1;
    }
    if (best && bestScore > 0) best.members.push(o);
    else unassigned.push(o);
  }

  // 4. discover microtrends from hashtags / bigrams among unassigned posts (≥ N distinct creators)
  // tags that merely restate a creator-format query (e.g. #animation for "animation") are handled by step 5
  const queryTokens = new Set(unassigned.flatMap((o) => (o.query?.startsWith('search:') ? tokenize(o.query.slice(7)) : [])));
  const byTag = new Map<string, Observation[]>();
  for (const o of unassigned) for (const t of uniq(o.tags || [])) {
    if (GENERIC_TAGS.has(t) || t.length < 3 || queryTokens.has(t)) continue;
    if (!byTag.has(t)) byTag.set(t, []);
    byTag.get(t)!.push(o);
  }
  const taken = new Set<string>();
  const tagClusters: Cluster[] = [];
  for (const [tag, members] of [...byTag.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const fresh = members.filter((m) => !taken.has(m.id));
    const creators = new Set(fresh.map((m) => m.creator?.name || m.id));
    if (creators.size < MIN_CREATORS_FOR_MICROTREND) continue;
    fresh.forEach((m) => taken.add(m.id));
    tagClusters.push({ id: `h_${tag}`, name: `#${tag}`, origin: 'hashtag', keywords: [tag], members: fresh });
  }

  const rest1 = unassigned.filter((o) => !taken.has(o.id));
  const byBigram = new Map<string, Observation[]>();
  for (const o of rest1) {
    if (o.title.startsWith('(')) continue; // placeholder titles
    const toks = tokenize(o.title);
    const seen = new Set<string>();
    for (let i = 0; i < toks.length - 1; i++) {
      const bg = `${toks[i]} ${toks[i + 1]}`;
      if (seen.has(bg)) continue;
      if (queryTokens.has(toks[i]) && queryTokens.has(toks[i + 1])) continue; // restates a creator-format query
      seen.add(bg);
      if (!byBigram.has(bg)) byBigram.set(bg, []);
      byBigram.get(bg)!.push(o);
    }
  }
  const bigramClusters: Cluster[] = [];
  for (const [bg, members] of [...byBigram.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const fresh = members.filter((m) => !taken.has(m.id));
    const creators = new Set(fresh.map((m) => m.creator?.name || m.id));
    if (creators.size < MIN_CREATORS_FOR_MICROTREND) continue;
    fresh.forEach((m) => taken.add(m.id));
    bigramClusters.push({ id: `b_${bg.replace(/\s+/g, '_')}`, name: titleCase(bg), origin: 'bigram', keywords: bg.split(' '), members: fresh });
  }

  // 5. format-level clusters from creator-format queries
  const rest2 = unassigned.filter((o) => !taken.has(o.id));
  const byQuery = new Map<string, Observation[]>();
  for (const o of rest2) {
    const q = o.query?.startsWith('search:') ? o.query.slice(7) : undefined;
    if (!q) continue;
    if (!byQuery.has(q)) byQuery.set(q, []);
    byQuery.get(q)!.push(o);
  }
  const formatClusters: Cluster[] = [];
  for (const [q, members] of byQuery) {
    const creators = new Set(members.map((m) => m.creator?.name || m.id));
    if (creators.size < MIN_CREATORS_FOR_MICROTREND) continue;
    members.forEach((m) => taken.add(m.id));
    formatClusters.push({ id: `f_${normalizeKey(q).replace(/\s+/g, '_')}`, name: `${titleCase(q)} (format)`, origin: 'format', keywords: tokenize(q), members });
  }

  clusters = [...clusters, ...tagClusters, ...bigramClusters, ...formatClusters];
  // drop empty, dedupe members
  for (const c of clusters) {
    const seen = new Set<string>();
    c.members = c.members.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }
  return clusters.filter((c) => c.members.length > 0);
}

const GENERIC_TAGS = new Set(['art', 'video', 'videos', 'shorts', 'fyp', 'viral', 'trending', 'bsky', 'bskyart', 'bluesky', 'oc', 'gif', 'sketch', 'commission', 'commissions', 'comms', 'commsopen', 'nsfw']);

export function titleCase(s: string): string {
  return s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
