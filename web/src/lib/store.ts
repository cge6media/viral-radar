/** Local persistence (per browser): preferences + watchlist. Wrapped in try/catch — storage may be unavailable. */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PREFS, type Preferences, type WatchItem } from './types';

const PREF_KEY = 'vr.prefs.v2';
const WATCH_KEY = 'vr.watchlist.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const merged = { ...fallback, ...parsed } as Record<string, unknown>;
    // arrays in the defaults must stay arrays of strings
    for (const [k, v] of Object.entries(fallback as Record<string, unknown>)) if (Array.isArray(v) && !(Array.isArray(merged[k]) && (merged[k] as unknown[]).every((x) => typeof x === 'string'))) merged[k] = v;
    return merged as T;
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
    const list = sanitize(data[WATCH_KEY]);
    if (mode === 'replace') { write(WATCH_KEY, list); items = list.length; }
    else { const cur = readList(); const ids = new Set(cur.map((x) => x.trendId)); const add = list.filter((x) => !ids.has(x.trendId)); write(WATCH_KEY, [...add, ...cur]); items = add.length; }
  } else if (mode === 'replace') {
    throw new Error('no journal in this file');
  }
  const prefs = data[PREF_KEY] as Partial<Preferences> | undefined;
  if (prefs && typeof prefs === 'object' && mode === 'replace') {
    const safe: Partial<Preferences> = {};
    for (const k of ['interests', 'tools', 'platforms'] as const) if (Array.isArray(prefs[k]) && (prefs[k] as unknown[]).every((v) => typeof v === 'string')) safe[k] = prefs[k] as string[];
    if (prefs.appetite === 'early' || prefs.appetite === 'balanced' || prefs.appetite === 'proven') safe.appetite = prefs.appetite;
    if (typeof prefs.showGeneric === 'boolean') safe.showGeneric = prefs.showGeneric;
    write(PREF_KEY, { ...DEFAULT_PREFS, ...safe });
  }
  notify();
  return { items };
}

const STATUSES = new Set(['watching', 'selected', 'producing', 'published', 'completed', 'skipped', 'planning']);
/** a journal row is only accepted with the shape the pages rely on; anything else is dropped, never rendered */
export function validItem(x: unknown): x is WatchItem {
  if (!x || typeof x !== 'object') return false;
  const i = x as Record<string, unknown>;
  if (typeof i.trendId !== 'string' || typeof i.name !== 'string' || typeof i.category !== 'string') return false;
  if (typeof i.status !== 'string' || !STATUSES.has(i.status)) return false;
  if (typeof i.addedAt !== 'string' || isNaN(new Date(i.addedAt).getTime())) return false;
  if (i.published != null && typeof i.published !== 'object') return false;
  if (i.assessment != null && typeof i.assessment !== 'object') return false;
  return true;
}
function sanitize(list: unknown): WatchItem[] {
  if (!Array.isArray(list)) return [];
  return list.filter(validItem).map((i) => ({ ...i, published: i.published ? Object.fromEntries(Object.entries(i.published).filter(([, v]) => v == null || typeof v === 'string' || typeof v === 'number')) : undefined }));
}
function readList(): WatchItem[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}
