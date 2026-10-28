import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { usePrefs } from '../lib/store';
import type { VideoIntel } from '../lib/types';
import { STAGE, STAGE_ORDER, WINDOW_LABEL } from '../lib/types';
import { bestThumb, categoryLabelDelta, fmtAgo, isQualified, growthMetricLabel, fmtRatio } from '../lib/data';
import { GradePill, StagePill, Thumb, WindowSwitch } from '../components/ui';
import { HBarChart } from '../components/charts';
import { PLATFORM_NAME } from '../lib/videos';

type Wave = VideoIntel['waves'][number];
const WAVE: Record<string, { label: string; desc: string }> = {
  promising_wave: { label: 'Promising wave', desc: '3+ independent creators with new entrants in the last 48h and no measured decline.' },
  established: { label: 'Established', desc: 'Many creators, flat growth — reliable but not emerging.' },
  crowded: { label: 'Crowded', desc: '30+ creators and weak video performance — saturated.' },
  declining: { label: 'Declining', desc: 'Measured decline or no fresh examples.' },
  insufficient: { label: 'Insufficient', desc: 'Not enough independent creators yet.' },
};

export function WaveCard({ w, now, showSequence }: { w: Wave; now: number; showSequence?: boolean }) {
  const meta = WAVE[w.state];
  return (
    <a className="card wave" href={`#/trend/${encodeURIComponent(w.trendId)}`}>
      <div className="row between"><span className={`pill wave ${w.state}`} title={meta.desc}><i aria-hidden />{meta.label}</span><span className="tiny dim">{w.platforms.map((p) => PLATFORM_NAME[p] || p).join(' · ')}</span></div>
      <h3 style={{ margin: '8px 0 2px' }}>{w.name}</h3>
      <div className="small muted">{w.category} · {w.creators} independent creator{w.creators === 1 ? '' : 's'} · {w.videos} videos{w.newCreators48h ? ` · ${w.newCreators48h} new in 48h` : ''}{w.growth != null ? ` · ${fmtRatio(w.growth)} measured` : ' · growth provisional'}</div>
      {(showSequence || w.platforms.length >= 2) && w.sequence.length > 0 && (
        <ol className="seq">
          {w.sequence.map((s) => <li key={s.platform}><b>{PLATFORM_NAME[s.platform] || s.platform}</b><span className="tiny dim">{fmtAgo(s.at, now)}</span></li>)}
        </ol>
      )}
    </a>
  );
}

export default function Trends() {
  const app = useApp();
  const [prefs] = usePrefs();
  const { ranked, now, snapshot } = app;
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const [tab, setTab] = useState<string>(params.get('tab') || 'waves');
  const [cat, setCat] = useState<string>(params.get('c') || '');
  const [showNews, setShowNews] = useState(false);
  const intel = snapshot.videos;
  const list = useMemo(() => ranked.filter((v) => (showNews || !v.isNewsEvent) && (!cat || v.category === cat)), [ranked, showNews, cat]);
  const byStage = useMemo(() => {
    const m: Record<string, typeof list> = {};
    STAGE_ORDER.forEach((s) => (m[s] = []));
    list.forEach((v) => (m[v.w.lifecycle] ||= []).push(v));
    return m;
  }, [list]);
  const movers = useMemo(() => list.filter((v) => v.w.grade !== 'insufficient' && (v.w.growth.basis === 'measured' || v.w.velocity?.videosMeasured)).sort((a, b) => (b.w.growth.ratio ?? 1) - (a.w.growth.ratio ?? 1)), [list]);
  const categories = snapshot.categories;
  const waves = (intel?.waves || []).filter((w) => !cat || w.category === cat);
  const cross = waves.filter((w) => w.platforms.length >= 2);

  return (
    <>
      <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Trends</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: '64ch' }}>Categories, microtrends and format waves — several independent creators producing similar videos, not one big video. Lifecycle stages come from measured growth where it exists; otherwise they are marked provisional.</p>
        </div>
        <WindowSwitch value={app.window} onChange={app.setWindow} />
      </div>
      <div className="seg" role="tablist" style={{ marginTop: 12 }}>
        {[['waves', 'Waves'], ['compass', 'Lifecycle compass'], ['categories', 'Categories'], ['map', 'Cross-platform map']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div className="chips" style={{ marginTop: 12 }}>
        <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>All categories</button>
        {categories.map((c) => <button key={c.category} className={`chip${cat === c.category ? ' on' : ''}`} onClick={() => setCat(c.category)}>{c.category} <span className="dim">{c.videos7d}</span></button>)}
        {tab === 'compass' && <button className={`chip${showNews ? ' on' : ''}`} onClick={() => setShowNews((s) => !s)}>{showNews ? 'Hiding nothing' : 'News hidden'}</button>}
      </div>

      {tab === 'waves' && (
        <section className="section">
          {waves.length ? <div className="grid cols-3">{waves.map((w) => <WaveCard key={w.trendId} w={w} now={now} />)}</div> : <div className="empty">No format wave with enough independent creators in this category yet.</div>}
        </section>
      )}

      {tab === 'compass' && (
        <>
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
          <div className="card section">
            <h3 style={{ marginBottom: 4 }}>Measured movers</h3>
            <div className="small muted" style={{ marginBottom: 8 }}>Trends with at least early evidence and two or more measurements. Each row says what was measured.</div>
            {movers.length === 0 ? <div className="empty">No measured growth yet in this window — movers appear once a trend with video evidence has been observed twice ≥2h apart.</div> : movers.slice(0, 12).map((v) => (
              <a key={v.id} href={`#/trend/${encodeURIComponent(v.id)}`} className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', alignItems: 'flex-start' }}>
                <span style={{ minWidth: 0, display: 'block' }}>
                  <span className="truncate" style={{ display: 'block', fontWeight: 700 }}>{v.name} <span className="small muted" style={{ fontWeight: 600 }}>· {v.category}</span></span>
                  <span className="tiny dim" style={{ display: 'block', fontWeight: 500, whiteSpace: 'normal' }}>{v.w.growth.basis === 'measured' ? growthMetricLabel(v.w) : 'video velocity vs. lifetime average'}</span>
                </span>
                <span className="row" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <GradePill grade={v.w.grade} />
                  <b className="num" style={{ color: (v.w.growth.ratio ?? 1) >= 1 ? 'var(--money-ink)' : 'var(--ink-3)' }}>{v.w.growth.basis === 'measured' ? fmtRatio(v.w.growth.ratio ?? 1) : `vel ${v.w.videoMomentum}`}</b>
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <section className="section grid cols-2">
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Category activity (7 days)</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>Relevance-checked videos per category; tooltips show the 24h change.</div>
            <HBarChart data={categories.map((c) => ({ label: c.category, value: c.videos7d, tip: `${c.category}: ${c.videos7d} videos / ${c.creators7d} creators in 7d · ${categoryLabelDelta(c).label}`, color: 'var(--money)' }))} valueFmt={(v) => `${Math.round(v)}`} />
          </div>
          <div className="catgrid">
            {categories.map((c) => {
              const d = categoryLabelDelta(c);
              return (
                <button key={c.category} className="cat" onClick={() => { setCat(c.category); setTab('waves'); }}>
                  <div className="n">{c.category}</div>
                  <div className="m">{c.videos7d} videos · {c.creators7d} creators · {c.qualifiedTrends} qualified</div>
                  <div className={`d ${d.dir === 'up' ? 'up' : d.dir === 'down' ? 'down' : ''}`}>{d.label}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'map' && (
        <section className="section">
          <div className="small muted" style={{ marginBottom: 10 }}>Waves with evidence on two or more platforms. The sequence is the earliest verified content per platform; a share's post time is used for platforms without statistics and is labelled as such on the trend page. Unknown order is not invented.</div>
          {cross.length ? <div className="grid cols-2">{cross.map((w) => <WaveCard key={w.trendId} w={w} now={now} showSequence />)}</div> : <div className="empty">No wave has verified evidence on two platforms yet. Direct statistics currently come from {(intel?.coverage || []).filter((c) => c.status === 'direct').map((c) => PLATFORM_NAME[c.platform]).join(' and ') || 'no platform'}.</div>}
        </section>
      )}
      <div className="tiny dim" style={{ marginTop: 16 }}>Window: {WINDOW_LABEL[app.window]} · last refresh {fmtAgo(snapshot.generatedAt, now)}</div>
    </>
  );
}
