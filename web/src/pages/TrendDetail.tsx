import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { advise } from '../lib/advisor';
import { fmtAgo, growthLabel } from '../lib/data';
import { PLATFORM_LABEL, KIND_LABEL } from '../lib/types';
import { StageBadge, BasisBadge, ScoreBars, EvidenceList, Section } from '../components/ui';
import { Sparkline } from '../components/charts';
import { ProfileTable } from './Categories';

export default function TrendDetail({ id }: { id: string }) {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const t = app.all.find((x) => x.id === id);
  if (!t) return <div className="empty">This trend isn't in the current dataset (it may have aged out). <a href="#/">Back to dashboard</a></div>;
  const a = advise(t, prefs);
  const g = growthLabel(t);
  const watched = watch.find((w) => w.trendId === t.id);
  const s = t.scores;
  const c = s.components;
  const pct = (v?: number) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  return (
    <>
      <a className="small muted" href="#/">← Dashboard</a>
      <div className="detail-head" style={{ marginTop: 8 }}>
        <div className="row wrap">
          <span className="small muted">{t.category} › {t.subcategory} › <b className="muted">{t.microtrend}</b></span>
        </div>
        <h1>{t.name.replace(/ \(format\)$/, '')}</h1>
        <div className="row wrap">
          <StageBadge stage={t.lifecycle} />
          <BasisBadge t={t} />
          {t.evidenceKinds.map((k) => <span key={k} className="badge kind">{KIND_LABEL[k]}</span>)}
          {t.isNewsEvent && <span className="badge news">News / person event</span>}
          <span className="small muted num">first seen {fmtAgo(t.firstSeen, app.now)} · updated {fmtAgo(t.lastSeen, app.now)}</span>
        </div>
        <div className="card">
          <div className="grid cols-2" style={{ alignItems: 'center' }}>
            <ScoreBars t={t} showConfidence />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="small muted">Momentum across runs ({t.series.length} point{t.series.length === 1 ? '' : 's'})</div>
                <div className="num" style={{ fontSize: 15 }}>{g.label}</div>
              </div>
              <Sparkline points={t.series.map((p) => ({ t: p.t, v: p.momentum }))} width={160} height={40} />
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" disabled={!!watched} onClick={() => { wl.add({ trendId: t.id, name: t.name, category: t.category }); app.toast('Added to watchlist'); }}>{watched ? `On watchlist · ${watched.status}` : 'Add to watchlist'}</button>
            <a className="btn primary" href="#ride">Ride this trend ↓</a>
          </div>
        </div>
      </div>

      <Section title="Evidence" sub={`${t.evidenceCount} items from ${t.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')} · ${t.videoCount} actual videos. Open any item at its source.`}>
        <EvidenceList t={t} now={app.now} max={14} />
        {t.evidence.every((e) => e.kind !== 'video') && <div className="notice warn" style={{ marginTop: 10 }}>Evidence comes from search interest / social posts only — no verified video performance yet.</div>}
      </Section>

      <Section title="Ride this trend" sub="Plain-language advice derived from the evidence above and your preferences.">
        <div id="ride" className="grid cols-2">
          <div className="card stack">
            <h3>What it is</h3>
            <p className="small">{a.what}</p>
            <h3>Why it may be growing</h3>
            <ul className="explain">{a.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <h3>What successful examples share</h3>
            <ul className="explain">{a.characteristics.map((w) => <li key={w}>{w}</li>)}</ul>
            <h3>Early or saturated?</h3>
            <p className="small"><b>{a.timing.label}.</b> {a.timing.detail}</p>
            {a.cautions.length > 0 && (<><h3>Cautions</h3><ul className="explain">{a.cautions.map((w) => <li key={w}>{w}</li>)}</ul></>)}
          </div>
          <div className="card stack">
            <h3>Three original concepts</h3>
            {a.concepts.map((cpt) => (
              <div className="concept" key={cpt.title}>
                <h4>{cpt.title}</h4>
                <div className="small muted">{cpt.format}</div>
                <p className="small" style={{ marginTop: 6 }}>{cpt.pitch}</p>
                <div className="small" style={{ marginTop: 6 }}><b>Hook:</b> {cpt.hook} · <b>Repeatable:</b> {cpt.repeatable}</div>
                <div style={{ marginTop: 6 }}><button className="btn sm" onClick={() => { wl.add({ trendId: t.id, name: t.name, category: t.category, status: 'planning', concept: cpt.title, notes: cpt.title }); app.toast('Saved to watchlist as Planning'); }}>Plan this concept</button></div>
              </div>
            ))}
            <h3>Where to publish</h3>
            <p className="small"><b>{a.platforms.platform}</b> — {a.platforms.why}</p>
            <h3>How it makes money</h3>
            <ul className="explain">{a.monetization.map((w) => <li key={w}>{w}</li>)}</ul>
            <p className="small"><b>Production difficulty:</b> {a.difficulty.label} — {a.difficulty.why}</p>
          </div>
        </div>
      </Section>

      <Section title="How the scores were calculated" sub="Transparent components; no invented growth. Details in SCORING.md.">
        <div className="grid cols-2">
          <div className="card">
            <dl className="kv">
              <dt>Momentum basis</dt><dd>{s.momentumBasis === 'observed' ? `Measured (${s.growth?.toFixed(2)}× over ${s.growthWindowHours}h)` : 'Provisional — first measurement'}</dd>
              <dt>Recency</dt><dd className="num">{pct(c.recency)}</dd>
              <dt>Growth</dt><dd className="num">{pct(c.growth)} <span className="muted">(50% = flat)</span></dd>
              <dt>Acceleration</dt><dd className="num">{pct(c.acceleration)} <span className="muted">(50% = steady)</span></dd>
              <dt>Breadth</dt><dd className="num">{pct(c.breadth)} <span className="muted">({c.sources} source{c.sources === 1 ? '' : 's'}, {c.evidence} items)</span></dd>
              <dt>Attention level</dt><dd className="num">{pct(c.level)}</dd>
              <dt>Saturation</dt><dd className="num">{pct(c.saturation)}</dd>
              <dt>Videos with stats</dt><dd className="num">{c.videosWithStats}</dd>
              <dt>Runs observed</dt><dd className="num">{c.runsObserved}</dd>
            </dl>
            <ul className="explain" style={{ marginTop: 10 }}>{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 6 }}>Category monetization profile — {t.category}</h3>
            <ProfileTable category={t.category} />
            <div className="small muted" style={{ marginTop: 8 }}>Keywords: {t.keywords.join(', ')}</div>
          </div>
        </div>
      </Section>
    </>
  );
}
