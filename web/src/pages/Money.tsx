import { useMemo, useState } from 'react';
import { PROGRAMS, calculate, defaultsFor, EXAMPLE_SCENARIOS, SPONSORSHIP_NOTE, AFFILIATE_NOTE, type CalcInput } from '../lib/money';
import { fmtMoney, fmtNum, profileScore } from '../lib/data';
import { CATEGORIES } from '../../../pipeline/src/intel/taxonomy';
import { ScenarioBars } from '../components/charts';
import { Section } from '../components/ui';
import { useApp } from '../App';

const initial = (platformId: string): CalcInput => ({
  platformId,
  videosPerMonth: 12,
  viewsPerVideo: 100_000,
  costPerVideo: 60,
  fixedMonthly: 80,
  eligible: true,
  sponsorPerVideo: 0,
  sponsorVideosShare: 0,
  affiliatePerThousandViews: 0,
  ...defaultsFor(platformId),
});

export default function Money() {
  const { ranked } = useApp();
  const [inp, setInp] = useState<CalcInput>(() => initial('youtube_shorts'));
  const program = PROGRAMS.find((p) => p.id === inp.platformId)!;
  const out = useMemo(() => calculate(inp), [inp]);
  const set = <K extends keyof CalcInput>(k: K, v: CalcInput[K]) => setInp((s) => ({ ...s, [k]: v }));
  const switchPlatform = (id: string) => setInp((s) => ({ ...s, platformId: id, ...defaultsFor(id) }));
  const num = (k: keyof CalcInput, opts: { step?: number; min?: number; max?: number } = {}) => (
    <input type="number" value={inp[k] as number} step={opts.step ?? 1} min={opts.min ?? 0} max={opts.max} onChange={(e) => set(k, Math.max(opts.min ?? 0, Number(e.target.value) || 0) as never)} />
  );

  const examples = useMemo(
    () =>
      EXAMPLE_SCENARIOS.map((views) => {
        const o = calculate({ ...inp, videosPerMonth: Math.max(1, inp.videosPerMonth), viewsPerVideo: views / Math.max(1, inp.videosPerMonth) });
        return { views, ...o };
      }),
    [inp],
  );

  // category monetization ratings, cross-referenced with live demand (trends currently active per category)
  const catRows = useMemo(() => {
    const active = new Map<string, number>();
    ranked.forEach((t) => active.set(t.category, (active.get(t.category) || 0) + 1));
    return CATEGORIES.map((c) => ({ name: c.name, p: c.profile, score: Math.round(profileScore(c.name)), active: active.get(c.name) || 0 })).sort((a, b) => b.score - a.score);
  }, [ranked]);

  return (
    <>
      <h1>Money Engine</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>Platform programs, an editable earnings calculator and category monetization ratings. RPM presets are planning ranges from public creator reports — not verified payouts — and every number can be changed.</p>

      <Section title="Platform comparison" sub="Official requirements where published; RPM ranges are third-party estimates (sources linked).">
        <div className="card tight table-wrap">
          <table className="data">
            <thead><tr><th>Platform</th><th>Program & model</th><th>Eligibility</th><th className="r">RPM low</th><th className="r">RPM base</th><th className="r">RPM high</th><th className="r">$ per 1M eligible views (base)</th></tr></thead>
            <tbody>
              {PROGRAMS.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b><div className="small muted">{p.payoutNote}</div></td>
                  <td style={{ maxWidth: 320 }}><div>{p.program}</div><div className="small muted">{p.modelNote}</div></td>
                  <td style={{ maxWidth: 300 }}><ul className="small" style={{ margin: 0, paddingLeft: 16 }}>{p.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
                    <div className="small" style={{ marginTop: 4 }}>{p.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }} className="truncate">{s.title} <span className="dim">({s.date})</span></a>)}</div>
                  </td>
                  <td className="r">{p.model === 'none' ? '—' : `$${p.rpm.low.toFixed(2)}`}</td>
                  <td className="r">{p.model === 'none' ? '—' : `$${p.rpm.base.toFixed(2)}`}</td>
                  <td className="r">{p.model === 'none' ? '—' : `$${p.rpm.high.toFixed(2)}`}</td>
                  <td className="r">{p.model === 'none' ? 'deals only' : fmtMoney(p.rpm.base * 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="notice" style={{ marginTop: 10 }}>High views do not automatically mean high earnings: 1M Shorts views at a $0.06 RPM is about $60, while 1M long-form views at $4 RPM is about $4,000 — and only eligible (monetized/qualified) views count at all.</div>
      </Section>

      <Section title="Earnings calculator" sub="Low / base / high scenarios, costs, break-even and ROI. Change any assumption.">
        <div className="grid cols-2">
          <div className="card">
            <div className="form-grid">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Target platform</label>
                <div className="chips">{PROGRAMS.map((p) => <button key={p.id} className={`chip${inp.platformId === p.id ? ' on' : ''}`} onClick={() => switchPlatform(p.id)}>{p.name}</button>)}</div>
                <div className="hint">{program.modelNote}</div>
              </div>
              <div className="field"><label>Videos per month</label>{num('videosPerMonth', { min: 1 })}</div>
              <div className="field"><label>Expected views per video</label>{num('viewsPerVideo', { step: 1000 })}</div>
              <div className="field"><label>Eligible / qualified views share</label><input type="range" min={0} max={1} step={0.01} value={inp.eligibleShare} onChange={(e) => set('eligibleShare', Number(e.target.value))} /><div className="hint">{Math.round(inp.eligibleShare * 100)}% of raw views count for the program (ad-eligible, qualified For-You views, etc.)</div></div>
              <div className="field"><label>Assumed RPM (USD per 1,000 eligible views)</label>{num('rpm', { step: 0.01 })}<div className="hint">Preset {program.rpm.low}–{program.rpm.high}; low = ×{inp.rpmLowMult.toFixed(2)}, high = ×{inp.rpmHighMult.toFixed(2)}</div></div>
              <div className="field"><label>Low-scenario multiplier</label>{num('rpmLowMult', { step: 0.05 })}</div>
              <div className="field"><label>High-scenario multiplier</label>{num('rpmHighMult', { step: 0.05 })}</div>
              <div className="field"><label>Production cost per video (USD)</label>{num('costPerVideo')}</div>
              <div className="field"><label>Monthly fixed costs (tools, subscriptions)</label>{num('fixedMonthly')}</div>
              <div className="field"><label>Monetization eligibility</label>
                <div className="chips"><button className={`chip${inp.eligible ? ' on' : ''}`} onClick={() => set('eligible', true)}>Eligible now</button><button className={`chip${!inp.eligible ? ' on' : ''}`} onClick={() => set('eligible', false)}>Not yet eligible</button></div>
                <div className="hint">{program.eligibility[0]}{program.eligibility[1] ? ` · ${program.eligibility[1]}` : ''}</div>
              </div>
              <div className="field"><label>Sponsorship: fee per sponsored video</label>{num('sponsorPerVideo', { step: 50 })}<div className="hint">{SPONSORSHIP_NOTE}</div></div>
              <div className="field"><label>Share of videos with a sponsor</label><input type="range" min={0} max={1} step={0.05} value={inp.sponsorVideosShare} onChange={(e) => set('sponsorVideosShare', Number(e.target.value))} /><div className="hint">{Math.round(inp.sponsorVideosShare * 100)}%</div></div>
              <div className="field"><label>Affiliate revenue per 1,000 views</label>{num('affiliatePerThousandViews', { step: 0.1 })}<div className="hint">{AFFILIATE_NOTE}</div></div>
            </div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <div className="tiles">
              <div className="tile"><div className="v num">{fmtNum(out.monthlyViews)}</div><div className="k">Monthly views</div></div>
              <div className="tile"><div className="v num">{fmtNum(out.eligibleViews)}</div><div className="k">Eligible views</div></div>
              <div className="tile"><div className="v num">{fmtMoney(out.expenses)}</div><div className="k">Monthly expenses</div></div>
              <div className="tile"><div className="v num" style={{ color: out.scenarios[1].net >= 0 ? 'var(--money-ink)' : 'var(--ink)' }}>{fmtMoney(out.scenarios[1].net)}</div><div className="k">Net (base scenario)</div></div>
            </div>
            <div className="card">
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Scenario</th><th className="r">RPM</th><th className="r">Program revenue</th><th className="r">Sponsor</th><th className="r">Affiliate</th><th className="r">Total</th><th className="r">Net</th><th className="r">ROI</th></tr></thead>
                  <tbody>
                    {out.scenarios.map((s) => (
                      <tr key={s.name}><td>{s.name}</td><td className="r">${s.rpm.toFixed(2)}</td><td className="r">{fmtMoney(s.adRevenue)}</td><td className="r">{fmtMoney(s.sponsor)}</td><td className="r">{fmtMoney(s.affiliate)}</td><td className="r"><b>{fmtMoney(s.revenue)}</b></td><td className="r" style={{ color: s.net >= 0 ? 'var(--money-ink)' : 'var(--ink-2)' }}>{fmtMoney(s.net)}</td><td className="r">{out.expenses > 0 ? `${Math.round(s.roi * 100)}%` : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="hr" />
              <div className="small stack" style={{ gap: 4 }}>
                <div>
                  <b>Break-even by views (base RPM, {inp.videosPerMonth} videos/month):</b>{' '}
                  {out.expenses <= 0 ? 'no costs to cover' : out.breakEvenViews == null ? 'not reachable — no view-based revenue with these inputs' : out.breakEvenViews === 0 ? 'already covered by sponsorship income' : `${fmtNum(out.breakEvenViews)} views/month${out.breakEvenViewsPerVideo != null ? ` (≈ ${fmtNum(out.breakEvenViewsPerVideo)} per video)` : ''}`}
                </div>
                <div>
                  <b>Break-even by output (at {fmtNum(inp.viewsPerVideo)} views/video):</b>{' '}
                  {out.expenses <= 0 ? 'no costs to cover' : out.netPerVideo <= 0 ? `each video loses ${fmtMoney(-out.netPerVideo, 2)} after its own production cost, so more videos never break even — raise views, RPM or sponsorship, or cut cost per video` : out.breakEvenVideos === 0 ? `each video nets ${fmtMoney(out.netPerVideo, 2)} and there are no fixed costs` : `each video nets ${fmtMoney(out.netPerVideo, 2)}; ${Math.ceil(out.breakEvenVideos!)} videos/month cover the ${fmtMoney(inp.fixedMonthly)} fixed costs`}
                </div>
                {out.notes.map((n) => <div key={n} className="muted">{n}</div>)}
              </div>
            </div>
            <div className="card">
              <div className="legend" style={{ marginBottom: 6 }}><span><i style={{ background: 'var(--ink-4)' }} />Low</span><span><i style={{ background: 'var(--money)' }} />Base</span><span><i style={{ background: 'var(--momentum)' }} />High</span></div>
              <ScenarioBars fmt={(v) => fmtMoney(v)} groups={[
                { label: 'Revenue', values: out.scenarios.map((s, i) => ({ name: s.name, value: s.revenue, color: ['var(--ink-4)', 'var(--money)', 'var(--momentum)'][i] })) },
                { label: 'Net', values: out.scenarios.map((s, i) => ({ name: s.name, value: s.net, color: ['var(--ink-4)', 'var(--money)', 'var(--momentum)'][i] })) },
              ]} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Example scenarios" sub={`Same assumptions, scaled from 100K to 100M monthly views on ${program.name}.`}>
        <div className="card tight table-wrap">
          <table className="data">
            <thead><tr><th className="r">Monthly views</th><th className="r">Eligible</th><th className="r">Low</th><th className="r">Base</th><th className="r">High</th><th className="r">Expenses</th><th className="r">Net (base)</th></tr></thead>
            <tbody>
              {examples.map((e) => (
                <tr key={e.views}><td className="r">{fmtNum(e.views)}</td><td className="r">{fmtNum(e.eligibleViews)}</td><td className="r">{fmtMoney(e.scenarios[0].revenue)}</td><td className="r"><b>{fmtMoney(e.scenarios[1].revenue)}</b></td><td className="r">{fmtMoney(e.scenarios[2].revenue)}</td><td className="r">{fmtMoney(e.expenses)}</td><td className="r" style={{ color: e.scenarios[1].net >= 0 ? 'var(--money-ink)' : 'var(--ink-2)' }}>{fmtMoney(e.scenarios[1].net)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Category monetization ratings" sub="Where creative effort may pay best. Editorial ratings (documented in SCORING.md) × live demand from the current trend set.">
        <div className="card tight table-wrap">
          <table className="data">
            <thead><tr><th>Category</th><th className="r">Score</th><th className="r">Advertiser</th><th className="r">Sponsorship</th><th className="r">Affiliate</th><th className="r">Repeatable</th><th className="r">Longevity</th><th className="r">Demand</th><th className="r">Cost</th><th className="r">Active trends</th></tr></thead>
            <tbody>
              {catRows.map((r) => (
                <tr key={r.name}><td>{r.name}</td><td className="r"><b>{r.score}</b></td>{[r.p.advertiser, r.p.sponsorship, r.p.affiliate, r.p.repeatable, r.p.longevity, r.p.demand, r.p.cost].map((v, i) => <td key={i} className="r">{Math.round(v * 100)}</td>)}<td className="r">{r.active}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>A category with strong views but poor direct monetization (e.g. News & Politics) scores low here even when it dominates attention.</div>
      </Section>
    </>
  );
}
