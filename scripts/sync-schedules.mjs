// Regenerates collect-b/c/d.yml from collect.yml (same content, different name + cron). Run after editing collect.yml.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('.github/workflows/collect.yml', 'utf8');
for (const [name, cron] of [['b', '18,48 * * * *'], ['c', '11,41 * * * *'], ['d', '26,56 * * * *']]) {
  let s = src.replace('name: Collect trends\n', `name: Collect trends (${name.toUpperCase()})\n`).replace("    - cron: '3,33 * * * *'", `    - cron: '${cron}'`);
  // siblings have no manual trigger: drop the whole workflow_dispatch block (the keeper always dispatches collect.yml)
  s = s.replace(/  workflow_dispatch:[^\n]*\n(?:    [^\n]*\n|      [^\n]*\n|        [^\n]*\n)*/, '');
  writeFileSync(`.github/workflows/collect-${name}.yml`, '# GENERATED from collect.yml by scripts/sync-schedules.mjs — do not edit by hand.\n' + s);
}
console.log('collect-b/c/d.yml regenerated');
