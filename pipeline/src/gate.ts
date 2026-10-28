/**
 * Release gate: refuses to publish a snapshot that fails a CRITICAL data-integrity check.
 * Non-critical findings (e.g. "no qualified opportunity today") are reported but never block —
 * an honest empty state is a valid release. GitHub Pages keeps the previous deployment when a publish is skipped.
 *
 *   npx tsx src/gate.ts   → exit 0 (publish) or exit 1 (block)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './lib/store.js';
import type { Snapshot } from './types.js';

const CRITICAL = new Set([
  'publication dates are not share dates and not in the future',
  'no social engagement attributed to an unverified video',
  'evidence links are absolute http(s) URLs',
  'growth ratios are finite and positive',
  'no duplicate videos within a trend',
  'no news/person events in recommendations',
]);

async function main() {
  const snap = JSON.parse(await readFile(path.join(DATA_DIR, 'latest.json'), 'utf8')) as Snapshot;
  if (snap.version !== 2) throw new Error(`unexpected snapshot version ${String((snap as { version: unknown }).version)}`);
  if (!Array.isArray(snap.trends) || !snap.generatedAt) throw new Error('snapshot malformed');
  const failed = snap.quality.checks.filter((c) => !c.ok);
  const critical = failed.filter((c) => CRITICAL.has(c.name));
  for (const c of snap.quality.checks) console.log(`${c.ok ? 'ok  ' : CRITICAL.has(c.name) ? 'FAIL' : 'warn'} ${c.name} — ${c.detail}`);
  console.log(`trends=${snap.trends.length} qualified=${snap.stats.qualifiedTrends} sources_ok=${snap.sources.filter((s) => s.ok).length}`);
  if (critical.length) {
    console.error(`BLOCKED: ${critical.length} critical check(s) failed`);
    process.exit(1);
  }
  const liveOk = snap.sources.some((s) => s.ok);
  if (!liveOk) {
    console.error('BLOCKED: no source succeeded this run');
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
