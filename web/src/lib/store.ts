/** Local persistence (per browser): preferences + watchlist. Wrapped in try/catch — storage may be unavailable. */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PREFS, type Preferences, type WatchItem } from './types';

const PREF_KEY = 'vr.prefs.v2';
const WATCH_KEY = 'vr.watchlist.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function usePrefs(): [Preferences, (p: Partial<Preferences>) => void] {
  const [prefs, setPrefs] = useState<Preferences>(() => read(PREF_KEY, DEFAULT_PREFS));
  useEffect(() => {
    const l = () => setPrefs(read(PREF_KEY, DEFAULT_PREFS));
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...read(PREF_KEY, DEFAULT_PREFS), ...patch };
    write(PREF_KEY, next);
    notify();
  }, []);
  return [prefs, update];
}

export function useWatchlist(): [WatchItem[], { add: (i: Omit<WatchItem, 'addedAt' | 'status'> & { status?: WatchItem['status'] }) => void; update: (id: string, patch: Partial<WatchItem>) => void; remove: (id: string) => void; replaceAll: (list: WatchItem[]) => void; merge: (list: WatchItem[]) => number }] {
  const [items, setItems] = useState<WatchItem[]>(() => readList());
  useEffect(() => {
    const l = () => setItems(readList());
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const save = (list: WatchItem[]) => {
    write(WATCH_KEY, list);
    notify();
  };
  return [
    items,
    {
      add: (i) => {
        const list = readList();
        if (list.some((x) => x.trendId === i.trendId)) return;
        save([{ ...i, status: i.status || 'watching', addedAt: new Date().toISOString() }, ...list]);
      },
      update: (id, patch) => save(readList().map((x) => (x.trendId === id ? { ...x, ...patch } : x))),
      remove: (id) => save(readList().filter((x) => x.trendId !== id)),
      replaceAll: (list) => save(list),
      merge: (list) => {
        const cur = readList();
        const ids = new Set(cur.map((x) => x.trendId));
        const add = list.filter((x) => x && typeof x.trendId === 'string' && !ids.has(x.trendId));
        save([...add, ...cur]);
        return add.length;
      },
    },
  ];
}

/** every private key this browser keeps (journal, preferences, alert bookkeeping) — for backup/restore */
export const PRIVATE_KEYS = [PREF_KEY, WATCH_KEY, 'vr.alerts.lastVisit', 'vr.alerts.seen', 'vr.window'];
export function exportPrivateData(): string {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: 1 };
  for (const k of PRIVATE_KEYS) { try { const v = localStorage.getItem(k); if (v) out[k] = JSON.parse(v); } catch { /* ignore */ } }
  return JSON.stringify(out, null, 2);
}
export function importPrivateData(json: string, mode: 'merge' | 'replace'): { items: number } {
  const data = JSON.parse(json) as Record<string, unknown>;
  let items = 0;
  if (Array.isArray(data[WATCH_KEY])) {
    const list = data[WATCH_KEY] as WatchItem[];
    if (mode === 'replace') { write(WATCH_KEY, list); items = list.length; }
    else { const cur = readList(); const ids = new Set(cur.map((x) => x.trendId)); const add = list.filter((x) => x && typeof x.trendId === 'string' && !ids.has(x.trendId)); write(WATCH_KEY, [...add, ...cur]); items = add.length; }
  }
  if (data[PREF_KEY] && typeof data[PREF_KEY] === 'object' && mode === 'replace') write(PREF_KEY, data[PREF_KEY]);
  notify();
  return { items };
}

function readList(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    return raw ? (JSON.parse(raw) as WatchItem[]) : [];
  } catch {
    return [];
  }
}
