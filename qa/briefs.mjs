// Generates the production briefs for every Creator Desk opportunity in data/latest.json → data/qa/briefs.json
// (for audits and tests; the app generates the same briefs in the browser from the same templates).
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const entry = `import { buildBriefs, briefsToMarkdown } from './web/src/lib/playbook.ts'; export { buildBriefs, briefsToMarkdown };`;
const r = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, define: { 'import.meta.env.BASE_URL': '"/"', 'import.meta.env.VITE_REPO': '""' } });
const mod = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const snap = JSON.parse(await readFile('data/latest.json', 'utf8'));
const out = (snap.desk?.opportunities || []).map((o) => ({ id: o.id, name: o.name, type: o.type, action: o.action, timing: o.timing, fit: o.fit, briefs: mod.buildBriefs(o), markdown: mod.briefsToMarkdown(o, mod.buildBriefs(o), snap.generatedAt) }));
await mkdir('data/qa', { recursive: true });
await writeFile('data/qa/briefs.json', JSON.stringify({ generatedAt: snap.generatedAt, runId: snap.runId, opportunities: out }, null, 1));
console.log(`${out.length} opportunities → data/qa/briefs.json`);
for (const o of out) console.log(`- ${o.action} ${o.name}: ${o.briefs.map((b) => b.variation + ' — ' + b.title).join(' | ')}`);
