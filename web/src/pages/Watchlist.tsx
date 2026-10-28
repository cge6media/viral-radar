import { useMemo, useRef, useState } from 'react';
import { useApp } from '../App';
import { exportPrivateData, importPrivateData, useWatchlist } from '../lib/store';
import type { PublishedRecord, WatchItem, WatchStatus } from '../lib/types';
import { fmtMoney, fmtNum, fmtAgo, bestThumb } from '../lib/data';
import { Section, StagePill, StatTile, Thumb } from '../components/ui';
import { Lede } from '../components/ui';
import { downloadText } from '../lib/playbook';
import { ActionPill, TypePill } from './Desk';
import type { DeskAction, OpportunityType } from '../lib/types';

const STATUSES: { id: WatchStatus; label: string; desc: string }[] = [
  { id: 'watching', label: 'Watching', desc: 'Interesting; not decided.' },
  { id: 'selected', label: 'Selected', desc: 'Chosen to produce.' },
  { id: 'producing', label: 'Producing', desc: 'In production now.' },
  { id: 'published', label: 'Published', desc: 'Live — record the real numbers.' },
  { id: 'completed', label: 'Completed', desc: 'Done; numbers final enough to learn from.' },
  { id: 'skipped', label: 'Skipped', desc: 'Decided against it (keep the reason).' },
];
const norm = (s: WatchStatus): WatchStatus => (s === 'planning' ? 'selected' : s);

export default function Watchlist() {
  const { snapshot, now, toast } = useApp();
  const [items, wl] = useWatchlist();
  const byId = new Map(snapshot.trends.map((t) => [t.id, t]));
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const published = items.filter((i) => ['published', 'completed'].includes(norm(i.status)) && i.published);
  const totals = published.reduce((a, i) => ({ views: a.views + (i.published?.views || 0), cost: a.cost + (i.published?.cost || 0), revenue: a.revenue + (i.published?.revenue || 0), hours: a.hours + (i.published?.hours || 0) }), { views: 0, cost: 0, revenue: 0, hours: 0 });
  const learn = useMemo(() => analyse(items), [items]);

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <div className="kicker">Content decision journal · private to this browser</div>
        <h1>Journal</h1>
        <Lede>Every trend you save keeps the assessment Viral Radar made at that moment (type, timing, action, score). Move it through Watching → Selected → Producing → Published → Completed, record the real platform, date, URL, views, production hours, cost and revenue, and the journal compares what happened with what was recommended. Nothing here is uploaded or committed anywhere — export a backup file to move it between devices.</Lede>
        <div className="tiles five">
          <StatTile v={items.length} k="Saved" />
          <StatTile v={published.length} k="Published" cls={published.length ? 'good' : ''} na={!published.length} />
          <StatTile v={fmtNum(totals.views)} k="Real views" na={!totals.views} />
          <StatTile cls={totals.revenue ? 'money' : ''} v={fmtMoney(totals.revenue)} k="Real revenue" na={!totals.revenue} />
          <StatTile cls={totals.hours ? 'money' : ''} v={totals.hours ? fmtMoney((totals.revenue - totals.cost) / totals.hours) + '/h' : '—'} k="Net return per production hour" na={!totals.hours} />
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => { downloadText(`viral-radar-journal-${new Date().toISOString().slice(0, 10)}.json`, exportPrivateData()); toast('Backup downloaded'); }}>Export backup (.json)</button>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>Import backup</button>
          <div className="seg" role="group" aria-label="Import mode"><button className={importMode === 'merge' ? 'on' : ''} onClick={() => setImportMode('merge')}>merge</button><button className={importMode === 'replace' ? 'on' : ''} onClick={() => setImportMode('replace')}>replace</button></div>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const r = importPrivateData(await f.text(), importMode); toast(`Imported ${r.items} item${r.items === 1 ? '' : 's'}`); } catch { toast('That file is not a Viral Radar backup'); } e.target.value = ''; }} />
        </div>
      </header>

      {items.length === 0 && <div className="empty" style={{ marginTop: 16 }}>Nothing saved yet. Save an opportunity from the Creator Desk, a trend from Trends, or a concept from the Studio.</div>}

      {STATUSES.map((s) => {
        const list = items.filter((i) => norm(i.status) === s.id);
        if (!list.length) return null;
        return (
          <section className="section" key={s.id}>
            <div className="section-head"><div><h2>{s.label} <span className="muted" style={{ fontWeight: 600 }}>{list.length}</span></h2><div className="sub">{s.desc}</div></div></div>
            <div className="stack">
              {list.map((i) => <Row key={i.trendId} i={i} trend={byId.get(i.trendId)} now={now} onChange={(p) => wl.update(i.trendId, p)} onRemove={() => wl.remove(i.trendId)} />)}
            </div>
          </section>
        );
      })}

      {learn && (
        <Section title="What the journal has learned" sub="Only from videos you marked Published or Completed with real numbers. Early vs later recommendations compares the first half of your saves with the second half.">
          <div className="grid cols-3">
            <div className="card"><h3>Which trends you chose</h3><ul className="small" style={{ paddingLeft: 18, marginTop: 6 }}>{learn.chosen.map((x) => <li key={x.k}>{x.k}: {x.n} ({x.pct}%)</li>)}</ul></div>
            <div className="card"><h3>Which performed best</h3>{learn.best.length ? <ol className="small" style={{ paddingLeft: 18, marginTop: 6 }}>{learn.best.map((x) => <li key={x.name}>{x.name} — {fmtNum(x.views)} views{x.revenue ? `, ${fmtMoney(x.revenue)}` : ''}{x.hours ? `, ${x.hours}h` : ''}</li>)}</ol> : <p className="small muted">No published numbers yet.</p>}</div>
            <div className="card"><h3>Hours and returns by category</h3>{learn.byCategory.length ? <ul className="small" style={{ paddingLeft: 18, marginTop: 6 }}>{learn.byCategory.map((x) => <li key={x.k}>{x.k}: {x.n} video{x.n === 1 ? '' : 's'}, median {fmtNum(x.medViews)} views, {x.hours ? `${x.hours}h total, ` : ''}{x.hours ? fmtMoney(x.net / x.hours) + '/h' : fmtMoney(x.net) + ' net'}</li>)}</ul> : <p className="small muted">Record production hours and revenue to see returns per hour.</p>}</div>
            <div className="card"><h3>Recommendation vs reality</h3>{learn.vsAssessment.length ? <ul className="small" style={{ paddingLeft: 18, marginTop: 6 }}>{learn.vsAssessment.map((x) => <li key={x.name}>{x.name}: recommended “{x.action}” at score {x.score}; your video reached {fmtNum(x.views)} views vs the best example's {fmtNum(x.topViews)} ({x.ratio}×)</li>)}</ul> : <p className="small muted">Published videos saved from the Creator Desk will show up here.</p>}</div>
            <div className="card"><h3>Earlier vs later recommendations</h3><p className="small" style={{ marginTop: 6 }}>{learn.earlyLate ? `First half of your saves: median ${fmtNum(learn.earlyLate.early)} views · second half: median ${fmtNum(learn.earlyLate.late)} views.` : 'Needs at least four published videos.'}</p></div>
            <div className="card"><h3>Formats worth repeating</h3>{learn.repeat.length ? <ul className="small" style={{ paddingLeft: 18, marginTop: 6 }}>{learn.repeat.map((x) => <li key={x.k}>{x.k}: {x.n} published, median {fmtNum(x.medViews)} views{x.net ? `, ${fmtMoney(x.net)} net` : ''}</li>)}</ul> : <p className="small muted">A format counts as repeatable for you once two of your published videos used it.</p>}</div>
          </div>
        </Section>
      )}
    </>
  );
}

function analyse(items: WatchItem[]) {
  if (!items.length) return null;
  const pub = items.filter((i) => ['published', 'completed'].includes(norm(i.status)) && i.published && (i.published.views || i.published.revenue));
  const count = (f: (i: WatchItem) => string) => { const m = new Map<string, number>(); for (const i of items) m.set(f(i), (m.get(f(i)) || 0) + 1); return Array.from(m.entries()).map(([k, n]) => ({ k, n, pct: Math.round((100 * n) / items.length) })).sort((a, b) => b.n - a.n).slice(0, 6); };
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const group = (f: (i: WatchItem) => string) => { const m = new Map<string, WatchItem[]>(); for (const i of pub) (m.get(f(i)) || m.set(f(i), []).get(f(i))!).push(i); return Array.from(m.entries()).map(([k, list]) => ({ k, n: list.length, medViews: med(list.map((i) => i.published?.views || 0)), hours: list.reduce((a, i) => a + (i.published?.hours || 0), 0), net: list.reduce((a, i) => a + (i.published?.revenue || 0) - (i.published?.cost || 0), 0) })); };
  const byCategory = group((i) => i.category).sort((a, b) => b.net - a.net);
  const repeat = group((i) => i.formatType ? `${i.formatType} · ${i.category}` : i.category).filter((x) => x.n >= 2).sort((a, b) => b.medViews - a.medViews);
  const ordered = [...pub].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const half = Math.floor(ordered.length / 2);
  return {
    chosen: count((i) => i.formatType ? `${i.formatType} (${i.category})` : i.category),
    best: pub.map((i) => ({ name: i.name, views: i.published?.views || 0, revenue: i.published?.revenue, hours: i.published?.hours })).sort((a, b) => b.views - a.views).slice(0, 5),
    byCategory, repeat,
    vsAssessment: pub.filter((i) => i.assessment?.topViews && i.published?.views).map((i) => ({ name: i.name, action: (i.assessment!.action || '').replace('_', ' '), score: i.assessment!.score, views: i.published!.views!, topViews: i.assessment!.topViews!, ratio: Math.round((100 * i.published!.views!) / i.assessment!.topViews!) / 100 })),
    earlyLate: ordered.length >= 4 ? { early: med(ordered.slice(0, half).map((i) => i.published?.views || 0)), late: med(ordered.slice(half).map((i) => i.published?.views || 0)) } : null,
  };
}

function Row({ i, trend, now, onChange, onRemove }: { i: WatchItem; trend?: { name: string; scores: { lifecycle: string }; category: string; evidence: unknown[] } & Parameters<typeof bestThumb>[0]; now: number; onChange: (p: Partial<WatchItem>) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const p = i.published || {};
  const set = (patch: Partial<PublishedRecord>) => onChange({ published: { ...p, ...patch } });
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <article className="card tight journal-row">
      <div className="row between wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <Thumb src={trend ? bestThumb(trend).src : undefined} name={i.name} className="small" />
          <div style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <b className="truncate"><a href={`#/trend/${encodeURIComponent(i.trendId)}`}>{i.name}</a></b>
              <span className="pill kind">{i.category}</span>
              {trend && <StagePill stage={trend.scores.lifecycle} />}
              {!trend && <span className="pill provisional" title="This trend is no longer in the current snapshot">not in the current index</span>}
            </div>
            <div className="tiny dim" style={{ marginTop: 4 }}>saved {fmtAgo(i.addedAt, now)}{i.assessment ? <> · at save time: <ActionPill action={(i.assessment.action || 'monitor') as DeskAction} /> <TypePill type={(i.assessment.type || 'uncertain') as OpportunityType} /> score {i.assessment.score ?? '—'} · fit {i.assessment.fit ?? '—'} · {i.assessment.creators ?? '—'} creators · best example {i.assessment.topViews ? fmtNum(i.assessment.topViews) : '—'} views</> : null}</div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <select value={norm(i.status)} onChange={(e) => onChange({ status: e.target.value as WatchStatus })} aria-label="Status">{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <button className="btn sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Close' : 'Details'}</button>
          <button className="btn ghost sm" onClick={onRemove} aria-label="Remove">✕</button>
        </div>
      </div>
      {open && (
        <div className="stack" style={{ gap: 10, marginTop: 12 }}>
          <label className="field"><span>Notes / why</span><textarea rows={2} value={i.notes || ''} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Angle, reason to skip, what you learned…" /></label>
          {i.concept && <div className="small"><b>Saved concept:</b> {i.concept.title} — {i.concept.hook}</div>}
          <div className="grid cols-4">
            <label className="field"><span>Platform</span><select value={p.platform || ''} onChange={(e) => set({ platform: e.target.value })}><option value="">—</option>{['YouTube Shorts', 'YouTube', 'TikTok', 'Instagram Reels', 'Facebook', 'Other'].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>Publish date</span><input type="date" value={p.date || ''} onChange={(e) => set({ date: e.target.value })} /></label>
            <label className="field" style={{ gridColumn: 'span 2' }}><span>Video URL</span><input type="url" value={p.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" /></label>
            <label className="field"><span>Views</span><input type="number" inputMode="numeric" value={p.views ?? ''} onChange={(e) => set({ views: num(e.target.value) })} /></label>
            <label className="field"><span>Production hours</span><input type="number" step="0.25" inputMode="decimal" value={p.hours ?? ''} onChange={(e) => set({ hours: num(e.target.value) })} /></label>
            <label className="field"><span>Production cost ($)</span><input type="number" step="0.01" inputMode="decimal" value={p.cost ?? ''} onChange={(e) => set({ cost: num(e.target.value) })} /></label>
            <label className="field"><span>Actual revenue ($)</span><input type="number" step="0.01" inputMode="decimal" value={p.revenue ?? ''} onChange={(e) => set({ revenue: num(e.target.value) })} /></label>
          </div>
          {p.views != null && i.assessment?.topViews ? <div className="small muted">Your video reached {fmtNum(p.views)} views — {Math.round((100 * p.views) / i.assessment.topViews) / 100}× the best example Viral Radar showed when you saved this ({fmtNum(i.assessment.topViews)}).{p.hours && p.revenue != null ? ` Net ${fmtMoney((p.revenue - (p.cost || 0)) / p.hours)} per production hour.` : ''}</div> : null}
        </div>
      )}
    </article>
  );
}
