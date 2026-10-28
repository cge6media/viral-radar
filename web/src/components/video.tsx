import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { VideoCard } from '../lib/types';
import { fmtNum, fmtAgo, coverHue } from '../lib/data';
import { STATE_LABEL, PLATFORM_NAME, embedFor, fmtAge, fmtDuration, fmtViews, momentumLine, thumbSources } from '../lib/videos';
import { Icon } from './ui';

// ---------------------------------------------------------------------------------------------------------------
// Player context: one modal for the whole app; browsing position is preserved because nothing navigates.
// ---------------------------------------------------------------------------------------------------------------
interface PlayerCtx { open: (c: VideoCard) => void; close: () => void; current: VideoCard | null }
const Ctx = createContext<PlayerCtx>({ open: () => {}, close: () => {}, current: null });
export const usePlayer = () => useContext(Ctx);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<VideoCard | null>(null);
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCurrent(null);
    addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [current]);
  return (
    <Ctx.Provider value={{ open: setCurrent, close: () => setCurrent(null), current }}>
      {children}
      {current && <VideoModal c={current} onClose={() => setCurrent(null)} />}
    </Ctx.Provider>
  );
}

/** Thumbnail that tries the best sources in order and never leaves a blank rectangle. */
export function VideoThumb({ c, className = '', children }: { c: VideoCard; className?: string; children?: ReactNode }) {
  const sources = thumbSources(c);
  const [i, setI] = useState(0);
  const src = sources[i];
  const [c1, c2] = coverHue(c.title || c.platformId);
  const portrait = !!c.isShort || c.platform === 'tiktok' || c.platform === 'instagram' || c.platform === 'bluesky';
  return (
    <div className={`vthumb ${portrait ? 'portrait' : 'landscape'} ${className}`} style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }}>
      <div className="cover"><span>{PLATFORM_NAME[c.platform] || 'Video'}</span></div>
      {src && (
        <>
          <img className="bg" src={src} alt="" aria-hidden loading="lazy" referrerPolicy="no-referrer" onError={() => setI((x) => x + 1)} />
          <img className={`fg ${portrait ? 'cover' : 'contain'}`} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setI((x) => x + 1)} />
        </>
      )}
      {children}
    </div>
  );
}

export function StateBadge({ state, onDark }: { state: VideoCard['state']; onDark?: boolean }) {
  const s = STATE_LABEL[state];
  return <span className={`pill vstate ${state}${onDark ? ' on-dark' : ''}`} title={s.desc}><i aria-hidden />{s.short}</span>;
}

/** The card: thumbnail, title, creator, verified metrics, age, momentum, state. Click opens the player. */
export function VideoCardView({ c, rank, now, compact, why }: { c: VideoCard; rank?: number; now: number; compact?: boolean; why?: boolean }) {
  const player = usePlayer();
  const [showWhy, setShowWhy] = useState(false);
  const m = momentumLine(c);
  const dur = fmtDuration(c.durationSec);
  return (
    <article className={`vcard${compact ? ' compact' : ''}`}>
      <button className="media" onClick={() => player.open(c)} aria-label={`Play: ${c.title}`}>
        <VideoThumb c={c}>
          <span className="shade" />
          {rank != null && <span className="rank num">{rank}</span>}
          <span className="tl"><span className={`pill plat ${c.platform} on-dark`}>{PLATFORM_NAME[c.platform]}{c.isShort && c.platform === 'youtube' ? ' Shorts' : ''}</span></span>
          {dur && <span className="dur num">{dur}</span>}
          <span className="play" aria-hidden>{Icon.play}</span>
          <span className="bl"><StateBadge state={c.state} onDark /></span>
        </VideoThumb>
      </button>
      <div className="body">
        <div className="t clamp2" title={c.title}>{c.title}</div>
        <div className="m truncate">{c.creator ? <span>{c.creator}</span> : <span className="dim">unknown creator</span>}{c.publishedAt ? <> · {fmtAge(c.ageHours)} ago</> : null}</div>
        <div className="stats">
          <b className="num">{fmtViews(c)}</b>
          {c.likes != null && c.views != null && <span className="num dim">{fmtNum(c.likes)} likes</span>}
        </div>
        <div className={`mom ${m.measured ? 'measured' : 'avg'}`} title={m.measured ? 'Measured between two real observations' : 'Lifetime average — not a measured recent rate'}><i aria-hidden />{m.text}</div>
        {why && (
          <button className="why" onClick={() => setShowWhy((s) => !s)} aria-expanded={showWhy}>{showWhy ? 'Hide' : 'Why this video is here'}</button>
        )}
        {why && showWhy && <WhyPanel c={c} now={now} />}
      </div>
    </article>
  );
}

export function WhyPanel({ c, now }: { c: VideoCard; now: number }) {
  return (
    <div className="whypanel">
      <div className="small"><b>{STATE_LABEL[c.state].label}</b> · {c.verified ? 'verified platform statistics' : 'indirect evidence only'} · {c.publishedAt ? `published ${fmtAgo(c.publishedAt, now)} (${new Date(c.publishedAt).toLocaleDateString()})` : 'publish date unverified'}</div>
      <ul className="small">
        {c.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <div className="row wrap tiny dim" style={{ gap: 10 }}>
        <span>viral {c.viralScore}</span><span>breakout {c.breakoutScore}</span><span>engagement {c.engagementScore}</span><span>outlier {c.outlierScore}</span>{c.crossPlatform ? <span>cross-platform links {c.crossPlatform}</span> : null}
      </div>
    </div>
  );
}

export function VideoGrid({ cards, now, start = 1, why, empty }: { cards: VideoCard[]; now: number; start?: number; why?: boolean; empty?: string }) {
  if (!cards.length) return <div className="empty">{empty || 'Nothing meets the bar here yet — nothing is padded in to fill the space.'}</div>;
  return <div className="vgrid">{cards.map((c, i) => <VideoCardView key={c.id} c={c} rank={start + i} now={now} why={why} />)}</div>;
}

export function VideoRail({ cards, now, why }: { cards: VideoCard[]; now: number; why?: boolean }) {
  if (!cards.length) return <div className="empty">Nothing meets the bar here yet.</div>;
  return <div className="vrail">{cards.map((c, i) => <VideoCardView key={c.id} c={c} rank={i + 1} now={now} compact why={why} />)}</div>;
}

// ---------------------------------------------------------------------------------------------------------------
// Modal player — official embeds only; otherwise an honest direct-link card (no fake controls).
// ---------------------------------------------------------------------------------------------------------------
function VideoModal({ c, onClose }: { c: VideoCard; onClose: () => void }) {
  const embed = embedFor(c);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const m = momentumLine(c);
  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className={`modal${embed?.portrait ? ' portrait' : ''}`} role="dialog" aria-modal="true" aria-label={c.title} onClick={(e) => e.stopPropagation()} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div className="t clamp2">{c.title}</div>
            <div className="small muted truncate">{c.creator ? <a href={c.creatorUrl} target="_blank" rel="noopener noreferrer">{c.creator}</a> : 'unknown creator'} · {PLATFORM_NAME[c.platform]}{c.publishedAt ? ` · published ${new Date(c.publishedAt).toLocaleDateString()}` : ' · publish date unverified'}</div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close player">✕</button>
        </div>
        <div className="modal-media">
          {embed ? (
            <iframe src={embed.src} title={c.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <div className="noembed">
              <VideoThumb c={c} />
              <div className="stack" style={{ gap: 8, padding: 14 }}>
                <b>Embedding is not available for this {PLATFORM_NAME[c.platform]} video.</b>
                <span className="small muted">Open the original to watch it — nothing is rehosted here.</span>
                <a className="btn primary" href={c.url} target="_blank" rel="noopener noreferrer">Open on {PLATFORM_NAME[c.platform]} ↗</a>
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <div className="row wrap" style={{ gap: 14 }}>
            <span><b className="num">{fmtViews(c)}</b>{c.verified ? <span className="tiny dim"> verified</span> : <span className="tiny dim"> unverified</span>}</span>
            {c.likes != null && <span className="num">{fmtNum(c.likes)} likes</span>}
            {c.comments != null && <span className="num">{fmtNum(c.comments)} comments</span>}
            <span className={`mom ${m.measured ? 'measured' : 'avg'}`}><i aria-hidden />{m.text}</span>
            <StateBadge state={c.state} />
          </div>
          <a className="btn sm" href={c.url} target="_blank" rel="noopener noreferrer">Open original ↗</a>
        </div>
        <details className="modal-why">
          <summary>Why this video is here</summary>
          <WhyPanel c={c} now={Date.now()} />
        </details>
      </div>
    </div>
  );
}
