import type { ReactNode } from 'react';
import type { Observation, Trend, SourceStatus } from '../lib/types';
import { KIND_LABEL, PLATFORM_LABEL, STAGE, TIME_WINDOWS, type TimeWindow } from '../lib/types';
import { fmtAgo, metricLine } from '../lib/data';

export function ScoreBars({ t, compact, showConfidence }: { t: Trend; compact?: boolean; showConfidence?: boolean }) {
  const s = t.scores;
  const Bar = ({ cls, label, v, title }: { cls: string; label: string; v: number; title: string }) => (
    <div className={`score ${cls}`} title={title}>
      <div className="lbl">
        <span>{label}</span>
        <b>{v}</b>
      </div>
      <div className="bar" role="img" aria-label={`${label} ${v} of 100`}>
        <i style={{ width: `${v}%` }} />
      </div>
    </div>
  );
  return (
    <div className={`scores${compact ? ' compact' : ''}`}>
      <Bar cls="momentum" label="Momentum" v={s.momentum} title={`Momentum ${s.momentum}/100 (${s.momentumBasis})`} />
      <Bar cls="money" label="Money" v={s.monetization} title={`Monetization opportunity ${s.monetization}/100`} />
      <Bar cls="creator" label="Creator fit" v={s.creator} title={`Creator opportunity ${s.creator}/100`} />
      {showConfidence && <Bar cls="confidence" label="Confidence" v={s.confidence} title={`Evidence confidence ${s.confidence}/100`} />}
    </div>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const s = STAGE[stage] || STAGE.insufficient_data;
  return (
    <span className={`badge stage ${stage}`} style={{ ['--stage' as string]: `var(--st-${stage})` }} title={s.desc}>
      <span className="dot" aria-hidden />
      {s.label}
    </span>
  );
}

export function BasisBadge({ t }: { t: Trend }) {
  const observed = t.scores.momentumBasis === 'observed';
  return (
    <span className={`badge ${observed ? 'observed' : 'provisional'}`} title={observed ? 'Growth measured from ≥2 data points' : 'First observation — growth not yet measured'}>
      {observed ? 'Measured growth' : 'Provisional'}
    </span>
  );
}

export function KindBadges({ t }: { t: Trend }) {
  return (
    <>
      {t.evidenceKinds.map((k) => (
        <span key={k} className="badge kind">{KIND_LABEL[k] || k}</span>
      ))}
    </>
  );
}

export function PlatformList({ t }: { t: Trend }) {
  return <span>{t.platforms.map((p) => PLATFORM_LABEL[p] || p).join(' · ')}</span>;
}

export function ConfidenceText({ t }: { t: Trend }) {
  const c = t.scores.confidence;
  const word = c >= 70 ? 'High' : c >= 40 ? 'Medium' : c >= 20 ? 'Low' : 'Very low';
  return (
    <span className="num" title="Evidence confidence 0–100: evidence count, independent sources, videos with stats, history length">
      {word} confidence ({c})
    </span>
  );
}

export function TrendRow({ t, n, now }: { t: Trend; n: number; now: number }) {
  return (
    <a className="rank" href={`#/trend/${encodeURIComponent(t.id)}`}>
      <div className="n">{n}</div>
      <div style={{ minWidth: 0 }}>
        <div className="title truncate">{t.name.replace(/ \(format\)$/, '')}</div>
        <div className="meta">
          <span>{t.category} › {t.subcategory}</span>
          <StageBadge stage={t.lifecycle} />
          <BasisBadge t={t} />
          {t.isNewsEvent && <span className="badge news" title="A news/person event rather than a repeatable format">News event</span>}
        </div>
      </div>
      <ScoreBars t={t} compact />
      <div className="right small muted">
        <div><PlatformList t={t} /></div>
        <div className="num">{t.evidenceCount} items · {t.videoCount} videos</div>
        <div className="num" title={t.lastSeen}>updated {fmtAgo(t.lastSeen, now)}</div>
        <div className="num" title="Evidence confidence">conf. {t.scores.confidence}</div>
      </div>
    </a>
  );
}

export function EvidenceItem({ e, now }: { e: Observation; now: number }) {
  const isVideo = e.kind === 'video';
  const m = metricLine(e);
  return (
    <div className="ev">
      {e.thumbnail ? (
        <img className="thumb" src={e.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(ev) => ((ev.target as HTMLImageElement).style.visibility = 'hidden')} />
      ) : (
        <div className="thumb ph">{KIND_LABEL[e.kind] || e.kind}</div>
      )}
      <div style={{ minWidth: 0 }}>
        <a className="t clamp2" href={e.url} target="_blank" rel="noopener noreferrer">
          {e.title || e.url}
        </a>
        <div className="m">
          <span className="badge kind">{isVideo ? (/youtu\.?be/.test(e.url) ? 'YouTube video' : /video\.bsky/.test(e.url) ? 'Bluesky video' : 'Video') : KIND_LABEL[e.kind] || e.kind}</span>
          <span>{PLATFORM_LABEL[e.source] || e.source}{e.region ? ` · ${e.region}` : ''}</span>
          {e.creator?.name && (
            <span>
              by{' '}
              {e.creator.url ? (
                <a href={e.creator.url} target="_blank" rel="noopener noreferrer">{e.creator.name}</a>
              ) : (
                e.creator.name
              )}
            </span>
          )}
          {m && <span className="num">{m}</span>}
          {e.publishedAt && <span className="num" title={e.publishedAt}>published {fmtAgo(e.publishedAt, now)}</span>}
          <span className="num" title={e.observedAt}>seen {fmtAgo(e.observedAt, now)}</span>
        </div>
        {e.links && e.links.length > 0 && e.kind !== 'video' && (
          <div className="m">
            {e.links.slice(0, 3).map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="truncate" style={{ maxWidth: 320 }}>
                {l.source ? `${l.source}: ` : ''}{l.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function EvidenceList({ t, now, max = 8 }: { t: Trend; now: number; max?: number }) {
  const list = t.evidence.slice(0, max);
  if (!list.length) return <div className="empty">No evidence inside the selected time window.</div>;
  return (
    <div className="evidence">
      {list.map((e) => (
        <EvidenceItem key={e.id} e={e} now={now} />
      ))}
    </div>
  );
}

export function Filters({
  window: w, platforms, available, onWindow, onPlatforms, historyHours,
}: {
  window: TimeWindow; platforms: string[]; available: string[]; onWindow: (w: TimeWindow) => void; onPlatforms: (p: string[]) => void; historyHours: number;
}) {
  const toggle = (p: string) => onPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chips" role="group" aria-label="Time window">
        {TIME_WINDOWS.map((tw) => {
          const beyond = tw.hours > Math.max(4, historyHours) && tw.hours > 24;
          return (
            <button key={tw.id} className={`chip${w === tw.id ? ' on' : ''}`} onClick={() => onWindow(tw.id)} title={beyond ? `Collection history covers ~${Math.ceil(historyHours)}h so far; this window will show the same data` : tw.label}>
              {tw.label}
            </button>
          );
        })}
      </div>
      <div className="chips" role="group" aria-label="Platforms">
        <button className={`chip${platforms.length === 0 ? ' on' : ''}`} onClick={() => onPlatforms([])}>All sources</button>
        {available.map((p) => (
          <button key={p} className={`chip${platforms.includes(p) ? ' on' : ''}`} onClick={() => toggle(p)}>
            {PLATFORM_LABEL[p] || p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SourceStatusList({ sources, now }: { sources: SourceStatus[]; now: number }) {
  return (
    <div className="sources">
      {sources.map((s) => {
        const cls = s.mode === 'disabled' ? 'disabled' : !s.ok && s.mode !== 'cached' ? 'error' : s.mode;
        return (
          <div className="source" key={s.source}>
            <span className={`dot ${cls}`} aria-hidden />
            <div style={{ minWidth: 0 }}>
              <div className="truncate">{s.label}</div>
              {s.mode === 'disabled' && <div className="err">Not configured — {s.note}</div>}
              {s.mode === 'cached' && <div className="err">Serving cached results · {s.error}</div>}
              {!s.ok && s.mode === 'live' && <div className="err">Failed · {s.error}</div>}
              {s.ok && s.error && <div className="err">Partial · {s.error}</div>}
            </div>
            <div className="small muted num nowrap">
              {s.items} items{s.fetchedAt ? ` · ${fmtAgo(s.fetchedAt, now)}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Section({ title, sub, children, right }: { title: string; sub?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
