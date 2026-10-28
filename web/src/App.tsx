import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Snapshot, Window } from './lib/types';
import { loadSnapshot, fmtAgo, rankView, type ViewTrend } from './lib/data';
import { usePrefs } from './lib/store';
import { Icon } from './components/ui';
import Discover from './pages/Discover';
import Compass from './pages/Compass';
import Money from './pages/Money';
import Studio from './pages/Studio';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import TrendDetail from './pages/TrendDetail';

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
  ['#/compass', 'Compass', Icon.compass],
  ['#/money', 'Money', Icon.money],
  ['#/studio', 'Studio', Icon.studio],
  ['#/watchlist', 'Watchlist', Icon.bookmark],
] as const;

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
      case '#/compass': return <Compass />;
      case '#/money': return <Money />;
      case '#/studio': return <Studio />;
      case '#/watchlist': return <Watchlist />;
      case '#/settings': return <Settings />;
      default: return <Discover />;
    }
  })();
  const isActive = (href: string) => (href === '#/' ? hash === '#/' || hash === '' || hash.startsWith('#/trend/') : hash.startsWith(href));

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
            <a href="#/settings" role="menuitem">Preferences</a>
            <a href="#/settings?tab=data" role="menuitem">Data sources & quality</a>
            <a href="#/settings?tab=about" role="menuitem">How scores work</a>
            <button role="menuitem" onClick={() => { setVersion((v) => v + 1); setToast('Reloading latest data'); setMenu(false); }}>Reload data</button>
          </div>
        )}
      </header>
      <main className="main">
        {error && <div className="notice bad">Couldn't load the latest data: {error}. The collector may not have run yet.</div>}
        {!snapshot && !error && <div className="skeleton" style={{ minHeight: 320 }} aria-busy />}
        {snapshot && !v2 && (
          <div className="notice warn">The first Viral Radar 2.0 collection is in progress. This page will show the new intelligence as soon as the cloud collector publishes it (usually within a few minutes). <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => setVersion((v) => v + 1)}>Check again</button></div>
        )}
        {state && <Ctx.Provider value={state}>{page}</Ctx.Provider>}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {NAV.map(([href, label, icon]) => <a key={href} href={href} className={isActive(href) ? 'active' : ''}>{icon}{label}</a>)}
      </nav>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
