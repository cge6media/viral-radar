/**
 * Discovery accuracy benchmark — runs on the GitHub runner (needs the YouTube key for verification).
 *
 * Positives come from INDEPENDENT public rankings (ChartsList US Shorts chart, ShortsMonkey "hot today", and for
 * the holdout set ChartsList Worldwide + Mexico), re-verified through the YouTube API. Negatives are controls drawn
 * from our own store (ordinary low-engagement posts, old videos recently shared, duplicates, keyword mismatches,
 * live streams). The benchmark only READS the observation store and the published lists — it never adds anything to
 * the collector, so it measures whether ordinary discovery would have found the videos on its own.
 *
 *   tsx src/tools/benchmark.ts --set dev|holdout --label <name>
 * Writes data/benchmark/<timestamp>-<label>.json and data/benchmark/<label>.md.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, loadObservations, loadMetricHistory, readJson } from '../lib/store.js';
import { hoursBetween, nowIso } from '../lib/util.js';
import { batchVerify } from './inspect.js';
import { buildVideoRecords, linkCrossPlatform, earlyRadarList, viralNowLists } from '../intel/videos.js';
import { markDuplicates } from '../intel/funnel.js';
import { contentTime } from '../intel/score.js';
import type { Observation, Snapshot, VideoRecord } from '../types.js';

const UA = 'ViralRadarBenchmark/1.0 (+https://github.com/cge6media/viral-radar; reads two public ranking pages per run)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RefItem { id: string; source: string; rank: number; listedViews?: number; listedTitle?: string }

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** ChartsList: entries link to /youtube/video/<id> and carry i.ytimg thumbnails; views appear as "12.3M" nearby. */
function parseChartsList(html: string, source: string): RefItem[] {
  const out: RefItem[] = [];
  const seen = new Set<string>();
  const re = /\/youtube\/video\/([A-Za-z0-9_-]{11})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const around = html.slice(m.index, m.index + 1500);
    const views = around.match(/(\d+(?:\.\d+)?)\s*([KMB])\b/);
    out.push({ id, source, rank: out.length + 1, listedViews: views ? Math.round(parseFloat(views[1]) * ({ K: 1e3, M: 1e6, B: 1e9 } as Record<string, number>)[views[2]]) : undefined });
  }
  return out;
}

/** ShortsMonkey: entries link to /youtube-shorts-analyzer/<id>. */
function parseShortsMonkey(html: string, source: string): RefItem[] {
  const out: RefItem[] = [];
  const seen = new Set<string>();
  const re = /youtube-shorts-analyzer\/([A-Za-z0-9_-]{11})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, source, rank: out.length + 1 });
  }
  return out;
}

const SETS: Record<string, { name: string; url: string; parse: (html: string, source: string) => RefItem[] }[]> = {
  dev: [
    { name: 'chartslist_us_shorts', url: 'https://chartslist.com/youtube/shorts/us/', parse: parseChartsList },
    { name: 'shortsmonkey_hot_today', url: 'https://www.shortsmonkey.com/en/hot-today', parse: parseShortsMonkey },
  ],
  holdout: [
    { name: 'chartslist_world_shorts', url: 'https://chartslist.com/youtube/shorts/', parse: parseChartsList },
    { name: 'chartslist_mx_shorts', url: 'https://chartslist.com/youtube/shorts/mx/', parse: parseChartsList },
    { name: 'chartslist_gb_shorts', url: 'https://chartslist.com/youtube/shorts/gb/', parse: parseChartsList },
  ],
};

interface PositiveResult {
  id: string; refs: string[]; bestRank: number; title?: string; channel?: string; publishedAt?: string; ageHours?: number; views?: number; durationSec?: number;
  eligible: boolean; eligibilityNote: string;
  discovered: boolean; firstSeenAt?: string; discoveredBy?: string[]; detectionDelayHours?: number;
  verified: boolean; state?: string; rejectedBy?: string; inFeed: boolean; feedList?: string;
  outcome: 'in_feed' | 'qualified_not_top' | 'verified_rejected' | 'discovered_unverified' | 'not_discovered' | 'ineligible';
  reason: string;
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) { console.error('YOUTUBE_API_KEY is not set'); process.exit(2); }
  const argv = process.argv.slice(2);
  const set = argv[argv.indexOf('--set') + 1] || 'dev';
  const label = argv[argv.indexOf('--label') + 1] || set;
  const now = nowIso();
  const refsSpec = SETS[set];
  if (!refsSpec) throw new Error(`unknown set ${set}`);

  // ---- 1. independent references ----
  const refs: RefItem[] = [];
  const refStatus: Record<string, { ok: boolean; items: number; error?: string }> = {};
  for (const r of refsSpec) {
    try {
      const html = await fetchText(r.url);
      const items = r.parse(html, r.name);
      refs.push(...items);
      refStatus[r.name] = { ok: true, items: items.length };
      console.log(`${r.name}: ${items.length} ids`);
    } catch (e) {
      refStatus[r.name] = { ok: false, items: 0, error: (e as Error).message };
      console.log(`${r.name}: ERROR ${(e as Error).message}`);
    }
    await sleep(5500); // crawl-delay 5s (chartslist robots.txt)
  }
  const byId = new Map<string, RefItem[]>();
  for (const r of refs) (byId.get(r.id) || byId.set(r.id, []).get(r.id)!).push(r);

  // ---- 2. verify through the API (1 unit per 50) ----
  const verified = await batchVerify(Array.from(byId.keys()), apiKey);

  // ---- 3. our store + current lists ----
  const all = await loadObservations();
  const videoObs = all.filter((o) => o.kind === 'video');
  const byYt = new Map<string, Observation[]>();
  for (const o of videoObs) if (o.video?.platform === 'youtube') (byYt.get(o.video.id) || byYt.set(o.video.id, []).get(o.video.id)!).push(o);
  const recent30 = videoObs.filter((o) => hoursBetween(contentTime(o) || o.firstSeenAt || o.observedAt, now) <= 24 * 30);
  const metricHistory = await loadMetricHistory(recent30.filter((o) => o.level === 'direct').map((o) => o.id));
  const channels = (await readJson<Record<string, { subscribers?: number; medianRecentViews?: number }>>('cache/youtube-channels.json')) || {};
  const records = buildVideoRecords({ observations: recent30, metricHistory, channels: new Map(Object.entries(channels)), now });
  linkCrossPlatform(records, recent30);
  markDuplicates(records);
  const recById = new Map(records.map((r) => [r.platformId, r]));
  const vn = viralNowLists(records, now);
  const er = earlyRadarList(records);
  const feed = new Map<string, string>();
  for (const [w, list] of Object.entries(vn)) for (const c of list.slice(0, 40)) if (!feed.has(c.platformId)) feed.set(c.platformId, `viralNow:${w}`);
  for (const c of er.slice(0, 40)) if (!feed.has(c.platformId)) feed.set(c.platformId, 'earlyRadar');
  const snapshot = await readJson<Snapshot>('latest.json');

  // ---- 4. positives ----
  const positives: PositiveResult[] = [];
  for (const [id, items] of byId) {
    const v = verified[id];
    const ageHours = v?.publishedAt ? hoursBetween(v.publishedAt, now) : undefined;
    const eligible = !!v?.found && ageHours != null && ageHours <= 24 * 30 && (v.views || 0) >= 500_000;
    const eligibilityNote = !v?.found ? 'not retrievable from the API (removed/private)' : ageHours == null ? 'no publish date' : ageHours > 24 * 30 ? `published ${Math.round(ageHours / 24)} days ago (outside the 30-day index)` : (v.views || 0) < 500_000 ? `${v.views} views (below the 500K eligibility floor)` : 'eligible';
    const obs = byYt.get(id) || [];
    const discovered = obs.length > 0;
    const firstSeenAt = obs.map((o) => o.firstSeenAt || o.observedAt).sort()[0];
    const discoveredBy = Array.from(new Set(obs.flatMap((o) => (o.query || o.source).split(',')).map((q) => q.trim().split(':')[0]).filter(Boolean)));
    const rec = recById.get(id);
    const inFeed = feed.has(id);
    let outcome: PositiveResult['outcome'];
    let reason: string;
    if (!eligible) { outcome = 'ineligible'; reason = eligibilityNote; }
    else if (!discovered) { outcome = 'not_discovered'; reason = 'never surfaced by any collector (charts, discovery searches, tracked links)'; }
    else if (!rec?.verified) { outcome = 'discovered_unverified'; reason = 'seen only as a share; statistics never fetched'; }
    else if (inFeed) { outcome = 'in_feed'; reason = `featured in ${feed.get(id)}`; }
    else if (rec.state === 'verified_hit' || rec.state === 'early_breakout') { outcome = 'qualified_not_top'; reason = `${rec.state} but ranked below the top-40 cutoff (viral ${rec.viralScore}, breakout ${rec.breakoutScore})`; }
    else { outcome = 'verified_rejected'; reason = rec.rejectedBy || 'rejected'; }
    positives.push({
      id, refs: items.map((i) => `${i.source}#${i.rank}`), bestRank: Math.min(...items.map((i) => i.rank)), title: v?.title, channel: v?.channel, publishedAt: v?.publishedAt, ageHours: ageHours != null ? Math.round(ageHours) : undefined, views: v?.views, durationSec: v?.durationSec,
      eligible, eligibilityNote, discovered, firstSeenAt, discoveredBy, detectionDelayHours: firstSeenAt && v?.publishedAt ? Math.round(hoursBetween(v.publishedAt, firstSeenAt)) : undefined,
      verified: !!rec?.verified, state: rec?.state, rejectedBy: rec?.rejectedBy, inFeed, feedList: feed.get(id), outcome, reason,
    });
  }
  const eligible = positives.filter((p) => p.eligible);
  const recall = { eligible: eligible.length, discovered: eligible.filter((p) => p.discovered).length, verified: eligible.filter((p) => p.verified).length, qualified: eligible.filter((p) => p.state === 'verified_hit' || p.state === 'early_breakout').length, inFeed: eligible.filter((p) => p.inFeed).length };
  const delays = eligible.filter((p) => p.detectionDelayHours != null).map((p) => p.detectionDelayHours!).sort((a, b) => a - b);
  const outcomes: Record<string, number> = {};
  for (const p of positives) outcomes[p.outcome] = (outcomes[p.outcome] || 0) + 1;
  const missReasons: Record<string, number> = {};
  for (const p of eligible.filter((p) => !p.inFeed)) missReasons[p.reason.replace(/\s*\([^)]*\)/g, '')] = (missReasons[p.reason.replace(/\s*\([^)]*\)/g, '')] || 0) + 1;

  // ---- 5. negatives (controls from our own store) ----
  const negatives: { kind: string; count: number; leaked: number; examples: string[] }[] = [];
  const featuredIds = new Set(feed.keys());
  const featuredRecIds = new Set(records.filter((r) => featuredIds.has(r.platformId)).map((r) => r.id));
  const lowBsky = records.filter((r) => r.platform === 'bluesky' && (r.metrics.likes || 0) < 50);
  negatives.push({ kind: 'ordinary low-engagement Bluesky videos (<50 likes)', count: lowBsky.length, leaked: lowBsky.filter((r) => featuredRecIds.has(r.id) || r.state !== 'rejected').length, examples: lowBsky.filter((r) => r.state !== 'rejected').slice(0, 3).map((r) => r.title) });
  const oldShared = records.filter((r) => r.platform === 'youtube' && r.verified && (r.ageHours ?? 0) > 24 * 30 && r.shareMetrics?.posts);
  negatives.push({ kind: 'old videos (>30d) recently shared on Bluesky', count: oldShared.length, leaked: oldShared.filter((r) => featuredRecIds.has(r.id)).length, examples: oldShared.filter((r) => featuredRecIds.has(r.id)).slice(0, 3).map((r) => r.title) });
  const dupes = records.filter((r) => r.rejectedBy?.startsWith('duplicate'));
  negatives.push({ kind: 'duplicate re-uploads (identical title, smaller copy)', count: dupes.length, leaked: dupes.filter((r) => featuredRecIds.has(r.id)).length, examples: [] });
  const live = records.filter((r) => r.isLive || (r.durationSec || 0) > 3 * 3600);
  negatives.push({ kind: 'live streams / stream recordings', count: live.length, leaked: live.filter((r) => featuredRecIds.has(r.id)).length, examples: live.filter((r) => featuredRecIds.has(r.id)).slice(0, 3).map((r) => r.title) });
  const unverifiedShares = records.filter((r) => !r.verified);
  negatives.push({ kind: 'unverified shares (TikTok/Instagram/other links without statistics)', count: unverifiedShares.length, leaked: unverifiedShares.filter((r) => featuredRecIds.has(r.id)).length, examples: [] });
  const belowFloor = records.filter((r) => r.platform === 'youtube' && r.verified && (r.metrics.views || 0) < 10_000);
  negatives.push({ kind: 'YouTube videos below the 10K-view candidate floor', count: belowFloor.length, leaked: belowFloor.filter((r) => featuredRecIds.has(r.id)).length, examples: [] });
  const keywordMismatch = (snapshot?.quality.relevance ? { sampled: snapshot.quality.relevance.sampled, relevant: snapshot.quality.relevance.relevant } : undefined);

  // ---- 6. precision of the feed against the stated criteria (rule judge) + classification agreement ----
  const judge = (c: { state: string; verified: boolean; views?: number; ageHours?: number; platform: string }, window?: number) =>
    c.verified && c.platform === 'youtube' && (c.views || 0) >= (c.state === 'verified_hit' ? 1_000_000 : 50_000) && (window == null || (c.ageHours != null && c.ageHours <= window));
  const precision = (list: { state: string; verified: boolean; views?: number; ageHours?: number; platform: string }[], window?: number) => ({ at10: list.slice(0, 10).filter((c) => judge(c, window)).length / Math.max(1, Math.min(10, list.length)), at20: list.slice(0, 20).filter((c) => judge(c, window)).length / Math.max(1, Math.min(20, list.length)), n: list.length });
  const precisionReport = { viralNow72h: precision(vn['72h'], 72), viralNow7d: precision(vn['7d'], 168), earlyRadar: precision(er) };
  // ground truth = the uploader's SPECIFIC YouTube category (catch-alls like Entertainment / People & Blogs say nothing)
  const SPECIFIC: Record<string, string[]> = { 'Music': ['Music'], 'Gaming': ['Gaming'], 'Pets & Animals': ['Animals & Pets'], 'Comedy': ['Comedy'], 'Film & Animation': ['Animation & Art', 'Film & TV'], 'Sports': ['Sports'], 'Education': ['Science & Education'], 'Science & Technology': ['Tech & AI', 'Science & Education'], 'News & Politics': ['News & Politics'], 'Howto & Style': ['Food & Cooking', 'Lifestyle'] };
  const classifiable = records.filter((r) => r.platform === 'youtube' && r.platformCategory && SPECIFIC[r.platformCategory]);
  const agree = classifiable.filter((r) => SPECIFIC[r.platformCategory!].includes(r.category)).length;
  const classification = { comparable: classifiable.length, agree, rate: classifiable.length ? Math.round((1000 * agree) / classifiable.length) / 10 : null, note: 'our category vs the uploader\'s specific YouTube category (Music, Gaming, Pets, Comedy, Film & Animation, Sports, Education, Sci & Tech, News, Howto); catch-all categories are excluded' };

  // ---- 7. playback: embeddable flag + thumbnail reachability for the featured top lists ----
  const featuredYt = Array.from(featuredIds).slice(0, 100);
  const emb = await batchVerify(featuredYt, apiKey);
  let embeddable = 0, thumbOk = 0, checked = 0;
  for (const id of featuredYt) {
    checked++;
    if (emb[id]?.embeddable !== false) embeddable++;
    try {
      const r = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      if (r.ok) thumbOk++;
    } catch { /* unreachable thumb */ }
  }
  const playback = { checked, embeddable, thumbOk, rate: checked ? Math.round((1000 * embeddable) / checked) / 10 : null, thumbRate: checked ? Math.round((1000 * thumbOk) / checked) / 10 : null, note: 'YouTube embeddable flag from the API (non-embeddable videos get the direct-link fallback) and HEAD on hqdefault.jpg' };

  // ---- 8. source coverage of positives ----
  const coverage: Record<string, number> = {};
  for (const p of eligible.filter((p) => p.discovered)) for (const s of p.discoveredBy || []) coverage[s] = (coverage[s] || 0) + 1;

  const result = {
    generatedAt: now, set, label, references: refStatus, totals: { referenced: positives.length, eligible: eligible.length, ineligible: positives.length - eligible.length },
    recall: { ...recall, discoveredRate: recall.eligible ? Math.round((1000 * recall.discovered) / recall.eligible) / 10 : null, inFeedRate: recall.eligible ? Math.round((1000 * recall.inFeed) / recall.eligible) / 10 : null },
    detectionDelayHours: delays.length ? { n: delays.length, median: delays[Math.floor(delays.length / 2)], p25: delays[Math.floor(delays.length / 4)], p75: delays[Math.floor((delays.length * 3) / 4)], note: 'hours from the video\'s publish time to our first observation (the index only started on 2026-10-28 03:52 UTC, so older videos carry their age as delay)' } : undefined,
    outcomes, missReasons, positives: positives.sort((a, b) => a.bestRank - b.bestRank), negatives, keywordMismatch, precision: precisionReport, classification, playback, coverage,
    storeSize: { observations: all.length, videos30d: records.length },
  };
  const dir = path.join(DATA_DIR, 'benchmark');
  await mkdir(dir, { recursive: true });
  const stamp = now.replace(/[-:]/g, '').slice(0, 13);
  await writeFile(path.join(dir, `${stamp}-${label}.json`), JSON.stringify(result, null, 1), 'utf8');
  await writeFile(path.join(dir, `${label}.md`), markdown(result), 'utf8');
  // 4.0: a compact summary the dashboard's Radar health tab can show (copied into the site build)
  const summary = {
    generatedAt: now, set, label,
    recall: { total: recall.eligible, discovered: recall.discovered, verified: recall.verified, qualified: recall.qualified, inFeed: recall.inFeed, discoveredRate: result.recall.discoveredRate },
    precision: precisionReport, classification: { rate: classification.rate, comparable: classification.comparable }, playback: { rate: playback.rate, thumbRate: playback.thumbRate, checked: playback.checked },
    negativesLeaked: negatives.reduce((a, n) => a + n.leaked, 0), negativesChecked: negatives.reduce((a, n) => a + n.count, 0),
    misses: eligible.filter((p) => !p.discovered).slice(0, 40).map((p) => ({ id: p.id, title: p.title, views: p.views, ageHours: p.ageHours, reason: p.outcome })),
    outcomes, missReasons,
  };
  await writeFile(path.join(dir, 'latest.json'), JSON.stringify(summary, null, 1), 'utf8');
  console.log(markdown(result));
}

function markdown(r: Awaited<ReturnType<typeof buildResultType>>): string {
  const pct = (x: number | null | undefined) => (x == null ? '—' : `${x}%`);
  const lines: string[] = [];
  lines.push(`# Discovery benchmark — ${r.label} (${r.set} set) — ${r.generatedAt}`, '');
  lines.push(`References: ${Object.entries(r.references).map(([k, v]) => `${k}: ${v.ok ? `${v.items} ids` : `ERROR ${v.error}`}`).join(' · ')}`, '');
  lines.push(`**Positives:** ${r.totals.referenced} referenced, ${r.totals.eligible} eligible (published ≤30 days, ≥500K verified views), ${r.totals.ineligible} ineligible.`, '');
  lines.push(`| metric | count | rate |`, `|---|---|---|`);
  lines.push(`| discovered by our collectors | ${r.recall.discovered}/${r.recall.eligible} | ${pct(r.recall.discoveredRate)} |`);
  lines.push(`| with verified statistics | ${r.recall.verified}/${r.recall.eligible} | ${pct(r.recall.eligible ? Math.round((1000 * r.recall.verified) / r.recall.eligible) / 10 : null)} |`);
  lines.push(`| qualified (hit or breakout) | ${r.recall.qualified}/${r.recall.eligible} | ${pct(r.recall.eligible ? Math.round((1000 * r.recall.qualified) / r.recall.eligible) / 10 : null)} |`);
  lines.push(`| in the user-facing feed (top 40 lists) | ${r.recall.inFeed}/${r.recall.eligible} | ${pct(r.recall.inFeedRate)} |`, '');
  lines.push(`Outcomes: ${Object.entries(r.outcomes).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '');
  if (Object.keys(r.missReasons).length) lines.push(`Why eligible positives are not in the feed: ${Object.entries(r.missReasons).map(([k, v]) => `${k} (${v})`).join('; ')}`, '');
  if (r.detectionDelayHours) lines.push(`Detection delay (publish → first observation): median ${r.detectionDelayHours.median}h, p25 ${r.detectionDelayHours.p25}h, p75 ${r.detectionDelayHours.p75}h over ${r.detectionDelayHours.n} videos. ${r.detectionDelayHours.note}`, '');
  lines.push(`Source coverage of discovered positives: ${Object.entries(r.coverage).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}`, '');
  lines.push(`**Precision (rule judge: verified YouTube stats, ≥1M views for hits / ≥50K for breakouts, inside the window):** Viral Now 72h P@10 ${pct(Math.round(r.precision.viralNow72h.at10 * 1000) / 10)} P@20 ${pct(Math.round(r.precision.viralNow72h.at20 * 1000) / 10)} · Viral Now 7d P@10 ${pct(Math.round(r.precision.viralNow7d.at10 * 1000) / 10)} P@20 ${pct(Math.round(r.precision.viralNow7d.at20 * 1000) / 10)} · Early Radar P@10 ${pct(Math.round(r.precision.earlyRadar.at10 * 1000) / 10)} P@20 ${pct(Math.round(r.precision.earlyRadar.at20 * 1000) / 10)}`, '');
  lines.push(`**Negative controls (leaked into the feed / total):** ${r.negatives.map((n) => `${n.kind}: ${n.leaked}/${n.count}`).join(' · ')}`, '');
  if (r.keywordMismatch) lines.push(`Keyword-mismatch control (format evidence passing the relevance validator this run): ${r.keywordMismatch.relevant}/${r.keywordMismatch.sampled}`, '');
  lines.push(`**Classification agreement with YouTube categories:** ${r.classification.agree}/${r.classification.comparable} (${pct(r.classification.rate)}) — ${r.classification.note}`, '');
  lines.push(`**Playback:** ${r.playback.embeddable}/${r.playback.checked} featured videos embeddable (${pct(r.playback.rate)}); thumbnails reachable ${r.playback.thumbOk}/${r.playback.checked} (${pct(r.playback.thumbRate)}). ${r.playback.note}`, '');
  lines.push(`Store: ${r.storeSize.observations} observations, ${r.storeSize.videos30d} unique videos in the 30-day index.`, '');
  lines.push(`## Positives (by best reference rank)`, '', `| ref rank | video | views | age | outcome | reason |`, `|---|---|---|---|---|---|`);
  for (const p of r.positives) lines.push(`| ${p.bestRank} | ${(p.title || p.id).replace(/\|/g, '/').slice(0, 60)} — ${p.channel || ''} | ${p.views?.toLocaleString() || '—'} | ${p.ageHours != null ? `${Math.round(p.ageHours / 24)}d` : '—'} | ${p.outcome} | ${p.reason.slice(0, 120)} |`);
  return lines.join('\n') + '\n';
}
// typing helper for markdown(): the result object literal above
async function buildResultType() { return null as unknown as ReturnType<typeof makeResult>; }
function makeResult() {
  return {} as {
    generatedAt: string; set: string; label: string; references: Record<string, { ok: boolean; items: number; error?: string }>; totals: { referenced: number; eligible: number; ineligible: number };
    recall: { eligible: number; discovered: number; verified: number; qualified: number; inFeed: number; discoveredRate: number | null; inFeedRate: number | null };
    detectionDelayHours?: { n: number; median: number; p25: number; p75: number; note: string };
    outcomes: Record<string, number>; missReasons: Record<string, number>; positives: PositiveResult[];
    negatives: { kind: string; count: number; leaked: number; examples: string[] }[]; keywordMismatch?: { sampled: number; relevant: number };
    precision: Record<'viralNow72h' | 'viralNow7d' | 'earlyRadar', { at10: number; at20: number; n: number }>;
    classification: { comparable: number; agree: number; rate: number | null; note: string };
    playback: { checked: number; embeddable: number; thumbOk: number; rate: number | null; thumbRate: number | null; note: string };
    coverage: Record<string, number>; storeSize: { observations: number; videos30d: number };
  };
}
void readFile;
void (null as unknown as VideoRecord);
main();
