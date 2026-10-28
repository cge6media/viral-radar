import { useMemo, useState } from 'react';
import { PROGRAMS, calculate, defaultsFor, EXAMPLE_SCENARIOS, SPONSORSHIP_NOTE, AFFILIATE_NOTE, monetizationSuitability, productionEconomics, investmentScenarios, type CalcInput } from '../lib/money';
import { fmtMoney, fmtNum, isQualified } from '../lib/data';
import { CATEGORIES } from '../../../pipeline/src/intel/taxonomy';
import { ScenarioBars } from '../components/charts';
import { Section, StatTile } from '../components/ui';
import ProductionCompare from '../components/compare';
import { useApp } from '../App';
import { usePrefs } from '../lib/store';

const initial = (platformId: string): CalcInput => ({
  platformId, videosPerMonth: 12, viewsPerVideo: 100_000, costPerVideo: 60, fixedMonthly: 80, eligible: true,
  sponsorPerVideo: 0, sponsorVideosShare: 0, affiliatePerThousandViews: 0, ...defaultsFor(platformId),
});

export default function Money() {
  const { ranked } = useApp();
  const [prefs] = usePrefs();
  const [inp, setInp] = useState<CalcInput>(() => initial('youtube_shorts'));
  const [inv, setInv] = useState({ videosPerMonth: 30, costPerVideo: 15, fixedMonthly: 50, viewsLow: 10_000, viewsBase: 50_000, viewsHigh: 500_000 });
  const program = PROGRAMS.find((p) => p.id === inp.platformId)!;
  const out = useMemo(() => calculate(inp), [inp]);
  const set = <K extends keyof CalcInput>(k: K, v: CalcInput[K]) => setInp((s) => ({ ...s, [k]: v }));
  const switchPlatform = (id: string) => setInp((s) => ({ ...s, platformId: id, ...defaultsFor(id) }));
  const num = (k: keyof CalcInput, opts: { step?: number; min?: number } = {}) => (
    <input type="number" value={inp[k] as number} step={opts.step ?? 1} min={opts.min ?? 0} onChange={(e) => set(k, Math.max(opts.min ?? 0, Number(e.target.value) || 0) as never)} />
  );
  const examples = useMemo(() => EXAMPLE_SCENARIOS.map((views) => ({ views, ...calculate({ ...inp, videosPerMonth: Math.max(1, inp.videosPerMonth), viewsPerVideo: views / Math.max(1, inp.videosPerMonth) }) })), [inp]);
  const rows = useMemo(() => investmentScenarios({ ...inv, platformIds: ['youtube_shorts', 'youtube_long', 'tiktok_rewards', 'facebook_cmp'] }), [inv]);
  const audience = useMemo(() => {
    const q = ranked.filter((v) => isQualified(v, prefs));
    return CATEGORIES.map((c) => {
      const inCat = q.filter((v) => v.category === c.name);
      const ms = monetizationSuitability(c.name);
      const econ = productionEconomics(c.name, prefs.tools);
      return { name: c.name, suitability: ms.score, audience: inCat.length ? Math.max(...inCat.map((v) => v.w.audienceInterest)) : null, momentum: inCat.length ? Math.max(...inCat.map((v) => v.w.momentum)) : null, qualified: inCat.length, econ };
    }).sort((a, b) => (b.qualified - a.qualified) || b.suitability - a.suitability);
  }, [ranked, prefs]);

  return (
    <>
      <h1>Money Engine</h1>
      <p className="muted" style={{ margin: '6px 0 18px', maxWidth: '68ch' }}>Four separate questions: does the category fit monetization programs, is there audience opportunity right now, what does production cost, and what could revenue look like under assumptions you control. Nothing here is a forecast of guaranteed earnings.</p>

      <Section title="Suitability · audience · economics" sub="Suitability is an editorial category profile. Audience opportunity comes from the live trend set (qualified trends only). Production economics reflect your tools.">
        <div className="card tight table-wrap">
          <table className="data">
            <thead><tr><th>Category</th><th className="r">Monetization suitability</th><th className="r">Audience opportunity</th><th className="r">Momentum</th><th className="r">Qualified trends</th><th>Production economics</th></tr></thead>
            <tbody>
              {audience.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td className="r"><b style={{ color: 'var(--money-ink)' }}>{r.suitability}</b></td>
                  <td className="r">{r.audience ?? <span className="dim">no qualified trend</span>}</td>
                  <td className="r">{r.momentum ?? <span className="dim">—</span>}</td>
                  <td className="r">{r.qualified}</td>
                  <td className="small">{r.econ.label} · {r.econ.hours[0]}–{r.econ.hours[1]} h · ${r.econ.cash[0]}–${r.econ.cash[1]} per video</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <ProductionCompare />

      <Section title="Content investment calculator" sub="Plan a month of production once and compare what the same plan could return on each platform. Program revenue only; sponsorship and affiliate are modelled in the full calculator below.">
        <div className="grid cols-2">
          <div className="card">
            <div className="form-grid">
              <div className="field"><label>Videos per month</label><input type="number" min={1} value={inv.videosPerMonth} onChange={(e) => setInv({ ...inv, videosPerMonth: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="field"><label>Production cost per video ($)</label><input type="number" min={0} value={inv.costPerVideo} onChange={(e) => setInv({ ...inv, costPerVideo: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="field"><label>Fixed monthly costs ($)</label><input type="number" min={0} value={inv.fixedMonthly} onChange={(e) => setInv({ ...inv, fixedMonthly: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="field"><label>Views per video — low</label><input type="number" min={0} step={1000} value={inv.viewsLow} onChange={(e) => setInv({ ...inv, viewsLow: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="field"><label>Views per video — base</label><input type="number" min={0} step={1000} value={inv.viewsBase} onChange={(e) => setInv({ ...inv, viewsBase: Math.max(0, Number(e.target.value) || 0) })} /></div>
              <div className="field"><label>Views per video — high</label><input type="number" min={0} step={1000} value={inv.viewsHigh} onChange={(e) => setInv({ ...inv, viewsHigh: Math.max(0, Number(e.target.value) || 0) })} /></div>
            </div>
            <div className="tiny dim" style={{ marginTop: 10 }}>Example: 30 animated videos at $15 each = {fmtMoney(30 * 15)} + fixed costs. Uses each platform's base RPM and eligible-view share (editable below); assumes eligibility.</div>
          </div>
          <div className="card table-wrap">
            <table className="data">
              <thead><tr><th>Platform</th><th className="r">RPM</th><th className="r">Eligible</th><th className="r">Low net</th><th className="r">Base net</th><th className="r">High net</th><th className="r">Break-even views/video</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.platformId}><td style={{ fontWeight: 700 }}>{r.platform}</td><td className="r">${r.rpm.toFixed(2)}</td><td className="r">{Math.round(r.eligibleShare * 100)}%</td>{r.scenarios.map((s) => <td key={s.name} className="r" style={{ color: s.net >= 0 ? 'var(--money-ink)' : 'var(--ink-2)' }}>{fmtMoney(s.net)}</td>)}<td className="r">{r.breakEvenViewsPerVideo == null ? '—' : fmtNum(r.breakEvenViewsPerVideo)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="tiny dim" style={{ marginTop: 8 }}>Monthly net = program revenue − {fmtMoney(rows[0]?.costs || 0)} production. Instagram has no per-view program and is omitted.</div>
          </div>
        </div>
      </Section>

      <Section title="Platform comparison" sub="Official requirements where published; RPM ranges are third-party estimates with sources.">
        <div className="card tight table-wrap">
          <table className="data">
            <thead><tr><th>Platform</th><th>Program & model</th><th>Eligibility</th><th className="r">RPM low</th><th className="r">base</th><th className="r">high</th><th className="r">$ per 1M eligible views</th></tr></thead>
            <tbody>
              {PROGRAMS.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b><div className="small muted">{p.payoutNote}</div></td>
                  <td style={{ maxWidth: 320 }}><div>{p.program}</div><div className="small muted">{p.modelNote}</div></td>
                  <td style={{ maxWidth: 300 }}><ul className="small" style={{ margin: 0, paddingLeft: 16 }}>{p.eligibility.map((e) => <li key={e}>{e}</li>)}</ul>
                    <div className="small" style={{ marginTop: 4 }}>{p.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--ink-2)' }} className="truncate">{s.title} <span className="dim">({s.date})</span></a>)}</div>
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

      <Section title="Full earnings calculator" sub="Low / base / high scenarios, costs, two break-even views and ROI. Change any assumption.">
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
              <div className="field"><label>Eligible / qualified views share</label><input type="range" min={0} max={1} step={0.01} value={inp.eligibleShare} onChange={(e) => set('eligibleShare', Number(e.target.value))} /><div className="hint">{Math.round(inp.eligibleShare * 100)}% of raw views count for the program</div></div>
              <div className="field"><label>Assumed RPM ($ per 1,000 eligible views)</label>{num('rpm', { step: 0.01 })}<div className="hint">Preset {program.rpm.low}–{program.rpm.high}; low = ×{inp.rpmLowMult.toFixed(2)}, high = ×{inp.rpmHighMult.toFixed(2)}</div></div>
              <div className="field"><label>Low-scenario multiplier</label>{num('rpmLowMult', { step: 0.05 })}</div>
              <div className="field"><label>High-scenario multiplier</label>{num('rpmHighMult', { step: 0.05 })}</div>
              <div className="field"><label>Production cost per video ($)</label>{num('costPerVideo')}</div>
              <div className="field"><label>Monthly fixed costs ($)</label>{num('fixedMonthly')}</div>
              <div className="field"><label>Monetization eligibility</label>
                <div className="chips"><button className={`chip${inp.eligible ? ' on' : ''}`} onClick={() => set('eligible', true)}>Eligible now</button><button className={`chip${!inp.eligible ? ' on' : ''}`} onClick={() => set('eligible', false)}>Not yet eligible</button></div>
                <div className="hint">{program.eligibility[0]}{program.eligibility[1] ? ` · ${program.eligibility[1]}` : ''}</div>
              </div>
              <div className="field"><label>Sponsorship fee per sponsored video ($)</label>{num('sponsorPerVideo', { step: 50 })}<div className="hint">{SPONSORSHIP_NOTE}</div></div>
              <div className="field"><label>Share of videos with a sponsor</label><input type="range" min={0} max={1} step={0.05} value={inp.sponsorVideosShare} onChange={(e) => set('sponsorVideosShare', Number(e.target.value))} /><div className="hint">{Math.round(inp.sponsorVideosShare * 100)}%</div></div>
              <div className="field"><label>Affiliate revenue per 1,000 views ($)</label>{num('affiliatePerThousandViews', { step: 0.1 })}<div className="hint">{AFFILIATE_NOTE}</div></div>
            </div>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <div className="tiles">
              <StatTile v={fmtNum(out.monthlyViews)} k="Monthly views" />
              <StatTile v={fmtNum(out.eligibleViews)} k="Eligible views" />
              <StatTile v={fmtMoney(out.expenses)} k="Monthly expenses" />
              <StatTile cls={out.scenarios[1].net >= 0 ? 'money' : ''} v={fmtMoney(out.scenarios[1].net)} k="Net (base)" />
            </div>
            <div className="card">
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Scenario</th><th className="r">RPM</th><th className="r">Program</th><th className="r">Sponsor</th><th className="r">Affiliate</th><th className="r">Gross</th><th className="r">Net</th><th className="r">Per video</th><th className="r">ROI</th></tr></thead>
                  <tbody>
                    {out.scenarios.map((s) => (
                      <tr key={s.name}><td>{s.name}</td><td className="r">${s.rpm.toFixed(2)}</td><td className="r">{fmtMoney(s.adRevenue)}</td><td className="r">{fmtMoney(s.sponsor)}</td><td className="r">{fmtMoney(s.affiliate)}</td><td className="r"><b>{fmtMoney(s.revenue)}</b></td><td className="r" style={{ color: s.net >= 0 ? 'var(--money-ink)' : 'var(--ink-2)' }}>{fmtMoney(s.net)}</td><td className="r">{fmtMoney(inp.videosPerMonth ? s.revenue / inp.videosPerMonth : 0)}</td><td className="r">{out.expenses > 0 ? `${Math.round(s.roi * 100)}%` : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="hr" />
              <div className="small stack" style={{ gap: 4 }}>
                <div><b>Break-even by views ({inp.videosPerMonth} videos/month):</b> {out.expenses <= 0 ? 'no costs to cover' : out.breakEvenViews == null ? 'not reachable — no view-based revenue with these inputs' : out.breakEvenViews === 0 ? 'already covered by sponsorship income' : `${fmtNum(out.breakEvenViews)} views/month${out.breakEvenViewsPerVideo != null ? ` (≈ ${fmtNum(out.breakEvenViewsPerVideo)} per video)` : ''}`}</div>
                <div><b>Break-even by output ({fmtNum(inp.viewsPerVideo)} views/video):</b> {out.expenses <= 0 ? 'no costs to cover' : out.netPerVideo <= 0 ? `each video loses ${fmtMoney(-out.netPerVideo, 2)} after its own cost — more videos never break even; raise views, RPM or sponsorship, or cut cost per video` : out.breakEvenVideos === 0 ? `each video nets ${fmtMoney(out.netPerVideo, 2)}; no fixed costs` : `each video nets ${fmtMoney(out.netPerVideo, 2)}; ${Math.ceil(out.breakEvenVideos!)} videos/month cover the ${fmtMoney(inp.fixedMonthly)} fixed costs`}</div>
                {out.notes.map((n) => <div key={n} className="muted">{n}</div>)}
              </div>
            </div>
            <div className="card">
              <div className="legend" style={{ marginBottom: 6 }}><span><i style={{ background: 'var(--ink-4)' }} />Low</span><span><i style={{ background: 'var(--money)' }} />Base</span><span><i style={{ background: 'var(--momentum)' }} />High</span></div>
              <ScenarioBars fmt={(v) => fmtMoney(v)} groups={[
                { label: 'Gross revenue', values: out.scenarios.map((s, i) => ({ name: s.name, value: s.revenue, color: ['var(--ink-4)', 'var(--money)', 'var(--momentum)'][i] })) },
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
    </>
  );
}
