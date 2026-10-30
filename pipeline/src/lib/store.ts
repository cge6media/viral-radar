/**
 * Persistent store = plain files committed to the repository (git is the database).
 *
 *   data/history/observations/YYYY-MM-DD.ndjson   append-only log. The first time an id is seen its FULL record is
 *                                                  written; later sightings append compact "ticks" {id, observedAt,
 *                                                  metrics} — only when ≥3h passed or the primary metric moved ≥15%.
 *   data/history/scores/YYYY-MM-DD.ndjson         per-run trend scores (compact keys) for growth + sparklines
 *   data/latest.json                               the dashboard payload (current snapshot)
 *   data/sources.json                              last-known source status
 *   data/cache/<source>.json                       last successful raw observations per source (fallback)
 *
 * Loading returns the latest state per id (full record + last tick applied) with `firstSeenAt` preserved.
 */
import { mkdir, readdir, readFile, writeFile, appendFile, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Metrics, Observation, Platform, SourceStatus } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.VR_DATA_DIR || path.resolve(__dirname, '../../../data');
export const RETENTION_DAYS = Number(process.env.VR_RETENTION_DAYS || 35);
// 2026-10-30: 14 → 7 days: the series shows 48 points (a day) and growth is measured over ≤48h; 14 days of records for
// every cluster (~20 MB a day) were re-parsed by every run for nothing
export const SCORE_RETENTION_DAYS = Number(process.env.VR_SCORE_RETENTION_DAYS || 7);
/** minimum hours between ticks for an unchanged item */
export const TICK_MIN_HOURS = Number(process.env.VR_TICK_MIN_HOURS || 3);
/** relative change of the primary metric that forces a tick */
export const TICK_MIN_CHANGE = Number(process.env.VR_TICK_MIN_CHANGE || 0.15);

const obsDir = () => path.join(DATA_DIR, 'history', 'observations');
const scoreDir = () => path.join(DATA_DIR, 'history', 'scores');
const cacheDir = () => path.join(DATA_DIR, 'cache');

export async function ensureDirs(): Promise<void> {
  await Promise.all([obsDir(), scoreDir(), cacheDir()].map((d) => mkdir(d, { recursive: true })));
}

const dayOf = (iso: string) => iso.slice(0, 10);

async function readNdjson<T>(file: string): Promise<T[]> {
  try {
    const txt = await readFile(file, 'utf8');
    return txt.split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

async function listFiles(dir: string, sinceDays: number): Promise<string[]> {
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.ndjson')).sort();
  } catch {
    return [];
  }
  const cutoff = dayOf(new Date(Date.now() - sinceDays * 864e5).toISOString());
  return files.filter((f) => f.slice(0, 10) >= cutoff).map((f) => path.join(dir, f));
}

interface Tick { _t: 1; id: string; observedAt: string; metrics: Metrics }
const isTick = (x: unknown): x is Tick => !!x && typeof x === 'object' && (x as Tick)._t === 1;

/** v1 records (no `level`) are upgraded on load so timestamps and metrics follow the v2 rules. */
export function migrate(o: Observation): Observation {
  if (o.level) return o;
  const x: Observation = { ...o };
  const yt = /youtu\.?be/.test(o.url) ? (o.url.match(/(?:v=|shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/) || [])[1] : undefined;
  if (o.kind === 'video' && o.source === 'youtube') {
    x.level = 'direct';
    x.videoPublishedAt = o.publishedAt;
    x.video = { platform: 'youtube', id: o.key.replace(/^yt:/, ''), statsDirect: true };
  } else if (o.kind === 'video' && yt) {
    // v1 stored the share time as publishedAt and the post's engagement as the video's metrics — undo both
    x.level = 'indirect';
    x.postPublishedAt = o.publishedAt;
    x.publishedAt = undefined;
    x.postMetrics = { ...o.metrics, accounts: 1 };
    x.metrics = {};
    x.video = { platform: 'youtube', id: yt, statsDirect: false };
    x.url = `https://www.youtube.com/watch?v=${yt}`;
    if (o.creator && !/youtube\.com/.test(o.creator.url || '')) {
      x.sharedBy = o.creator;
      x.creator = undefined;
    }
    x.thumbnail = o.thumbnail || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  } else if (o.kind === 'video' && !/^https:\/\/bsky\.app\//.test(o.url) && !/^bsky:/.test(o.key)) {
    // v1 external video link on another platform (TikTok/Instagram): a share, not a measurement
    x.level = 'indirect';
    x.postPublishedAt = o.publishedAt;
    x.publishedAt = undefined;
    x.postMetrics = { ...o.metrics, accounts: 1 };
    x.metrics = {};
    if (o.creator) {
      x.sharedBy = o.creator;
      x.creator = undefined;
    }
  } else if (o.kind === 'video') {
    x.level = 'direct';
    x.postPublishedAt = o.publishedAt;
    x.videoPublishedAt = o.publishedAt;
    x.video = { platform: 'bluesky', id: o.key.replace(/^bsky:/, ''), statsDirect: true };
  } else {
    x.level = 'indirect';
    if (o.kind === 'post') x.postPublishedAt = o.publishedAt;
    if (!x.publishedAt && o.kind !== 'post') x.publishedAt = o.observedAt;
  }
  return x;
}

/** Latest state per id, with firstSeenAt. */
export async function loadObservations(sinceDays = RETENTION_DAYS): Promise<Observation[]> {
  const byId = new Map<string, Observation>();
  for (const file of await listFiles(obsDir(), sinceDays)) {
    for (const rec of await readNdjson<Observation | Tick>(file)) {
      if (isTick(rec)) {
        const cur = byId.get(rec.id);
        if (cur && rec.observedAt >= cur.observedAt) byId.set(rec.id, { ...cur, observedAt: rec.observedAt, metrics: rec.metrics });
      } else {
        const cur = byId.get(rec.id);
        if (!cur) byId.set(rec.id, { ...rec, firstSeenAt: rec.firstSeenAt || rec.observedAt });
        else if (rec.observedAt >= cur.observedAt) byId.set(rec.id, { ...rec, firstSeenAt: cur.firstSeenAt || cur.observedAt });
      }
    }
  }
  return Array.from(byId.values()).map(migrate);
}

/**
 * Metric history for specific ids inside the retention window: every full record and tick, chronological.
 * Used for video velocity (views gained per hour) and engagement momentum.
 */
export async function loadMetricHistory(ids: Iterable<string>, sinceDays = 8): Promise<Map<string, { t: string; metrics: Metrics }[]>> {
  const want = new Set(ids);
  const out = new Map<string, { t: string; metrics: Metrics }[]>();
  if (!want.size) return out;
  for (const file of await listFiles(obsDir(), sinceDays)) {
    for (const rec of await readNdjson<Observation | Tick>(file)) {
      if (!want.has(rec.id)) continue;
      if (!out.has(rec.id)) out.set(rec.id, []);
      out.get(rec.id)!.push({ t: rec.observedAt, metrics: rec.metrics });
    }
  }
  for (const arr of out.values()) arr.sort((a, b) => a.t.localeCompare(b.t));
  return out;
}

export function primaryMetric(m: Metrics): number | undefined {
  return m.views ?? m.likes ?? m.uses ?? m.approxTraffic ?? m.reposts;
}

/** Append new observations. Returns {full, ticks} counts written. */
export async function appendObservations(obs: Observation[], existing: Observation[]): Promise<{ full: number; ticks: number }> {
  await ensureDirs();
  const last = new Map(existing.map((o) => [o.id, o]));
  const byDay = new Map<string, string[]>();
  let full = 0, ticks = 0;
  for (const o of obs) {
    const prev = last.get(o.id);
    let line: string | undefined;
    if (!prev) {
      line = JSON.stringify({ ...o, firstSeenAt: undefined });
      full++;
    } else {
      const hours = (new Date(o.observedAt).getTime() - new Date(prev.observedAt).getTime()) / 36e5;
      const a = primaryMetric(prev.metrics), b = primaryMetric(o.metrics);
      const moved = a != null && b != null && a > 0 ? Math.abs(b - a) / a >= TICK_MIN_CHANGE : a !== b;
      if (hours >= TICK_MIN_HOURS || moved) {
        line = JSON.stringify({ _t: 1, id: o.id, observedAt: o.observedAt, metrics: o.metrics } satisfies Tick);
        ticks++;
      }
    }
    if (!line) continue;
    last.set(o.id, o);
    const d = dayOf(o.observedAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(line);
  }
  for (const [d, lines] of byDay) await appendFile(path.join(obsDir(), `${d}.ndjson`), lines.join('\n') + '\n', 'utf8');
  return { full, ticks };
}

export interface ScoreRecord {
  runId: string;
  t: string;
  trendId: string;
  name: string;
  momentum: number;
  confidence: number;
  monetization: number;
  creator: number;
  /** attention signal 0..1 (v1) / adoption 0..1 (v2) */
  signal: number;
  lifecycle: string;
  evidenceCount: number;
  /** v2: independent creators in the 7-day window */
  adoption?: number;
  /** v2: independent creators in the 24h / 48h windows (like-for-like growth per window) */
  creators24?: number;
  creators48?: number;
  /** v3: active-source signature of the run — growth is only compared between runs with the same signature,
   *  so switching a source on never reads as growth */
  sources?: string;
  /** v2: direct videos in the 7-day window */
  directVideos?: number;
  grade?: string;
}
type CompactScore = { r: string; t: string; i: string; n: string; m: number; c: number; $: number; k: number; s: number; l: string; e: number; a?: number; a1?: number; a2?: number; d?: number; g?: string; src?: string };
const compact = (x: ScoreRecord): CompactScore => ({ r: x.runId, t: x.t, i: x.trendId, n: x.name, m: x.momentum, c: x.confidence, $: x.monetization, k: x.creator, s: x.signal, l: x.lifecycle, e: x.evidenceCount, a: x.adoption, a1: x.creators24, a2: x.creators48, d: x.directVideos, g: x.grade, src: x.sources });
const expand = (x: CompactScore | ScoreRecord): ScoreRecord =>
  'runId' in x ? x : { runId: x.r, t: x.t, trendId: x.i, name: x.n, momentum: x.m, confidence: x.c, monetization: x.$, creator: x.k, signal: x.s, lifecycle: x.l, evidenceCount: x.e, adoption: x.a, creators24: x.a1, creators48: x.a2, directVideos: x.d, grade: x.g, sources: x.src };

export async function appendScores(records: ScoreRecord[]): Promise<void> {
  await ensureDirs();
  if (!records.length) return;
  const d = dayOf(records[0].t);
  await appendFile(path.join(scoreDir(), `${d}.ndjson`), records.map((r) => JSON.stringify(compact(r))).join('\n') + '\n', 'utf8');
}

export async function loadScores(sinceDays = SCORE_RETENTION_DAYS): Promise<ScoreRecord[]> {
  const out: ScoreRecord[] = [];
  for (const file of await listFiles(scoreDir(), sinceDays)) out.push(...(await readNdjson<CompactScore | ScoreRecord>(file)).map(expand));
  return out;
}

/** Remove history files older than the retention windows (keeps the repo small). */
/**
 * 2026-10-30: compact observation files older than `keepFullDays` to the last state per id (the last full record,
 * plus the last tick after it). Metric history is only read for the last 8 days (velocity), so older files need
 * only carry "the latest state of each id" for the 30-day index — not every 30-minute tick. Without this, the
 * history grew ~18 MB a day and every run re-parsed all of it (35 days ≈ 600 MB), the next collection timeout in
 * the making. A compacted file is marked by a `.compact` sidecar so it is rewritten only once.
 */
export async function compactHistory(keepFullDays = 9): Promise<{ files: string[]; before: number; after: number }> {
  const out = { files: [] as string[], before: 0, after: 0 };
  const cutoff = dayOf(new Date(Date.now() - keepFullDays * 864e5).toISOString());
  let files: string[] = [];
  try { files = (await readdir(obsDir())).filter((f) => f.endsWith('.ndjson') && f.slice(0, 10) < cutoff).sort(); } catch { return out; }
  for (const f of files) {
    const file = path.join(obsDir(), f);
    const marker = `${file}.compact`;
    try { await readFile(marker, 'utf8'); continue; } catch { /* not compacted yet */ }
    const rows = await readNdjson<Observation | Tick>(file);
    const lastFull = new Map<string, Observation>();
    const lastTick = new Map<string, Tick>();
    for (const r of rows) {
      if (isTick(r)) { const cur = lastTick.get(r.id); if (!cur || r.observedAt >= cur.observedAt) lastTick.set(r.id, r); }
      else { const cur = lastFull.get(r.id); if (!cur || r.observedAt >= cur.observedAt) lastFull.set(r.id, r); lastTick.delete(r.id); }
    }
    const kept: unknown[] = [];
    for (const [id, full] of lastFull) { kept.push(full); const t = lastTick.get(id); if (t && t.observedAt >= full.observedAt) kept.push(t); }
    // ticks whose full record lives in an earlier file must survive too (they carry the latest metrics for that id)
    for (const [id, t] of lastTick) if (!lastFull.has(id)) kept.push(t);
    out.before += rows.length; out.after += kept.length;
    await rewriteNdjson(path.relative(DATA_DIR, file), kept);
    await writeFile(marker, `${new Date().toISOString()} ${rows.length} -> ${kept.length}\n`, 'utf8');
    out.files.push(f);
  }
  return out;
}

export async function pruneHistory(): Promise<string[]> {
  const removed: string[] = [];
  for (const [dir, days] of [[obsDir(), RETENTION_DAYS], [scoreDir(), SCORE_RETENTION_DAYS]] as const) {
    const cutoff = dayOf(new Date(Date.now() - days * 864e5).toISOString());
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if ((f.endsWith('.ndjson') || f.endsWith('.ndjson.compact')) && f.slice(0, 10) < cutoff) {
        await unlink(path.join(dir, f));
        removed.push(f);
      }
    }
  }
  return removed;
}

export async function writeJson(rel: string, data: unknown, opts: { compact?: boolean } = {}): Promise<void> {
  const file = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(file), { recursive: true });
  // atomic: a crash mid-write must never leave a truncated ledger or snapshot behind
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, opts.compact ? JSON.stringify(data) : JSON.stringify(data, null, 1), 'utf8');
  await rename(tmp, file);
}

/** append-only NDJSON logs (predictions, outcomes, health): one JSON object per line, never rewritten */
export async function appendNdjson(rel: string, rows: unknown[]): Promise<void> {
  if (!rows.length) return;
  const file = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}
/** maintenance only: rewrite an NDJSON log with the rows that stay active (the dropped rows were archived first) */
export async function rewriteNdjson(rel: string, rows: unknown[]): Promise<void> {
  const file = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, rows.length ? rows.map((r) => JSON.stringify(r)).join('\n') + '\n' : '', 'utf8');
  await rename(tmp, file);
}
export async function readNdjsonLog<T>(rel: string): Promise<T[]> {
  return readNdjson<T>(path.join(DATA_DIR, rel));
}

export async function readJson<T>(rel: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, rel), 'utf8')) as T;
  } catch {
    return undefined;
  }
}

export async function saveSourceCache(source: Platform, items: Observation[]): Promise<void> {
  await writeJson(`cache/${source}.json`, { savedAt: new Date().toISOString(), items });
}
export async function loadSourceCache(source: Platform): Promise<{ savedAt: string; items: Observation[] } | undefined> {
  return readJson(`cache/${source}.json`);
}

export async function loadPreviousStatus(): Promise<SourceStatus[]> {
  return (await readJson<SourceStatus[]>('sources.json')) || [];
}
