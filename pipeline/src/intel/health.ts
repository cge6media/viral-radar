/**
 * Collection health (4.0): a run log kept in data/health.json plus, when the workflow exported it, the GitHub
 * Actions run list (data/health/actions.json) — the only place where *dropped* scheduled runs are visible, since a
 * run that never started cannot log itself. Freshness is a state computed by the client from `lastCollectionAt`.
 */
import type { HealthReport, HealthRun, SourceStatus } from '../types.js';
import { readJson, writeJson } from '../lib/store.js';
import { hoursBetween, round } from '../lib/util.js';

export const SCHEDULE = process.env.VR_SCHEDULE || '3,18,33,48 * * * *';
/** target collection cadence (collections per day) the dashboard measures against */
export const TARGET_PER_DAY = Number(process.env.VR_TARGET_COLLECTIONS_PER_DAY || 48);

export interface ActionsRun { createdAt: string; event: string; conclusion: string | null; status: string; durationSec?: number }

export async function recordHealth(run: HealthRun, sources: SourceStatus[], now: string): Promise<HealthReport> {
  const prev = await readJson<HealthReport>('health.json');
  const runs = [...(prev?.runs || []).filter((r) => r.runId !== run.runId), run].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).slice(-300);
  const day = runs.filter((r) => hoursBetween(r.startedAt, now) <= 24);
  const gaps: number[] = [];
  for (let i = 1; i < day.length; i++) gaps.push(hoursBetween(day[i - 1].startedAt, day[i].startedAt) * 60);
  const covered = day.length ? Math.min(24, hoursBetween(day[0].startedAt, now)) : 0;
  const expectedSlots = Math.max(1, Math.round((TARGET_PER_DAY * covered) / 24));
  const actions = await readJson<ActionsRun[]>('health/actions.json');
  const sched = (actions || []).filter((a) => a.event === 'schedule' && hoursBetween(a.createdAt, now) <= 24);
  const failures = (actions || []).filter((a) => hoursBetween(a.createdAt, now) <= 24 && a.conclusion === 'failure').length;
  const report: HealthReport = {
    generatedAt: now,
    lastCollectionAt: run.startedAt,
    lastPublishedAt: run.published ? run.startedAt : prev?.lastPublishedAt,
    last24h: {
      collections: day.length, expectedSlots,
      startRate: covered >= 2 ? round(Math.min(1, day.length / expectedSlots), 2) : null,
      meanGapMin: gaps.length ? round(gaps.reduce((a, b) => a + b, 0) / gaps.length, 0) : undefined,
      maxGapMin: gaps.length ? round(Math.max(...gaps), 0) : undefined,
      failures,
    },
    sources: sources.map((s) => ({ source: s.source, ok: s.ok, lastSuccess: s.ok ? s.fetchedAt : undefined, error: s.error })),
    schedule: SCHEDULE,
    runs: runs.slice(-96),
  };
  void sched;
  await writeJson('health.json', { ...report, runs });
  return report;
}
