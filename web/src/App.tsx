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
import { PlayerProvider } from './components/video';

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

const NAV = [
  ['#/', 'Discover', Icon.radar],
  ['#/viral', 'Viral Now', Icon.fire],
  ['#/radar', 'Early Radar', Icon.pulse],
  ['#/trends', 'Trends', Icon.compass],
  ['#/money', 'Money', Icon.money],
  ['#/studio', 'Studio', Icon.studio],
  ['#/hall-of-fame', 'Hall of Fame', Icon.trophy],
  ['#/watchlist', 'Watchlist', Icon.bookmark],
] as const;
/** phone tab bar: four primary tabs + More */
const TABS = NAV.slice(0, 4);
const MORE = NAV.slice(4);

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

  const ageH = snapshot ? (now - new Date(snapshot.generatedAt).getTime()) / 36e5 : 0;
  const okSources = snapshot ? snapshot.sources.filter((s) => s.ok).length : 0;

  const page = (() => {
    if (!state) return null;
    const m = hash.match(/^#\/trend\/(.+)$/);
    if (m) return <TrendDetail id={decodeURIComponent(m[1])} />;
    switch (hash.replace(/\?.*$/, '')) {
      case '#/viral': return <ViralNow />;
      case '#/radar': return <EarlyRadar />;
      case '#/trends': case '#/compass': return <Trends />;
      case '#/money': return <Money />;
      case '#/studio': return <Studio />;
      case '#/hall-of-fame': return <HallOfFame />;
      case '#/watchlist': return <Watchlist />;
      case '#/settings': case '#/diagnostics': return <Settings />;
      default: return <Discover />;
    }
  })();
  const isActive = (href: string) => (href === '#/' ? hash === '#/' || hash === '' || hash.startsWith('#/trend/') : href === '#/trends' ? hash.startsWith('#/trends') || hash.startsWith('#/compass') : hash.startsWith(href));
  const moreActive = MORE.some(([href]) => isActive(href)) || hash.startsWith('#/settings') || hash.startsWith('#/diagnostics');
  const [sheet, setSheet] = useState(false);
  useEffect(() => setSheet(false), [hash]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/"><span style={{ color: 'var(--accent-ink)', display: 'inline-flex' }}>{Icon.radar}</span>Viral Radar</a>
          <nav className="topnav" aria-label="Sections">
            {NAV.map(([href, label]) => <a key={href} href={href} className={isActive(href) ? 'active' : ''}>{label}</a>)}
          </nav>
          <div className="right">
            {snapshot && (
              <span className={`fresh${ageH > 2 ? ' stale' : ''}${okSources === 0 ? ' bad' : ''}`} title={snapshot.generatedAt}><i aria-hidden />Updated {fmtAgo(snapshot.generatedAt, now)}</span>
            )}
            <button className="iconbtn" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{Icon.gear}</button>
          </div>
        </div>
        {menu && (
          <div className="menu" role="menu">
            <a href="#/settings?tab=coverage" role="menuitem">Source coverage & diagnostics</a>
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
        {TABS.map(([href, label, icon]) => <a key={href} href={href} className={isActive(href) ? 'active' : ''}>{icon}{label.replace('Early ', '').replace(' Now', '')}</a>)}
        <button className={moreActive ? 'active' : ''} onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>{Icon.more}More</button>
      </nav>
      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(false)} role="presentation">
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {MORE.map(([href, label, icon]) => <a key={href} href={href} role="menuitem" className={isActive(href) ? 'active' : ''}>{icon}{label}</a>)}
            <a href="#/settings?tab=coverage" role="menuitem" className={hash.startsWith('#/settings') ? 'active' : ''}>{Icon.gear}Diagnostics & settings</a>
          </div>
        </div>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
