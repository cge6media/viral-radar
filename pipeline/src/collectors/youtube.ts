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
 *   C. Discovery — 4.0: an ADAPTIVE allocation of search.list probes (see discovery.ts): the run's allowance comes
 *      from the budget left for the Pacific day ÷ runs still expected (reserve rule), probes are chosen by measured
 *      yield with 25 % exploration, inside VR_YT_SEARCH_BUDGET calls/day (default 90 of the 100 allowed).
 *   E. Channel statistics (50 per unit) and upload baselines for outlier candidates (2 units each).
 *   F. Hot-channel uploads (4.0, units only): the latest uploads of channels that just produced a hit/breakout, so a
 *      creator's next video is seen in its first hours (exploitation without spending a search call).
 *   G. Shorts verification (4.0, no quota): HEAD youtube.com/shorts/<id> — 200 means the Shorts player serves it,
 *      a redirect to /watch means it is not a Short. Cached in data/cache/youtube-shorts.json.
 *
 * A quota ledger (data/cache/youtube-quota.json) tracks units and search calls per Pacific day and stops the
 * collector before the daily limits. Without a key the source is reported as "disabled" and nothing is fabricated.
 *
 * D. oEmbed (no key) verifies title + channel of linked videos when the API is unavailable (no stats, no dates).
 */
import type { Observation } from '../types.js';
import { fetchJson, fixtureMode } from '../lib/http.js';
import { readJson, writeJson } from '../lib/store.js';
import { extractHashtags, hoursBetween, nowIso, round, sha1, youtubeId } from '../lib/util.js';
import { FORMATS } from '../intel/relevance.js';
import { allowance, buildPool, choose, emptyLedger, probeLabel, recordYield, rollLedger, summarizeYield, wantsDepth, MAX_PER_RUN, type Probe, type ProbeResult, type YieldLedger } from './discovery.js';

const API = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_REGIONS = (process.env.VR_YT_REGIONS || 'US,GB').split(',').map((s) => s.trim()).filter(Boolean);
/** secondary regions: two per run in rotation (international coverage at ~1/6 of the cost of charting them all every run) */
export const YOUTUBE_SECONDARY_REGIONS = (process.env.VR_YT_SECONDARY_REGIONS || 'CA,AU,IN,MX,BR,ES,DE,FR,JP,KR,PH,ID').split(',').map((s) => s.trim()).filter(Boolean);
export const SECONDARY_PER_RUN = Number(process.env.VR_YT_SECONDARY_PER_RUN || 3);
/** entertainment categories for chart=mostPopular (documented category ids) */
export const YT_CHART_CATEGORIES = (process.env.VR_YT_CHART_CATEGORIES || '1,10,15,20,23,24').split(',').map((s) => s.trim()).filter(Boolean);
export const SEARCH_BUDGET = Number(process.env.VR_YT_SEARCH_BUDGET || 90);
export const UNIT_BUDGET = Number(process.env.VR_YT_UNIT_BUDGET || 9000);
export const TRACK_MAX = Number(process.env.VR_YT_TRACK_MAX || 2500);
/** search.list calls per run are decided by the adaptive scheduler (discovery.ts); this env var now only caps it */
export const SEARCHES_PER_RUN = Number(process.env.VR_YT_SEARCHES_PER_RUN || MAX_PER_RUN);
/** format probes — a slice rotates into the schedule */
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

export interface QuotaLedger { day: string; units: number; searchCalls: number; lastDiscoveryAt?: string; slot?: number; rounds?: number; chartRound?: number; runsToday?: number; firstRunAt?: string; /** set on the first quotaExceeded answer: nothing more is spent that quota day */ exhaustedAt?: string; calls: { t: string; method: string; units: number; note?: string }[] }

/** hours until the next Pacific midnight (quota reset) */
export function hoursLeftInQuotaDay(iso = nowIso()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24, m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return round(24 - (h + m / 60), 2);
}

/** The quota day in Pacific time (YouTube resets at midnight PT), formatted YYYY-MM-DD. */
export const quotaDay = (iso = nowIso()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const today = () => quotaDay();

export async function loadLedger(): Promise<QuotaLedger> {
  const l = await readJson<QuotaLedger>('cache/youtube-quota.json');
  if (l && l.day === today()) return l;
  return { day: today(), units: 0, searchCalls: 0, lastDiscoveryAt: l?.lastDiscoveryAt, slot: l?.slot, rounds: l?.rounds, chartRound: l?.chartRound, calls: [] };
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

export interface YouTubeRunResult { items: Observation[]; errors: string[]; disabled?: boolean; subrequests: number; ledger?: QuotaLedger; tracked?: number; discovered?: number; regions?: string[]; diagnostics?: { id: string; t: string; views?: number; likes?: number; comments?: number }[]; probes?: ProbeResult[]; searchAllowance?: number; uploadsChecked?: number; uploadsNew?: number; shortsVerified?: { checked: number; shorts: number; notShorts: number; reliable: boolean } }

/**
 * @param trackIds   YouTube video ids already known (from history + this run's social links) to refresh.
 * @param topicTerms entertainment topic terms from this run (exploitation queries: what is being talked about now).
 * @param trendTerms microtrend names from the previous snapshot (exploitation: follow measured momentum).
 * @param diagnosticIds videos re-measured for diagnostics only (never stored as observations).
 */
export async function collectYouTube(opts: { apiKey?: string; trackIds?: string[]; topicTerms?: string[]; trendTerms?: string[]; diagnosticIds?: string[]; knownIds?: Set<string>; hotChannels?: { id: string; uploads?: string }[]; shortsCheckIds?: string[]; runSeed?: string } = {}): Promise<YouTubeRunResult> {
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
  const canSpend = (units: number) => !ledger.exhaustedAt && ledger.units + units <= UNIT_BUDGET;
  const noteQuotaError = (msg: string) => { if (/quotaExceeded|HTTP 403/.test(msg) && !ledger.exhaustedAt) { ledger.exhaustedAt = nowIso(); errors.push('YouTube answered quotaExceeded — no further calls this quota day'); } };
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
        noteQuotaError(msg);
        if (!/HTTP 400/.test(msg)) errors.push(`chart ${region}/${cat || 'all'}: ${msg}`); // some categories are not chartable in some regions
      }
    }
  }

  await saveLedger(ledger); // charts spent — persist before the long phases so a crash never loses the spend

  // C. discovery — adaptive allocation (4.0): reserve rule → allowance; bandit choice over the probe pool; yield ledger
  let discovered = 0;
  const known = opts.knownIds || new Set<string>();
  const yieldLedger = rollLedger((await readJson<YieldLedger>('cache/youtube-yield.json')) || emptyLedger(today()), today());
  yieldLedger.today.runs++;
  if (!yieldLedger.today.firstRunAt) yieldLedger.today.firstRunAt = observedAt;
  ledger.runsToday = (ledger.runsToday || 0) + 1;
  if (!ledger.firstRunAt) ledger.firstRunAt = observedAt;
  const hoursElapsed = hoursBetween(ledger.firstRunAt, observedAt);
  const hoursLeft = hoursLeftInQuotaDay(observedAt);
  const searchAllowance = allowance({ budget: SEARCH_BUDGET, spent: ledger.searchCalls, hoursLeftInDay: hoursLeft, runsToday: ledger.runsToday, hoursElapsedToday: hoursElapsed, max: MAX_PER_RUN });
  const queryRound = yieldLedger.today.runs + Object.keys(yieldLedger.probes).length;
  const pool = buildPool({ topicTerms: opts.topicTerms, trendTerms: opts.trendTerms, queries: DISCOVERY_QUERIES.slice(queryRound % DISCOVERY_QUERIES.length, (queryRound % DISCOVERY_QUERIES.length) + 6) });
  const seed = opts.runSeed || sha1(observedAt);
  const picks = choose(pool, yieldLedger, searchAllowance, observedAt, seed);
  const probeResults: ProbeResult[] = [];
  const searchOnce = async (probe: Probe, label: string, pageToken?: string): Promise<{ ids: string[]; next?: string } | undefined> => {
    if (ledger.searchCalls >= SEARCH_BUDGET) return undefined;
    subrequests++;
    spend('search.list', 1, `${label}${pageToken ? ' p2' : ''}`);
    const after = encodeURIComponent(new Date(Date.now() - probe.hours * 36e5).toISOString());
    const before = probe.beforeHours ? `&publishedBefore=${encodeURIComponent(new Date(Date.now() - probe.beforeHours * 36e5).toISOString())}` : '';
    const url = `${API}/search?part=id&type=video&order=viewCount&publishedAfter=${after}${before}&maxResults=50&safeSearch=moderate${probe.q != null ? `&q=${encodeURIComponent(probe.q)}` : ''}${probe.duration ? `&videoDuration=${probe.duration}` : ''}${probe.region ? `&regionCode=${probe.region}` : ''}${probe.category ? `&videoCategoryId=${probe.category}` : ''}${probe.lang ? `&relevanceLanguage=${probe.lang}` : ''}${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`;
    const sr = await fetchJson<{ items: { id: { videoId: string } }[]; nextPageToken?: string }>(url, { retries: 0 });
    return { ids: (sr.items || []).map((it) => it.id?.videoId).filter(Boolean), next: sr.nextPageToken };
  };
  const detailsFor = async (ids: string[], label: string): Promise<YtVideo[]> => {
    const out: YtVideo[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      if (!canSpend(1)) break;
      const chunk = ids.slice(i, i + 50);
      subrequests++;
      spend('videos.list', 1, `details ${label} ${chunk.length}`);
      const v = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=snippet,statistics,contentDetails&id=${chunk.join(',')}&key=${apiKey}`, { retries: 0 });
      out.push(...(v.items || []));
    }
    return out;
  };
  const measure = (label: string, family: string, how: ProbeResult['how'], searches: number, vids: YtVideo[], returned: number): ProbeResult => {
    const r: ProbeResult = { label, family, searches, returned, newIds: 0, newCandidates: 0, newEligible: 0, newFresh: 0, how };
    for (const v of vids) {
      if (known.has(v.id) || seen.has(`youtube:video:${v.id}`)) continue;
      r.newIds++;
      const views = num(v.statistics?.viewCount) || 0;
      const age = hoursBetween(v.snippet.publishedAt, observedAt);
      if (views >= 10_000) r.newCandidates++;
      if (views >= 500_000 && age <= 24 * 30) r.newEligible++;
      if (age <= 24) r.newFresh++;
    }
    return r;
  };
  let spentThisRun = 0;
  for (const pick of picks) {
    if (spentThisRun >= searchAllowance) break;
    try {
      const page1 = await searchOnce(pick.probe, pick.label);
      if (!page1) break;
      spentThisRun++;
      const vids = await detailsFor(page1.ids, pick.label);
      const r = measure(pick.label, pick.probe.family, pick.how, 1, vids, page1.ids.length);
      for (const v of vids) { add(videoToObservation(v, pick.label, undefined, observedAt)); discovered++; }
      // depth: a second page in the same run when the first one was rich in new eligible videos and the allowance allows
      if (page1.next && wantsDepth(pick.probe, { newEligible: r.newEligible, returned: page1.ids.length }) && ledger.searchCalls < SEARCH_BUDGET && spentThisRun < searchAllowance) {
        const page2 = await searchOnce(pick.probe, pick.label, page1.next);
        if (page2) {
          spentThisRun++;
          const vids2 = await detailsFor(page2.ids, pick.label);
          const r2 = measure(pick.label, pick.probe.family, 'depth', 1, vids2, page2.ids.length);
          for (const v of vids2) { add(videoToObservation(v, pick.label, undefined, observedAt)); discovered++; }
          r.searches += 1; r.returned += r2.returned; r.newIds += r2.newIds; r.newCandidates += r2.newCandidates; r.newEligible += r2.newEligible; r.newFresh += r2.newFresh;
          yieldLedger.today.picks.depth++;
        }
      }
      recordYield(yieldLedger, r, observedAt);
      probeResults.push(r);
    } catch (e) {
      errors.push(`${pick.label}: ${redact((e as Error).message)}`);
      noteQuotaError((e as Error).message);
      // a failing probe still gets its cooldown (and a zero yield), so it is not re-picked every run while it keeps failing
      recordYield(yieldLedger, { label: pick.label, family: pick.probe.family, searches: 1, returned: 0, newIds: 0, newCandidates: 0, newEligible: 0, newFresh: 0, how: pick.how }, observedAt);
      await saveLedger(ledger);
    }
  }
  ledger.lastDiscoveryAt = nowIso();
  await saveLedger(ledger);
  await writeJson('cache/youtube-yield.json', yieldLedger);

  // F. hot-channel uploads (units only): the newest uploads of channels that just produced a hit or breakout
  let uploadsChecked = 0, uploadsNew = 0;
  const hot = (opts.hotChannels || []).filter((c) => c.uploads && /^UU[A-Za-z0-9_-]{20,}$/.test(c.uploads)).slice(0, 30);
  const uploadIds: string[] = [];
  for (const c of hot) {
    if (!canSpend(1)) break;
    try {
      subrequests++;
      spend('playlistItems.list', 1, `uploads ${c.id}`);
      const pl = await fetchJson<{ items: { contentDetails: { videoId: string; videoPublishedAt?: string } }[] }>(`${API}/playlistItems?part=contentDetails&playlistId=${c.uploads}&maxResults=10&key=${apiKey}`, { retries: 0 });
      uploadsChecked++;
      for (const it of pl.items || []) {
        const id = it.contentDetails?.videoId;
        const at = it.contentDetails?.videoPublishedAt;
        if (!id || known.has(id) || seen.has(`youtube:video:${id}`)) continue;
        if (at && hoursBetween(at, observedAt) > 72) continue;
        uploadIds.push(id);
      }
    } catch (e) {
      errors.push(`uploads ${c.id}: ${redact((e as Error).message)}`);
    }
  }
  if (uploadIds.length) {
    try {
      const vids = await detailsFor(Array.from(new Set(uploadIds)), 'uploads');
      const r = measure('uploads:hot-channels', 'uploads', 'rotation', 0, vids, vids.length);
      for (const v of vids) { add(videoToObservation(v, 'uploads:hot-channels', undefined, observedAt)); uploadsNew++; }
      recordYield(yieldLedger, r, observedAt);
      await writeJson('cache/youtube-yield.json', yieldLedger);
    } catch (e) {
      errors.push(`uploads details: ${redact((e as Error).message)}`);
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
      noteQuotaError((e as Error).message);
      if (ledger.exhaustedAt) break;
    }
  }

  await saveLedger(ledger); // tracking spent

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

  // G. Shorts verification (no quota): applies to the ids the caller asked about (featured + new candidates)
  const shortsVerified = fixtureMode() ? undefined : await verifyShorts(opts.shortsCheckIds || [], items);

  await saveLedger(ledger);
  return { items, errors, subrequests, ledger, tracked, discovered, regions, diagnostics, probes: probeResults, searchAllowance, uploadsChecked, uploadsNew, shortsVerified };
}

// ---------------------------------------------------------------------------------------------------------------
// Channel statistics + creator baselines (cheap: 50 channels per unit; baseline = 2 units per channel)
// ---------------------------------------------------------------------------------------------------------------
export interface ChannelRecord { id: string; title?: string; subscribers?: number; videos?: number; views?: number; uploads?: string; fetchedAt: string; medianRecentViews?: number; baselineSampled?: number; baselineAt?: string; /** 4.0: last time this channel's uploads playlist was checked for new videos */ uploadsAt?: string }

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

// ---------------------------------------------------------------------------------------------------------------
// Shorts verification (no quota). youtube.com/shorts/<id> answers 200 for a Short and redirects (303 → /watch?v=)
// for a long-form video. A self-check on long videos from the same run guards against a region/consent page that
// would answer 200 for everything; if the check fails the run records nothing (duration stays the only evidence).
// ---------------------------------------------------------------------------------------------------------------
export interface ShortsCache { [id: string]: { s: 0 | 1; t: string } }
export async function loadShortsCache(): Promise<ShortsCache> {
  return (await readJson<ShortsCache>('cache/youtube-shorts.json')) || {};
}
async function headShorts(id: string): Promise<'short' | 'not_short' | 'unknown'> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(8000) });
    if (res.status === 200) return 'short';
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') || '';
      // only a redirect to the watch page proves "not a Short"; any other redirect (consent, bot wall, regional host) is unknown
      return /\/watch\?v=|youtube\.com\/watch/.test(loc) ? 'not_short' : 'unknown';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
export async function verifyShorts(ids: string[], items: Observation[], max = 150): Promise<{ checked: number; shorts: number; notShorts: number; reliable: boolean }> {
  const cache = await loadShortsCache();
  const byId = new Map(items.filter((o) => o.video?.platform === 'youtube').map((o) => [o.video!.id, o]));
  const result = { checked: 0, shorts: 0, notShorts: 0, reliable: true };
  // self-check: two long videos must NOT answer 200
  const longs = items.filter((o) => (o.video?.durationSec || 0) >= 600).slice(0, 2).map((o) => o.video!.id);
  for (const id of longs) {
    const r = await headShorts(id);
    if (r === 'short') { result.reliable = false; break; }
  }
  if (result.reliable && longs.length) {
    const now = nowIso();
    // "not a Short" verdicts expire after 30 days (a redirect policy can change); Shorts verdicts are stable
    const fresh = (id: string) => { const c = cache[id]; return !!c && (c.s === 1 || hoursBetween(c.t, now) < 24 * 30); };
    const todo = Array.from(new Set(ids)).filter((id) => /^[A-Za-z0-9_-]{6,}$/.test(id) && !fresh(id) && byId.get(id)?.video?.durationSec != null && (byId.get(id)!.video!.durationSec as number) <= 180).slice(0, max);
    for (let i = 0; i < todo.length; i += 4) {
      const rs = await Promise.all(todo.slice(i, i + 4).map(async (id) => [id, await headShorts(id)] as const));
      for (const [id, r] of rs) {
        if (r === 'unknown') continue;
        cache[id] = { s: r === 'short' ? 1 : 0, t: now };
        result.checked++;
        if (r === 'short') result.shorts++; else result.notShorts++;
      }
    }
    // a batch of ≥20 sub-minute videos with zero Shorts means the check is not working from this network
    const subMinute = todo.filter((id) => (byId.get(id)?.video?.durationSec ?? 999) <= 60).length;
    if (subMinute >= 20 && result.shorts === 0) result.reliable = false;
    if (result.reliable) await writeJson('cache/youtube-shorts.json', cache);
  }
  if (result.reliable) applyShortsCache(items, cache);
  return result;
}
/** stamp the verified Shorts state onto YouTube observations (the cache is the source of truth across runs) */
export function applyShortsCache(items: Observation[], cache: ShortsCache): number {
  let n = 0;
  for (const o of items) {
    if (o.video?.platform !== 'youtube') continue;
    const c = cache[o.video.id];
    if (!c) continue;
    o.video.shortForm = c.s ? 'verified' : 'not_short';
    if (c.s && !/shorts\//.test(o.url) && o.source === 'youtube') o.url = `https://www.youtube.com/shorts/${o.video.id}`;
    if (!c.s && /shorts\//.test(o.url) && o.source === 'youtube') o.url = `https://www.youtube.com/watch?v=${o.video.id}`;
    n++;
  }
  return n;
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
