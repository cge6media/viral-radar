/**
 * Pipeline entrypoint (v2):
 *   Source discovery → Collection → Verification (YouTube) → Normalization → Dedup/History → Relevance validation
 *   → Clustering (topics / microtrends / formats) → Per-window scoring → Quality checks → Snapshot
 *
 *   npm run collect            live collection (GitHub Actions on a schedule)
 *   npm run collect:fixtures   offline run against captured real responses in pipeline/fixtures
 */
import { collectGoogleTrends } from './collectors/googleTrends.js';
import { collectBluesky } from './collectors/bluesky.js';
import { collectMastodon } from './collectors/mastodon.js';
import { collectYouTube, enrichYouTubeLinks, fetchChannelData, loadChannelCache, quotaDay, SEARCH_BUDGET, UNIT_BUDGET } from './collectors/youtube.js';
import { collectTikTok, enrichTikTokLinks } from './collectors/tiktok.js';
import { buildVideoRecords, linkCrossPlatform, trendIndexFrom, type ChannelStats } from './intel/videos.js';
import { buildVideoIntel, markDuplicates } from './intel/funnel.js';
import { buildClusters, independentCreators, type Cluster } from './intel/cluster.js';
import { classify, decideNewsEvent, profileFor } from './intel/taxonomy.js';
import { FORMAT_BY_ID, validateObservation } from './intel/relevance.js';
import { contentTime, inWindow, interestLevel, scoreWindow, uniqByExample, videoRate, type MetricPoint } from './intel/score.js';
import { runQualityChecks } from './quality.js';
import {
  appendObservations, appendScores, loadMetricHistory, loadObservations, loadScores, loadSourceCache, pruneHistory,
  saveSourceCache, writeJson, readJson, DATA_DIR, type ScoreRecord,
} from './lib/store.js';
import { fixtureMode } from './lib/http.js';
import type { CategoryActivity, Observation, Platform, Snapshot, SourceQuality, SourceStatus, Trend, VideoRecord, Window, WindowScores } from './types.js';
import { WINDOWS } from './types.js';
import { hasUnsafeMarkers, hoursBetween, nowIso, round, sha1 } from './lib/util.js';

if (process.argv.includes('--fixtures')) process.env.VR_FIXTURES = '1';

const SOURCE_LABELS: Record<Platform, string> = {
  google_trends: 'Google Trends — trending searches',
  bluesky: 'Bluesky — topics, feeds, video discovery',
  mastodon: 'Mastodon — trending hashtags (7-day history)',
  youtube: 'YouTube Data API — charts, tracking, discovery',
  tiktok: 'TikTok Creative Center (opt-in, best-effort)',
};
const SOURCE_METRICS: Record<Platform, string[]> = {
  google_trends: ['search traffic (lower bound)', 'news links'],
  bluesky: ['likes', 'reposts', 'replies', 'native video', 'external video links'],
  mastodon: ['daily uses', 'accounts', '7-day series'],
  youtube: ['views', 'likes', 'comments', 'publish date', 'duration', 'channel'],
  tiktok: ['post count', 'views', '7-day trend'],
};
const SOURCE_WEIGHT: Record<Platform, number> = { youtube: 1, bluesky: 0.7, tiktok: 0.6, google_trends: 0.4, mastodon: 0.35 };

interface SourceRun { status: SourceStatus; items: Observation[]; subrequests: number; errors: number; extra?: Record<string, unknown> }

async function runSource(source: Platform, fn: () => Promise<{ items: Observation[]; errors: string[]; disabled?: boolean; subrequests?: number }>): Promise<SourceRun> {
  const label = SOURCE_LABELS[source];
  const t0 = Date.now();
  try {
    const r = await fn();
    const subrequests = r.subrequests ?? 1;
    if (r.disabled) return { status: { source, label, ok: false, mode: 'disabled', items: 0, note: r.errors.join('; ') }, items: [], subrequests: 0, errors: 0 };
    if (r.items.length > 0) {
      await saveSourceCache(source, r.items);
      return {
        status: { source, label, ok: true, mode: fixtureMode() ? 'fixture' : 'live', items: r.items.length, fetchedAt: nowIso(), error: r.errors.length ? summarizeErrors(r.errors) : undefined, note: `${Date.now() - t0}ms` },
        items: r.items, subrequests, errors: r.errors.length, extra: r as unknown as Record<string, unknown>,
      };
    }
    throw new Error(r.errors.join('; ') || 'no items returned');
  } catch (e) {
    const cache = await loadSourceCache(source);
    if (cache?.items?.length) {
      return { status: { source, label, ok: false, mode: 'cached', items: cache.items.length, fetchedAt: cache.savedAt, error: (e as Error).message, note: `serving cached results from ${cache.savedAt}` }, items: cache.items, subrequests: 1, errors: 1 };
    }
    return { status: { source, label, ok: false, mode: 'live', items: 0, error: (e as Error).message }, items: [], subrequests: 1, errors: 1 };
  }
}

export async function main(): Promise<Snapshot> {
  const runStart = nowIso();
  const runId = `${runStart.slice(0, 16).replace(/[-:T]/g, '')}_${sha1(runStart)}`;
  console.log(`[viral-radar] run ${runId} fixtures=${fixtureMode()} data=${DATA_DIR}`);

  // ---- 1. collect social + search sources ----
  const existing = await loadObservations();
  const [gt, bs, ma, tt] = await Promise.all([
    runSource('google_trends', collectGoogleTrends),
    runSource('bluesky', () => collectBluesky()),
    runSource('mastodon', () => collectMastodon()),
    runSource('tiktok', collectTikTok),
  ]);

  // ---- 2. YouTube: verify linked videos + charts + rationed discovery ----
  const knownYt = new Set<string>();
  for (const o of [...existing, ...bs.items]) if (o.video?.platform === 'youtube' && hoursBetween(o.firstSeenAt || o.observedAt, runStart) <= 24 * 7) knownYt.add(o.video.id);
  const topicTerms = bs.items.filter((o) => o.kind === 'social_topic').map((o) => o.title).filter((t) => classify(t).category !== 'News & Politics' && !decideNewsEvent([], t, classify(t).category));
  // exploitation: microtrends that already showed momentum last run become discovery probes
  const previous = await readJson<Snapshot>('latest.json');
  const trendTerms = (previous?.trends || []).filter((t) => t.kind === 'microtrend' && t.qualified && !t.isGeneric).sort((a, b) => b.scores.opportunity - a.scores.opportunity).map((t) => t.name.replace(/^#/, '').replace(/([a-z])([A-Z])/g, '$1 $2')).slice(0, 3);
  // diagnostics watch list (benchmark cases): re-measured every run, never stored as observations
  const watch = (await readJson<{ ids: string[] }>('diagnostics/watch.json'))?.ids || [];
  let ytDiagnostics: { id: string; t: string; views?: number; likes?: number; comments?: number }[] = [];
  const yt = await runSource('youtube', async () => {
    const r = await collectYouTube({ trackIds: Array.from(knownYt), topicTerms, trendTerms, diagnosticIds: watch });
    ytDiagnostics = r.diagnostics || [];
    return r;
  });
  if (ytDiagnostics.length) await appendDiagnostics(ytDiagnostics);

  const sources = [gt, bs, ma, yt, tt].map((r) => r.status);
  let fresh = [gt, bs, ma, yt, tt].flatMap((r) => r.items).filter((o) => !hasUnsafeMarkers(`${o.title} ${o.text || ''}`));
  for (const s of sources) console.log(`  ${s.ok ? 'ok ' : 'ERR'} ${s.source.padEnd(14)} ${s.mode.padEnd(8)} ${String(s.items).padStart(4)} ${s.error || ''}`);

  // upgrade Bluesky-linked YouTube videos with the verified YouTube record (creator, publish date, stats stay on the YouTube record)
  const ytById = new Map(yt.items.map((o) => [o.video!.id, o]));
  for (const o of fresh) {
    if (o.source === 'bluesky' && o.video?.platform === 'youtube') {
      const v = ytById.get(o.video.id);
      if (v) {
        o.creator = v.creator;
        o.title = v.title;
        o.thumbnail = v.thumbnail;
        o.videoPublishedAt = v.videoPublishedAt;
        o.publishedAt = v.videoPublishedAt; // now verified on the video platform
        o.verifiedAt = v.verifiedAt;
      }
    }
  }
  if (!fixtureMode() && yt.status.mode === 'disabled') {
    const n = await enrichYouTubeLinks(fresh);
    if (n) console.log(`  verified ${n} linked YouTube videos via oEmbed (title + channel; no stats without an API key)`);
  }
  if (!fixtureMode()) {
    const n = await enrichTikTokLinks(fresh);
    if (n) console.log(`  verified ${n} linked TikTok videos via oEmbed (title + author + embed; TikTok publishes no statistics)`);
  }

  // ---- 3. relevance validation (stage 2 classification) ----
  for (const o of fresh) o.formats = validateObservation(o).formats;

  // ---- 4. persist + dedupe ----
  const written = await appendObservations(fresh, existing);
  const all = dedupeLatest([...existing, ...fresh]);
  // re-validate every observation with the current rules — stored formats are a cache from the rules of the day they were first seen
  for (const o of all) o.formats = validateObservation(o).formats;
  console.log(`  observations: +${written.full} new, ${written.ticks} ticks, ${all.length} unique in window (${existing.length} loaded from history)`);

  // ---- 5. cluster ----
  const now = nowIso();
  const recent = all.filter((o) => inWindow(o, '7d', now) && !(o.kind === 'post' && !(o.text || '').trim()));
  const clusters = buildClusters(recent);
  const scoreHistory = await loadScores();
  const byTrend = new Map<string, ScoreRecord[]>();
  for (const r of scoreHistory) (byTrend.get(r.trendId) || byTrend.set(r.trendId, []).get(r.trendId)!).push(r);
  const metricHistory = await loadMetricHistory(recent.filter((o) => o.kind === 'video' && o.level === 'direct').map((o) => o.id));

  // ---- 6. score per window ----
  const trends: Trend[] = [];
  const records: ScoreRecord[] = [];
  for (const c of clusters) {
    const fmt = c.formatId ? FORMAT_BY_ID.get(c.formatId) : undefined;
    const text = (c.kind === 'format' && fmt ? `${fmt.name} ${fmt.category} `.repeat(3) : '') + c.members.map((m) => `${m.title} ${m.text || ''}`).join(' \n ');
    const cls = fmt ? { category: fmt.category, subcategory: fmt.subcategory } : classify(text, c.members.flatMap((m) => m.tags || []));
    const isNewsEvent = c.kind === 'format' ? false : decideNewsEvent(c.members, c.name, cls.category);
    const isGeneric = c.kind === 'format' ? !!fmt?.generic : c.kind === 'microtrend' ? !!c.broadTopic : false;
    const hist = byTrend.get(c.id) || [];
    const windows = {} as Record<Window, WindowScores>;
    for (const w of WINDOWS) windows[w] = scoreWindow({ cluster: c, category: cls.category, isNewsEvent, isGeneric, now, window: w, history: hist, metricHistory });
    const s7 = windows['7d'];
    const evidence = pickEvidence(c, now);
    const platforms = Array.from(new Set(c.members.map((m) => m.source)));
    const videosAll = uniqByExample(c.members.filter((m) => m.kind === 'video'));
    const series = [...hist.filter((h) => h.adoption != null).map((h) => ({ t: h.t, momentum: h.momentum, adoption: h.adoption!, signal: h.signal })), { t: now, momentum: s7.momentum, adoption: s7.creators, signal: s7.adoption / 100 }].sort((a, b) => a.t.localeCompare(b.t));
    // qualification: evidence grade ≥ early, not news; generic formats only with a measured shift in attention
    const genericShift = s7.growth.basis === 'measured' && (s7.growth.ratio ?? 0) >= 1.5;
    const qualified = s7.grade !== 'insufficient' && !isNewsEvent && (!isGeneric || genericShift) && c.kind !== 'topic' ? true : c.kind === 'topic' && s7.videos >= 2 && s7.grade !== 'insufficient' && !isNewsEvent;
    const trend: Trend = {
      id: c.id, kind: c.kind, name: c.name, category: cls.category, subcategory: cls.subcategory,
      format: c.kind === 'format' ? c.name : c.kind === 'microtrend' ? c.name : cls.subcategory,
      platforms, evidenceKinds: Array.from(new Set(c.members.map((m) => m.kind))),
      firstDetected: c.members.map((m) => m.firstSeenAt || m.observedAt).sort()[0],
      lastSeen: c.members.map((m) => m.observedAt).sort().pop()!,
      evidenceCount: c.members.length, videoCount: videosAll.length, directVideoCount: videosAll.filter((v) => v.level === 'direct').length,
      creatorCount: independentCreators(videosAll.length ? videosAll : c.members),
      scores: s7, windows, evidence, keywords: c.keywords.slice(0, 12), series, isNewsEvent, isGeneric, qualified,
      monetizationSuitability: round(100 * profileScore(cls.category), 0),
      summary: summarize(c, s7, windows['24h'], cls.category, isNewsEvent, isGeneric, now),
    };
    trends.push(trend);
    records.push({ runId, t: now, trendId: c.id, name: c.name, momentum: s7.momentum, confidence: s7.confidence, monetization: trend.monetizationSuitability, creator: s7.creatorOpportunity, signal: s7.adoption / 100, lifecycle: s7.lifecycle, evidenceCount: s7.items, adoption: s7.creators, creators24: windows['24h'].creators, creators48: windows['48h'].creators, directVideos: s7.directVideos, grade: s7.grade });
  }
  trends.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.scores.opportunity - a.scores.opportunity || b.scores.momentum - a.scores.momentum);
  await appendScores(records);

  // ---- 7. category activity ----
  const categories = categoryActivity(recent, trends, now);

  // ---- 8. source quality ----
  const sourceQuality = sourceQualityFrom([gt, bs, ma, yt, tt], recent, now, existing);

  // ---- 8b. video-native intelligence (3.0): one record per unique video over 30 days ----
  const recent30 = all.filter((o) => o.kind === 'video' && hoursBetween(contentTime(o) || o.firstSeenAt || o.observedAt, now) <= 24 * 30);
  const metricHistory30 = await loadMetricHistory(recent30.filter((o) => o.level === 'direct').map((o) => o.id));
  const trendIndex = trendIndexFrom(trends);
  const channelCache = await loadChannelCache();
  const toStats = (c: Record<string, { subscribers?: number; videos?: number; views?: number; medianRecentViews?: number; baselineSampled?: number; baselineAt?: string }>) => new Map<string, ChannelStats>(Object.entries(c).map(([id, x]) => [id, { subscribers: x.subscribers, videos: x.videos, views: x.views, medianRecentViews: x.medianRecentViews, baselineSampled: x.baselineSampled, baselineAt: x.baselineAt }]));
  let videoRecords: VideoRecord[] = buildVideoRecords({ observations: recent30, metricHistory: metricHistory30, channels: toStats(channelCache), trendIndex, now });
  if (!fixtureMode() && yt.status.mode === 'live') {
    // channel statistics for every channel in the universe (50 per unit) + upload baselines for outlier candidates
    const channelIds = Array.from(new Set(recent30.filter((o) => o.source === 'youtube' && o.video?.channelId).map((o) => o.video!.channelId!)));
    const baselineIds = videoRecords
      .filter((r) => r.platform === 'youtube' && r.verified && (r.metrics.views || 0) >= 100_000 && (r.ageHours ?? Infinity) <= 24 * 14 && r.creator?.channelId && (r.subscriberRatio == null || r.subscriberRatio >= 2))
      .sort((a, b) => (b.subscriberRatio ?? 0) - (a.subscriberRatio ?? 0))
      .map((r) => r.creator!.channelId!);
    const ch = await fetchChannelData({ channelIds, baselineIds, maxBaselines: 20 });
    if (ch.errors.length) console.log(`  channel data: ${ch.errors.length} error(s): ${ch.errors[0]}`);
    console.log(`  channel data: ${Object.keys(ch.channels).length} channels cached (+${ch.units} units)`);
    videoRecords = buildVideoRecords({ observations: recent30, metricHistory: metricHistory30, channels: toStats(ch.channels), trendIndex, now });
  }
  linkCrossPlatform(videoRecords, recent30);
  const dupes = markDuplicates(videoRecords);
  const ledgerNow = await readJson<{ units: number; searchCalls: number; day: string }>('cache/youtube-quota.json');
  const videoIntel = buildVideoIntel({ records: videoRecords, trends, sources, observations: recent30, now, youtubeQuota: ledgerNow && ledgerNow.day === quotaDay(now) ? { used: ledgerNow.units, limit: UNIT_BUDGET, searches: ledgerNow.searchCalls, searchLimit: SEARCH_BUDGET } : undefined });
  await writeJson('videos.json', { generatedAt: now, runId, counts: videoIntel.counts, records: videoRecords.filter((r) => r.state !== 'rejected' || isCandidateLike(r)).map(slimRecord) });
  console.log(`  videos: ${videoRecords.length} unique (${videoIntel.counts.verified_hit} verified hits, ${videoIntel.counts.early_breakout} breakouts, ${videoIntel.counts.unverified_signal} unverified signals, ${videoIntel.counts.rejected} rejected, ${dupes} duplicates); funnel ${videoIntel.funnel.discovered}→${videoIntel.funnel.verified}→${videoIntel.funnel.candidates}→${videoIntel.funnel.qualified}→${videoIntel.funnel.inFeed}`);

  // ---- 9. quality checks + snapshot ----
  const pruned = await pruneHistory();
  if (pruned.length) console.log(`  pruned ${pruned.length} old history files`);
  const earliest = all.map((o) => o.firstSeenAt || o.observedAt).sort()[0];
  const ledger = await readJson<{ units: number; searchCalls: number; day: string }>('cache/youtube-quota.json');
  const quality = runQualityChecks({ trends, observations: recent, sources, now, records: videoRecords });
  const snapshot: Snapshot = {
    version: 2, generatedAt: now, runId, sources, sourceQuality, trends, categories, quality, videos: videoIntel,
    stats: {
      observationsThisRun: fresh.length, observationsTotal: all.length,
      qualifiedTrends: trends.filter((t) => t.qualified).length,
      newTrends24h: trends.filter((t) => t.qualified && hoursBetween(t.firstDetected, now) <= 24).length,
      historyDays: earliest ? Math.ceil(hoursBetween(earliest, now) / 24) : 0, earliestObservation: earliest,
      youtube: ledger && ledger.day === quotaDay(now) ? { quotaUnitsToday: ledger.units, searchCallsToday: ledger.searchCalls, trackedVideos: knownYt.size } : { quotaUnitsToday: 0, searchCallsToday: 0, trackedVideos: knownYt.size },
    },
  };
  await writeJson('latest.json', snapshot);
  await writeJson('sources.json', sources);
  await writeJson('quality/report.json', { generatedAt: now, runId, quality, sourceQuality, qualified: trends.filter((t) => t.qualified).map((t) => ({ id: t.id, name: t.name, kind: t.kind, grade: t.scores.grade, creators: t.scores.creators, videos: t.scores.videos, direct: t.scores.directVideos })) });
  console.log(`  trends: ${trends.length} (${snapshot.stats.qualifiedTrends} qualified; ${trends.filter((t) => t.kind === 'microtrend').length} microtrends, ${trends.filter((t) => t.kind === 'format').length} formats, ${trends.filter((t) => t.kind === 'topic').length} topics). Quality: ${quality.checks.filter((c) => c.ok).length}/${quality.checks.length} checks ok. Wrote data/latest.json`);
  return snapshot;
}

function isCandidateLike(r: VideoRecord): boolean {
  return r.verified && ((r.metrics.views || 0) >= 10_000 || (r.metrics.likes || 0) >= 100);
}

/** videos.json keeps the full record but trims text-heavy fields */
function slimRecord(r: VideoRecord): VideoRecord {
  return { ...r, reasons: r.reasons.slice(0, 8), sources: r.sources.slice(0, 6), crossPlatform: r.crossPlatform.slice(0, 6) };
}

async function appendDiagnostics(points: { id: string; t: string; views?: number; likes?: number; comments?: number }[]): Promise<void> {
  const { appendFile, mkdir } = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = path.join(DATA_DIR, 'diagnostics');
  await mkdir(dir, { recursive: true });
  await appendFile(path.join(dir, 'track.ndjson'), points.map((p) => JSON.stringify(p)).join('\n') + '\n', 'utf8');
}

function profileScore(category: string): number {
  const p = profileFor(category);
  return 0.3 * p.advertiser + 0.2 * p.sponsorship + 0.15 * p.affiliate + 0.15 * p.longevity + 0.1 * p.demand + 0.1 * (1 - p.cost);
}

/** Most relevant evidence first: direct videos by performance, then indirect videos by share interest, then signals. */
function pickEvidence(c: Cluster, now: string): Observation[] {
  const videos = uniqByExample(c.members.filter((m) => m.kind === 'video'));
  const direct = videos.filter((v) => v.level === 'direct').sort((a, b) => (videoRate(b, now)?.rate || 0) - (videoRate(a, now)?.rate || 0));
  const indirect = videos.filter((v) => v.level !== 'direct').sort((a, b) => interestLevel(b) - interestLevel(a));
  const signals = c.members.filter((m) => m.kind !== 'video').sort((a, b) => interestLevel(b) - interestLevel(a));
  // keep one example per creator first (independence), then fill
  const seenCreator = new Set<string>();
  const firstPass: Observation[] = [];
  const rest: Observation[] = [];
  for (const v of [...direct, ...indirect]) {
    const ck = v.creator?.url || v.creator?.name || v.sharedBy?.name || v.id;
    if (seenCreator.has(ck)) rest.push(v);
    else {
      seenCreator.add(ck);
      firstPass.push(v);
    }
  }
  // up to 10 by strength (one per creator first), then make sure the newest examples are represented so the
  // 24h/48h views are not empty just because the strongest videos are older; signals fill the remaining slots
  const picked = [...firstPass, ...rest].slice(0, 10);
  const have = new Set(picked.map((v) => v.id));
  const newest = videos.filter((v) => !have.has(v.id)).sort((a, b) => (contentTime(b) || '').localeCompare(contentTime(a) || ''));
  for (const v of newest) {
    if (picked.length >= 16) break;
    if (hoursBetween(contentTime(v) || v.observedAt, now) <= 48) picked.push(v);
  }
  return [...picked, ...signals.slice(0, 4)].slice(0, 20).map(slim);
}

function slim(o: Observation): Observation {
  return { ...o, text: (o.text || '').slice(0, 220), history: o.history?.slice(-8), links: o.links?.slice(0, 3) };
}

function summarize(c: Cluster, s7: WindowScores, s24: WindowScores, category: string, news: boolean, generic: boolean, now: string): string {
  const name = c.name.replace(/^#/, '');
  const parts: string[] = [];
  if (c.kind === 'microtrend') parts.push(`${s7.creators} independent creator${s7.creators === 1 ? '' : 's'} posted ${s7.videos} video${s7.videos === 1 ? '' : 's'} around “${name}” in the last 7 days${s24.videos ? ` (${s24.videos} in the last 24h)` : ''}.`);
  else if (c.kind === 'format') parts.push(`${s7.videos} relevance-checked ${name.toLowerCase()} video${s7.videos === 1 ? '' : 's'} from ${s7.creators} creator${s7.creators === 1 ? '' : 's'} in the last 7 days${s24.videos ? `, ${s24.videos} in the last 24h` : ''}.${generic ? ' An evergreen category — only a measured shift makes it a trend.' : ''}`);
  else parts.push(`Audience-interest topic (${c.members.find((m) => m.kind !== 'video' && m.kind !== 'post')?.kind?.replace('_', ' ') || 'signal'})${s7.videos ? ` with ${s7.videos} related video${s7.videos === 1 ? '' : 's'}` : ' with no video examples yet'}.`);
  if (s7.directVideos) parts.push(`${s7.directVideos} of them carry platform statistics${(s7.components.topPerHour ?? 0) >= 1 ? `; the strongest averages ~${Math.round(s7.components.topPerHour)} ${s7.components.topIsViews ? 'views' : 'engagements'}/hour since publish` : ''}.`);
  if (s7.growth.basis === 'measured') parts.push(`Measured ${s7.growth.metric}: ${s7.growth.ratio}× over ${s7.growth.windowHours}h.`);
  else parts.push('Growth not yet measured.');
  if (news) parts.push('Flagged as a news/person event, not a repeatable format.');
  void category;
  void now;
  return parts.join(' ');
}

function categoryActivity(recent: Observation[], trends: Trend[], now: string): CategoryActivity[] {
  const videos = uniqByExample(recent.filter((o) => o.kind === 'video' && (o.formats || []).length));
  const m = new Map<string, Observation[]>();
  for (const v of videos) {
    const cat = FORMAT_BY_ID.get(v.formats![0])?.category || classify(v.title).category;
    (m.get(cat) || m.set(cat, []).get(cat)!).push(v);
  }
  const out: CategoryActivity[] = [];
  for (const [category, vs] of m) {
    const h = (o: Observation) => hoursBetween(contentTime(o) || o.observedAt, now);
    const v24 = vs.filter((o) => h(o) <= 24).length;
    const prev24 = vs.filter((o) => h(o) > 24 && h(o) <= 48).length;
    const levels = vs.map((o) => videoRate(o, now)?.rate ?? interestLevel(o)).sort((a, b) => a - b);
    const q = trends.filter((t) => t.qualified && t.category === category);
    out.push({
      category, videos7d: vs.length, videos24h: v24, creators7d: independentCreators(vs), level: round(levels[Math.floor(levels.length / 2)] || 0, 3),
      change24h: v24 + prev24 >= 4 && prev24 >= 2 ? round(v24 / prev24, 2) : null, qualifiedTrends: q.length, topTrendId: q[0]?.id,
    });
  }
  return out.sort((a, b) => b.videos24h - a.videos24h || b.videos7d - a.videos7d);
}

function sourceQualityFrom(runs: SourceRun[], recent: Observation[], now: string, existing: Observation[]): SourceQuality[] {
  return runs.map((r) => {
    const src = r.status.source;
    const mine = recent.filter((o) => o.source === src);
    const vids = uniqByExample(mine.filter((o) => o.kind === 'video'));
    const ages = r.items.map((o) => contentTime(o)).filter((t): t is string => !!t).map((t) => hoursBetween(t, now)).sort((a, b) => a - b);
    const hist = existing.filter((o) => o.source === src).map((o) => o.firstSeenAt || o.observedAt).sort()[0];
    const notes: string[] = [];
    if (src === 'bluesky') notes.push('Engagement counts only; external video links are indirect until YouTube verifies them.');
    if (src === 'youtube' && r.status.mode === 'disabled') notes.push('Add the free YOUTUBE_API_KEY secret to enable direct video statistics.');
    if (src === 'google_trends') notes.push('Search interest, not video performance. Mostly news/sports — used as corroboration.');
    if (src === 'mastodon') notes.push('Small network; its 7-day hashtag series gives measured daily growth.');
    if (src === 'tiktok') notes.push('Undocumented endpoint; opt-in only.');
    return {
      source: src, label: r.status.label,
      status: r.status.mode === 'live' && !r.status.ok ? 'error' : r.status.mode,
      lastSuccess: r.status.ok ? r.status.fetchedAt : r.status.mode === 'cached' ? r.status.fetchedAt : undefined,
      items: r.status.items, uniqueVideos: vids.length, directVideos: vids.filter((v) => v.level === 'direct').length,
      relevantItems: mine.filter((o) => (o.formats || []).length > 0).length,
      metrics: SOURCE_METRICS[src], medianAgeHours: ages.length ? round(ages[Math.floor(ages.length / 2)], 1) : undefined,
      historyDays: hist ? Math.ceil(hoursBetween(hist, now) / 24) : 0,
      errorRate: r.subrequests ? round(r.errors / r.subrequests, 3) : 0, weight: SOURCE_WEIGHT[src], notes,
    };
  });
}

function summarizeErrors(errors: string[]): string {
  const head = errors.slice(0, 2).map((e) => e.replace(/https?:\/\/\S+/g, '<url>').slice(0, 110));
  return `${errors.length} sub-request(s) failed: ${head.join(' | ')}${errors.length > 2 ? ' | …' : ''}`;
}

/** Keep only the latest observation per id, preserving firstSeenAt. */
function dedupeLatest(obs: Observation[]): Observation[] {
  const m = new Map<string, Observation>();
  for (const o of obs) {
    const prev = m.get(o.id);
    if (!prev) m.set(o.id, o);
    else if (prev.observedAt < o.observedAt) m.set(o.id, { ...o, firstSeenAt: prev.firstSeenAt || prev.observedAt });
  }
  return Array.from(m.values());
}

const isDirect = process.argv[1] && /run\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
