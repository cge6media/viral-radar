import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import type { VideoCard, VideoWindow } from '../lib/types';
import { VIDEO_WINDOWS, VIDEO_WINDOW_LABEL } from '../lib/types';
import { PLATFORM_FILTERS, SORT_MODES, LANGUAGE_FILTERS, loadVideoIndex, selectCards, toCard, type PlatformFilter, type SortMode, type LanguageFilter, PLATFORM_NAME } from '../lib/videos';
import { VideoGrid } from '../components/video';
import { fmtAgo } from '../lib/data';

export function usePersisted<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; } });
  useEffect(() => { try { localStorage.setItem(key, v); } catch { /* ignore */ } }, [key, v]);
  return [v, setV];
}

export function useAllCards(): { cards: VideoCard[] | null; error: string | null; generatedAt?: string } {
  const [state, setState] = useState<{ cards: VideoCard[] | null; error: string | null; generatedAt?: string }>({ cards: null, error: null });
  useEffect(() => {
    let alive = true;
    loadVideoIndex().then((ix) => alive && setState({ cards: ix.records.map(toCard), error: null, generatedAt: ix.generatedAt })).catch((e) => alive && setState({ cards: null, error: (e as Error).message }));
    return () => { alive = false; };
  }, []);
  return state;
}

export function PlatformBar({ value, onChange, coverage }: { value: PlatformFilter; onChange: (p: PlatformFilter) => void; coverage?: { platform: string; status: string }[] }) {
  return (
    <div className="seg wrap" role="group" aria-label="Platform">
      {PLATFORM_FILTERS.map((p) => {
        const cov = coverage?.find((c) => (p.id === 'other' ? c.platform === 'bluesky' : c.platform === p.id));
        const status = p.id === 'all' ? 'direct' : cov?.status || 'unavailable';
        return <button key={p.id} className={value === p.id ? 'on' : ''} onClick={() => onChange(p.id)} title={status === 'direct' ? 'Direct platform statistics' : status === 'indirect' ? 'Share evidence only — no platform statistics' : 'No data from this platform yet'}>{p.label}{status !== 'direct' ? <i className={`cov ${status}`} aria-hidden /> : null}</button>;
      })}
    </div>
  );
}

export function LanguageBar({ value, onChange }: { value: LanguageFilter; onChange: (l: LanguageFilter) => void }) {
  return (
    <div className="seg wrap" role="group" aria-label="Language">
      {LANGUAGE_FILTERS.map((l) => <button key={l.id} className={value === l.id ? 'on' : ''} onClick={() => onChange(l.id)} title={l.desc}>{l.label}</button>)}
    </div>
  );
}

export function SortBar({ value, onChange, modes = SORT_MODES }: { value: SortMode; onChange: (s: SortMode) => void; modes?: typeof SORT_MODES }) {
  return (
    <div className="seg wrap" role="group" aria-label="Sort">
      {modes.map((m) => <button key={m.id} className={value === m.id ? 'on' : ''} onClick={() => onChange(m.id)} title={m.desc}>{m.label}</button>)}
    </div>
  );
}

export function CoverageNote({ platform, coverage }: { platform: PlatformFilter; coverage?: { platform: string; status: string; note: string; uniqueVideos: number; verifiedVideos: number; unverifiedShares: number }[] }) {
  if (platform === 'all') return null;
  const cov = coverage?.find((c) => (platform === 'other' ? c.platform === 'bluesky' : c.platform === platform));
  if (!cov) return null;
  if (cov.status === 'direct') return <div className="notice ok small">{PLATFORM_NAME[cov.platform]}: direct platform statistics for {cov.verifiedVideos} videos{cov.platform === 'bluesky' ? ' — ranked on Bluesky\'s own like-based scale, never against YouTube view counts' : ''}.</div>;
  return <div className="notice warn small"><b>{PLATFORM_NAME[cov.platform]} coverage is {cov.status}.</b> {cov.note} {cov.uniqueVideos ? `${cov.uniqueVideos} ${cov.platform} videos are known from shares (${cov.unverifiedShares} without statistics).` : 'No videos from this platform are in the data yet.'} This page will not be filled with unrelated results.</div>;
}

export default function ViralNow() {
  const { snapshot, now } = useApp();
  const intel = snapshot.videos;
  const [win, setWin] = usePersisted<VideoWindow>('vr.vn.window', '72h');
  const [platform, setPlatform] = usePersisted<PlatformFilter>('vr.vn.platform', 'all');
  const [sort, setSort] = usePersisted<SortMode>('vr.vn.sort', 'most_viral');
  const [lang, setLang] = usePersisted<LanguageFilter>('vr.vn.lang', 'all');
  const { cards, error } = useAllCards();

  const list = useMemo(() => {
    if (!intel) return [];
    const base = cards ?? [...Object.values(intel.viralNow).flat(), ...intel.bluesky.viralNow];
    const uniq = Array.from(new Map(base.map((c) => [c.id, c])).values());
    const eligible = sort === 'most_viral' ? uniq.filter((c) => c.state === 'verified_hit') : uniq.filter((c) => c.state === 'verified_hit' || c.state === 'early_breakout');
    return selectCards(eligible, { platform, sort, window: win, now, language: lang });
  }, [cards, intel, platform, sort, win, now, lang]);

  if (!intel) return <div className="notice warn">The first 3.0 collection has not published yet — video rankings appear after the next cloud run.</div>;
  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <h1>Viral Now</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>The biggest verified videos published in the selected period — ranked on their own platform's statistics (views, age, measured growth, engagement). Ordinary uploads never make this list; small creators do when their numbers are exceptional.</p>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="seg" role="group" aria-label="Publish window">
            {VIDEO_WINDOWS.map((w) => <button key={w} className={win === w ? 'on' : ''} onClick={() => setWin(w)} title={VIDEO_WINDOW_LABEL[w]}>{w}</button>)}
          </div>
          <PlatformBar value={platform} onChange={setPlatform} coverage={intel.coverage} />
        </div>
        <SortBar value={sort} onChange={setSort} />
        <LanguageBar value={lang} onChange={setLang} />
        <CoverageNote platform={platform} coverage={intel.coverage} />
        {lang !== 'all' && <div className="small muted">Language is detected from the title (script and stop-words) or declared by the uploader — a filter for your own use, never a ranking factor. Worldwide discovery is unchanged.</div>}
        {error && <div className="notice warn small">Full index unavailable ({error}); showing the top lists from the snapshot.</div>}
      </header>
      <section className="section">
        <div className="row between wrap" style={{ marginBottom: 10 }}>
          <div className="small muted">{list.length} video{list.length === 1 ? '' : 's'} · published within {VIDEO_WINDOW_LABEL[win].toLowerCase()} · statistics as of {fmtAgo(intel.generatedAt, now)}</div>
          <div className="small muted">{intel.counts.verified_hit} verified hits · {intel.counts.early_breakout} breakouts in the 30-day index</div>
        </div>
        <VideoGrid cards={list.slice(0, 60)} now={now} why empty={sort === 'fastest_rising' ? 'No measured velocity yet for this selection — velocity needs two real observations ≥1h apart; the collector runs every 30 minutes.' : lang !== 'all' ? 'No verified hit in this language for the selected period — nothing is substituted.' : undefined} />
      </section>
    </>
  );
}
