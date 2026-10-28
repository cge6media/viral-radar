import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { isQualified, diversify, personalize, viewFor } from '../lib/data';
import { advise } from '../lib/studio';
import { GradePill, KindPill, Section, StagePill, Thumb, WindowSwitch } from '../components/ui';
import { bestThumb } from '../lib/data';
import { WINDOW_LABEL } from '../lib/types';

export default function Studio() {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const qualified = useMemo(() => diversify(app.ranked.filter((v) => isQualified(v, prefs)), 12, 3), [app.ranked, prefs]);
  const [sel, setSel] = useState<string>('');
  const chosen = useMemo(() => {
    const t = app.snapshot.trends.find((x) => x.id === (sel || qualified[0]?.id));
    return t ? personalize(viewFor(t, app.window, app.now), prefs) : undefined;
  }, [sel, qualified, app.snapshot.trends, app.window, app.now, prefs]);
  const adv = chosen ? advise(chosen, chosen.w, prefs) : undefined;
  const queue = watch.filter((w) => w.concept);

  return (
    <>
      <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>Content Studio</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: '64ch' }}>Turn a qualified trend into a specific video idea. Concepts are derived from the trend's evidence and your tools — original characters, structure and hooks, not generic advice.</p>
        </div>
        <WindowSwitch value={app.window} onChange={app.setWindow} />
      </div>

      <Section title="Pick a trend" sub={`Qualified opportunities in the ${WINDOW_LABEL[app.window].toLowerCase()}.`}>
        {qualified.length ? (
          <div className="chips">
            {qualified.map((v) => <button key={v.id} className={`chip${(chosen?.id === v.id) ? ' on' : ''}`} onClick={() => setSel(v.id)}>{v.name}</button>)}
          </div>
        ) : <div className="empty">No qualified trends in this window. Widen the window or check back after the next collection.</div>}
      </Section>

      {chosen && adv && (
        <Section title={`Turn “${chosen.name}” into a video idea`} sub={chosen.summary} more="Open the trend" moreHref={`#/trend/${encodeURIComponent(chosen.id)}`}>
          <div className="grid cols-3" style={{ marginBottom: 12 }}>
            <a className="card" href={`#/trend/${encodeURIComponent(chosen.id)}`} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12, alignItems: 'center' }}>
              <Thumb src={bestThumb(chosen).src} name={chosen.name} />
              <div style={{ minWidth: 0 }}>
                <div className="row wrap" style={{ gap: 6 }}><KindPill kind={chosen.kind} /><StagePill stage={chosen.w.lifecycle} /><GradePill grade={chosen.w.grade} /></div>
                <div className="small muted" style={{ marginTop: 6 }}>{chosen.category} · {chosen.w.creators} creators · momentum {chosen.w.momentum}</div>
              </div>
            </a>
            <div className="card"><h3>Timing: {adv.timing.label}</h3><p className="small" style={{ marginTop: 6 }}>{adv.timing.detail}</p></div>
            <div className="card"><h3>Publish on</h3><p className="small" style={{ marginTop: 6 }}><b>{adv.platforms.platform}</b> — {adv.platforms.why}. Difficulty {adv.difficulty.label}.</p></div>
          </div>
          <div className="grid cols-3">
            {adv.concepts.map((c) => {
              const saved = watch.find((w) => w.trendId === chosen.id && w.concept?.title === c.title);
              return (
                <div className="card" key={c.title} style={{ borderLeft: '3px solid var(--creator)' }}>
                  <h3 style={{ marginBottom: 6 }}>{c.title}</h3>
                  <p className="small" style={{ marginBottom: 10 }}>{c.hook}</p>
                  <dl className="kv">
                    <dt>Opening</dt><dd>{c.opening}</dd>
                    <dt>Structure</dt><dd>{c.structure.join(' → ')}</dd>
                    <dt>Length</dt><dd>{c.length}</dd>
                    <dt>Approach</dt><dd>{c.approach}</dd>
                    <dt>Platform</dt><dd>{c.platform}</dd>
                    <dt>Difficulty</dt><dd>{c.difficulty}</dd>
                    <dt>Budget</dt><dd>{c.budget}</dd>
                    <dt>Money</dt><dd>{c.monetization}</dd>
                  </dl>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn sm primary" disabled={!!saved} onClick={() => { if (watch.some((w) => w.trendId === chosen.id)) wl.update(chosen.id, { concept: c, status: 'selected' }); else wl.add({ trendId: chosen.id, name: chosen.name, category: chosen.category, status: 'selected', concept: c, formatType: chosen.opportunity?.type }); app.toast('Saved to production queue'); }}>{saved ? 'In production queue' : 'Save to production queue'}</button>
                  </div>
                </div>
              );
            })}
          </div>
          {adv.cautions.length > 0 && <div className="notice warn" style={{ marginTop: 12 }}>{adv.cautions.join(' ')}</div>}
        </Section>
      )}

      <Section title="Production queue" sub="Concepts you saved, with their status. Track actual results on the Watchlist." more="Open watchlist" moreHref="#/watchlist">
        {queue.length ? (
          <div className="grid cols-2">
            {queue.map((q) => (
              <div className="card" key={q.trendId}>
                <div className="row between"><span className="pill kind">{q.status}</span><a className="small muted" href={`#/trend/${encodeURIComponent(q.trendId)}`}>{q.name}</a></div>
                <h3 style={{ margin: '8px 0 4px' }}>{q.concept!.title}</h3>
                <p className="small muted">{q.concept!.hook}</p>
                <div className="tiny dim" style={{ marginTop: 6 }}>{q.concept!.length} · {q.concept!.platform} · {q.concept!.budget}</div>
              </div>
            ))}
          </div>
        ) : <div className="empty">Nothing in the queue yet. Save a concept above or from any trend page.</div>}
      </Section>
    </>
  );
}
