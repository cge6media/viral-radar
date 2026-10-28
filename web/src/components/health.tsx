import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { fmtAgo, fmtNum } from '../lib/data';
import { Section, StatTile } from '../components/ui';

/** Freshness is a state, never "live": fresh < 45 min, delayed < 2 h, stale beyond. */
export function freshness(generatedAt: string, now: number): { state: 'fresh' | 'delayed' | 'stale'; label: string; minutes: number } {
  const minutes = Math.round((now - new Date(generatedAt).getTime()) / 60000);
  if (minutes < 45) return { state: 'fresh', label: 'Fresh', minutes };
  if (minutes < 120) return { state: 'delayed', label: 'Delayed', minutes };
  return { state: 'stale', label: 'Stale', minutes };
}

interface YieldDoc { generatedAt: string; today: { day: string; searches: number; returned: number; newIds: number; newCandidates: number; newEligible: number; newFresh: number; runs: number; picks: { explore: number; exploit: number; depth: number } }; families: { family: string; probes: number; searches: number; newIds: number; newEligible: number; eligiblePerSearch: number; newPerSearch: number }[]; probes: { label: string; family: string; runs: number; searches: number; newIds: number; newEligible: number; ewma: number; lastAt?: string; lastPick?: string; lastEligible?: number }[]; history: { day: string; searches: number; newEligible: number; newIds: number; runs: number }[] }
interface BenchDoc { generatedAt?: string; label?: string; recall?: { discovered?: number; total?: number; verified?: number; qualified?: number; inFeed?: number }; misses?: { id: string; title?: string; views?: number; reason?: string }[]; [k: string]: unknown }

export default function Health() {
  const { snapshot, now } = useApp();
  const h = snapshot.health;
  const f = freshness(snapshot.generatedAt, now);
  const [yieldDoc, setYield] = useState<YieldDoc | null>(null);
  const [bench, setBench] = useState<BenchDoc | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/diagnostics/discovery-yield.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' }).then(async (r) => r.ok && setYield((await r.json()) as YieldDoc)).catch(() => undefined);
    fetch(`${import.meta.env.BASE_URL}data/benchmark/latest.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' }).then(async (r) => r.ok && setBench((await r.json()) as BenchDoc)).catch(() => undefined);
  }, []);
  const intel = snapshot.videos;
  const q = intel?.coverage.find((c) => c.platform === 'youtube')?.quota;
  const sc = snapshot.scorecard;
  const okSources = snapshot.sources.filter((s) => s.ok).length;
  const recent = intel ? Math.round(((intel.funnel.discovered || 0) * 0) + 0) : 0;
  void recent;
  return (
    <>
      <Section title="Freshness" sub="Collections are scheduled four times an hour and gated to roughly every 30 minutes; GitHub drops or delays some slots, so the real cadence is measured, not assumed.">
        <div className="tiles five">
          <StatTile v={f.label} k="Data state" s={`${f.minutes} min since the last collection`} cls={f.state === 'fresh' ? 'good' : f.state === 'delayed' ? 'warn' : 'bad'} />
          <StatTile v={h ? fmtAgo(h.lastCollectionAt, now) : fmtAgo(snapshot.generatedAt, now)} k="Last successful collection" s={new Date(h?.lastCollectionAt || snapshot.generatedAt).toLocaleString()} />
          <StatTile v={h?.lastPublishedAt ? fmtAgo(h.lastPublishedAt, now) : '—'} k="Last successful publication" s={h?.lastPublishedAt ? new Date(h.lastPublishedAt).toLocaleString() : 'unknown'} />
          <StatTile v={`${okSources}/${snapshot.sources.length}`} k="Sources OK this run" s={snapshot.sources.filter((s) => !s.ok).map((s) => s.source).join(', ') || 'all live'} cls={okSources === snapshot.sources.length ? 'good' : 'warn'} />
          <StatTile v={h?.last24h.startRate != null ? `${Math.round(h.last24h.startRate * 100)}%` : '—'} k="Collection success (24h)" s={h ? `${h.last24h.collections} collections vs ${h.last24h.expectedSlots} expected · max gap ${h.last24h.maxGapMin ?? '—'} min` : 'measured from the run log'} cls={h?.last24h.startRate != null ? (h.last24h.startRate >= 0.8 ? 'good' : h.last24h.startRate >= 0.5 ? 'warn' : 'bad') : ''} na={h?.last24h.startRate == null} />
        </div>
        {h && (
          <div className="small muted" style={{ marginTop: 10 }}>Schedule <code>{h.schedule}</code> · mean gap {h.last24h.meanGapMin ?? '—'} min · {h.last24h.failures} failed Actions run{h.last24h.failures === 1 ? '' : 's'} in 24h · per-source last success: {h.sources.map((s) => `${s.source} ${s.ok ? '✓' : '✗ ' + (s.error || '').slice(0, 40)}`).join(' · ')}</div>
        )}
        {h?.runs?.length ? (
          <div className="runstrip" title="Last collections: height = items collected; dark = not published">
            {h.runs.slice(-48).map((r) => <span key={r.runId} className={`bar${r.published ? '' : ' off'}`} style={{ height: `${Math.max(8, Math.min(100, (r.items / 2000) * 100))}%` }} title={`${new Date(r.startedAt).toLocaleString()} · ${r.items} items · ${r.durationSec}s · ${r.sourcesOk}/${r.sourcesTotal} sources${r.trigger ? ` · ${r.trigger}` : ''}`} />)}
          </div>
        ) : null}
      </Section>

      {intel && (
        <Section title="Radar health" sub="Counts from the current 30-day index and today's quota ledger.">
          <div className="tiles five">
            <StatTile v={fmtNum(intel.funnel.discovered)} k="Unique videos indexed" s="30-day window" />
            <StatTile v={fmtNum(intel.funnel.verified)} k="Verified videos" s="platform statistics" cls="good" />
            <StatTile v={fmtNum(intel.counts.early_breakout)} k="Genuine breakouts" s="early + delayed, absolute and relative floors" />
            <StatTile v={fmtNum(intel.funnel.qualified)} k="Qualified opportunities" s={`${intel.funnel.inFeed} in the top lists`} />
            <StatTile v={q ? `${fmtNum(q.used)} / ${fmtNum(q.limit)}` : '—'} k="YouTube units today" s={q ? `${q.searches} / ${q.searchLimit} searches` : 'no key'} cls={q && q.used / q.limit > 0.9 ? 'warn' : ''} />
          </div>
          {sc && (
            <div className="small muted" style={{ marginTop: 10 }}>Prediction scorecard: {sc.predictions} predictions, {sc.pending} horizons pending, {sc.evaluated} evaluated{sc.precision['48'] != null ? `, radar precision@48h ${Math.round(sc.precision['48']! * 100)}%` : ' — precision not yet measurable'}; {sc.crossings.observed} observable crossings, {sc.crossings.predictedBefore} predicted before. <a href="#/scorecard">Open the scorecard →</a></div>
          )}
        </Section>
      )}

      <Section title="Discovery yield per source and per search" sub="What each probe family returns per search.list call: new ids (never seen before), new candidates (≥10K views) and new eligible videos (≥500K views, ≤30 days). The scheduler spends more on what yields and keeps 25% for exploration.">
        {yieldDoc ? (
          <>
            <div className="row wrap small" style={{ gap: 14, marginBottom: 10 }}>
              <span>today ({yieldDoc.today.day}): <b className="num">{yieldDoc.today.searches}</b> searches in {yieldDoc.today.runs} runs → <b className="num">{yieldDoc.today.newIds}</b> new ids, <b className="num">{yieldDoc.today.newCandidates}</b> candidates, <b className="num">{yieldDoc.today.newEligible}</b> eligible, {yieldDoc.today.newFresh} under 24h</span>
              <span className="dim">picks: {yieldDoc.today.picks.exploit} exploit · {yieldDoc.today.picks.explore} explore · {yieldDoc.today.picks.depth} depth</span>
              <span className="dim">useful discoveries per search: <b className="num">{yieldDoc.today.searches ? (yieldDoc.today.newEligible / yieldDoc.today.searches).toFixed(2) : '—'}</b></span>
            </div>
            <div className="tablewrap">
              <table className="table">
                <thead><tr><th>family</th><th className="num">probes</th><th className="num">searches</th><th className="num">new ids</th><th className="num">eligible</th><th className="num">eligible / search</th><th className="num">new / search</th></tr></thead>
                <tbody>{yieldDoc.families.map((x) => <tr key={x.family}><td>{x.family}</td><td className="num">{x.probes}</td><td className="num">{x.searches}</td><td className="num">{x.newIds}</td><td className="num">{x.newEligible}</td><td className="num"><b>{x.eligiblePerSearch}</b></td><td className="num">{x.newPerSearch}</td></tr>)}</tbody>
              </table>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="small">All probes ({yieldDoc.probes.length})</summary>
              <div className="tablewrap"><table className="table small"><thead><tr><th>probe</th><th>family</th><th className="num">runs</th><th className="num">searches</th><th className="num">new</th><th className="num">eligible</th><th className="num">yield (ewma)</th><th>last</th></tr></thead><tbody>{yieldDoc.probes.map((p) => <tr key={p.label}><td className="truncate" style={{ maxWidth: 260 }}>{p.label}</td><td>{p.family}</td><td className="num">{p.runs}</td><td className="num">{p.searches}</td><td className="num">{p.newIds}</td><td className="num">{p.newEligible}</td><td className="num">{p.ewma}</td><td className="tiny dim">{p.lastAt ? `${fmtAgo(p.lastAt, now)} (${p.lastPick})` : ''}</td></tr>)}</tbody></table></div>
            </details>
            {yieldDoc.history.length ? <div className="tiny dim" style={{ marginTop: 8 }}>Previous days: {yieldDoc.history.slice(-7).map((d) => `${d.day}: ${d.newEligible} eligible / ${d.searches} searches`).join(' · ')}</div> : null}
          </>
        ) : <div className="small muted">The yield ledger appears after the first adaptive-discovery run.</div>}
      </Section>

      <Section title="Why videos are rejected" sub="The funnel's rejection reasons, aggregated by rule.">
        {intel ? <ul className="reasons small">{Object.entries(intel.funnel.rejections).map(([k, v]) => <li key={k}><b className="num">{fmtNum(v)}</b><span>{k}</span></li>)}</ul> : null}
      </Section>

      <Section title="Failure taxonomy" sub="How a miss is classified when troubleshooting — each class has a different fix.">
        <div className="grid cols-2">
          <div className="card tight"><b>Collection failure</b><div className="small muted">The video was never discovered: no probe, chart, upload check or share surfaced it. Fix: discovery schedule / new probe family. Benchmark field: <code>never discovered</code>.</div></div>
          <div className="card tight"><b>Verification failure</b><div className="small muted">Discovered, but the platform gave no reliable statistics (TikTok/Instagram/Facebook links, deleted or private videos). Fix: a data source, not a ranking change. Benchmark field: <code>discovered but unverified</code>.</div></div>
          <div className="card tight"><b>Classification failure</b><div className="small muted">Verified, but assigned the wrong category or opportunity type (event/meme/format). Fix: taxonomy priors, structural features. Measured by the category-agreement and the microtrend label audit.</div></div>
          <div className="card tight"><b>Ranking failure</b><div className="small muted">Correctly collected and verified, but a rule rejected it or it sat below the list cutoff. Fix: thresholds. Benchmark field: <code>verified but rejected by rule</code> / <code>qualified but below the cutoff</code>.</div></div>
          <div className="card tight"><b>Presentation failure</b><div className="small muted">Qualified, but could not be viewed properly (embed blocked, thumbnail missing, player error). Fix: embed/fallback. Measured by the browser QA playback test, not only the API's embeddable flag.</div></div>
        </div>
        {bench ? <div className="small muted" style={{ marginTop: 10 }}>Latest benchmark{bench.label ? ` (${bench.label})` : ''}{bench.generatedAt ? `, ${fmtAgo(bench.generatedAt, now)}` : ''}: {bench.recall ? `${bench.recall.discovered}/${bench.recall.total} independent references discovered` : 'see docs/BENCHMARK.md'}{bench.misses?.length ? `; ${bench.misses.length} misses listed in docs/BENCHMARK.md` : ''}.</div> : <div className="small muted" style={{ marginTop: 10 }}>Benchmark results live in <code>docs/BENCHMARK.md</code> and <code>data/benchmark/</code>.</div>}
      </Section>
    </>
  );
}
