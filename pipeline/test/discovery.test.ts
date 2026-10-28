import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowance, buildPool, choose, emptyLedger, probeLabel, recordYield, rollLedger, summarizeYield, wantsDepth, PRIOR_YIELD } from '../src/collectors/discovery.js';
import { hoursLeftInQuotaDay } from '../src/collectors/youtube.js';

const NOW = '2026-10-28T12:00:00.000Z';

test('discovery: the reserve rule spreads the daily search budget over the runs still expected', () => {
  // start of the Pacific day, nothing spent, 24h left, no cadence known yet → assume 2 runs/h → 90/48 ≈ 1
  assert.equal(allowance({ budget: 90, spent: 0, hoursLeftInDay: 24, runsToday: 1, hoursElapsedToday: 0 }), 1);
  // hourly cadence measured (6 runs in 6h), 18h left, 70 left → 70/18 = 3
  assert.equal(allowance({ budget: 90, spent: 20, hoursLeftInDay: 18, runsToday: 6, hoursElapsedToday: 6 }), 3);
  // GitHub dropped half the runs: fewer runs expected → more per run, capped at 4
  assert.equal(allowance({ budget: 90, spent: 10, hoursLeftInDay: 10, runsToday: 3, hoursElapsedToday: 6 }), 4);
  // late in the day with budget to spare: never more than the cap, never zero while budget remains
  assert.equal(allowance({ budget: 90, spent: 80, hoursLeftInDay: 0.3, runsToday: 30, hoursElapsedToday: 23 }), 4);
  assert.equal(allowance({ budget: 90, spent: 89, hoursLeftInDay: 12, runsToday: 12, hoursElapsedToday: 12 }), 1);
  assert.equal(allowance({ budget: 90, spent: 90, hoursLeftInDay: 12, runsToday: 12, hoursElapsedToday: 12 }), 0);
  assert.ok(hoursLeftInQuotaDay('2026-10-28T07:30:00.000Z') > 23.4 && hoursLeftInQuotaDay('2026-10-28T07:30:00.000Z') <= 23.6, 'PDT: 00:30 → 23.5h left');
});

test('discovery: choice respects cooldowns, explores deterministically, exploits measured yield, and the ledger learns', () => {
  const pool = buildPool({ topicTerms: ['black cat day'], trendTerms: ['puppet dance'] });
  assert.ok(pool.length > 60);
  assert.ok(pool.some((p) => p.family === 'topic') && pool.some((p) => p.family === 'trend') && pool.some((p) => p.family === 'spanish'));
  let ledger = emptyLedger('2026-10-28');
  // first run: four picks, all distinct labels; with an empty ledger every exploit score is the optimistic prior
  const picks = choose(pool, ledger, 4, NOW, 'seed-a');
  assert.equal(picks.length, 4);
  assert.equal(new Set(picks.map((p) => p.label)).size, 4);
  assert.deepEqual(choose(pool, ledger, 4, NOW, 'seed-a').map((p) => p.label), picks.map((p) => p.label), 'deterministic for the same seed');
  // record yields: one probe is rich, one is empty
  recordYield(ledger, { label: picks[0].label, family: picks[0].probe.family, searches: 1, returned: 50, newIds: 30, newCandidates: 20, newEligible: 12, newFresh: 4, how: 'exploit' }, NOW);
  recordYield(ledger, { label: picks[1].label, family: picks[1].probe.family, searches: 1, returned: 50, newIds: 0, newCandidates: 0, newEligible: 0, newFresh: 0, how: 'exploit' }, NOW);
  assert.equal(ledger.probes[picks[0].label].ewma, 12);
  assert.equal(ledger.probes[picks[1].label].ewma, 0);
  assert.equal(ledger.today.searches, 2);
  // both are now inside their cooldown → neither can be chosen again right away
  const later = choose(pool, ledger, 50, NOW, 'seed-b');
  assert.ok(!later.some((p) => p.label === picks[0].label || p.label === picks[1].label));
  // after the cooldown, the rich probe outranks every unknown probe (12 + bonus > prior 3 + bonus)
  const afterCooldown = new Date(new Date(NOW).getTime() + 48 * 36e5).toISOString();
  const exploitOnly = choose(pool, ledger, 1, afterCooldown, 'seed-exploit-1');
  // find a seed that exploits (deterministic search)
  let pick = exploitOnly[0];
  for (let i = 0; pick.how !== 'exploit' && i < 20; i++) pick = choose(pool, ledger, 1, afterCooldown, `seed-exploit-${i}`)[0];
  assert.equal(pick.how, 'exploit');
  assert.equal(pick.label, picks[0].label, 'the probe with the best measured yield is exploited first');
  // and the empty probe's EWMA decays towards its results, not the prior
  recordYield(ledger, { label: picks[1].label, family: picks[1].probe.family, searches: 1, returned: 50, newIds: 10, newCandidates: 4, newEligible: 2, newFresh: 1, how: 'explore' }, afterCooldown);
  assert.equal(ledger.probes[picks[1].label].ewma, 0.6);
  assert.equal(ledger.probes[picks[1].label].runs, 2);
  // day roll keeps probe memory and archives the day
  ledger = rollLedger(ledger, '2026-10-29');
  assert.equal(ledger.today.searches, 0);
  assert.equal(ledger.history.length, 1);
  assert.equal(ledger.history[0].newEligible, 14);
  assert.ok(Object.keys(ledger.probes).length >= 2);
  const sum = summarizeYield(ledger);
  assert.ok(sum.families.length >= 1 && sum.probes[0].ewma >= sum.probes[sum.probes.length - 1].ewma);
  assert.equal(PRIOR_YIELD, 3);
  // depth only for paged probes that were rich
  const paged = pool.find((p) => (p.pages || 1) >= 2)!;
  assert.equal(wantsDepth(paged, { newEligible: 9, returned: 50 }), true);
  assert.equal(wantsDepth(paged, { newEligible: 3, returned: 50 }), false);
  assert.equal(wantsDepth(pool.find((p) => !p.pages)!, { newEligible: 30, returned: 50 }), false);
  assert.equal(probeLabel({ hours: 72, duration: 'short', region: 'MX', lang: 'es', family: 'region', cooldownHours: 1 }), 'top:MX:72h:short:es');
});
