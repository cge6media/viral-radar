import type { ReactNode } from 'react';
import type { Observation, SourceStatus, SourceQuality, Window, VideoCard } from '../lib/types';
import { usePlayer } from './video';
import { GRADE, KIND_LABEL, KIND_OF_TREND, PLATFORM_LABEL, STAGE, WINDOWS, WINDOW_LABEL } from '../lib/types';
import { bestThumb, coverHue, exampleLine, fmtAgo, fmtNum, type ViewTrend } from '../lib/data';

export const Icon = {
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>,
  radar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" opacity=".6" /><path d="M12 12l6-6" /></svg>,
  compass: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-4 2 2-6z" /></svg>,
  money: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M7 12h.01M17 12h.01" /></svg>,
  studio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 5v5" /></svg>,
  bookmark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 4h12v17l-6-4-6 4z" /></svg>,
  fire: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-1-6-4-8 0 4-4 6-4 11 0 4 3 8 7 8z" /></svg>,
  pulse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>,
  trophy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></svg>,
  more: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
};

export function Section({ title, sub, children, more, moreHref }: { title: string; sub?: string; children: ReactNode; more?: string; moreHref?: string }) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {more && moreHref && <a className="more" href={moreHref}>{more} →</a>}
      </div>
      {children}
    </section>
  );
}

export function WindowSwitch({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  return (
    <div className="seg" role="group" aria-label="Time window">
      {WINDOWS.map((w) => (
        <button key={w} className={value === w ? 'on' : ''} onClick={() => onChange(w)} title={WINDOW_LABEL[w]}>{w}</button>
      ))}
    </div>
  );
}

export function StagePill({ stage, onDark }: { stage: string; onDark?: boolean }) {
  const s = STAGE[stage] || STAGE.insufficient_data;
  return (
    <span className={`pill stage ${stage}${onDark ? ' on-dark' : ''}`} style={{ ['--stage' as string]: `var(--st-${stage})` }} title={s.desc}>
      <i aria-hidden />{s.label}
    </span>
  );
}
export function GradePill({ grade, onDark }: { grade: string; onDark?: boolean }) {
  const g = GRADE[grade] || GRADE.insufficient;
  return <span className={`pill grade ${grade}${onDark ? ' on-dark' : ''}`} title={g.desc}><i aria-hidden />{g.label}</span>;
}
export function GrowthPill({ v }: { v: ViewTrend }) {
  const measured = v.w.growth.basis === 'measured' || !!v.w.velocity?.videosMeasured;
  return <span className={`pill ${measured ? 'measured' : 'provisional'}`} title={measured ? 'Growth measured from repeated observations' : 'First observation — growth not yet measured'}>{measured ? 'Measured' : 'Provisional'}</span>;
}
export function KindPill({ kind }: { kind: string }) {
  return <span className="pill kind">{KIND_OF_TREND[kind] || kind}</span>;
}

/** Thumbnail with graceful fallback cover. */
export function Thumb({ src, name, portrait, play, overlay, className = '' }: { src?: string; name: string; portrait?: boolean; play?: boolean; overlay?: ReactNode; className?: string }) {
  const [c1, c2] = coverHue(name);
  const initials = name.replace(/^#/, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
  return (
    <div className={`thumb${portrait ? ' portrait' : ''} ${className}`}>
      <div className="cover" style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }}>{initials}</div>
      {src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} style={{ position: 'absolute', inset: 0 }} />}
      {play && <span className="play" aria-hidden>{Icon.play}</span>}
      {overlay}
    </div>
  );
}

export function TrendCard({ v, now }: { v: ViewTrend; now: number }) {
  const th = bestThumb(v);
  const href = `#/trend/${encodeURIComponent(v.id)}`;
  return (
    <a className="tcard" href={href}>
      <Thumb src={th.src} name={v.name} play={v.videoCount > 0} overlay={<><div className="shade" /><div className="tl"><StagePill stage={v.w.lifecycle} onDark /></div><div className="br"><GradePill grade={v.w.grade} onDark /></div></>} />
      <div style={{ padding: '0 4px' }}>
        <div className="ttl clamp2">{v.name.replace(/^#/, '#')}</div>
        <div className="meta">{v.category} · {KIND_OF_TREND[v.kind]} · {v.w.creators} creator{v.w.creators === 1 ? '' : 's'}{v.w.directVideos ? ` · ${v.w.directVideos} measured` : ''}</div>
      </div>
      <div className="foot">
        <span className="mbar" title={`Momentum ${v.w.momentum}/100`}>Momentum <span className="bar"><i style={{ width: `${v.w.momentum}%` }} /></span><b>{v.w.momentum}</b></span>
        <span className="tiny dim num">{fmtAgo(v.lastSeen, now)}</span>
      </div>
    </a>
  );
}

export function TrendRow({ v, now, n }: { v: ViewTrend; now: number; n?: number }) {
  const th = bestThumb(v);
  return (
    <a className="lrow" href={`#/trend/${encodeURIComponent(v.id)}`}>
      <Thumb src={th.src} name={v.name} />
      <div style={{ minWidth: 0 }}>
        <div className="t truncate">{n ? `${n}. ` : ''}{v.name}</div>
        <div className="m truncate">{v.category} · {v.w.creators} creators · {GRADE[v.w.grade].label}{v.w.directVideos ? ` · ${v.w.directVideos} measured` : ''} · {fmtAgo(v.lastSeen, now)}</div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <StagePill stage={v.w.lifecycle} />
        <b className="num">{v.w.momentum}</b>
      </div>
    </a>
  );
}

export function ScoreBars({ v }: { v: ViewTrend }) {
  const Bar = ({ cls, label, val, title }: { cls: string; label: string; val: number; title: string }) => (
    <div className={`score ${cls}`} title={title}>
      <div className="lbl"><span>{label}</span><b>{val}</b></div>
      <div className="bar" role="img" aria-label={`${label} ${val} of 100`}><i style={{ width: `${val}%` }} /></div>
    </div>
  );
  return (
    <div className="scores">
      <Bar cls="momentum" label="Momentum" val={v.w.momentum} title="Adoption, measured signal, recency, interest, growth" />
      <Bar cls="money" label="Money fit" val={v.monetizationSuitability} title="Category monetization suitability (editorial)" />
      <Bar cls="creator" label="Creator fit" val={v.w.creatorOpportunity} title="Creator opportunity incl. your preferences" />
    </div>
  );
}

/** an evidence observation as a playable card (official embeds; otherwise the modal offers the direct link) */
export function observationToCard(e: Observation): VideoCard {
  return {
    id: e.id, platform: e.video?.platform || (e.source === 'bluesky' ? 'bluesky' : 'other'), platformId: e.video?.id || e.key, url: e.url, title: e.title, thumbnail: e.thumbnail,
    creator: e.creator?.name || (e.sharedBy ? `shared by ${e.sharedBy.name}` : undefined), creatorUrl: e.creator?.url, publishedAt: e.videoPublishedAt || (e.level === 'direct' ? e.publishedAt : undefined),
    ageHours: e.videoPublishedAt ? (Date.now() - new Date(e.videoPublishedAt).getTime()) / 36e5 : undefined, durationSec: e.video?.durationSec, isShort: e.video?.durationSec != null ? e.video.durationSec <= 180 : /shorts\//.test(e.url) || undefined,
    views: e.metrics.views, likes: e.metrics.likes, comments: e.metrics.comments, shares: e.postMetrics?.accounts,
    state: e.level === 'direct' ? 'verified_hit' : 'unverified_signal', viralScore: 0, breakoutScore: 0, engagementScore: 0, outlierScore: 0,
    category: '', formats: e.formats || [], reasons: [e.level === 'direct' ? 'Statistics measured on the video platform.' : 'A share — the video\'s own statistics are unverified.'], crossPlatform: 0, verified: e.level === 'direct',
  };
}

export function EvidenceCard({ e, now }: { e: Observation; now: number }) {
  const isVideo = e.kind === 'video';
  const player = usePlayer();
  const plat = e.video?.platform ? { youtube: 'YouTube', bluesky: 'Bluesky', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', other: 'Video' }[e.video.platform] : PLATFORM_LABEL[e.source];
  const line = exampleLine(e);
  const when = e.videoPublishedAt ? `published ${fmtAgo(e.videoPublishedAt, now)}` : e.postPublishedAt ? (isVideo && e.level === 'indirect' ? `shared ${fmtAgo(e.postPublishedAt, now)}` : `posted ${fmtAgo(e.postPublishedAt, now)}`) : e.publishedAt ? `seen ${fmtAgo(e.publishedAt, now)}` : `seen ${fmtAgo(e.observedAt, now)}`;
  const overlay = <div className="tl"><span className="pill kind on-dark">{isVideo ? (e.level === 'direct' ? `${plat} · measured` : `${plat} · shared`) : KIND_LABEL[e.kind]}</span></div>;
  return (
    <div className="ecard">
      {isVideo ? (
        <button className="media" onClick={() => player.open(observationToCard(e))} aria-label={`Play: ${e.title}`} style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <Thumb src={e.thumbnail} name={e.title} portrait={!!e.thumbnail && /video\.bsky\.app/.test(e.thumbnail)} play overlay={overlay} />
        </button>
      ) : (
        <a href={e.url} target="_blank" rel="noopener noreferrer" aria-label={`Open: ${e.title}`}>
          <Thumb src={e.thumbnail} name={e.title} overlay={overlay} />
        </a>
      )}
      <div style={{ minWidth: 0 }}>
        <a className="t clamp2" href={e.url} target="_blank" rel="noopener noreferrer">{e.title || e.url}</a>
        <div className="m clamp2">
          {e.creator?.name ? <a href={e.creator.url} target="_blank" rel="noopener noreferrer">{e.creator.name}</a> : e.sharedBy?.name ? <span>shared by {e.sharedBy.name}</span> : null}
          {line && <> · {line}</>}
          <> · {when}</>
        </div>
      </div>
    </div>
  );
}

export function SourceList({ sources, quality, now }: { sources: SourceStatus[]; quality?: SourceQuality[]; now: number }) {
  return (
    <div className="sources">
      {sources.map((s) => {
        const q = quality?.find((x) => x.source === s.source);
        const cls = s.mode === 'disabled' ? 'disabled' : !s.ok && s.mode !== 'cached' ? 'error' : s.mode;
        return (
          <div className="source" key={s.source}>
            <span className={`dot ${cls}`} aria-hidden />
            <div>
              <div className="truncate" style={{ fontWeight: 700 }}>{s.label}</div>
              <div className="err">
                {s.mode === 'disabled' ? `Not configured — ${s.note}` : q ? `${q.uniqueVideos} unique videos (${q.directVideos} measured) · ${q.relevantItems} relevant · median age ${q.medianAgeHours != null ? `${q.medianAgeHours}h` : '—'} · errors ${Math.round(q.errorRate * 100)}%` : s.error || ''}
              </div>
            </div>
            <div className="small muted num" style={{ whiteSpace: 'nowrap' }}>{s.items} items{s.fetchedAt ? ` · ${fmtAgo(s.fetchedAt, now)}` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export function StatTile({ v, k, s, cls, na }: { v: ReactNode; k: string; s?: string; cls?: string; na?: boolean }) {
  return (
    <div className={`tile ${cls || ''}`}>
      <div className={`v num${na ? ' na' : ''}`}>{v}</div>
      <div className="k">{k}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export const n = fmtNum;
