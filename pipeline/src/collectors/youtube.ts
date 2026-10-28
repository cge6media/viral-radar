/**
 * YouTube — production collector (official Data API v3, free key) + oEmbed fallback.
 *
 * Quota facts (developers.google.com/youtube/v3/determine_quota_cost + getting-started, re-checked 2026-10-28, and
 * the project's own quota page in the Cloud console):
 *   "Queries per day" = 10,000 units combined for all non-search endpoints; videos.list = 1 unit per call (≤50 ids);
 *   "Search Queries per day" = 100 search.list calls in their OWN bucket (1 unit each, not 100 units of the pool);
 *   per-minute limits (1.8M units, 100 searches) are irrelevant at this volume. Quotas reset at midnight PACIFIC time,
 *   so the ledger's day is the Pacific date — a UTC day would let two ledger days fall into one quota day.
 *
 * Per run:
 *   A. Charts  — videos.list chart=mostPopular per region (+ per entertainment category): ~1 unit each, every run.
 *   B. Tracking refresh — videos.list for every video id seen in the last 7 days (YouTube records AND YouTube links
 *      found on Bluesky): 1 unit per 50 ids. This turns social shares into verified video records (real views,
 *      publish date, channel, duration) and produces repeated observations → view velocity.
 *   C. Discovery — search.list for format queries + the run's entertainment topics, only every
 *      VR_YT_DISCOVERY_HOURS (default 6h) and within VR_YT_SEARCH_BUDGET calls/day (default 90 of the 100 allowed).
 *
 * A quota ledger (data/cache/youtube-quota.json) tracks units and search calls per UTC day and stops the collector
 * before the daily limits. Without a key the source is reported as "disabled" and nothing is fabricated.
 *
 * D. oEmbed (no key) verifies title + channel of linked videos when the API is unavailable (no stats, no dates).
 */
import type { Observation } from '../types.js';
import { fetchJson } from '../lib/http.js';
import { readJson, writeJson } from '../lib/store.js';
import { extractHashtags, hoursBetween, nowIso, youtubeId } from '../lib/util.js';
import { FORMATS } from '../intel/relevance.js';

const API = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_REGIONS = (process.env.VR_YT_REGIONS || 'US,GB').split(',').map((s) => s.trim()).filter(Boolean);
/** secondary regions: two per run in rotation (international coverage at ~1/6 of the cost of charting them all every run) */
export const YOUTUBE_SECONDARY_REGIONS = (process.env.VR_YT_SECONDARY_REGIONS || 'CA,AU,IN,MX,BR,ES,DE,FR,JP,KR,PH,ID').split(',').map((s) => s.trim()).filter(Boolean);
export const SECONDARY_PER_RUN = Number(process.env.VR_YT_SECONDARY_PER_RUN || 2);
/** entertainment categories for chart=mostPopular (documented category ids) */
export const YT_CHART_CATEGORIES = (process.env.VR_YT_CHART_CATEGORIES || '1,10,15,20,23,24').split(',').map((s) => s.trim()).filter(Boolean);
export const DISCOVERY_HOURS = Number(process.env.VR_YT_DISCOVERY_HOURS || 6);
export const SEARCH_BUDGET = Number(process.env.VR_YT_SEARCH_BUDGET || 90);
export const UNIT_BUDGET = Number(process.env.VR_YT_UNIT_BUDGET || 9000);
export const TRACK_MAX = Number(process.env.VR_YT_TRACK_MAX || 1500);
/** broad "what is big right now" probes (order=viewCount within the last 72h) — run every discovery round */
export const BROAD_QUERIES: string[] = process.env.VR_YT_BROAD_QUERIES
  ? process.env.VR_YT_BROAD_QUERIES.split(',').map((s) => s.trim()).filter(Boolean)
  : ['#shorts', 'viral', 'funny', 'trending', 'videos virales', 'reaction', 'animation', 'cat'];
/** format probes — rotated across rounds so the whole list is covered every day */
export const DISCOVERY_QUERIES: string[] = process.env.VR_YT_QUERIES
  ? process.env.VR_YT_QUERIES.split(',').map((s) => s.trim()).filter(Boolean)
  : ['animated skit', 'animal interview', 'talking cat', 'ai animation short', 'puppet comedy', 'rapping cat', 'cartoon short film', 'comedy skit', 'street interview', 'stop motion', 'asmr', 'oddly satisfying', 'cooking recipe short', 'indie animation', 'dubbed animals', 'original character animation', 'parody song', 'storytime animation', 'ai generated video', 'skit', 'prank', 'meme', 'cover song', 'gaming clip', 'speedrun', 'satisfying', 'explained'];

export const YT_CATEGORY: Record<string, string> = {
  '1': 'Film & Animation', '2': 'Autos & Vehicles', '10': 'Music', '15': 'Pets & Animals', '17': 'Sports',
  '19': 'Travel & Events', '20': 'Gaming', '22': 'People & Blogs', '23': 'Comedy', '24': 'Entertainment',
  '25': 'News & Politics', '26': 'Howto & Style', '27': 'Education', '28': 'Science & Technology', '29': 'Nonprofits & Activism',
};

export interface YtVideo {
  id: string;
  snippet: {
    publishedAt: string; channelId: string; title: string; description?: string;
    thumbnails?: Record<string, { url: string }>; channelTitle: string; tags?: string[]; categoryId?: string;
    liveBroadcastContent?: 'live' | 'upcoming' | 'none';
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

export interface QuotaLedger { day: string; units: number; searchCalls: number; lastDiscoveryAt?: string; rounds?: number; chartRound?: number; calls: { t: string; method: string; units: number; note?: string }[] }

/** The quota day in Pacific time (YouTube resets at midnight PT), formatted YYYY-MM-DD. */
export const quotaDay = (iso = nowIso()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const today = () => quotaDay();

export async function loadLedger(): Promise<QuotaLedger> {
  const l = await readJson<QuotaLedger>('cache/youtube-quota.json');
  if (l && l.day === today()) return l;
  return { day: today(), units: 0, searchCalls: 0, lastDiscoveryAt: l?.lastDiscoveryAt, rounds: l?.rounds, chartRound: l?.chartRound, calls: [] };
}
export async function saveLedger(l: QuotaLedger): Promise<void> {
  l.calls = l.calls.slice(-200);
  await writeJson('cache/youtube-quota.json', l);
}

export function videoToObservation(v: YtVideo, query: string, rank: number | undefined, observedAt = nowIso(), region?: string): Observation {
  const thumbs = v.snippet.thumbnails || {};
  const thumb = (thumbs['medium'] || thumbs['high'] || thumbs['default'])?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
  const dur = v.contentDetails?.duration ? isoDurationSeconds(v.contentDetails.duration) : undefined;
  const isShort = dur != null ? dur <= 180 : /#shorts/i.test(v.snippet.title + ' ' + (v.snippet.description || ''));
  return {
    id: `youtube:video:${v.id}`, source: 'youtube', kind: 'video', level: 'direct', key: `yt:${v.id}`,
    title: v.snippet.title,
    url: isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    observedAt, verifiedAt: observedAt,
    publishedAt: v.snippet.publishedAt, videoPublishedAt: v.snippet.publishedAt,
    metrics: { views: num(v.statistics?.viewCount), likes: num(v.statistics?.likeCount), comments: num(v.statistics?.commentCount), rank },
    video: { platform: 'youtube', id: v.id, durationSec: dur, channelId: v.snippet.channelId, statsDirect: true, live: v.snippet.liveBroadcastContent === 'live' || v.snippet.liveBroadcastContent === 'upcoming' ? v.snippet.liveBroadcastContent : undefined },
    region,
    creator: { name: v.snippet.channelTitle, url: `https://www.youtube.com/channel/${v.snippet.channelId}` },
    thumbnail: thumb,
    text: (v.snippet.description || '').slice(0, 400),
    tags: [...extractHashtags(v.snippet.title + ' ' + (v.snippet.description || '')), ...(v.snippet.tags || []).map((t) => t.toLowerCase()).slice(0, 15)],
    platformCategory: YT_CATEGORY[v.snippet.categoryId || ''],
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
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

export interface YouTubeRunResult { items: Observation[]; errors: string[]; disabled?: boolean; subrequests: number; ledger?: QuotaLedger; tracked?: number; discovered?: number; regions?: string[]; diagnostics?: { id: string; t: string; views?: number; likes?: number; comments?: number }[] }

/**
 * @param trackIds   YouTube video ids already known (from history + this run's social links) to refresh.
 * @param topicTerms entertainment topic terms from this run (exploitation queries: what is being talked about now).
 * @param trendTerms microtrend names from the previous snapshot (exploitation: follow measured momentum).
 * @param diagnosticIds videos re-measured for diagnostics only (never stored as observations).
 */
export async function collectYouTube(opts: { apiKey?: string; trackIds?: string[]; topicTerms?: string[]; trendTerms?: string[]; diagnosticIds?: string[] } = {}): Promise<YouTubeRunResult> {
  const apiKey = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
  const items: Observation[] = [];
  const errors: string[] = [];
  let subrequests = 0;
  if (!apiKey) return { items, errors: ['YOUTUBE_API_KEY not set'], disabled: true, subrequests };
  const ledger = await loadLedger();
  const observedAt = nowIso();
  const seen = new Set<string>();
  const add = (o: Observation) => {
    if (seen.has(o.id)) return;
    seen.add(o.id);
    items.push(o);
  };
  // search.list is metered in its own 100/day bucket; everything else draws from the 10,000-unit pool
  const spend = (method: string, units: number, note?: string) => {
    if (method === 'search.list') ledger.searchCalls += 1;
    else ledger.units += units;
    ledger.calls.push({ t: nowIso(), method, units, note });
  };
  const canSpend = (units: number) => ledger.units + units <= UNIT_BUDGET;
  const redact = (m: string) => m.split(apiKey).join('***');

  // A. charts — primary regions every run, a rotating slice of secondary regions
  const chartRound = ledger.chartRound || 0;
  ledger.chartRound = chartRound + 1;
  const secondary = YOUTUBE_SECONDARY_REGIONS.length ? Array.from({ length: Math.min(SECONDARY_PER_RUN, YOUTUBE_SECONDARY_REGIONS.length) }, (_, i) => YOUTUBE_SECONDARY_REGIONS[(chartRound * SECONDARY_PER_RUN + i) % YOUTUBE_SECONDARY_REGIONS.length]) : [];
  const regions = Array.from(new Set([...YOUTUBE_REGIONS, ...secondary]));
  for (const region of regions) {
    for (const cat of ['', ...YT_CHART_CATEGORIES]) {
      if (!canSpend(1)) break;
      try {
        subrequests++;
        spend('videos.list', 1, `mostPopular ${region} cat=${cat || 'all'}`);
        const url = `${API}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${region}${cat ? `&videoCategoryId=${cat}` : ''}&maxResults=50&key=${apiKey}`;
        const res = await fetchJson<{ items: YtVideo[] }>(url, { retries: 0 });
        (res.items || []).forEach((v, i) => add(videoToObservation(v, `chart:${region}:${cat || 'all'}`, i + 1, observedAt, region)));
      } catch (e) {
        const msg = redact((e as Error).message);
        if (!/HTTP 400/.test(msg)) errors.push(`chart ${region}/${cat || 'all'}: ${msg}`); // some categories are not chartable in some regions
      }
    }
  }

  // C. discovery (rationed)
  let discovered = 0;
  const hoursSinceDiscovery = ledger.lastDiscoveryAt ? (Date.now() - new Date(ledger.lastDiscoveryAt).getTime()) / 36e5 : Infinity;
  if (hoursSinceDiscovery >= DISCOVERY_HOURS && ledger.searchCalls < SEARCH_BUDGET) {
    // exploitation: what people talk about now (Bluesky topics) and microtrends that already show momentum
    const topicQueries = (opts.topicTerms || []).slice(0, 3);
    const trendQueries = (opts.trendTerms || []).filter((t) => !topicQueries.includes(t)).slice(0, 3);
    const perRound = Math.max(1, Math.floor(SEARCH_BUDGET / Math.max(1, Math.round(24 / DISCOVERY_HOURS))));
    // exploration: broad probes every round, then a rotating window of format probes so the whole catalogue is covered daily
    const round = ledger.rounds || 0;
    const formatSlots = Math.max(0, perRound - BROAD_QUERIES.length - topicQueries.length - trendQueries.length);
    const start = DISCOVERY_QUERIES.length ? (round * formatSlots) % DISCOVERY_QUERIES.length : 0;
    const formatQueries = Array.from({ length: Math.min(formatSlots, DISCOVERY_QUERIES.length) }, (_, i) => DISCOVERY_QUERIES[(start + i) % DISCOVERY_QUERIES.length]);
    const queries = Array.from(new Set([...BROAD_QUERIES, ...topicQueries, ...trendQueries, ...formatQueries]));
    ledger.rounds = round + 1;
    const shortsOnly = new Set(BROAD_QUERIES.filter((_, i) => i % 2 === 0)); // half the broad probes target Shorts (<4 min) explicitly
    const publishedAfter = encodeURIComponent(new Date(Date.now() - 3 * 864e5).toISOString());
    const foundIds: string[] = [];
    for (const q of queries.slice(0, perRound)) {
      if (ledger.searchCalls >= SEARCH_BUDGET) break;
      try {
        subrequests++;
        spend('search.list', 1, q);
        const sUrl = `${API}/search?part=id&type=video&order=viewCount&publishedAfter=${publishedAfter}&q=${encodeURIComponent(q)}&maxResults=25&safeSearch=moderate${shortsOnly.has(q) ? '&videoDuration=short' : ''}&key=${apiKey}`;
        const s = await fetchJson<{ items: { id: { videoId: string } }[] }>(sUrl, { retries: 0 });
        for (const it of s.items || []) if (it.id?.videoId) foundIds.push(`${it.id.videoId}|${q}`);
      } catch (e) {
        errors.push(`search ${q}: ${redact((e as Error).message)}`);
      }
    }
    ledger.lastDiscoveryAt = nowIso();
    // details for discovered ids (batched)
    const byId = new Map(foundIds.map((x) => x.split('|') as [string, string]));
    const ids = Array.from(byId.keys());
    for (let i = 0; i < ids.length; i += 50) {
      if (!canSpend(1)) break;
      const chunk = ids.slice(i, i + 50);
      try {
        subrequests++;
        spend('videos.list', 1, `discovery details ${chunk.length}`);
        const v = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${apiKey}`, { retries: 0 });
        for (const vid of v.items || []) {
          add(videoToObservation(vid, `yt:${byId.get(vid.id) || 'search'}`, undefined, observedAt));
          discovered++;
        }
      } catch (e) {
        errors.push(`discovery details: ${redact((e as Error).message)}`);
      }
    }
  }

  // B. tracking refresh (cheap, every run): known ids not already fetched above
  const track = Array.from(new Set((opts.trackIds || []).filter((id) => /^[A-Za-z0-9_-]{6,}$/.test(id) && !seen.has(`youtube:video:${id}`)))).slice(0, TRACK_MAX);
  let tracked = 0;
  for (let i = 0; i < track.length; i += 50) {
    if (!canSpend(1)) {
      errors.push('unit budget reached before all tracked videos were refreshed');
      break;
    }
    const chunk = track.slice(i, i + 50);
    try {
      subrequests++;
      spend('videos.list', 1, `track ${chunk.length}`);
      const v = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${apiKey}`, { retries: 0 });
      for (const vid of v.items || []) {
        add(videoToObservation(vid, 'track', undefined, observedAt));
        tracked++;
      }
    } catch (e) {
      errors.push(`track: ${redact((e as Error).message)}`);
    }
  }

  // E. diagnostics — re-measure watched videos (benchmark cases), kept out of the observation store
  const diagnostics: YouTubeRunResult['diagnostics'] = [];
  const diag = Array.from(new Set((opts.diagnosticIds || []).filter((id) => /^[A-Za-z0-9_-]{6,}$/.test(id)))).slice(0, 200);
  for (let i = 0; i < diag.length; i += 50) {
    if (!canSpend(1)) break;
    const chunk = diag.slice(i, i + 50);
    try {
      subrequests++;
      spend('videos.list', 1, `diagnostics ${chunk.length}`);
      const v = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=statistics&id=${chunk.join(',')}&key=${apiKey}`, { retries: 0 });
      for (const vid of v.items || []) diagnostics.push({ id: vid.id, t: observedAt, views: num(vid.statistics?.viewCount), likes: num(vid.statistics?.likeCount), comments: num(vid.statistics?.commentCount) });
    } catch (e) {
      errors.push(`diagnostics: ${redact((e as Error).message)}`);
    }
  }

  await saveLedger(ledger);
  return { items, errors, subrequests, ledger, tracked, discovered, regions, diagnostics };
}

// ---------------------------------------------------------------------------------------------------------------
// Channel statistics + creator baselines (cheap: 50 channels per unit; baseline = 2 units per channel)
// ---------------------------------------------------------------------------------------------------------------
export interface ChannelRecord { id: string; title?: string; subscribers?: number; videos?: number; views?: number; uploads?: string; fetchedAt: string; medianRecentViews?: number; baselineSampled?: number; baselineAt?: string }

export async function loadChannelCache(): Promise<Record<string, ChannelRecord>> {
  return (await readJson<Record<string, ChannelRecord>>('cache/youtube-channels.json')) || {};
}

/**
 * Refresh channel statistics for the given ids (older than 24h) and compute upload baselines for `baselineIds`
 * (older than 72h). Returns the merged cache. Spends from the same ledger (units only).
 */
export async function fetchChannelData(opts: { apiKey?: string; channelIds: string[]; baselineIds?: string[]; maxBaselines?: number }): Promise<{ channels: Record<string, ChannelRecord>; units: number; errors: string[] }> {
  const apiKey = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
  const cache = await loadChannelCache();
  const errors: string[] = [];
  let units = 0;
  if (!apiKey) return { channels: cache, units, errors: ['YOUTUBE_API_KEY not set'] };
  const ledger = await loadLedger();
  const now = nowIso();
  const stale = (c?: ChannelRecord) => !c || hoursBetween(c.fetchedAt, now) >= 24;
  const ids = Array.from(new Set(opts.channelIds.filter((id) => /^UC[A-Za-z0-9_-]{20,}$/.test(id) && stale(cache[id])))).slice(0, 1000);
  const redact = (m: string) => m.split(apiKey).join('***');
  for (let i = 0; i < ids.length; i += 50) {
    if (ledger.units + 1 > UNIT_BUDGET) { errors.push('unit budget reached before all channels were refreshed'); break; }
    const chunk = ids.slice(i, i + 50);
    try {
      ledger.units += 1; units += 1;
      ledger.calls.push({ t: nowIso(), method: 'channels.list', units: 1, note: `stats ${chunk.length}` });
      const res = await fetchJson<{ items: { id: string; snippet?: { title?: string }; statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>(
        `${API}/channels?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&maxResults=50&key=${apiKey}`, { retries: 0 });
      for (const c of res.items || []) {
        cache[c.id] = { ...(cache[c.id] || {}), id: c.id, title: c.snippet?.title, subscribers: num(c.statistics?.subscriberCount), videos: num(c.statistics?.videoCount), views: num(c.statistics?.viewCount), uploads: c.contentDetails?.relatedPlaylists?.uploads, fetchedAt: now };
      }
    } catch (e) {
      errors.push(`channels: ${redact((e as Error).message)}`);
    }
  }
  // baselines: median views of the channel's 20 most recent uploads (excluding nothing — the candidate itself is usually
  // one of them, which makes the ratio conservative)
  const baseIds = Array.from(new Set((opts.baselineIds || []).filter((id) => cache[id]?.uploads && (!cache[id].baselineAt || hoursBetween(cache[id].baselineAt!, now) >= 72)))).slice(0, opts.maxBaselines ?? 20);
  for (const id of baseIds) {
    if (ledger.units + 2 > UNIT_BUDGET) { errors.push('unit budget reached before all baselines were computed'); break; }
    try {
      ledger.units += 2; units += 2;
      ledger.calls.push({ t: nowIso(), method: 'playlistItems.list+videos.list', units: 2, note: `baseline ${id}` });
      const pl = await fetchJson<{ items: { contentDetails: { videoId: string } }[] }>(`${API}/playlistItems?part=contentDetails&playlistId=${cache[id].uploads}&maxResults=20&key=${apiKey}`, { retries: 0 });
      const vids = (pl.items || []).map((p) => p.contentDetails.videoId).filter(Boolean);
      if (!vids.length) { cache[id].baselineAt = now; cache[id].baselineSampled = 0; continue; }
      const vs = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=statistics&id=${vids.join(',')}&key=${apiKey}`, { retries: 0 });
      const views = (vs.items || []).map((v) => num(v.statistics?.viewCount)).filter((x): x is number => x != null).sort((a, b) => a - b);
      cache[id].medianRecentViews = views.length ? views[Math.floor(views.length / 2)] : undefined;
      cache[id].baselineSampled = views.length;
      cache[id].baselineAt = now;
    } catch (e) {
      errors.push(`baseline ${id}: ${redact((e as Error).message)}`);
    }
  }
  await saveLedger(ledger);
  // keep the cache bounded: drop channels not refreshed for 14 days
  for (const [id, c] of Object.entries(cache)) if (hoursBetween(c.fetchedAt, now) > 24 * 14) delete cache[id];
  await writeJson('cache/youtube-channels.json', cache);
  return { channels: cache, units, errors };
}

/** oEmbed enrichment (no key): verified title + channel for linked YouTube videos. No stats, no dates. */
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

export async function enrichYouTubeLinks(obs: Observation[], max = 60): Promise<number> {
  let n = 0;
  for (const o of obs) {
    if (n >= max) break;
    if (o.source === 'youtube' || o.video?.platform !== 'youtube' || o.creator?.url?.includes('youtube.com')) continue;
    const e = await oembed(o.url);
    if (!e) continue;
    n++;
    o.title = e.title || o.title;
    o.creator = { name: e.author_name, url: e.author_url };
    o.thumbnail = o.thumbnail || e.thumbnail_url;
    o.verifiedAt = nowIso();
  }
  return n;
}
