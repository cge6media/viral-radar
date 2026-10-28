import { useMemo } from 'react';
import { useApp } from '../App';
import { STAGE, STAGE_ORDER } from '../lib/types';
import { rollupCategories, fmtAgo } from '../lib/data';
import { Filters, Section, StageBadge } from '../components/ui';
import { HBarChart } from '../components/charts';

export default function Compass() {
  const app = useApp();
  const { ranked, now, snapshot } = app;
  const historyHours = snapshot.stats.earliestObservation ? (now - new Date(snapshot.stats.earliestObservation).getTime()) / 36e5 : 0;
  const byStage = useMemo(() => {
    const m: Record<string, typeof ranked> = {};
    STAGE_ORDER.forEach((s) => (m[s] = []));
    ranked.forEach((t) => (m[t.lifecycle] ||= []).push(t));
    return m;
  }, [ranked]);
  const cats = useMemo(() => rollupCategories(ranked).slice(0, 12), [ranked]);
  const movers = useMemo(() => ranked.filter((t) => t.scores.momentumBasis === 'observed' && t.scores.growth != null).sort((a, b) => (b.scores.growth || 0) - (a.scores.growth || 0)), [ranked]);

  return (
    <>
      <h1>Trend Compass</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>Every trend placed on its lifecycle. Stage is decided from measured growth where we have it, otherwise from recency and breadth (marked provisional).</p>
      <Filters window={app.window} platforms={app.platforms} available={app.availablePlatforms} onWindow={app.setWindow} onPlatforms={app.setPlatforms} historyHours={historyHours} />

      <div className="section compass" role="list">
        {STAGE_ORDER.map((s) => (
          <div key={s} className="col" role="listitem" style={{ ['--stage' as string]: `var(--st-${s})` }}>
            <h3>
              <span>{STAGE[s].glyph} {STAGE[s].label}</span>
              <span className="count">{byStage[s].length}</span>
            </h3>
            <div className="desc">{STAGE[s].desc}</div>
            {byStage[s].slice(0, 12).map((t) => (
              <a key={t.id} className="mini" href={`#/trend/${encodeURIComponent(t.id)}`}>
                <div className="t truncate">{t.name.replace(/ \(format\)$/, '')}</div>
                <div className="m num">{t.category} · M {t.scores.momentum} · C {t.scores.confidence}{t.scores.growth != null && t.scores.momentumBasis === 'observed' ? ` · ${t.scores.growth >= 1 ? '+' : ''}${Math.round((t.scores.growth - 1) * 100)}%` : ''}</div>
              </a>
            ))}
            {byStage[s].length > 12 && <div className="small dim" style={{ marginTop: 6 }}>+{byStage[s].length - 12} more</div>}
            {byStage[s].length === 0 && <div className="small dim">None right now</div>}
          </div>
        ))}
      </div>

      <div className="grid cols-2 section">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Category momentum</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>Mean momentum of each category's top three trends.</div>
          <HBarChart data={cats.map((c) => ({ label: c.category, value: c.momentum, href: `#/categories?c=${encodeURIComponent(c.category)}`, tip: `${c.category}: momentum ${c.momentum} · ${c.trends} trends · ${c.videos} videos` }))} max={100} />
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Biggest measured movers</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>Only trends with two or more measurements. Growth = attention now ÷ attention at the previous measurement.</div>
          {movers.length === 0 ? (
            <div className="empty">No measured growth yet — the first collection run just happened. Movers appear after the next scheduled refresh.</div>
          ) : (
            <div className="ranklist">
              {movers.slice(0, 10).map((t) => (
                <a key={t.id} href={`#/trend/${encodeURIComponent(t.id)}`} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                  <span className="truncate" style={{ minWidth: 0 }}>{t.name.replace(/ \(format\)$/, '')} <span className="small muted">· {t.category}</span></span>
                  <span className="row nowrap">
                    <StageBadge stage={t.lifecycle} />
                    <b className="num" style={{ color: (t.scores.growth || 1) >= 1 ? 'var(--money-ink)' : 'var(--ink-3)' }}>{(t.scores.growth || 1) >= 1 ? '+' : ''}{Math.round(((t.scores.growth || 1) - 1) * 100)}%</b>
                    <span className="small dim num">{t.scores.growthWindowHours ? `${Math.round(t.scores.growthWindowHours)}h` : ''}</span>
                  </span>
                </a>
              ))}
            </div>
          )}
          <div className="small dim" style={{ marginTop: 10 }}>Last refresh {fmtAgo(snapshot.generatedAt, now)}.</div>
        </div>
      </div>
    </>
  );
}
