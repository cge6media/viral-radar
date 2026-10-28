import { useApp } from '../App';
import { useWatchlist } from '../lib/store';
import type { WatchItem, WatchStatus } from '../lib/types';
import { fmtMoney, fmtNum, fmtAgo } from '../lib/data';
import { StageBadge } from '../components/ui';

const STATUSES: { id: WatchStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' },
  { id: 'planning', label: 'Planning' },
  { id: 'producing', label: 'Producing' },
  { id: 'published', label: 'Published' },
];

export default function Watchlist() {
  const { all, now } = useApp();
  const [items, wl] = useWatchlist();
  const byId = new Map(all.map((t) => [t.id, t]));
  const totals = items.reduce((a, i) => ({ views: a.views + (i.actual?.views || 0), cost: a.cost + (i.actual?.cost || 0), revenue: a.revenue + (i.actual?.revenue || 0) }), { views: 0, cost: 0, revenue: 0 });

  return (
    <>
      <h1>Watchlist</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>Saved opportunities with lightweight statuses. Optionally track actual views, cost and revenue per video. Stored in this browser.</p>
      {items.length > 0 && (
        <div className="tiles" style={{ marginBottom: 14 }}>
          <div className="tile"><div className="v num">{items.length}</div><div className="k">Saved</div></div>
          <div className="tile"><div className="v num">{fmtNum(totals.views)}</div><div className="k">Tracked views</div></div>
          <div className="tile"><div className="v num">{fmtMoney(totals.revenue)}</div><div className="k">Tracked revenue</div></div>
          <div className="tile"><div className="v num" style={{ color: totals.revenue - totals.cost >= 0 ? 'var(--money-ink)' : 'var(--ink)' }}>{fmtMoney(totals.revenue - totals.cost)}</div><div className="k">Net of tracked cost</div></div>
        </div>
      )}
      {items.length === 0 && <div className="empty">Nothing saved yet. Use "Watch" on any trend or recommendation to add it here.</div>}
      {STATUSES.map((s) => {
        const list = items.filter((i) => i.status === s.id);
        if (!list.length) return null;
        return (
          <section className="section" key={s.id}>
            <div className="section-head"><h2>{s.label} <span className="muted" style={{ fontWeight: 400 }}>{list.length}</span></h2></div>
            <div className="stack">
              {list.map((i) => <Row key={i.trendId} i={i} trend={byId.get(i.trendId)} now={now} onChange={(p) => wl.update(i.trendId, p)} onRemove={() => wl.remove(i.trendId)} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Row({ i, trend, now, onChange, onRemove }: { i: WatchItem; trend?: ReturnType<typeof useApp>['all'][number]; now: number; onChange: (p: Partial<WatchItem>) => void; onRemove: () => void }) {
  const a = i.actual || {};
  const setA = (k: keyof NonNullable<WatchItem['actual']>, v: string) => onChange({ actual: { ...a, [k]: k === 'url' ? v : v === '' ? undefined : Number(v) } });
  return (
    <div className="card tight">
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <a href={`#/trend/${encodeURIComponent(i.trendId)}`} style={{ fontWeight: 600 }}>{i.name.replace(/ \(format\)$/, '')}</a>
          <div className="small muted">{i.category} · added {fmtAgo(i.addedAt, now)}{trend ? <> · now <StageBadge stage={trend.lifecycle} /> momentum {trend.scores.momentum}</> : <> · no longer in the current dataset</>}</div>
        </div>
        <div className="row">
          <select value={i.status} onChange={(e) => onChange({ status: e.target.value as WatchStatus })} style={{ width: 'auto' }}>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn ghost sm" onClick={onRemove}>Remove</button>
        </div>
      </div>
      <div className="form-grid c3" style={{ marginTop: 10 }}>
        <div className="field"><label>Notes / concept</label><input type="text" value={i.notes || ''} placeholder="Your angle, hook, deadline…" onChange={(e) => onChange({ notes: e.target.value })} /></div>
        <div className="field"><label>Published URL</label><input type="text" value={a.url || ''} placeholder="https://" onChange={(e) => setA('url', e.target.value)} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>Views</label><input type="number" value={a.views ?? ''} onChange={(e) => setA('views', e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Cost $</label><input type="number" value={a.cost ?? ''} onChange={(e) => setA('cost', e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Revenue $</label><input type="number" value={a.revenue ?? ''} onChange={(e) => setA('revenue', e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}
