import { useState } from 'react';
import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { advise } from '../lib/studio';
import { bestThumb, fmtAgo, fmtNum, growthLabel, personalize, viewFor } from '../lib/data';
import { monetizationSuitability, productionEconomics, investmentScenarios, PROGRAMS } from '../lib/money';
import { GRADE, PLATFORM_LABEL, STAGE, WINDOW_LABEL } from '../lib/types';
import type { SavedConcept } from '../lib/types';
import { EvidenceCard, GradePill, GrowthPill, KindPill, ScoreBars, Section, StagePill, StatTile, Thumb, WindowSwitch } from '../components/ui';
import { Sparkline } from '../components/charts';
import { fmtMoney } from '../lib/data';

export default function TrendDetail({ id }: { id: string }) {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const t = app.snapshot.trends.find((x) => x.id === id);
  const [showAll, setShowAll] = useState(false);
  if (!t) return <div className="empty">This trend isn't in the current dataset (it may have aged out). <a href="#/" style={{ color: 'var(--accent-ink)' }}>Back to Discover</a></div>;
  const v = personalize(viewFor(t, app.window, app.now), prefs);
  const w = v.w;
  const a = advise(v, w, prefs);
  const g = growthLabel(w);
  const watched = watch.find((x) => x.trendId === t.id);
  const th = bestThumb(t);
  const ms = monetizationSuitability(t.category);
  const econ = productionEconomics(t.category, prefs.tools);
  const videos = v.evidence.filter((e) => e.kind === 'video');
  const signals = v.evidence.filter((e) => e.kind !== 'video');
  const shown = showAll ? videos : videos.slice(0, 8);
  const inv = investmentScenarios({ videosPerMonth: 8, costPerVideo: econ.cash[0] + (econ.cash[1] - econ.cash[0]) / 2, fixedMonthly: 50, viewsLow: 20_000, viewsBase: 100_000, viewsHigh: 1_000_000, platformIds: ['youtube_shorts', 'youtube_long', 'tiktok_rewards'] });
  const save = (concept?: SavedConcept) => {
    if (watched) wl.update(t.id, concept ? { concept, status: 'planning' } : {});
    else wl.add({ trendId: t.id, name: t.name, category: t.category, status: concept ? 'planning' : 'watching', concept });
    app.toast(concept ? 'Concept saved to your production queue' : 'Saved to watchlist');
  };

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <a className="small muted" href="#/">← Discover</a>
        <WindowSwitch value={app.window} onChange={app.setWindow} />
      </div>

      <article className="hero">
        <div className="media"><Thumb src={th.src} name={t.name} play={t.videoCount > 0} overlay={<div className="shade" />} /></div>
        <div className="body">
          <div className="kicker">{t.category} › {t.subcategory}{t.kind === 'microtrend' ? ` › ${t.format}` : ''}</div>
          <h2>{t.name}</h2>
          <div className="row wrap" style={{ gap: 6 }}>
            <KindPill kind={t.kind} />
            <StagePill stage={w.lifecycle} />
            <GradePill grade={w.grade} />
            <GrowthPill v={v} />
            {t.isNewsEvent && <span className="pill news">News / person event</span>}
            {t.isGeneric && <span className="pill kind">Evergreen category</span>}
          </div>
          <p className="why">{t.summary}</p>
          <div className="facts">
            <div className="fact"><div className="k">Platforms</div><div className="v">{t.platforms.map((p) => PLATFORM_LABEL[p]).join(' · ')}</div></div>
            <div className="fact"><div className="k">Momentum</div><div className="v num">{w.momentum} <span className="tiny dim">/100 · {WINDOW_LABEL[app.window].toLowerCase()}</span></div></div>
            <div className="fact"><div className="k">First detected</div><div className="v">{fmtAgo(t.firstDetected, app.now)}</div></div>
            <div className="fact"><div className="k">Evidence quality</div><div className="v">{GRADE[w.grade].label}</div></div>
          </div>
          <div className="actions">
            <a className="btn primary lg" href="#studio">Turn this into a video idea</a>
            <button className="btn lg" onClick={() => save()} disabled={!!watched}>{watched ? `Saved · ${watched.status}` : 'Save trend'}</button>
          </div>
        </div>
      </article>

      <Section title="Actual video examples" sub={videos.length ? `${videos.length} relevant example${videos.length === 1 ? '' : 's'} in this window — ${w.directVideos} with platform statistics. Opens the original.` : 'No video examples inside this window.'}>
        {videos.length ? (
          <>
            <div className="egrid">{shown.map((e) => <EvidenceCard key={e.id} e={e} now={app.now} />)}</div>
            {videos.length > 8 && <div style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show fewer' : `Show all ${videos.length}`}</button></div>}
          </>
        ) : <div className="empty">Evidence here is search or social interest only — not proven video performance.</div>}
        {signals.length > 0 && (
          <div className="card tight" style={{ marginTop: 12 }}>
            <div className="small muted" style={{ marginBottom: 6 }}>Supporting signals</div>
            {signals.map((e) => (
              <div key={e.id} className="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="truncate" style={{ fontWeight: 700 }}>{e.title}</a>
                <span className="muted num" style={{ whiteSpace: 'nowrap' }}>{{ search_interest: 'search spike', social_topic: 'social topic', hashtag: 'hashtag', post: 'post', video: 'video' }[e.kind]} · {PLATFORM_LABEL[e.source]}{e.region ? ` ${e.region}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Growth analysis" sub="Only observed history. Nothing here is a projection.">
        <div className="grid cols-2">
          <div className="card">
            <div className="tiles" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <StatTile cls="momentum" v={w.adoption} k="Category adoption" s={`${w.creators} independent creators${w.newCreators ? `, ${w.newCreators} new in 48h` : ''}`} />
              <StatTile v={w.videoPerformance ?? 'n/a'} na={w.videoPerformance == null} k="Video performance" s={w.videoPerformance == null ? 'needs platform statistics' : `${w.directVideos} measured videos, age-normalized`} />
              <StatTile v={w.videoMomentum ?? 'n/a'} na={w.videoMomentum == null} k="Video momentum" s={w.velocity ? `${w.velocity.videosMeasured} videos re-measured${w.velocity.viewsPerHour != null ? ` · ${fmtNum(w.velocity.viewsPerHour)} views/h` : ''}` : 'needs repeated observations'} />
              <StatTile v={w.audienceInterest} k="Audience interest" s="searches, hashtags, discussion" />
            </div>
            <div className="hr" />
            <div className="row between">
              <div>
                <div className="small muted">Momentum across runs ({t.series.length} point{t.series.length === 1 ? '' : 's'})</div>
                <div style={{ fontWeight: 800 }}>{g.label}</div>
              </div>
              <Sparkline points={t.series.map((p) => ({ t: p.t, v: p.momentum }))} width={170} height={44} />
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>What the data says</h3>
            <ul className="explain">{w.notes.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="hr" />
            <ScoreBars v={v} />
            <div className="tiny dim" style={{ marginTop: 8 }}>Confidence {w.confidence}/100 · {w.items} items · {w.videos} videos · {w.directVideos} measured · {t.platforms.length} source{t.platforms.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </Section>

      <Section title="Why this trend matters" sub="Concise, evidence-backed. Cautions are listed, not hidden.">
        <div className="grid cols-2">
          <div className="card stack">
            <h3>Why it may be growing</h3>
            <ul className="explain">{a.why.map((x) => <li key={x}>{x}</li>)}</ul>
            <h3>What successful examples share</h3>
            <ul className="explain">{a.characteristics.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="card stack">
            <h3>Timing: {a.timing.label}</h3>
            <p className="small">{a.timing.detail} <span className="muted">Lifecycle: {STAGE[w.lifecycle].label}.</span></p>
            {a.cautions.length > 0 && (<><h3>Cautions</h3><ul className="explain">{a.cautions.map((x) => <li key={x}>{x}</li>)}</ul></>)}
          </div>
        </div>
      </Section>

      <Section title="Creator opportunity" sub="Three original concepts derived from this trend's evidence and your tools. Save one to your production queue.">
        <div id="studio" className="grid cols-3">
          {a.concepts.map((c) => (
            <div className="card concept" key={c.title} style={{ borderLeft: '3px solid var(--creator)' }}>
              <h4>{c.title}</h4>
              <p className="small" style={{ marginBottom: 8 }}>{c.hook}</p>
              <dl className="kv">
                <dt>Opening</dt><dd>{c.opening}</dd>
                <dt>Structure</dt><dd>{c.structure.join(' → ')}</dd>
                <dt>Length</dt><dd>{c.length}</dd>
                <dt>Approach</dt><dd>{c.approach}</dd>
                <dt>Platform</dt><dd>{c.platform}</dd>
                <dt>Difficulty</dt><dd>{c.difficulty}</dd>
                <dt>Budget</dt><dd>{c.budget}</dd>
                <dt>Money</dt><dd>{c.monetization}</dd>
              </dl>
              <div style={{ marginTop: 10 }}><button className="btn sm primary" onClick={() => save(c)}>Save to production queue</button></div>
            </div>
          ))}
        </div>
        <div className="card tight" style={{ marginTop: 12 }}>
          <div className="small"><b>Publish on:</b> {a.platforms.platform} — {a.platforms.why}. <b>Difficulty:</b> {a.difficulty.label} ({a.difficulty.why}).</div>
        </div>
      </Section>

      <Section title="Revenue potential" sub="Scenario, not a forecast: 8 videos/month at this category's typical production cost, three view outlooks, program revenue only." more="Adjust in Money Engine" moreHref={`#/money?category=${encodeURIComponent(t.category)}`}>
        <div className="grid cols-2">
          <div className="card">
            <div className="row between"><h3>Monetization suitability</h3><b className="num" style={{ color: 'var(--money-ink)', fontSize: 22 }}>{ms.score}</b></div>
            <div className="small muted" style={{ margin: '4px 0 10px' }}>Category profile for {t.category}: how well it fits ad, sponsorship and affiliate programs. Editorial, not measured earnings.</div>
            {ms.parts.map((p) => (
              <div key={p.label} className="score money" style={{ marginBottom: 6 }}><div className="lbl"><span>{p.label}</span><b>{p.value}</b></div><div className="bar"><i style={{ width: `${p.value}%` }} /></div></div>
            ))}
            <div className="hr" />
            <div className="small"><b>Production economics:</b> {econ.label} — {econ.hours[0]}–{econ.hours[1]} h and ${econ.cash[0]}–${econ.cash[1]} per video with your tools.</div>
          </div>
          <div className="card table-wrap">
            <table className="data">
              <thead><tr><th>Platform</th><th className="r">RPM</th><th className="r">20K views/video</th><th className="r">100K</th><th className="r">1M</th><th className="r">Break-even views/video</th></tr></thead>
              <tbody>
                {inv.map((r) => (
                  <tr key={r.platformId}><td>{r.platform}</td><td className="r">${r.rpm.toFixed(2)}</td>{r.scenarios.map((s) => <td key={s.name} className="r" style={{ color: s.net >= 0 ? 'var(--money-ink)' : 'var(--ink-2)' }}>{fmtMoney(s.net)}</td>)}<td className="r">{r.breakEvenViewsPerVideo == null ? '—' : fmtNum(r.breakEvenViewsPerVideo)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="tiny dim" style={{ marginTop: 8 }}>Net per month after ~{fmtMoney(inv[0]?.costs || 0)} of production. Eligibility assumed; {PROGRAMS.find((p) => p.id === 'youtube_shorts')?.eligibility[0]} for YouTube.</div>
          </div>
        </div>
      </Section>
    </>
  );
}
