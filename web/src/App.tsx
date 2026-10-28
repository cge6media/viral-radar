import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Snapshot, Window } from './lib/types';
import { loadSnapshot, fmtAgo, rankView, type ViewTrend } from './lib/data';
import { usePrefs } from './lib/store';
import { Icon } from './components/ui';
import Discover from './pages/Discover';
import ViralNow from './pages/ViralNow';
import EarlyRadar from './pages/EarlyRadar';
import Trends from './pages/Trends';
import Money from './pages/Money';
import Studio from './pages/Studio';
import HallOfFame from './pages/HallOfFame';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import TrendDetail from './pages/TrendDetail';
import Desk from './pages/Desk';
import ScorecardPage from './pages/Scorecard';
import Alerts, { useAlertState } from './pages/Alerts';
import { PlayerProvider } from './components/video';
import { freshness } from './components/health';

export interface AppState {
  snapshot: Snapshot;
  now: number;
  window: Window;
  setWindow: (w: Window) => void;
  /** every trend viewed through the current window, personalised and ranked (qualified first) */
  ranked: ViewTrend[];
  reload: () => void;
  toast: (msg: string) => void;
}
const Ctx = createContext<AppState | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('no app context');
  return c;
};

/** primary navigation (five items) + a grouped "More" menu, so the header is not eight equal tabs */
const NAV = [
  ['#/', 'Discover', Icon.radar],
  ['#/viral', 'Viral Now', Icon.fire],
  ['#/radar', 'Early Radar', Icon.pulse],
  ['#/desk', 'Creator Desk', Icon.studio],
  ['#/trends', 'Trends', Icon.compass],
] as const;
const MORE = [
  ['#/money', 'Money', Icon.money],
  ['#/watchlist', 'Journal', Icon.bookmark],
  ['#/alerts', 'Alerts', Icon.bell],
  ['#/scorecard', 'Scorecard', Icon.target],
  ['#/hall-of-fame', 'Hall of Fame', Icon.trophy],
  ['#/studio', 'Studio (concepts)', Icon.studio],
] as const;
/** phone tab bar: four primary tabs + More */
const TABS = NAV.slice(0, 4);

function useHash(): string {
  const [h, setH] = useState(() => location.hash || '#/');
  useEffect(() => {
    const on = () => setH(location.hash || '#/');
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return h;
}

export default function App() {
  const hash = useHash();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [win, setWindow] = useState<Window>(() => {
    try { return (localStorage.getItem('vr.window') as Window) || '48h'; } catch { return '48h'; }
  });
  const [prefs] = usePrefs();
  const [toastMsg, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadSnapshot().then((s) => alive && (setSnapshot(s), setNow(Date.now()))).catch((e) => alive && setError((e as Error).message));
    return () => { alive = false; };
  }, [version]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!toastMsg) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toastMsg]);
  useEffect(() => { scrollTo({ top: 0 }); setMenu(false); }, [hash]);
  useEffect(() => { try { localStorage.setItem('vr.window', win); } catch { /* ignore */ } }, [win]);

  const v2 = snapshot?.version === 2;
  const state = useMemo<AppState | null>(() => {
    if (!snapshot || !v2) return null;
    return { snapshot, now, window: win, setWindow, ranked: rankView(snapshot.trends, win, prefs, now), reload: () => setVersion((v) => v + 1), toast: (m) => setToast(m) };
  }, [snapshot, v2, now, win, prefs]);

  const fresh = snapshot ? freshness(snapshot.generatedAt, now) : null;
  const okSources = snapshot ? snapshot.sources.filter((s) => s.ok).length : 0;
  const { unseen } = useAlertState(snapshot?.alerts || []);

  const page = (() => {
    if (!state) return null;
    const m = hash.match(/^#\/trend\/(.+)$/);
    if (m) { let id = m[1]; try { id = decodeURIComponent(m[1]); } catch { /* malformed hash → use it raw */ } return <TrendDetail id={id} />; }
    switch (hash.replace(/\?.*$/, '')) {
      case '#/viral': return <ViralNow />;
      case '#/radar': return <EarlyRadar />;
      case '#/trends': case '#/compass': return <Trends />;
      case '#/money': return <Money />;
      case '#/studio': return <Studio />;
      case '#/desk': return <Desk />;
      case '#/scorecard': return <ScorecardPage />;
      case '#/alerts': return <Alerts />;
      case '#/hall-of-fame': return <HallOfFame />;
      case '#/watchlist': case '#/journal': return <Watchlist />;
      case '#/settings': case '#/diagnostics': case '#/health': return <Settings key={hash} />;
      default: return <Discover />;
    }
  })();
  const isActive = (href: string) => (href === '#/' ? hash === '#/' || hash === '' || hash.startsWith('#/trend/') : href === '#/trends' ? hash.startsWith('#/trends') || hash.startsWith('#/compass') : hash.startsWith(href));
  const moreActive = MORE.some(([href]) => isActive(href)) || hash.startsWith('#/settings') || hash.startsWith('#/diagnostics') || hash.startsWith('#/health');
  const [sheet, setSheet] = useState(false);
  useEffect(() => setSheet(false), [hash]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/"><span style={{ color: 'var(--accent-ink)', display: 'inline-flex' }}>{Icon.radar}</span>Viral Radar</a>
          <nav className="topnav" aria-label="Sections">
            {NAV.map(([href, label]) => <a key={href} href={href} className={isActive(href) ? 'active' : ''}>{label}</a>)}
            <button className={`navmore${moreActive ? ' active' : ''}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>More ▾</button>
          </nav>
          <div className="right">
            <a className={`bell${unseen.length ? ' has' : ''}`} href="#/alerts" aria-label={`Alerts, ${unseen.length} new`} title={`${unseen.length} new alert${unseen.length === 1 ? '' : 's'} since your last visit`}>{Icon.bell}{unseen.length > 0 && <span className="num">{unseen.length > 99 ? '99+' : unseen.length}</span>}</a>
            {snapshot && fresh && (
              <a href="#/settings?tab=health" className={`fresh ${fresh.state}${okSources === 0 ? ' bad' : ''}`} title={`${fresh.label}: last collection ${snapshot.generatedAt} (${fresh.minutes} min ago). Collections are scheduled every ~30 min; "delayed" and "stale" are measured states, never hidden.`}><i aria-hidden />{fresh.label} · {fmtAgo(snapshot.generatedAt, now)}</a>
            )}
            <button className="iconbtn" aria-label="Settings" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{Icon.gear}</button>
          </div>
        </div>
        {menu && (
          <div className="menu" role="menu">
            {MORE.map(([href, label]) => <a key={href} href={href} role="menuitem">{label}</a>)}
            <div className="hr" />
            <a href="#/settings?tab=health" role="menuitem">Radar health & freshness</a>
            <a href="#/settings?tab=coverage" role="menuitem">Source coverage</a>
            <a href="#/settings?tab=funnel" role="menuitem">Discovery funnel</a>
            <a href="#/settings?tab=data" role="menuitem">Data & quality checks</a>
            <a href="#/settings?tab=prefs" role="menuitem">Preferences</a>
            <a href="#/settings?tab=about" role="menuitem">How scores work</a>
            <button role="menuitem" onClick={() => { setVersion((v) => v + 1); setToast('Reloading latest data'); setMenu(false); }}>Reload data</button>
          </div>
        )}
      </header>
      <main className="main">
        {error && <div className="notice bad">Couldn't load the latest data: {error}. The collector may not have run yet.</div>}
        {!snapshot && !error && <div className="skeleton" style={{ minHeight: 320 }} aria-busy />}
        {snapshot && !v2 && (
          <div className="notice warn">The first Viral Radar collection is in progress. This page will show the new intelligence as soon as the cloud collector publishes it (usually within a few minutes). <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setVersion((v) => v + 1)}>Check again</button></div>
        )}
        {state && <Ctx.Provider value={state}><PlayerProvider>{page}</PlayerProvider></Ctx.Provider>}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map(([href, label, icon]) => <a key={href} href={href} className={isActive(href) ? 'active' : ''}>{icon}{label.replace('Early ', '').replace(' Now', '').replace('Creator ', '')}</a>)}
        <button className={moreActive ? 'active' : ''} onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>{Icon.more}More</button>
      </nav>
      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(false)} role="presentation">
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {[NAV[4], ...MORE].map(([href, label, icon]) => <a key={href} href={href} role="menuitem" className={isActive(href) ? 'active' : ''}>{icon}{label}{href === '#/alerts' && unseen.length ? <span className="pill measured" style={{ marginLeft: 'auto' }}>{unseen.length} new</span> : null}</a>)}
            <a href="#/settings?tab=health" role="menuitem" className={hash.startsWith('#/settings') ? 'active' : ''}>{Icon.gear}Health, diagnostics & settings</a>
          </div>
        </div>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
