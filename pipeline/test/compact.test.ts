import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('store 2026-10-30: old observation files compact to the last state per id, recent files stay intact', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vr-compact-'));
  process.env.VR_DATA_DIR = dir;
  const store = await import('../src/lib/store.js');
  const obs = path.join(dir, 'history', 'observations');
  await mkdir(obs, { recursive: true });
  const full = (id: string, t: string, views: number) => JSON.stringify({ id, kind: 'video', source: 'youtube', level: 'direct', key: id, title: id, url: 'u', observedAt: t, metrics: { views }, video: { platform: 'youtube', id } });
  const tick = (id: string, t: string, views: number) => JSON.stringify({ _t: 1, id, observedAt: t, metrics: { views } });
  const old = '2026-10-01.ndjson';
  await writeFile(path.join(obs, old), [full('a', '2026-10-01T00:00:00Z', 10), tick('a', '2026-10-01T03:00:00Z', 20), tick('a', '2026-10-01T06:00:00Z', 30), full('b', '2026-10-01T01:00:00Z', 5), full('b', '2026-10-01T05:00:00Z', 7), tick('c', '2026-10-01T02:00:00Z', 99)].join('\n') + '\n');
  const recent = `${new Date().toISOString().slice(0, 10)}.ndjson`;
  await writeFile(path.join(obs, recent), [full('d', new Date().toISOString(), 1), tick('d', new Date().toISOString(), 2)].join('\n') + '\n');
  const r = await store.compactHistory(9);
  assert.deepEqual(r.files, [old]);
  assert.equal(r.before, 6);
  const rows = (await readFile(path.join(obs, old), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  // a: last full + last tick after it; b: last full only; c: orphan tick kept
  assert.equal(rows.length, 4);
  assert.ok(rows.some((x) => x.id === 'a' && !x._t && x.metrics.views === 10));
  assert.ok(rows.some((x) => x.id === 'a' && x._t === 1 && x.metrics.views === 30));
  assert.ok(rows.some((x) => x.id === 'b' && x.metrics.views === 7) && !rows.some((x) => x.id === 'b' && x.metrics.views === 5));
  assert.ok(rows.some((x) => x.id === 'c' && x._t === 1));
  // marker written, second pass is a no-op, recent file untouched
  const again = await store.compactHistory(9);
  assert.equal(again.files.length, 0);
  assert.equal((await readFile(path.join(obs, recent), 'utf8')).trim().split('\n').length, 2);
  // the latest state per id survives compaction
  const loaded = await store.loadObservations(60);
  const a = loaded.find((o) => o.id === 'a')!;
  assert.equal(a.metrics.views, 30);
  assert.equal(loaded.find((o) => o.id === 'b')!.metrics.views, 7);
});
