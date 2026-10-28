import { useEffect, useState } from 'react';
import { PROGRAMS } from '../lib/money';
import { fmtMoney, fmtNum } from '../lib/data';
import { Section } from './ui';

/** Production return comparison (4.0): two ideas, editable assumptions, illustrative returns per production hour. */
export interface IdeaInput { name: string; hours: number; cost: number; views: number; qualifiedPct: number; rpm: number; sponsor: number; platformId: string }
const KEY = 'vr.compare.v1';
const DEFAULT: [IdeaInput, IdeaInput] = [
  { name: 'Idea A', hours: 0.75, cost: 5, views: 50_000, qualifiedPct: 60, rpm: 0.08, sponsor: 0, platformId: 'youtube_shorts' },
  { name: 'Idea B', hours: 2, cost: 20, views: 150_000, qualifiedPct: 60, rpm: 0.08, sponsor: 0, platformId: 'youtube_shorts' },
];

export function ideaReturn(i: IdeaInput): { revenue: number; profit: number; perHour: number; breakEvenViews: number } {
  const revenue = (i.views * (i.qualifiedPct / 100) * i.rpm) / 1000 + i.sponsor;
  const profit = revenue - i.cost;
  const perHour = i.hours > 0 ? profit / i.hours : 0;
  const perView = (i.qualifiedPct / 100) * i.rpm / 1000;
  const breakEvenViews = perView > 0 ? Math.max(0, (i.cost - i.sponsor) / perView) : Infinity;
  return { revenue, profit, perHour, breakEvenViews };
}

export default function ProductionCompare({ prefill }: { prefill?: Partial<IdeaInput>[] }) {
  const [ideas, setIdeas] = useState<[IdeaInput, IdeaInput]>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as [IdeaInput, IdeaInput]; } catch { /* ignore */ }
    return prefill ? [{ ...DEFAULT[0], ...prefill[0] }, { ...DEFAULT[1], ...prefill[1] }] : DEFAULT;
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ideas)); } catch { /* ignore */ } }, [ideas]);
  const set = (k: 0 | 1, patch: Partial<IdeaInput>) => setIdeas((s) => { const n: [IdeaInput, IdeaInput] = [{ ...s[0] }, { ...s[1] }]; n[k] = { ...n[k], ...patch }; return n; });
  const res = ideas.map(ideaReturn);
  const better = res[0].perHour === res[1].perHour ? -1 : res[0].perHour > res[1].perHour ? 0 : 1;
  const field = (k: 0 | 1, key: keyof IdeaInput, label: string, opts: { step?: number; min?: number; max?: number; suffix?: string } = {}) => (
    <label className="field"><span>{label}{opts.suffix ? ` (${opts.suffix})` : ''}</span><input type="number" inputMode="decimal" step={opts.step ?? 1} min={opts.min ?? 0} max={opts.max} value={ideas[k][key] as number} onChange={(e) => set(k, { [key]: Math.max(opts.min ?? 0, Number(e.target.value) || 0) } as Partial<IdeaInput>)} /></label>
  );
  return (
    <Section title="Production return comparison" sub="Compare two content ideas on the economics of your own assumptions: production time and cost, assumed views, the share of views that qualify for the program, the RPM you expect, any sponsorship. Illustrative only — a trend's popularity never implies that a new creator will get similar views.">
      <div className="grid cols-2">
        {([0, 1] as const).map((k) => {
          const i = ideas[k]; const r = res[k];
          const program = PROGRAMS.find((p) => p.id === i.platformId);
          return (
            <div className={`card compare${better === k ? ' better' : ''}`} key={k}>
              <div className="row between wrap" style={{ gap: 8 }}>
                <input className="name" value={i.name} onChange={(e) => set(k, { name: e.target.value })} aria-label="Idea name" />
                <select value={i.platformId} onChange={(e) => { const p = PROGRAMS.find((x) => x.id === e.target.value); set(k, { platformId: e.target.value, rpm: p ? p.rpm.base : i.rpm, qualifiedPct: p ? Math.round(p.eligibleShareDefault * 100) : i.qualifiedPct }); }} aria-label="Platform">{PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div className="grid cols-3" style={{ marginTop: 10 }}>
                {field(k, 'hours', 'Production time', { step: 0.25, suffix: 'h' })}
                {field(k, 'cost', 'Production cost', { step: 1, suffix: '$' })}
                {field(k, 'views', 'Assumed views', { step: 1000 })}
                {field(k, 'qualifiedPct', 'Qualified views', { step: 1, max: 100, suffix: '%' })}
                {field(k, 'rpm', 'RPM', { step: 0.01, suffix: '$ / 1K qualified' })}
                {field(k, 'sponsor', 'Sponsorship', { step: 10, suffix: '$' })}
              </div>
              <div className="tiles" style={{ marginTop: 10 }}>
                <div className="tile"><div className="v num money">{fmtMoney(r.revenue, 2)}</div><div className="k">Illustrative revenue</div></div>
                <div className="tile"><div className={`v num ${r.profit >= 0 ? 'money' : 'bad'}`}>{fmtMoney(r.profit, 2)}</div><div className="k">Profit after cost</div></div>
                <div className="tile"><div className={`v num ${r.perHour >= 0 ? 'money' : 'bad'}`}>{fmtMoney(r.perHour, 2)}/h</div><div className="k">Return per production hour</div></div>
                <div className="tile"><div className="v num">{isFinite(r.breakEvenViews) ? fmtNum(Math.round(r.breakEvenViews)) : '—'}</div><div className="k">Views to break even</div></div>
              </div>
              {program && <div className="tiny dim" style={{ marginTop: 8 }}>{program.name}: {program.eligibility[0] || 'see platform comparison'} · RPM range {fmtMoney(program.rpm.low, 2)}–{fmtMoney(program.rpm.high, 2)} (third-party estimates)</div>}
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>{better === -1 ? 'Both ideas return the same per hour under these assumptions.' : `${ideas[better].name} returns ${fmtMoney(Math.abs(res[0].perHour - res[1].perHour), 2)} more per production hour under these assumptions — change the assumed views to see how sensitive the comparison is.`} Potential revenue is not likely revenue: eligibility, RPM and views are all assumptions you control here.</p>
    </Section>
  );
}
