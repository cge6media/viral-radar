/**
 * Persistent store = plain files committed to the repository (git is the database).
 *
 *   data/history/observations/YYYY-MM-DD.ndjson   append-only observation log (one JSON per line)
 *   data/history/scores/YYYY-MM-DD.ndjson         per-run trend scores (for growth + charts)
 *   data/latest.json                               the dashboard payload (current snapshot)
 *   data/sources.json                              last-known source status (for cached fallback)
 *   data/cache/<source>.json                       last successful raw observations per source (fallback)
 *
 * Duplicate prevention: an observation is only appended if the same id has not been
 * recorded within the same hour bucket with identical metrics.
 */
import { mkdir, readdir, readFile, writeFile, appendFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Observation, Platform, SourceStatus } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.VR_DATA_DIR || path.resolve(__dirname, '../../../data');
export const RETENTION_DAYS = Number(process.env.VR_RETENTION_DAYS || 35);

const obsDir = () => path.join(DATA_DIR, 'history', 'observations');
const scoreDir = () => path.join(DATA_DIR, 'history', 'scores');
const cacheDir = () => path.join(DATA_DIR, 'cache');

export async function ensureDirs(): Promise<void> {
  await Promise.all([obsDir(), scoreDir(), cacheDir()].map((d) => mkdir(d, { recursive: true })));
}

const dayOf = (iso: string) => iso.slice(0, 10);
const hourOf = (iso: string) => iso.slice(0, 13);

async function readNdjson<T>(file: string): Promise<T[]> {
  try {
    const txt = await readFile(file, 'utf8');
    return txt.split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

export async function loadObservations(sinceDays = RETENTION_DAYS): Promise<Observation[]> {
  let files: string[] = [];
  try {
    files = (await readdir(obsDir())).filter((f) => f.endsWith('.ndjson')).sort();
  } catch {
    return [];
  }
  const cutoff = dayOf(new Date(Date.now() - sinceDays * 864e5).toISOString());
  const out: Observation[] = [];
  for (const f of files) {
    if (f.slice(0, 10) < cutoff) continue;
    out.push(...(await readNdjson<Observation>(path.join(obsDir(), f))));
  }
  return out;
}

/** Append new observations, skipping exact duplicates within the same hour. Returns number written. */
export async function appendObservations(obs: Observation[], existing: Observation[]): Promise<number> {
  await ensureDirs();
  const seen = new Set(existing.map((o) => `${o.id}|${hourOf(o.observedAt)}|${JSON.stringify(o.metrics)}`));
  const byDay = new Map<string, string[]>();
  let n = 0;
  for (const o of obs) {
    const sig = `${o.id}|${hourOf(o.observedAt)}|${JSON.stringify(o.metrics)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const d = dayOf(o.observedAt);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(JSON.stringify(o));
    n++;
  }
  for (const [d, lines] of byDay) {
    await appendFile(path.join(obsDir(), `${d}.ndjson`), lines.join('\n') + '\n', 'utf8');
  }
  return n;
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

export async function appendScores(records: ScoreRecord[]): Promise<void> {
  await ensureDirs();
  if (!records.length) return;
  const d = dayOf(records[0].t);
  await appendFile(path.join(scoreDir(), `${d}.ndjson`), records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

export async function loadScores(sinceDays = RETENTION_DAYS): Promise<ScoreRecord[]> {
  let files: string[] = [];
  try {
    files = (await readdir(scoreDir())).filter((f) => f.endsWith('.ndjson')).sort();
  } catch {
    return [];
  }
  const cutoff = dayOf(new Date(Date.now() - sinceDays * 864e5).toISOString());
  const out: ScoreRecord[] = [];
  for (const f of files) {
    if (f.slice(0, 10) < cutoff) continue;
    out.push(...(await readNdjson<ScoreRecord>(path.join(scoreDir(), f))));
  }
  return out;
}

/** Remove history files older than the retention window (keeps the repo small). */
export async function pruneHistory(): Promise<string[]> {
  const removed: string[] = [];
  const cutoff = dayOf(new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString());
  for (const dir of [obsDir(), scoreDir()]) {
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
