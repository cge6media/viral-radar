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
import { mkdir, readdir, readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Metrics, Observation, Platform, SourceStatus } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.VR_DATA_DIR || path.resolve(__dirname, '../../../data');
export const RETENTION_DAYS = Number(process.env.VR_RETENTION_DAYS || 35);
export const SCORE_RETENTION_DAYS = Number(process.env.VR_SCORE_RETENTION_DAYS || 14);
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
  return Array.from(byId.values());
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
  signal: number;
  lifecycle: string;
  evidenceCount: number;
}
type CompactScore = { r: string; t: string; i: string; n: string; m: number; c: number; $: number; k: number; s: number; l: string; e: number };
const compact = (x: ScoreRecord): CompactScore => ({ r: x.runId, t: x.t, i: x.trendId, n: x.name, m: x.momentum, c: x.confidence, $: x.monetization, k: x.creator, s: x.signal, l: x.lifecycle, e: x.evidenceCount });
const expand = (x: CompactScore | ScoreRecord): ScoreRecord =>
  'runId' in x ? x : { runId: x.r, t: x.t, trendId: x.i, name: x.n, momentum: x.m, confidence: x.c, monetization: x.$, creator: x.k, signal: x.s, lifecycle: x.l, evidenceCount: x.e };

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
      if (f.endsWith('.ndjson') && f.slice(0, 10) < cutoff) {
        await unlink(path.join(dir, f));
        removed.push(f);
      }
    }
  }
  return removed;
}

export async function writeJson(rel: string, data: unknown): Promise<void> {
  const file = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 1), 'utf8');
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
