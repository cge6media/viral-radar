/**
 * Adaptive discovery scheduler (4.0) — allocates the daily search.list allowance by demonstrated usefulness.
 *
 * The probe pool is the same family of query-less "top by views" probes as 3.0 (fresh / windows / day slices /
 * categories / regions / global / keywords / live topic & trend terms), but instead of a fixed rotation every run:
 *   1. a RESERVE rule decides how many searches this run may spend: the budget left for the Pacific quota day
 *      divided by the number of runs still expected today (from the measured run cadence), clamped to 1–4 — so a
 *      day's allowance is never exhausted early, and runs that GitHub dropped are made up by later runs;
 *   2. every probe carries a yield ledger (new ids, new candidates ≥10K views, new *eligible* videos ≥500K views
 *      and ≤30 days, fresh ≤24h, duplicate-return rate) with an exponentially weighted "new eligible per search";
 *   3. selection is a bandit: 25 % of picks EXPLORE (the least-run probe outside its cooldown — unknown regions,
 *      categories and day slices keep being sampled, so a format we have never named can still surface), the rest
 *      EXPLOIT by an upper-confidence score (yield + optimism for rarely-run probes), never re-running a probe inside
 *      its cooldown (the same top-50 would come back);
 *   4. a probe whose last page returned many new eligible videos earns a second page in the same run (depth where
 *      the mid-size breakouts live).
 * Everything the scheduler decides is written to the ledger and shown in Diagnostics, so the allocation can be
 * audited run by run. Nothing here depends on benchmark ids.
 */
import { hoursBetween, round, sha1 } from '../lib/util.js';

export interface Probe { hours: number; beforeHours?: number; duration?: 'short' | 'medium' | 'long'; region?: string; category?: string; lang?: string; pages?: number; q?: string; family: string; cooldownHours: number }

export interface ProbeYield {
  family: string;
  runs: number;
  searches: number;
  returned: number;
  newIds: number;
  newCandidates: number;
  newEligible: number;
  newFresh: number;
  lastAt?: string;
  lastReturned?: number;
  lastNew?: number;
  lastEligible?: number;
  /** exponentially weighted new-eligible per search (α = 0.3) */
  ewma: number;
  ewmaNew: number;
  /** how it was chosen the last time */
  lastPick?: 'explore' | 'exploit' | 'depth' | 'rotation';
}
export interface DayYield { day: string; searches: number; returned: number; newIds: number; newCandidates: number; newEligible: number; newFresh: number; runs: number; firstRunAt?: string; picks: { explore: number; exploit: number; depth: number } }
export interface YieldLedger { probes: Record<string, ProbeYield>; today: DayYield; history: DayYield[] }

export const PRIOR_YIELD = 3; // optimistic prior for a never-run probe: 3 new eligible videos per search
const ALPHA = 0.3;
export const MAX_PER_RUN = Number(process.env.VR_YT_MAX_SEARCHES_PER_RUN || 4);
export const EXPLORE_SHARE = 0.25;
const US = 'US';

export function probeLabel(p: Probe): string {
  return p.q != null ? `yt:${p.q}` : `top:${p.region || 'all'}:${p.hours}h${p.beforeHours ? '-' + p.beforeHours + 'h' : ''}${p.duration ? ':' + p.duration : ''}${p.category ? ':cat' + p.category : ''}${p.lang ? ':' + p.lang : ''}`;
}

/** The probe pool. Families and cooldowns encode how fast each list changes. */
export function buildPool(opts: { topicTerms?: string[]; trendTerms?: string[]; queries?: string[] } = {}): Probe[] {
  const pool: Probe[] = [
    { hours: 6, duration: 'short', region: US, family: 'fresh', cooldownHours: 1.5 },
    { hours: 24, duration: 'short', region: US, family: 'fresh', cooldownHours: 2 },
    { hours: 24, duration: 'short', family: 'fresh', cooldownHours: 3 },
    { hours: 72, duration: 'short', region: US, pages: 2, family: 'window', cooldownHours: 8 },
    { hours: 24 * 7, duration: 'short', region: US, pages: 3, family: 'window', cooldownHours: 12 },
    { hours: 24 * 21, duration: 'short', region: US, family: 'window', cooldownHours: 24 },
    { hours: 72, region: US, family: 'window', cooldownHours: 12 },
    { hours: 24 * 7, region: US, family: 'window', cooldownHours: 24 },
    { hours: 24 * 7, duration: 'medium', region: US, family: 'window', cooldownHours: 24 },
    { hours: 24 * 7, duration: 'short', pages: 2, family: 'global', cooldownHours: 12 },
    { hours: 24 * 21, duration: 'short', family: 'global', cooldownHours: 24 },
    { hours: 72, duration: 'short', pages: 2, family: 'global', cooldownHours: 8 },
    ...Array.from({ length: 7 }, (_, i) => ({ hours: 24 * (i + 2), beforeHours: 24 * (i + 1), duration: 'short' as const, region: US, family: 'day', cooldownHours: 20 })),
    ...Array.from({ length: 7 }, (_, i) => ({ hours: 24 * (i + 2), beforeHours: 24 * (i + 1), duration: 'short' as const, family: 'day-global', cooldownHours: 20 })),
    ...['15', '23', '20', '24', '22', '26', '1', '10', '27', '28', '17', '2', '19'].map((c) => ({ hours: 72, duration: 'short' as const, region: US, category: c, family: 'category', cooldownHours: 12 })),
    ...['GB', 'IN', 'MX', 'BR', 'ID', 'PH', 'JP', 'KR', 'ES', 'DE', 'FR', 'VN', 'CA', 'AU', 'AR', 'CO', 'TR', 'TH', 'PK', 'NG', 'EG', 'SA', 'IT', 'PL', 'RU', 'TW'].map((r) => ({ hours: 72, duration: 'short' as const, region: r, lang: ['MX', 'ES', 'AR', 'CO'].includes(r) ? 'es' : undefined, family: 'region', cooldownHours: 12 })),
    ...['MX', 'ES', 'AR', 'CO'].map((r) => ({ hours: 24 * 7, duration: 'short' as const, region: r, lang: 'es', pages: 2, family: 'spanish', cooldownHours: 12 })),
    { hours: 72, q: '#shorts', duration: 'short', family: 'keyword', cooldownHours: 24 },
    { hours: 72, q: 'videos virales', duration: 'short', lang: 'es', family: 'keyword', cooldownHours: 24 },
    ...(opts.queries || []).slice(0, 6).map((q) => ({ hours: 72, q, family: 'keyword', cooldownHours: 48 })),
    ...(opts.topicTerms || []).slice(0, 2).map((q) => ({ hours: 72, q, family: 'topic', cooldownHours: 24 })),
    ...(opts.trendTerms || []).slice(0, 2).map((q) => ({ hours: 72, q, family: 'trend', cooldownHours: 24 })),
  ];
  return pool;
}

export function emptyLedger(day: string): YieldLedger {
  return { probes: {}, today: emptyDay(day), history: [] };
}
export function emptyDay(day: string): DayYield {
  return { day, searches: 0, returned: 0, newIds: 0, newCandidates: 0, newEligible: 0, newFresh: 0, runs: 0, picks: { explore: 0, exploit: 0, depth: 0 } };
}

/** Roll the ledger to a new quota day (keeps 30 days of daily totals). */
export function rollLedger(l: YieldLedger, day: string): YieldLedger {
  if (l.today.day === day) return l;
  return { probes: l.probes, today: emptyDay(day), history: [...l.history, l.today].slice(-30) };
}

/**
 * How many searches this run may spend: budget left ÷ runs still expected today, clamped to 1…MAX_PER_RUN.
 * The run cadence is measured from the ledger (runs so far today ÷ hours elapsed), floored at one run per hour.
 */
export function allowance(opts: { budget: number; spent: number; hoursLeftInDay: number; runsToday: number; hoursElapsedToday: number; max?: number }): number {
  const left = Math.max(0, opts.budget - opts.spent);
  if (left === 0) return 0;
  const rate = Math.max(1, Math.min(4, opts.hoursElapsedToday >= 1 ? opts.runsToday / opts.hoursElapsedToday : 2));
  const runsLeft = Math.max(1, Math.ceil(Math.max(0.5, opts.hoursLeftInDay) * rate));
  // round, not floor: the rule is recomputed every run, so an optimistic round self-corrects while a floor would strand budget
  return Math.max(1, Math.min(opts.max ?? MAX_PER_RUN, Math.round(left / runsLeft)));
}

/** deterministic pseudo-random in [0,1) from a seed string (so runs are reproducible and testable) */
export function seededRandom(seed: string): number {
  return parseInt(sha1(seed).slice(0, 8), 16) / 0x100000000;
}

export interface Pick { probe: Probe; label: string; how: 'explore' | 'exploit' | 'depth'; score: number }

/** Choose `n` probes for this run (depth pages are decided after each probe runs, see `wantsDepth`). */
export function choose(pool: Probe[], ledger: YieldLedger, n: number, now: string, seed: string): Pick[] {
  const picks: Pick[] = [];
  const used = new Set<string>();
  const totalSearches = Object.values(ledger.probes).reduce((a, p) => a + p.searches, 0);
  for (let i = 0; i < n; i++) {
    const eligible = pool.filter((p) => {
      const label = probeLabel(p);
      if (used.has(label)) return false;
      const y = ledger.probes[label];
      return !y?.lastAt || hoursBetween(y.lastAt, now) >= p.cooldownHours;
    });
    if (!eligible.length) break;
    const r = seededRandom(`${seed}:${i}`);
    let best: Pick | undefined;
    if (r < EXPLORE_SHARE) {
      // explore: the least-run probe (ties → least recently run, then stable order)
      const sorted = [...eligible].sort((a, b) => {
        const ya = ledger.probes[probeLabel(a)], yb = ledger.probes[probeLabel(b)];
        return (ya?.runs || 0) - (yb?.runs || 0) || (ya?.lastAt || '').localeCompare(yb?.lastAt || '');
      });
      best = { probe: sorted[0], label: probeLabel(sorted[0]), how: 'explore', score: 0 };
    } else {
      for (const p of eligible) {
        const label = probeLabel(p);
        const y = ledger.probes[label];
        const mean = y && y.searches > 0 ? y.ewma : PRIOR_YIELD;
        const score = mean + 1.5 * Math.sqrt(Math.log(totalSearches + 2) / ((y?.searches || 0) + 1));
        if (!best || score > best.score) best = { probe: p, label, how: 'exploit', score: round(score, 3) };
      }
    }
    if (!best) break;
    used.add(best.label);
    picks.push(best);
  }
  return picks;
}

/** a probe earns a second page when its first page just returned many new eligible videos */
export function wantsDepth(p: Probe, firstPage: { newEligible: number; returned: number }): boolean {
  return (p.pages || 1) >= 2 && firstPage.returned >= 40 && firstPage.newEligible >= 8;
}

export interface ProbeResult { label: string; family: string; searches: number; returned: number; newIds: number; newCandidates: number; newEligible: number; newFresh: number; how: Pick['how'] | 'rotation' }

/** Record a probe's measured yield into the ledger. */
export function recordYield(ledger: YieldLedger, r: ProbeResult, now: string): void {
  const y = ledger.probes[r.label] || (ledger.probes[r.label] = { family: r.family, runs: 0, searches: 0, returned: 0, newIds: 0, newCandidates: 0, newEligible: 0, newFresh: 0, ewma: PRIOR_YIELD, ewmaNew: 10 });
  const perSearch = r.searches > 0 ? r.newEligible / r.searches : 0;
  const newPerSearch = r.searches > 0 ? r.newIds / r.searches : 0;
  y.ewma = y.searches === 0 ? perSearch : round((1 - ALPHA) * y.ewma + ALPHA * perSearch, 3);
  y.ewmaNew = y.searches === 0 ? newPerSearch : round((1 - ALPHA) * y.ewmaNew + ALPHA * newPerSearch, 2);
  y.runs++; y.searches += r.searches; y.returned += r.returned; y.newIds += r.newIds; y.newCandidates += r.newCandidates; y.newEligible += r.newEligible; y.newFresh += r.newFresh;
  y.lastAt = now; y.lastReturned = r.returned; y.lastNew = r.newIds; y.lastEligible = r.newEligible; y.lastPick = r.how;
  const d = ledger.today;
  d.searches += r.searches; d.returned += r.returned; d.newIds += r.newIds; d.newCandidates += r.newCandidates; d.newEligible += r.newEligible; d.newFresh += r.newFresh;
  if (r.how !== 'rotation') d.picks[r.how]++;
}

/** Diagnostics view of the ledger: per-family and per-probe yield, today's totals. */
export function summarizeYield(ledger: YieldLedger): { families: { family: string; probes: number; searches: number; newIds: number; newEligible: number; eligiblePerSearch: number; newPerSearch: number }[]; probes: { label: string; family: string; runs: number; searches: number; newIds: number; newEligible: number; ewma: number; lastAt?: string; lastPick?: string; lastEligible?: number }[]; today: DayYield; history: DayYield[] } {
  const fam = new Map<string, { probes: number; searches: number; newIds: number; newEligible: number }>();
  for (const [, y] of Object.entries(ledger.probes)) {
    const f = fam.get(y.family) || fam.set(y.family, { probes: 0, searches: 0, newIds: 0, newEligible: 0 }).get(y.family)!;
    f.probes++; f.searches += y.searches; f.newIds += y.newIds; f.newEligible += y.newEligible;
  }
  const families = Array.from(fam.entries()).map(([family, f]) => ({ family, ...f, eligiblePerSearch: f.searches ? round(f.newEligible / f.searches, 2) : 0, newPerSearch: f.searches ? round(f.newIds / f.searches, 1) : 0 })).sort((a, b) => b.eligiblePerSearch - a.eligiblePerSearch);
  const probes = Object.entries(ledger.probes).map(([label, y]) => ({ label, family: y.family, runs: y.runs, searches: y.searches, newIds: y.newIds, newEligible: y.newEligible, ewma: y.ewma, lastAt: y.lastAt, lastPick: y.lastPick, lastEligible: y.lastEligible })).sort((a, b) => b.ewma - a.ewma);
  return { families, probes, today: ledger.today, history: ledger.history };
}
