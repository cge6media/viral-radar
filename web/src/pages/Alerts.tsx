import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import { useWatchlist, usePrefs } from '../lib/store';
import type { Alert, AlertKind } from '../lib/types';
import { fmtAgo } from '../lib/data';
import { Section, StatTile } from '../components/ui';
import { Lede } from '../components/ui';
import { evidenceToCard } from '../lib/videos';
import { usePlayer } from '../components/video';

const KIND: Record<AlertKind, { label: string; group: 'hits' | 'early' | 'formats' }> = {
  new_hit: { label: 'New verified hit', group: 'hits' },
  acceleration: { label: 'Exceptional acceleration', group: 'early' },
  creator_outlier: { label: 'Creator outlier', group: 'early' },
  resurfacing: { label: 'Older video resurfacing', group: 'early' },
  format_spreading: { label: 'Format spreading', group: 'formats' },
  category_momentum: { label: 'Category momentum', group: 'formats' },
};
const VISIT_KEY = 'vr.alerts.lastVisit';
const SEEN_KEY = 'vr.alerts.seen';

/** "new since last visit" bookkeeping — per browser, never sent anywhere */
export function useAlertState(alerts: Alert[]): { unseen: Alert[]; lastVisit: string | null; markSeen: () => void } {
  const [lastVisit, setLastVisit] = useState<string | null>(() => { try { return localStorage.getItem(VISIT_KEY); } catch { return null; } });
  const [seen, setSeen] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') as string[]); } catch { return new Set(); } });
  const unseen = useMemo(() => alerts.filter((a) => !seen.has(`${a.id}@${a.at}`) && (!lastVisit || a.at > lastVisit)), [alerts, seen, lastVisit]);
  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    const next = new Set(seen);
    for (const a of alerts) next.add(`${a.id}@${a.at}`);
    try { localStorage.setItem(VISIT_KEY, now); localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(next).slice(-400))); } catch { /* ignore */ }
    setLastVisit(now); setSeen(next);
  }, [alerts, seen]);
  return { unseen, lastVisit, markSeen };
}

export default function Alerts() {
  const { snapshot, now } = useApp();
  const alerts = snapshot.alerts || [];
  const { unseen, lastVisit, markSeen } = useAlertState(alerts);
  const [watch] = useWatchlist();
  const [prefs] = usePrefs();
  const [filter, setFilter] = useState<'all' | 'new' | 'hits' | 'early' | 'formats' | 'preferred' | 'saved'>('new');
  const player = usePlayer();
  const savedIds = new Set(watch.map((w) => w.trendId));
  const unseenIds = new Set(unseen.map((a) => `${a.id}@${a.at}`));
  useEffect(() => () => { /* mark seen when leaving the page */ }, []);
  const list = useMemo(() => alerts.filter((a) => {
    switch (filter) {
      case 'new': return unseenIds.has(`${a.id}@${a.at}`);
      case 'hits': return KIND[a.kind].group === 'hits';
      case 'early': return KIND[a.kind].group === 'early';
      case 'formats': return KIND[a.kind].group === 'formats';
      case 'preferred': return prefs.interests.includes(a.category);
      case 'saved': return a.subject.type === 'trend' && savedIds.has(a.subject.id);
      default: return true;
    }
  }), [alerts, filter, unseenIds, prefs.interests, savedIds]);

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <div className="kicker">Early-warning alerts · 7-day log · {unseen.length} new since {lastVisit ? fmtAgo(lastVisit, now) : 'your first visit'}</div>
        <h1>Alerts</h1>
        <Lede>Only unusually strong signals: a video crossing its hit floor while tracked, acceleration ≥2.5× at ≥20K views/h, creator outliers ≥100× their median upload, formats gaining ≥3 independent creators in 48h, category waves measured at ≥2×, older videos resurfacing. Deduplicated per subject with a 48-hour cooldown. Every alert shows what caused it; none of them is a promise of future virality.</Lede>
        <div className="tiles">
          <StatTile v={unseen.length} k="New since last visit" cls={unseen.length ? 'good' : ''} na={!unseen.length} />
          <StatTile v={alerts.filter((a) => KIND[a.kind].group === 'hits').length} k="Verified hits (7d)" />
          <StatTile v={alerts.filter((a) => KIND[a.kind].group === 'early').length} k="Early signals (7d)" />
          <StatTile v={alerts.filter((a) => KIND[a.kind].group === 'formats').length} k="Formats & categories (7d)" />
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Filter alerts">
            {([['new', `New (${unseen.length})`], ['all', 'All'], ['hits', 'Major hits'], ['early', 'Early signals'], ['formats', 'Formats'], ['preferred', 'My categories'], ['saved', 'Saved trends']] as const).map(([id, label]) => <button key={id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
          {unseen.length > 0 && <button className="btn sm" onClick={markSeen}>Mark all as seen</button>}
        </div>
      </header>
      <Section title={filter === 'new' ? 'New since your last visit' : 'Alert log'} sub={`${list.length} alert${list.length === 1 ? '' : 's'}`}>
        {list.length === 0 ? <div className="empty">{filter === 'new' ? 'Nothing new since your last visit — no alert is invented to fill the space.' : 'No alerts in this filter.'}</div> : (
          <div className="stack" style={{ gap: 10 }}>
            {list.map((a) => (
              <article key={`${a.id}@${a.at}`} className={`alert card tight ${a.severity}${unseenIds.has(`${a.id}@${a.at}`) ? ' unseen' : ''}`}>
                <div className="row wrap between" style={{ gap: 8 }}>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className={`pill akind ${a.kind}`}><i aria-hidden />{KIND[a.kind].label}</span>
                    <span className="pill kind">{a.category}</span>
                    {unseenIds.has(`${a.id}@${a.at}`) && <span className="pill measured">new</span>}
                  </div>
                  <span className="tiny dim num">{fmtAgo(a.at, now)}</span>
                </div>
                <div className="alert-body">
                  {a.subject.thumbnail && <img className="athumb" src={a.subject.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}
                  <div style={{ minWidth: 0 }}>
                    <div className="t clamp2">{a.subject.type === 'video' && a.subject.url
                      ? <button className="linklike" onClick={() => player.open(evidenceToCard({ id: a.subject.id, platform: a.subject.platform || 'youtube', url: a.subject.url!, title: a.subject.title, thumbnail: a.subject.thumbnail, state: 'verified_hit', verified: true }))}>{a.subject.title}</button>
                      : <a href={`#/trend/${encodeURIComponent(a.subject.id)}`}>{a.subject.title}</a>}</div>
                    <div className="small" style={{ marginTop: 4 }}>{a.evidence}</div>
                    <div className="tiny dim" style={{ marginTop: 4 }}>Threshold: {a.threshold}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
      <Section title="Optional external delivery" sub="In-app alerts need no credentials. External delivery (Discord or Telegram) can be added by an owner with a free webhook secret; it is not enabled and nothing was purchased.">
        <p className="small muted">To enable: add a repository secret <code>ALERT_WEBHOOK_URL</code> (a Discord webhook URL or a Telegram bot sendMessage URL) and set the variable <code>VR_ALERT_WEBHOOK</code> to <code>1</code>; the collector posts only high-severity alerts, at most ten per run. See docs/ALERTS.md.</p>
      </Section>
    </>
  );
}
