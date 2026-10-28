import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Snapshot, Trend, TimeWindow } from './lib/types';
import { loadSnapshot, fmtAgo, filterTrends, rankTrends } from './lib/data';
import { usePrefs } from './lib/store';
import Dashboard from './pages/Dashboard';
import Compass from './pages/Compass';
import Categories from './pages/Categories';
import Money from './pages/Money';
import Roadmap from './pages/Roadmap';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import TrendDetail from './pages/TrendDetail';

export interface AppState {
  snapshot: Snapshot;
  now: number;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  platforms: string[];
  setPlatforms: (p: string[]) => void;
  /** filtered + personalized + ranked trends for the current filters */
  ranked: Trend[];
  /** all trends personalized (no time/platform filter), for detail lookups */
  all: Trend[];
  availablePlatforms: string[];
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
  ['#/', 'Dashboard'],
  ['#/compass', 'Trend Compass'],
  ['#/categories', 'Viral Categories'],
  ['#/money', 'Money Engine'],
  ['#/roadmap', 'Content Roadmap'],
  ['#/watchlist', 'Watchlist'],
  ['#/settings', 'Settings'],
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
  const [win, setWindow] = useState<TimeWindow>('7d');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [prefs] = usePrefs();
  const [toastMsg, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadSnapshot()
      .then((s) => alive && (setSnapshot(s), setNow(Date.now())))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [version]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toastMsg]);

  useEffect(() => {
    scrollTo({ top: 0 });
  }, [hash]);

  const state = useMemo<AppState | null>(() => {
    if (!snapshot) return null;
    const all = rankTrends(snapshot.trends, { ...prefs, hideNews: false });
    const ranked = rankTrends(filterTrends(snapshot.trends, { window: win, platforms }, now), prefs);
    const availablePlatforms = snapshot.sources.filter((s) => s.items > 0).map((s) => s.source);
    return {
      snapshot, now, window: win, setWindow, platforms, setPlatforms, ranked, all, availablePlatforms,
      reload: () => setVersion((v) => v + 1),
      toast: (m: string) => setToast(m),
    };
  }, [snapshot, now, win, platforms, prefs]);

  const generatedAgoH = snapshot ? (now - new Date(snapshot.generatedAt).getTime()) / 36e5 : 0;
  const okSources = snapshot ? snapshot.sources.filter((s) => s.ok).length : 0;
  const totalSources = snapshot ? snapshot.sources.filter((s) => s.mode !== 'disabled').length : 0;

  const page = (() => {
    if (!state) return null;
    const m = hash.match(/^#\/trend\/(.+)$/);
    if (m) return <TrendDetail id={decodeURIComponent(m[1])} />;
    switch (hash.replace(/\?.*$/, '')) {
      case '#/compass': return <Compass />;
      case '#/categories': return <Categories />;
      case '#/money': return <Money />;
      case '#/roadmap': return <Roadmap />;
      case '#/watchlist': return <Watchlist />;
      case '#/settings': return <Settings />;
      default: return <Dashboard />;
    }
  })();

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <svg className="radar" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--momentum-ink)" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="5.5" fill="none" stroke="var(--momentum-ink)" strokeWidth="1.8" opacity="0.7" />
            <circle cx="12" cy="12" r="1.6" fill="var(--momentum-ink)" />
            <path d="M12 12 L19.5 4.5" stroke="var(--momentum-ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Viral Radar
        </a>
        <div className="status">
          {snapshot && (
            <>
              <span className={`pulse${generatedAgoH > 3 ? ' stale' : ''}${okSources === 0 ? ' bad' : ''}`} aria-hidden />
              <span className="nowrap" title={snapshot.generatedAt}>Refreshed {fmtAgo(snapshot.generatedAt, now)}</span>
              <span className="nowrap dim">{okSources}/{totalSources} sources</span>
            </>
          )}
        </div>
      </header>
      <nav className="nav" aria-label="Sections">
        {NAV.map(([href, label]) => (
          <a key={href} href={href} className={(href === '#/' ? hash === '#/' || hash === '' || hash.startsWith('#/trend/') : hash.startsWith(href)) ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>
      <main className="main">
        {error && (
          <div className="notice bad">
            Couldn't load the latest data: {error}. The collector may not have run yet — see Settings › Refresh.
          </div>
        )}
        {!snapshot && !error && <div className="skeleton" style={{ minHeight: 240 }} aria-busy />}
        {state && <Ctx.Provider value={state}>{page}</Ctx.Provider>}
      </main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
