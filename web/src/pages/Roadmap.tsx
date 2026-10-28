import { useMemo } from 'react';
import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { diversify, difficultyFor, growthLabel, fmtAgo } from '../lib/data';
import { profileFor } from '../../../pipeline/src/intel/taxonomy';
import { advise } from '../lib/advisor';
import type { Trend } from '../lib/types';
import { Section, StageBadge, BasisBadge, ScoreBars } from '../components/ui';

export default function Roadmap() {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const { ranked, now } = app;

  const pool = useMemo(() => ranked.filter((t) => !t.isNewsEvent), [ranked]);
  const strong = pool.filter((t) => t.lifecycle !== 'insufficient_data' && t.lifecycle !== 'cooling');
  const picks = diversify(strong.length ? strong : pool, 5, 2);
  const top = picks[0];
  const alternatives = picks.slice(1, 5);
  const emerging = pool.filter((t) => t.lifecycle === 'emerging' || t.lifecycle === 'accelerating').slice(0, 6);
  const money = [...pool].sort((a, b) => b.scores.monetization - a.scores.monetization || b.scores.momentum - a.scores.momentum).slice(0, 6);
  const easy = [...pool].filter((t) => profileFor(t.category).cost <= 0.4).sort((a, b) => b.scores.opportunity - a.scores.opportunity).slice(0, 6);
  const avoid = ranked.filter((t) => t.lifecycle === 'cooling' || (t.lifecycle === 'peaking' && (t.scores.components.saturation || 0) > 0.3) || t.isNewsEvent).slice(0, 8);

  const Item = ({ t, why }: { t: Trend; why: string }) => {
    const watched = watch.some((w) => w.trendId === t.id);
    return (
      <div className="mini" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <a className="t" href={`#/trend/${encodeURIComponent(t.id)}`}>{t.name.replace(/ \(format\)$/, '')}</a>
          <div className="m">{t.category} · {why}</div>
        </div>
        <button className="btn sm" disabled={watched} onClick={() => { wl.add({ trendId: t.id, name: t.name, category: t.category }); app.toast('Added to watchlist'); }}>{watched ? 'Watching' : 'Watch'}</button>
      </div>
    );
  };

  return (
    <>
      <h1>Content roadmap</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>Your daily opportunity page for {new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}. Built from the current filters and your preferences.</p>

      {top ? (
        <TopPick t={top} now={now} prefs={prefs} onWatch={() => { wl.add({ trendId: top.id, name: top.name, category: top.category, status: 'planning' }); app.toast('Added to watchlist as Planning'); }} watched={watch.some((w) => w.trendId === top.id)} />
      ) : (
        <div className="empty">No supported opportunities in this window yet.</div>
      )}

      <Section title="Four alternatives" sub="Different formats worth considering today.">
        <div className="grid cols-2">
          {alternatives.map((t) => {
            const a = advise(t, prefs);
            return (
              <div className="card" key={t.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">{t.category} › {t.subcategory}</span><StageBadge stage={t.lifecycle} /></div>
                <h3 style={{ margin: '6px 0 4px' }}><a href={`#/trend/${encodeURIComponent(t.id)}`}>{a.concepts[0].title}</a></h3>
                <div className="small muted" style={{ marginBottom: 8 }}>Riding <b>{t.name.replace(/ \(format\)$/, '')}</b> · {a.concepts[0].format} · {difficultyFor(t.category, prefs).label} difficulty</div>
                <p className="small" style={{ marginBottom: 10 }}>{a.concepts[0].pitch}</p>
                <ScoreBars t={t} compact />
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid cols-2 section">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Emerging categories</h2>
          <div className="small muted">New developments worth investigating before they are crowded.</div>
          {emerging.length ? emerging.map((t) => <Item key={t.id} t={t} why={`${growthLabel(t).label} · seen ${fmtAgo(t.lastSeen, now)}`} />) : <div className="empty" style={{ marginTop: 10 }}>Nothing emerging in this window.</div>}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Highest monetization potential</h2>
          <div className="small muted">Promising economic opportunities (category profile × current momentum).</div>
          {money.map((t) => <Item key={t.id} t={t} why={`money ${t.scores.monetization} · momentum ${t.scores.momentum}`} />)}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Easiest to produce</h2>
          <div className="small muted">Low-cost formats with reasonable potential.</div>
          {easy.length ? easy.map((t) => <Item key={t.id} t={t} why={`${difficultyFor(t.category, prefs).label} difficulty · opportunity ${t.scores.opportunity}`} />) : <div className="empty" style={{ marginTop: 10 }}>No low-cost formats in this window.</div>}
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Trends to avoid</h2>
          <div className="small muted">Saturated, declining, or one-off news events — based on current evidence.</div>
          {avoid.length ? avoid.map((t) => (
            <div key={t.id} className="mini">
              <a className="t" href={`#/trend/${encodeURIComponent(t.id)}`}>{t.name.replace(/ \(format\)$/, '')}</a>
              <div className="m">{t.isNewsEvent ? 'News/person event — not a repeatable format' : t.lifecycle === 'cooling' ? `Cooling · ${growthLabel(t).label}` : 'Peaking and saturated — crowded'}</div>
            </div>
          )) : <div className="empty" style={{ marginTop: 10 }}>Nothing to avoid yet.</div>}
        </div>
      </div>
    </>
  );
}

function TopPick({ t, now, prefs, onWatch, watched }: { t: Trend; now: number; prefs: ReturnType<typeof usePrefs>[0]; onWatch: () => void; watched: boolean }) {
  const a = advise(t, prefs);
  const c = a.concepts[0];
  const g = growthLabel(t);
  return (
    <article className="card reco top" style={{ marginTop: 4 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="kicker">Today's top pick · {t.category} › {t.subcategory}</span>
        <span className="row"><StageBadge stage={t.lifecycle} /><BasisBadge t={t} /></span>
      </div>
      <h2 style={{ fontSize: 22 }}><a href={`#/trend/${encodeURIComponent(t.id)}`}>{c.title}</a></h2>
      <p>{c.pitch}</p>
      <dl>
        <dt>Riding</dt><dd><a href={`#/trend/${encodeURIComponent(t.id)}`}>{t.name.replace(/ \(format\)$/, '')}</a></dd>
        <dt>Format</dt><dd>{c.format}</dd>
        <dt>Hook</dt><dd>{c.hook}</dd>
        <dt>Direction</dt><dd>{g.label}</dd>
        <dt>Timing</dt><dd>{a.timing.label} — {a.timing.detail}</dd>
        <dt>Publish on</dt><dd>{a.platforms.platform} <span className="muted">— {a.platforms.why}</span></dd>
        <dt>Money</dt><dd>{a.monetization.slice(0, 2).join(' ')}</dd>
        <dt>Evidence</dt><dd>{t.evidenceCount} items · {t.videoCount} videos · {t.platforms.length} source{t.platforms.length > 1 ? 's' : ''} · updated {fmtAgo(t.lastSeen, now)}</dd>
      </dl>
      <ScoreBars t={t} showConfidence />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" disabled={watched} onClick={onWatch}>{watched ? 'On watchlist' : 'Plan this'}</button>
        <a className="btn primary" href={`#/trend/${encodeURIComponent(t.id)}`}>Ride this trend</a>
      </div>
    </article>
  );
}
