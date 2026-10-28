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

export function useWatchlist(): [WatchItem[], { add: (i: Omit<WatchItem, 'addedAt' | 'status'> & { status?: WatchItem['status'] }) => void; update: (id: string, patch: Partial<WatchItem>) => void; remove: (id: string) => void }] {
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
    },
  ];
}

function readList(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    return raw ? (JSON.parse(raw) as WatchItem[]) : [];
  } catch {
    return [];
  }
}
