import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// point the store at a temp dir BEFORE importing it
const tmp = await mkdtemp(path.join(os.tmpdir(), 'vr-store-'));
process.env.VR_DATA_DIR = tmp;
const store = await import('../src/lib/store.js');
import type { Observation } from '../src/types.js';

const o = (id: string, observedAt: string, likes: number): Observation => ({ id, source: 'bluesky', kind: 'post', level: 'indirect', key: id, title: id, url: 'https://x', observedAt, metrics: { likes } });

test('store: full record on first sight, ticks only when ≥3h passed or the metric moved ≥15%; latest state + firstSeenAt on load; cache fallback', async () => {
  const t1 = '2026-10-28T01:05:00.000Z';
  const first = [o('a', t1, 100), o('b', t1, 2)];
  assert.deepEqual(await store.appendObservations(first, []), { full: 2, ticks: 0 });
  // 35 minutes later, +5% → no tick
  assert.deepEqual(await store.appendObservations([o('a', '2026-10-28T01:40:00.000Z', 105)], await store.loadObservations()), { full: 0, ticks: 0 });
  // +20% → tick
  assert.deepEqual(await store.appendObservations([o('a', '2026-10-28T01:50:00.000Z', 125)], await store.loadObservations()), { full: 0, ticks: 1 });
  // unchanged but 3h later → tick
  assert.deepEqual(await store.appendObservations([o('a', '2026-10-28T05:00:00.000Z', 125)], await store.loadObservations()), { full: 0, ticks: 1 });
  const all = await store.loadObservations();
  assert.equal(all.length, 2, 'latest state per id');
  const a = all.find((x) => x.id === 'a')!;
  assert.equal(a.observedAt, '2026-10-28T05:00:00.000Z');
  assert.equal(a.metrics.likes, 125);
  assert.equal(a.firstSeenAt, t1);
  assert.equal(a.title, 'a', 'full record fields survive ticks');
  const files = await readdir(path.join(tmp, 'history', 'observations'));
  assert.deepEqual(files, ['2026-10-28.ndjson']);
  const lines = (await readFile(path.join(tmp, 'history', 'observations', files[0]), 'utf8')).trim().split('\n');
  assert.equal(lines.length, 4);
  assert.ok(lines[2].startsWith('{"_t":1'), 'ticks are compact');

  await store.appendScores([{ runId: 'r1', t: t1, trendId: 't_a', name: 'a', momentum: 50, confidence: 40, monetization: 60, creator: 55, signal: 0.4, lifecycle: 'emerging', evidenceCount: 2 }]);
  const scores = await store.loadScores();
  assert.equal(scores.length, 1);
  assert.equal(scores[0].trendId, 't_a');
  assert.equal(scores[0].monetization, 60);

  await store.saveSourceCache('bluesky', first);
  const cache = await store.loadSourceCache('bluesky');
  assert.equal(cache?.items.length, 2);
  assert.equal(await store.loadSourceCache('tiktok'), undefined);
});
