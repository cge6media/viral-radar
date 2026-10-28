import { useApp } from '../App';
import { useWatchlist } from '../lib/store';
import type { WatchItem, WatchStatus } from '../lib/types';
import { fmtMoney, fmtNum, fmtAgo, bestThumb } from '../lib/data';
import { StagePill, StatTile, Thumb } from '../components/ui';

const STATUSES: { id: WatchStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' }, { id: 'planning', label: 'Planning' }, { id: 'producing', label: 'Producing' }, { id: 'published', label: 'Published' },
];

export default function Watchlist() {
  const { snapshot, now } = useApp();
  const [items, wl] = useWatchlist();
  const byId = new Map(snapshot.trends.map((t) => [t.id, t]));
  const totals = items.reduce((a, i) => ({ views: a.views + (i.actual?.views || 0), cost: a.cost + (i.actual?.cost || 0), revenue: a.revenue + (i.actual?.revenue || 0) }), { views: 0, cost: 0, revenue: 0 });

  return (
    <>
      <h1>Watchlist</h1>
      <p className="muted" style={{ margin: '6px 0 16px', maxWidth: '64ch' }}>Saved opportunities and concepts with lightweight statuses. Track real views, cost and revenue per video to learn what works for you. Stored in this browser.</p>
      {items.length > 0 && (
        <div className="tiles" style={{ marginBottom: 16 }}>
          <StatTile v={items.length} k="Saved" />
          <StatTile v={fmtNum(totals.views)} k="Tracked views" />
          <StatTile cls="money" v={fmtMoney(totals.revenue)} k="Tracked revenue" />
          <StatTile cls={totals.revenue - totals.cost >= 0 ? 'money' : ''} v={fmtMoney(totals.revenue - totals.cost)} k="Net of tracked cost" />
        </div>
      )}
      {items.length === 0 && <div className="empty">Nothing saved yet. Use “Save” on any opportunity, or save a concept from the Studio.</div>}
      {STATUSES.map((s) => {
        const list = items.filter((i) => i.status === s.id);
        if (!list.length) return null;
        return (
          <section className="section" key={s.id}>
            <div className="section-head"><h2>{s.label} <span className="muted" style={{ fontWeight: 600 }}>{list.length}</span></h2></div>
            <div className="stack">
              {list.map((i) => <Row key={i.trendId} i={i} trend={byId.get(i.trendId)} now={now} onChange={(p) => wl.update(i.trendId, p)} onRemove={() => wl.remove(i.trendId)} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Row({ i, trend, now, onChange, onRemove }: { i: WatchItem; trend?: ReturnType<typeof useApp>['snapshot']['trends'][number]; now: number; onChange: (p: Partial<WatchItem>) => void; onRemove: () => void }) {
  const a = i.actual || {};
  const setA = (k: keyof NonNullable<WatchItem['actual']>, v: string) => onChange({ actual: { ...a, [k]: k === 'url' ? v : v === '' ? undefined : Number(v) } });
  return (
    <div className="card tight">
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'start' }}>
        <Thumb src={trend ? bestThumb(trend).src : undefined} name={i.name} />
        <div style={{ minWidth: 0 }}>
          <div className="row between wrap">
            <div style={{ minWidth: 0 }}>
              <a href={`#/trend/${encodeURIComponent(i.trendId)}`} style={{ fontWeight: 800 }}>{i.name}</a>
              <div className="small muted">{i.category} · added {fmtAgo(i.addedAt, now)}{trend ? <> · now <StagePill stage={trend.scores.lifecycle} /> momentum {trend.scores.momentum}</> : <> · no longer in the current dataset</>}</div>
            </div>
            <div className="row">
              <select value={i.status} onChange={(e) => onChange({ status: e.target.value as WatchStatus })} style={{ width: 'auto' }}>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              <button className="btn ghost sm" onClick={onRemove}>Remove</button>
            </div>
          </div>
          {i.concept && <div className="small" style={{ marginTop: 6 }}><b>Concept:</b> {i.concept.title} — {i.concept.hook}</div>}
        </div>
      </div>
      <div className="form-grid c3" style={{ marginTop: 10 }}>
        <div className="field"><label>Notes</label><input type="text" value={i.notes || ''} placeholder="Your angle, hook, deadline…" onChange={(e) => onChange({ notes: e.target.value })} /></div>
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
