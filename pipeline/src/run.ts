/**
 * Pipeline entrypoint (v2):
 *   Source discovery → Collection → Verification (YouTube) → Normalization → Dedup/History → Relevance validation
 *   → Clustering (topics / microtrends / formats) → Per-window scoring → Quality checks → Snapshot
 *
 *   npm run collect            live collection (GitHub Actions on a schedule)
 *   npm run collect:fixtures   offline run against captured real responses in pipeline/fixtures
 */
import { collectGoogleTrends } from './collectors/googleTrends.js';
import { collectBluesky, refreshBlueskyPosts } from './collectors/bluesky.js';
import { collectMastodon } from './collectors/mastodon.js';
import { applyShortsCache, collectYouTube, enrichYouTubeLinks, fetchChannelData, loadChannelCache, loadShortsCache, quotaDay, SEARCH_BUDGET, UNIT_BUDGET } from './collectors/youtube.js';
import { summarizeYield, type YieldLedger } from './collectors/discovery.js';
import { classifyTrends } from './intel/formats.js';
import { buildDesk } from './intel/desk.js';
import { buildAlerts } from './intel/alerts.js';
import { recordHealth } from './intel/health.js';
import { attachHistory, buildScorecard, detectCrossings, evaluatePredictions, selectPredictions, summaryOf, type CrossingRecord } from './intel/predict.js';
import { collectTikTok, enrichTikTokLinks } from './collectors/tiktok.js';
import { buildVideoRecords, linkCrossPlatform, trendIndexFrom, type ChannelStats } from './intel/videos.js';
import { buildVideoIntel, markDuplicates } from './intel/funnel.js';
import { buildClusters, independentCreators, type Cluster } from './intel/cluster.js';
import { classify, decideNewsEvent, profileFor } from './intel/taxonomy.js';
import { FORMAT_BY_ID, validateObservation } from './intel/relevance.js';
import { contentTime, inWindow, interestLevel, scoreWindow, uniqByExample, videoRate, type MetricPoint } from './intel/score.js';
import { runQualityChecks } from './quality.js';
import { CRITICAL_CHECKS } from './gate.js';
import {
  appendNdjson, appendObservations, appendScores, compactHistory, loadMetricHistory, loadObservations, loadScores, loadSourceCache, pruneHistory, readNdjsonLog, rewriteNdjson,
  saveSourceCache, writeJson, readJson, DATA_DIR, type ScoreRecord,
} from './lib/store.js';
import { fixtureMode } from './lib/http.js';
import type { Alert, CategoryActivity, Observation, OutcomeRecord, Platform, PredictionRecord, Snapshot, SourceQuality, SourceStatus, Trend, VideoRecord, Window, WindowScores } from './types.js';
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
  // stage timings (seconds since the previous stage) — printed and recorded in health.json so a slow run is diagnosable
  const stageTimes: Record<string, number> = {};
  let stageAt = Date.now();
  const stage = (name: string) => { const t = Date.now(); stageTimes[name] = round((t - stageAt) / 1000, 1); stageAt = t; console.log(`  ⏱ ${name}: ${stageTimes[name]}s`); };
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

  stage('sources');
  // ---- 2. YouTube: verify linked videos + charts + rationed discovery ----
  // tracking refresh, prioritised: featured videos every run, videos seen in the last 72h every run, the rest of the
  // 7-day universe on alternating runs (the universe outgrew a flat 1,500-id cap once discovery widened)
  const knownYt = new Set<string>();
  const firstSeenById = new Map<string, string>();
  for (const o of [...existing, ...bs.items]) if (o.video?.platform === 'youtube' && hoursBetween(o.firstSeenAt || o.observedAt, runStart) <= 24 * 7) {
    knownYt.add(o.video.id);
    const fs = o.firstSeenAt || o.observedAt;
    if (!firstSeenById.has(o.video.id) || fs < firstSeenById.get(o.video.id)!) firstSeenById.set(o.video.id, fs);
  }
  const previous = await readJson<Snapshot>('latest.json');
  // 4.0: open predictions stay in the priority tracking set until their 7-day horizon has been evaluated
  const predictionsAll = await readNdjsonLog<PredictionRecord>('predictions/predictions.ndjson');
  const openPredictionIds = new Set(predictionsAll.filter((p) => p.platform === 'youtube' && hoursBetween(p.predictedAt, runStart) <= 168 * 1.5).map((p) => p.platformId));
  const featured = new Set<string>([...Object.values(previous?.videos?.viralNow || {}).flat(), ...(previous?.videos?.earlyRadar || [])].filter((c) => c.platform === 'youtube').map((c) => c.platformId));
  for (const id of openPredictionIds) { featured.add(id); knownYt.add(id); if (!firstSeenById.has(id)) firstSeenById.set(id, runStart); }
  const openPredictionVideoIds = new Set(predictionsAll.filter((p) => hoursBetween(p.predictedAt, runStart) <= 168 * 1.5).map((p) => p.videoId));
  // every YouTube id known over the 30-day retention window: the discovery scheduler measures yield as "new to us"
  const knownYt30 = new Set<string>();
  for (const o of existing) if (o.video?.platform === 'youtube') knownYt30.add(o.video.id);
  // hot channels (produced a featured hit/breakout recently): their newest uploads are checked without search quota
  const channelCache0 = await loadChannelCache();
  const hotIds = Array.from(new Set([...(previous?.videos?.earlyRadar || []), ...(previous?.videos?.viralNow?.['72h'] || [])].map((c) => c.creatorUrl?.match(/channel\/(UC[A-Za-z0-9_-]{20,})/)?.[1]).filter((x): x is string => !!x)));
  const hotChannels = hotIds.map((id) => channelCache0[id]).filter((c) => c?.uploads && (!c.uploadsAt || hoursBetween(c.uploadsAt, runStart) >= 6)).sort((a, b) => (a.uploadsAt || '').localeCompare(b.uploadsAt || '')).slice(0, 30).map((c) => ({ id: c.id, uploads: c.uploads }));
  const runParity = Number(runStart.slice(14, 16)) >= 30 ? 1 : 0;
  const trackIds = Array.from(knownYt).sort((a, b) => rank(a) - rank(b));
  function rank(id: string): number {
    if (featured.has(id)) return 0;
    if (hoursBetween(firstSeenById.get(id) || runStart, runStart) <= 72) return 1;
    return 2 + ((id.charCodeAt(0) + id.charCodeAt(1)) % 2 === runParity ? 0 : 1);
  }
  const topicTerms = bs.items.filter((o) => o.kind === 'social_topic').map((o) => o.title).filter((t) => classify(t).category !== 'News & Politics' && !decideNewsEvent([], t, classify(t).category));
  // exploitation: microtrends that already showed momentum last run become discovery probes
  const trendTerms = (previous?.trends || []).filter((t) => t.kind === 'microtrend' && t.qualified && !t.isGeneric).sort((a, b) => b.scores.opportunity - a.scores.opportunity).map((t) => t.name.replace(/^#/, '').replace(/([a-z])([A-Z])/g, '$1 $2')).slice(0, 3);
  // diagnostics watch list (benchmark cases): re-measured every run, never stored as observations
  const watch = (await readJson<{ ids: string[] }>('diagnostics/watch.json'))?.ids || [];
  let ytDiagnostics: { id: string; t: string; views?: number; likes?: number; comments?: number }[] = [];
  const yt = await runSource('youtube', async () => {
    const r = await collectYouTube({ trackIds, topicTerms, trendTerms, diagnosticIds: watch, knownIds: knownYt30, hotChannels, shortsCheckIds: Array.from(featured), runSeed: runId });
    ytDiagnostics = r.diagnostics || [];
    if (r.probes?.length) console.log(`  discovery: allowance ${r.searchAllowance}, ${r.probes.map((p) => `${p.label} [${p.how}] new ${p.newIds}/${p.returned}, eligible ${p.newEligible}`).join('; ')}`);
    if (r.uploadsChecked) console.log(`  hot-channel uploads: ${r.uploadsChecked} channels checked, ${r.uploadsNew} new videos`);
    if (r.shortsVerified) console.log(`  shorts verification: ${r.shortsVerified.checked} checked (${r.shortsVerified.shorts} Shorts, ${r.shortsVerified.notShorts} not), reliable=${r.shortsVerified.reliable}`);
    return r;
  });
  if (ytDiagnostics.length) await appendDiagnostics(ytDiagnostics);
  if (hotChannels.length && yt.status.ok) {
    const cc = await loadChannelCache();
    for (const h of hotChannels) if (cc[h.id]) cc[h.id].uploadsAt = runStart;
    await writeJson('cache/youtube-channels.json', cc);
  }

  // featured Bluesky videos are re-measured every run (their statistics otherwise only refresh when a feed shows them again)
  if (!fixtureMode() && previous?.videos) {
    const featuredBsky = new Set([...previous.videos.bluesky.viralNow, ...previous.videos.bluesky.earlyRadar].map((c) => c.id));
    const targets = existing.filter((o) => featuredBsky.has(o.id));
    if (targets.length) {
      const r = await refreshBlueskyPosts(targets, runStart);
      if (r.items.length) bs.items.push(...r.items);
      console.log(`  refreshed ${r.items.length}/${targets.length} featured Bluesky videos${r.errors.length ? ` (${r.errors[0]})` : ''}`);
    }
  }
  const sources = [gt, bs, ma, yt, tt].map((r) => r.status);
  const sourceSignature = sources.filter((s) => s.ok && s.mode !== 'disabled').map((s) => s.source).sort().join(',');
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

  stage('youtube');
  // ---- 3. relevance validation (stage 2 classification) ----
  for (const o of fresh) o.formats = validateObservation(o).formats;

  stage('relevance');
  // ---- 4. persist + dedupe ----
  const written = await appendObservations(fresh, existing);
  const all = dedupeLatest([...existing, ...fresh]);
  // re-validate every observation with the current rules — stored formats are a cache from the rules of the day they were first seen
  for (const o of all) o.formats = validateObservation(o).formats;
  // 4.0: the Shorts verification cache is the source of truth for every YouTube observation, old or new
  const shortsApplied = applyShortsCache(all, await loadShortsCache());
  if (shortsApplied) console.log(`  shorts: ${shortsApplied} observations carry a verified Shorts/not-Shorts state`);
  console.log(`  observations: +${written.full} new, ${written.ticks} ticks, ${all.length} unique in window (${existing.length} loaded from history)`);

  stage('persist');
  // ---- 5. cluster ----
  const now = nowIso();
  const recent = all.filter((o) => inWindow(o, '7d', now) && !(o.kind === 'post' && !(o.text || '').trim()));
  const clusters = buildClusters(recent);
  const scoreHistory = await loadScores();
  const byTrend = new Map<string, ScoreRecord[]>();
  for (const r of scoreHistory) (byTrend.get(r.trendId) || byTrend.set(r.trendId, []).get(r.trendId)!).push(r);
  const metricHistory = await loadMetricHistory(recent.filter((o) => o.kind === 'video' && o.level === 'direct').map((o) => o.id));

  stage('cluster');
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
    for (const w of WINDOWS) windows[w] = scoreWindow({ cluster: c, category: cls.category, isNewsEvent, isGeneric, now, window: w, history: hist, metricHistory, sourceSignature });
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
    records.push({ runId, t: now, trendId: c.id, name: c.name, momentum: s7.momentum, confidence: s7.confidence, monetization: trend.monetizationSuitability, creator: s7.creatorOpportunity, signal: s7.adoption / 100, lifecycle: s7.lifecycle, evidenceCount: s7.items, adoption: s7.creators, creators24: windows['24h'].creators, creators48: windows['48h'].creators, directVideos: s7.directVideos, grade: s7.grade, sources: sourceSignature });
  }
  trends.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.scores.opportunity - a.scores.opportunity || b.scores.momentum - a.scores.momentum);
  // score history only for trends the dashboard ships (bare signal topics with no videos and no grade are counted, never shown)
  const shippedIds = new Set(trends.filter((t) => !(t.kind === 'topic' && t.videoCount === 0 && WINDOWS.every((w) => t.windows[w].grade === 'insufficient'))).map((t) => t.id));
  await appendScores(records.filter((r) => shippedIds.has(r.trendId)));
  // keep the snapshot small: series capped to the last 96 points; bare signal topics with no videos and no grade
  // in any window are counted but not shipped (they are news/search spikes the dashboard never shows)
  for (const t of trends) t.series = t.series.slice(-48);
  const shipped = trends.filter((t) => !(t.kind === 'topic' && t.videoCount === 0 && WINDOWS.every((w) => t.windows[w].grade === 'insufficient')));
  console.log(`  snapshot trends: ${shipped.length} of ${trends.length} (dropped ${trends.length - shipped.length} bare signal topics)`);

  stage('score');
  // ---- 7. category activity ----
  const categories = categoryActivity(recent, trends, now);

  // ---- 8. source quality ----
  const sourceQuality = sourceQualityFrom([gt, bs, ma, yt, tt], recent, now, existing);

  stage('activity');
  // ---- 8b. video-native intelligence (3.0): one record per unique video over 30 days ----
  const recent30 = all.filter((o) => o.kind === 'video' && hoursBetween(contentTime(o) || o.firstSeenAt || o.observedAt, now) <= 24 * 30);
  const metricHistory30 = await loadMetricHistory(new Set([...recent30.filter((o) => o.level === 'direct').map((o) => o.id), ...openPredictionVideoIds]), 12);
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
  await writeJson('videos.json', { generatedAt: now, runId, counts: videoIntel.counts, records: videoRecords.filter((r) => r.state !== 'rejected' || isCandidateLike(r)).map(slimRecord) }, { compact: true });

  stage('videos');
  // ---- 8c. 4.0: opportunity types, Creator Desk, forward predictions, alerts ----
  const typeCounts = classifyTrends(trends, videoRecords, now);
  const desk = buildDesk(trends, videoRecords, now);
  console.log(`  opportunity types: ${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(', ')}; desk: ${desk.opportunities.length} opportunities (${desk.opportunities.map((o) => `${o.action}:${o.name.slice(0, 24)}`).join(', ')})`);
  const trendCreators = new Map(trends.map((t) => [t.id, t.creatorCount]));
  const recordById = new Map(videoRecords.map((r) => [r.id, r]));
  const radarRecords = videoIntel.earlyRadar.map((c) => recordById.get(c.id)).filter((r): r is VideoRecord => !!r);
  const channelStats = toStats(await loadChannelCache());
  const outcomesAll0 = await readNdjsonLog<OutcomeRecord>('predictions/outcomes.ndjson');
  const crossingsAll0 = await readNdjsonLog<CrossingRecord>('predictions/crossings.ndjson');
  // the active logs keep 60 days; older rows move verbatim to data/predictions/archive/ (maintenance, never an edit of a row)
  const ARCHIVE_HOURS = 24 * 60;
  const stale = new Set(predictionsAll.filter((p) => hoursBetween(p.predictedAt, now) > ARCHIVE_HOURS).map((p) => p.id));
  let outcomesAll = outcomesAll0, crossingsAll = crossingsAll0;
  if (stale.size && !fixtureMode()) {
    const month = now.slice(0, 7);
    const oldPreds = predictionsAll.filter((p) => stale.has(p.id)), oldOut = outcomesAll0.filter((o) => stale.has(o.predictionId)), oldCross = crossingsAll0.filter((c) => hoursBetween(c.crossedAt, now) > ARCHIVE_HOURS);
    await appendNdjson(`predictions/archive/${month}-predictions.ndjson`, oldPreds);
    await appendNdjson(`predictions/archive/${month}-outcomes.ndjson`, oldOut);
    await appendNdjson(`predictions/archive/${month}-crossings.ndjson`, oldCross);
    const keepP = predictionsAll.filter((p) => !stale.has(p.id));
    outcomesAll = outcomesAll0.filter((o) => !stale.has(o.predictionId));
    crossingsAll = crossingsAll0.filter((c) => hoursBetween(c.crossedAt, now) <= ARCHIVE_HOURS);
    await rewriteNdjson('predictions/predictions.ndjson', keepP);
    await rewriteNdjson('predictions/outcomes.ndjson', outcomesAll);
    await rewriteNdjson('predictions/crossings.ndjson', crossingsAll);
    predictionsAll.splice(0, predictionsAll.length, ...keepP);
    console.log(`  predictions: archived ${oldPreds.length} predictions / ${oldOut.length} outcomes / ${oldCross.length} crossings older than 60 days`);
  }
  const newPredictions = fixtureMode() ? [] : selectPredictions({ records: videoRecords, radar: radarRecords, open: predictionsAll, trendCreators, now, runId });
  attachHistory(newPredictions, metricHistory30, now);
  const newOutcomes = evaluatePredictions({ predictions: predictionsAll, outcomes: outcomesAll, metricHistory: metricHistory30, records: videoRecords, channels: channelStats, trendCreators, now });
  const newCrossings = detectCrossings(videoRecords, metricHistory30, [...predictionsAll, ...newPredictions], new Set(crossingsAll.map((c) => c.videoId)), now, runId);
  if (!fixtureMode()) {
    await appendNdjson('predictions/predictions.ndjson', newPredictions);
    await appendNdjson('predictions/outcomes.ndjson', newOutcomes);
    await appendNdjson('predictions/crossings.ndjson', newCrossings);
  }
  const allPreds = [...predictionsAll, ...newPredictions].filter((p) => hoursBetween(p.predictedAt, now) <= 24 * 60);
  const scorecard = buildScorecard(allPreds, [...outcomesAll, ...newOutcomes], [...crossingsAll, ...newCrossings], now);
  await writeJson('predictions/scorecard.json', scorecard, { compact: true });
  console.log(`  predictions: +${newPredictions.length} recorded (${allPreds.length} total, ${scorecard.pending} horizons pending), +${newOutcomes.length} outcomes evaluated, +${newCrossings.length} crossings; radar precision@48h ${scorecard.precision['48'] ?? 'n/a'}`);
  const alerts = buildAlerts({ records: videoRecords, desk, waves: videoIntel.waves, crossings: newCrossings, history: previous?.alerts || [], now });
  console.log(`  alerts: ${alerts.filter((a) => a.at === now).length} new, ${alerts.length} in the 7-day log`);
  const yieldLedger = await readJson<YieldLedger>('cache/youtube-yield.json');
  if (yieldLedger) await writeJson('diagnostics/discovery-yield.json', { generatedAt: now, ...summarizeYield(yieldLedger) }, { compact: true });
  console.log(`  videos: ${videoRecords.length} unique (${videoIntel.counts.verified_hit} verified hits, ${videoIntel.counts.early_breakout} breakouts, ${videoIntel.counts.unverified_signal} unverified signals, ${videoIntel.counts.rejected} rejected, ${dupes} duplicates); funnel ${videoIntel.funnel.discovered}→${videoIntel.funnel.verified}→${videoIntel.funnel.candidates}→${videoIntel.funnel.qualified}→${videoIntel.funnel.inFeed}`);

  stage('intel');
  // ---- 9. quality checks + snapshot ----
  const pruned = await pruneHistory();
  if (pruned.length) console.log(`  pruned ${pruned.length} old history files`);
  const compacted = await compactHistory();
  if (compacted.files.length) console.log(`  compacted ${compacted.files.length} observation files older than 9 days: ${compacted.before} → ${compacted.after} rows`);
  const earliest = all.map((o) => o.firstSeenAt || o.observedAt).sort()[0];
  const ledger = await readJson<{ units: number; searchCalls: number; day: string }>('cache/youtube-quota.json');
  const quality = runQualityChecks({ trends, observations: recent, sources, now, records: videoRecords });
  stage('snapshot');
  const health = await recordHealth({ runId, startedAt: runStart, durationSec: round((Date.now() - new Date(runStart).getTime()) / 1000, 0), sourcesOk: sources.filter((s) => s.ok).length, sourcesTotal: sources.length, items: fresh.length, units: ledger?.day === quotaDay(now) ? ledger.units : undefined, searches: ledger?.day === quotaDay(now) ? ledger.searchCalls : undefined, published: quality.checks.every((c) => c.ok || !CRITICAL_CHECKS.has(c.name)) && sources.some((x) => x.ok), trigger: process.env.GITHUB_EVENT_NAME, stages: stageTimes }, sources, now);
  const snapshot: Snapshot = {
    version: 2, generatedAt: now, runId, sources, sourceQuality, trends: shipped.map(slimTrend), categories, quality, videos: videoIntel,
    desk, alerts, health, scorecard: summaryOf(scorecard),
    stats: {
      observationsThisRun: fresh.length, observationsTotal: all.length,
      qualifiedTrends: trends.filter((t) => t.qualified).length,
      newTrends24h: trends.filter((t) => t.qualified && hoursBetween(t.firstDetected, now) <= 24).length,
      historyDays: earliest ? Math.ceil(hoursBetween(earliest, now) / 24) : 0, earliestObservation: earliest,
      youtube: ledger && ledger.day === quotaDay(now) ? { quotaUnitsToday: ledger.units, searchCallsToday: ledger.searchCalls, trackedVideos: knownYt.size } : { quotaUnitsToday: 0, searchCallsToday: 0, trackedVideos: knownYt.size },
    },
  };
  await writeJson('latest.json', snapshot, { compact: true });
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

/** unqualified trends ship fewer examples; the window objects for 24h/48h drop their component breakdown */
function slimTrend(t: Trend): Trend {
  const evidence = t.qualified ? t.evidence.slice(0, 12) : t.evidence.slice(0, 4);
  const windows = { ...t.windows };
  for (const w of WINDOWS) if (w !== '7d') windows[w] = { ...windows[w], components: {} };
  return { ...t, evidence, windows };
}

/** evidence records shipped in latest.json: enough to render and open, not the whole observation */
function slim(o: Observation): Observation {
  const { links, ...rest } = o;
  void links;
  return { ...rest, text: (o.text || '').slice(0, 120), tags: (o.tags || []).slice(0, 6), history: o.history?.slice(-4), query: (o.query || '').split(',')[0]?.slice(0, 40) };
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
