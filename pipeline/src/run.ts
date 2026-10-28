/**
 * Pipeline entrypoint:  Source Discovery → Collection → Normalization → Dedup → Classification → Scoring → Snapshot
 *
 *   npm run collect            live collection (runs in GitHub Actions on a schedule)
 *   npm run collect:fixtures   offline run against captured real responses in pipeline/fixtures
 */
import { collectGoogleTrends } from './collectors/googleTrends.js';
import { collectBluesky } from './collectors/bluesky.js';
import { collectMastodon } from './collectors/mastodon.js';
import { collectYouTube, enrichYouTubeLinks } from './collectors/youtube.js';
import { collectTikTok } from './collectors/tiktok.js';
import { buildClusters } from './intel/cluster.js';
import { classify, looksLikeNewsEvent } from './intel/taxonomy.js';
import { observationLevel, scoreCluster } from './intel/score.js';
import {
  appendObservations, appendScores, loadObservations, loadScores, loadSourceCache, pruneHistory,
  saveSourceCache, writeJson, DATA_DIR, type ScoreRecord,
} from './lib/store.js';
import { fixtureMode } from './lib/http.js';
import type { Observation, Platform, Snapshot, SourceStatus, Trend } from './types.js';
import { hasUnsafeMarkers, hoursBetween, nowIso, sha1 } from './lib/util.js';

if (process.argv.includes('--fixtures')) process.env.VR_FIXTURES = '1';

const SOURCE_LABELS: Record<Platform, string> = {
  google_trends: 'Google Trends (trending searches RSS)',
  bluesky: 'Bluesky (trending topics, topic feeds, format searches)',
  mastodon: 'Mastodon (trending hashtags, 7-day history)',
  youtube: 'YouTube Data API v3 (most popular + search)',
  tiktok: 'TikTok Creative Center (best-effort, opt-in)',
};

async function runSource(
  source: Platform,
  fn: () => Promise<{ items: Observation[]; errors: string[]; disabled?: boolean }>,
): Promise<{ status: SourceStatus; items: Observation[] }> {
  const label = SOURCE_LABELS[source];
  const t0 = Date.now();
  try {
    const r = await fn();
    if (r.disabled) {
      return { status: { source, label, ok: false, mode: 'disabled', items: 0, note: r.errors.join('; ') }, items: [] };
    }
    if (r.items.length > 0) {
      await saveSourceCache(source, r.items);
      return {
        status: { source, label, ok: true, mode: fixtureMode() ? 'fixture' : 'live', items: r.items.length, fetchedAt: nowIso(), error: r.errors.length ? summarizeErrors(r.errors) : undefined, note: `${Date.now() - t0}ms` },
        items: r.items,
      };
    }
    throw new Error(r.errors.join('; ') || 'no items returned');
  } catch (e) {
    const cache = await loadSourceCache(source);
    if (cache?.items?.length) {
      return {
        status: { source, label, ok: false, mode: 'cached', items: cache.items.length, fetchedAt: cache.savedAt, error: (e as Error).message, note: `serving cached results from ${cache.savedAt}` },
        items: cache.items, // cached observations keep their original observedAt → they age naturally
      };
    }
    return { status: { source, label, ok: false, mode: 'live', items: 0, error: (e as Error).message }, items: [] };
  }
}

export async function main(): Promise<Snapshot> {
  const runStart = nowIso();
  const runId = `${runStart.slice(0, 16).replace(/[-:T]/g, '')}_${sha1(runStart)}`;
  console.log(`[viral-radar] run ${runId} fixtures=${fixtureMode()} data=${DATA_DIR}`);

  // ---- 1. collect ----
  const results = await Promise.all([
    runSource('google_trends', collectGoogleTrends),
    runSource('bluesky', () => collectBluesky()),
    runSource('mastodon', () => collectMastodon()),
    runSource('youtube', () => collectYouTube()),
    runSource('tiktok', collectTikTok),
  ]);
  const sources = results.map((r) => r.status);
  const fresh = results.flatMap((r) => r.items).filter((o) => !hasUnsafeMarkers(`${o.title} ${o.text || ''}`));
  for (const s of sources) console.log(`  ${s.ok ? 'ok ' : 'ERR'} ${s.source.padEnd(14)} ${s.mode.padEnd(8)} ${String(s.items).padStart(4)} ${s.error || ''}`);

  // enrich YouTube links found in social posts (title/author/thumbnail via oEmbed)
  if (!fixtureMode()) {
    const n = await enrichYouTubeLinks(fresh);
    if (n) console.log(`  enriched ${n} YouTube links via oEmbed`);
  }

  // ---- 2. persist + dedupe ----
  const existing = await loadObservations();
  const written = await appendObservations(fresh, existing);
  const all = dedupeLatest([...existing, ...fresh]);
  console.log(`  observations: +${written} new, ${all.length} unique in window (${existing.length} loaded from history)`);

  // ---- 3. cluster + classify + score ----
  const now = nowIso();
  // only cluster evidence from the last 7 days; older observations still feed history/growth
  const recent = all.filter((o) => hoursBetween(o.observedAt, now) <= 24 * 7);
  const clusters = buildClusters(recent);
  const scoreHistory = await loadScores();
  const byTrend = new Map<string, ScoreRecord[]>();
  for (const r of scoreHistory) {
    if (!byTrend.has(r.trendId)) byTrend.set(r.trendId, []);
    byTrend.get(r.trendId)!.push(r);
  }

  const trends: Trend[] = [];
  const records: ScoreRecord[] = [];
  for (const c of clusters) {
    const text = c.members.map((m) => `${m.title} ${m.text || ''}`).join(' \n ');
    const tags = c.members.flatMap((m) => m.tags || []);
    const cls = classify(text, tags);
    // Search-interest-only clusters (Google Trends spikes) are topics/events, not repeatable formats,
    // unless the search term itself names a content category (e.g. "cricket", "halloween costumes").
    const searchOnly = c.members.every((m) => m.kind === 'search_interest');
    const titleCls = classify(c.members.map((m) => m.title).join(' '));
    const isNewsEvent =
      looksLikeNewsEvent(c.members.map((m) => m.title + ' ' + (m.text || '')).join(' '), cls.category) ||
      (searchOnly && titleCls.category === 'Other');
    const hist = byTrend.get(c.id) || [];
    const { scores, lifecycle, signal } = scoreCluster({ cluster: c, category: cls.category, isNewsEvent, now, history: hist });
    const platforms = Array.from(new Set(c.members.map((m) => m.source)));
    const evidence = [...c.members]
      .sort((a, b) => kindRank(a) - kindRank(b) || observationLevel(b) - observationLevel(a))
      .slice(0, 14)
      .map(slimObservation);
    const series = [...hist.map((h) => ({ t: h.t, momentum: h.momentum, signal: h.signal })), { t: now, momentum: scores.momentum, signal }].sort((a, b) => a.t.localeCompare(b.t));
    const trend: Trend = {
      id: c.id,
      name: c.name,
      category: cls.category,
      subcategory: cls.subcategory,
      microtrend: c.origin === 'format' ? c.name.replace(/ \(format\)$/, '') : c.name,
      lifecycle,
      platforms,
      evidenceKinds: Array.from(new Set(c.members.map((m) => m.kind))),
      firstSeen: c.members.map((m) => m.observedAt).sort()[0],
      lastSeen: c.members.map((m) => m.observedAt).sort().pop()!,
      evidenceCount: c.members.length,
      sourceCount: platforms.length,
      videoCount: c.members.filter((m) => m.kind === 'video').length,
      scores,
      evidence,
      keywords: c.keywords.slice(0, 12),
      series,
      isNewsEvent,
      safe: true,
    };
    trends.push(trend);
    records.push({ runId, t: now, trendId: c.id, name: c.name, momentum: scores.momentum, confidence: scores.confidence, monetization: scores.monetization, creator: scores.creator, signal, lifecycle, evidenceCount: c.members.length });
  }
  trends.sort((a, b) => b.scores.opportunity - a.scores.opportunity || b.scores.momentum - a.scores.momentum);
  await appendScores(records);

  // ---- 4. snapshot ----
  const pruned = await pruneHistory();
  if (pruned.length) console.log(`  pruned ${pruned.length} old history files`);
  const earliest = all.map((o) => o.observedAt).sort()[0];
  const snapshot: Snapshot = {
    version: 1,
    generatedAt: now,
    runId,
    sources,
    trends,
    stats: {
      observationsThisRun: fresh.length,
      observationsTotal: all.length,
      historyDays: earliest ? Math.ceil(hoursBetween(earliest, now) / 24) : 0,
      earliestObservation: earliest,
    },
  };
  await writeJson('latest.json', snapshot);
  await writeJson('sources.json', sources);
  console.log(`  trends: ${trends.length} (${trends.filter((t) => t.videoCount > 0).length} with video evidence). Wrote data/latest.json`);
  return snapshot;
}

function summarizeErrors(errors: string[]): string {
  const head = errors.slice(0, 2).map((e) => e.replace(/https?:\/\/\S+/g, "<url>").slice(0, 110));
  return `${errors.length} sub-request(s) failed: ${head.join(' | ')}${errors.length > 3 ? ' | …' : ''}`;
}

/** Keep only the latest observation per id (history files hold the rest). */
function dedupeLatest(obs: Observation[]): Observation[] {
  const m = new Map<string, Observation>();
  for (const o of obs) {
    const prev = m.get(o.id);
    if (!prev || prev.observedAt < o.observedAt) m.set(o.id, o);
  }
  return Array.from(m.values());
}

function kindRank(o: Observation): number {
  if (o.kind === 'video' && o.metrics.views != null) return 0;
  if (o.kind === 'video') return 1;
  if (o.kind === 'search_interest') return 2;
  if (o.kind === 'social_topic') return 3;
  if (o.kind === 'hashtag') return 4;
  return 5;
}

/** Trim fields the dashboard doesn't need to keep latest.json small. */
function slimObservation(o: Observation): Observation {
  return { ...o, text: (o.text || '').slice(0, 220), history: o.history?.slice(-8), links: o.links?.slice(0, 3) };
}

const isDirect = process.argv[1] && /run\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
