import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { rollupCategories, profileScore } from '../lib/data';
import { CATEGORIES, profileFor } from '../../../pipeline/src/intel/taxonomy';
import { STAGE, STAGE_ORDER } from '../lib/types';
import { Section, StageBadge, TrendRow } from '../components/ui';
import { HBarChart } from '../components/charts';

export default function Categories() {
  const { ranked, now } = useApp();
  const initial = new URLSearchParams(location.hash.split('?')[1] || '').get('c') || '';
  const [sel, setSel] = useState<string>(initial);
  const rollups = useMemo(() => rollupCategories(ranked), [ranked]);
  const selected = rollups.find((r) => r.category === sel);
  const inCat = ranked.filter((t) => t.category === sel);
  const subs = useMemo(() => {
    const m = new Map<string, number>();
    inCat.forEach((t) => m.set(t.subcategory, (m.get(t.subcategory) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [inCat]);

  return (
    <>
      <h1>Viral categories</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>Parent category → subcategory → microtrend. Categories evolve: microtrends are discovered from the data, not hard-coded.</p>

      <div className="grid cols-2">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Momentum by category</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>Tap a bar to drill in.</div>
          <HBarChart data={rollups.map((c) => ({ label: c.category, value: c.momentum, tip: `${c.category}: ${c.trends} trends · ${c.evidence} items · ${c.videos} videos` }))} max={100} />
          <div className="chips" style={{ marginTop: 10 }}>
            <button className={`chip${!sel ? ' on' : ''}`} onClick={() => setSel('')}>All</button>
            {rollups.map((c) => (
              <button key={c.category} className={`chip${sel === c.category ? ' on' : ''}`} onClick={() => setSel(c.category)}>{c.category} <span className="dim">{c.trends}</span></button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Monetization profile by category</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>Editorial ratings (0–100) from advertiser suitability, sponsorship, affiliate, longevity, demand and cost. Full table in the Money Engine.</div>
          <HBarChart data={[...CATEGORIES].map((c) => ({ label: c.name, value: Math.round(profileScore(c.name)), color: 'var(--money)' })).sort((a, b) => b.value - a.value)} max={100} />
        </div>
      </div>

      {sel && selected ? (
        <Section title={sel} sub={`${selected.trends} trends · ${selected.evidence} evidence items · ${selected.videos} videos`}>
          <div className="grid cols-2" style={{ marginBottom: 12 }}>
            <div className="card tight">
              <h3 style={{ marginBottom: 6 }}>Subcategories active now</h3>
              <div className="chips">{subs.map(([s, n]) => <span key={s} className="chip">{s} <span className="dim">{n}</span></span>)}</div>
              <div className="hr" />
              <h3 style={{ marginBottom: 6 }}>Lifecycle mix</h3>
              <div className="chips">{STAGE_ORDER.filter((s) => selected.stages[s]).map((s) => <span key={s} className="row small"><StageBadge stage={s} /> {selected.stages[s]}</span>)}</div>
            </div>
            <div className="card tight">
              <h3 style={{ marginBottom: 6 }}>Monetization profile</h3>
              <ProfileTable category={sel} />
            </div>
          </div>
          <div className="card tight">
            <div className="ranklist">{inCat.map((t, i) => <TrendRow key={t.id} t={t} n={i + 1} now={now} />)}</div>
          </div>
        </Section>
      ) : (
        <Section title="All categories" sub="Each row is a category with its strongest microtrend right now.">
          <div className="card tight table-wrap">
            <table className="data">
              <thead><tr><th>Category</th><th>Top microtrend</th><th>Stage</th><th className="r">Trends</th><th className="r">Videos</th><th className="r">Momentum</th><th className="r">Money</th></tr></thead>
              <tbody>
                {rollups.map((c) => (
                  <tr key={c.category}>
                    <td><button className="btn ghost sm" style={{ padding: 0 }} onClick={() => setSel(c.category)}>{c.category}</button></td>
                    <td>{c.topTrend ? <a href={`#/trend/${encodeURIComponent(c.topTrend.id)}`}>{c.topTrend.name.replace(/ \(format\)$/, '')}</a> : '—'} <span className="small muted">{c.topTrend ? `› ${c.topTrend.subcategory}` : ''}</span></td>
                    <td>{c.topTrend && <StageBadge stage={c.topTrend.lifecycle} />}</td>
                    <td className="r">{c.trends}</td><td className="r">{c.videos}</td><td className="r">{c.momentum}</td><td className="r">{c.monetization}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      <div className="small dim" style={{ marginTop: 14 }}>Stages: {STAGE_ORDER.map((s) => `${STAGE[s].glyph} ${STAGE[s].label}`).join(' · ')}</div>
    </>
  );
}

export function ProfileTable({ category }: { category: string }) {
  const p = profileFor(category);
  const rows: [string, number, string][] = [
    ['Advertiser suitability', p.advertiser, 'brand safety / ad fill'],
    ['Sponsorship potential', p.sponsorship, 'brand-deal demand'],
    ['Affiliate opportunity', p.affiliate, 'product-link fit'],
    ['Repeatability', p.repeatable, 'can you make it weekly?'],
    ['Content longevity', p.longevity, 'evergreen vs. one-day'],
    ['Audience demand', p.demand, 'baseline appetite'],
    ['Production cost', p.cost, 'higher = more expensive'],
  ];
  return (
    <table className="data small">
      <tbody>
        {rows.map(([k, v, why]) => (
          <tr key={k}><td>{k} <span className="dim">· {why}</span></td><td className="r" style={{ width: 120 }}>
            <div className="score money" style={{ ['--c' as string]: k === 'Production cost' ? 'var(--ink-3)' : 'var(--money)' }}><div className="bar"><i style={{ width: `${Math.round(v * 100)}%` }} /></div></div>
          </td><td className="r num" style={{ width: 40 }}>{Math.round(v * 100)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
