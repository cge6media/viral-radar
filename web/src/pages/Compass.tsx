import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { usePrefs } from '../lib/store';
import { STAGE, STAGE_ORDER, WINDOW_LABEL } from '../lib/types';
import { bestThumb, categoryLabelDelta, fmtAgo, isQualified } from '../lib/data';
import { GradePill, Section, StagePill, Thumb, TrendRow, WindowSwitch } from '../components/ui';
import { HBarChart } from '../components/charts';

export default function Compass() {
  const app = useApp();
  const [prefs] = usePrefs();
  const { ranked, now, snapshot } = app;
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const [cat, setCat] = useState<string>(params.get('c') || '');
  const [showNews, setShowNews] = useState(false);
  const list = useMemo(() => ranked.filter((v) => (showNews || !v.isNewsEvent) && (!cat || v.category === cat)), [ranked, showNews, cat]);
  const byStage = useMemo(() => {
    const m: Record<string, typeof list> = {};
    STAGE_ORDER.forEach((s) => (m[s] = []));
    list.forEach((v) => (m[v.w.lifecycle] ||= []).push(v));
    return m;
  }, [list]);
  const movers = useMemo(() => list.filter((v) => v.w.growth.basis === 'measured' || v.w.velocity?.videosMeasured).sort((a, b) => (b.w.growth.ratio ?? 1) - (a.w.growth.ratio ?? 1)), [list]);
  const categories = snapshot.categories;

  return (
    <>
      <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Trend Compass</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: '64ch' }}>Every trend placed on its lifecycle for the {WINDOW_LABEL[app.window].toLowerCase()}. Stages come from measured creator growth and video velocity where we have them; otherwise from recency and corroboration, marked provisional.</p>
        </div>
        <WindowSwitch value={app.window} onChange={app.setWindow} />
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>All categories</button>
        {categories.map((c) => <button key={c.category} className={`chip${cat === c.category ? ' on' : ''}`} onClick={() => setCat(c.category)}>{c.category} <span className="dim">{c.videos7d}</span></button>)}
        <button className={`chip${showNews ? ' on' : ''}`} onClick={() => setShowNews((s) => !s)}>{showNews ? 'Hiding nothing' : 'News hidden'}</button>
      </div>

      <div className="section compass" role="list">
        {STAGE_ORDER.map((s) => (
          <div key={s} className="col" role="listitem" style={{ ['--stage' as string]: `var(--st-${s})` }}>
            <h3><span>{STAGE[s].label}</span><span className="count">{byStage[s].length}</span></h3>
            <div className="desc">{STAGE[s].desc}</div>
            {byStage[s].slice(0, 14).map((v) => {
              const th = bestThumb(v);
              return (
                <a key={v.id} className="mini" href={`#/trend/${encodeURIComponent(v.id)}`}>
                  <Thumb src={th.src} name={v.name} />
                  <div style={{ minWidth: 0 }}>
                    <div className="t truncate">{v.name}</div>
                    <div className="m truncate">{v.category} · M {v.w.momentum} · {v.w.creators} creators{isQualified(v, prefs) ? ' · qualified' : ''}</div>
                  </div>
                </a>
              );
            })}
            {byStage[s].length > 14 && <div className="tiny dim" style={{ marginTop: 6 }}>+{byStage[s].length - 14} more</div>}
            {byStage[s].length === 0 && <div className="tiny dim">None right now</div>}
          </div>
        ))}
      </div>

      <div className="grid cols-2 section">
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Measured movers</h3>
          <div className="small muted" style={{ marginBottom: 8 }}>Only trends with two or more measurements. Ratio = independent creators now ÷ at the previous measurement (or video velocity vs. lifetime average).</div>
          {movers.length === 0 ? <div className="empty">No measured growth yet in this window — movers appear once a trend has been observed twice ≥2h apart.</div> : movers.slice(0, 10).map((v) => (
            <a key={v.id} href={`#/trend/${encodeURIComponent(v.id)}`} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span className="truncate" style={{ minWidth: 0, fontWeight: 700 }}>{v.name} <span className="small muted" style={{ fontWeight: 600 }}>· {v.category}</span></span>
              <span className="row" style={{ whiteSpace: 'nowrap' }}>
                <GradePill grade={v.w.grade} />
                <b className="num" style={{ color: (v.w.growth.ratio ?? 1) >= 1 ? 'var(--money-ink)' : 'var(--ink-3)' }}>{v.w.growth.basis === 'measured' ? `${(v.w.growth.ratio ?? 1) >= 1 ? '+' : ''}${Math.round(((v.w.growth.ratio ?? 1) - 1) * 100)}%` : `vel ${v.w.videoMomentum}`}</b>
              </span>
            </a>
          ))}
          <div className="tiny dim" style={{ marginTop: 10 }}>Last refresh {fmtAgo(snapshot.generatedAt, now)}.</div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Category activity (7 days)</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>Relevance-checked videos per category; tooltips show the 24h change.</div>
          <HBarChart data={categories.map((c) => ({ label: c.category, value: c.videos7d, tip: `${c.category}: ${c.videos7d} videos / ${c.creators7d} creators in 7d · ${categoryLabelDelta(c).label}`, color: 'var(--money)' }))} valueFmt={(v) => `${Math.round(v)}`} />
        </div>
      </div>

      {cat && (
        <Section title={cat} sub={`${list.length} trends in this window.`}>
          <div className="card tight">{list.map((v, i) => <TrendRow key={v.id} v={v} now={now} n={i + 1} />)}</div>
        </Section>
      )}
    </>
  );
}
