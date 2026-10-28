import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import { useWatchlist } from '../lib/store';
import type { DeskOpportunity } from '../lib/types';
import { fmtAgo, fmtNum } from '../lib/data';
import { evidenceToCard } from '../lib/videos';
import { VideoRail } from '../components/video';
import { Section, StatTile, TypePill, ActionPill, TimingPill, TYPE_LABEL, ACTION_LABEL, TIMING_LABEL } from '../components/ui';
import { Lede } from '../components/ui';
export { TypePill, ActionPill, TimingPill, TYPE_LABEL, ACTION_LABEL, TIMING_LABEL };
import { buildBriefs, briefsToMarkdown, downloadText, type Brief } from '../lib/playbook';

function useSelected(): [string, (id: string) => void] {
  const read = () => new URLSearchParams(location.hash.split('?')[1] || '').get('o') || '';
  const [sel, setSel] = useState(read);
  useEffect(() => { const on = () => setSel(read()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return [sel, (id) => { location.hash = id ? `#/desk?o=${encodeURIComponent(id)}` : '#/desk'; }];
}

export default function Desk() {
  const { snapshot, now, toast } = useApp();
  const desk = snapshot.desk;
  const [sel, setSel] = useSelected();
  const [watch, wl] = useWatchlist();
  const ops = desk?.opportunities || [];
  const primary = ops.filter((o) => o.action === 'create_today' || o.action === 'participate' || o.action === 'research');
  const secondary = ops.filter((o) => !primary.includes(o));
  const chosen = useMemo(() => ops.find((o) => o.id === sel), [ops, sel]);
  const ageH = (now - new Date(snapshot.generatedAt).getTime()) / 36e5;

  if (!desk) return <div className="notice warn">The Creator Desk appears after the first 4.0 collection publishes.</div>;
  if (chosen) return <Playbook o={chosen} back={() => setSel('')} generatedAt={desk.generatedAt} saved={!!watch.find((w) => w.trendId === chosen.trendId)} onSave={() => { wl.add({ trendId: chosen.trendId, name: chosen.name, category: chosen.category, status: 'selected', assessment: { action: chosen.action, type: chosen.type, timing: chosen.timing, score: chosen.score, fit: chosen.fit, creators: chosen.facts.creators, topViews: chosen.facts.topViews, grade: chosen.facts.grade, savedRunAt: desk.generatedAt }, formatType: chosen.type }); toast('Saved to the journal as “Selected”'); }} toast={toast} />;

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <div className="kicker">Creator Desk · data {fmtAgo(desk.generatedAt, now)}{ageH > 2 ? ' · stale' : ''}</div>
        <h1>Today's creator opportunities</h1>
        <Lede>If you have 30 minutes to two hours today, which opportunity is worth it? Ranked for AI entertainment, animation, characters, editing and music, in English/Spanish, with revenue as the goal. Every item carries its real evidence, its type, how early it is, whether it fits a ≤2h production, how it could pay, and one recommended action. Nothing is padded in: when fewer qualify, fewer are shown.</Lede>
        <div className="tiles">
          <StatTile v={primary.length} k="Actionable now" s="create / participate / research" cls={primary.length ? 'good' : ''} na={primary.length === 0} />
          <StatTile v={ops.filter((o) => o.type === 'format').length} k="Repeatable formats" s="independent creators, shared structure" />
          <StatTile v={ops.filter((o) => o.type === 'meme').length} k="Emerging memes" s="one moment, many creators" na={!ops.some((o) => o.type === 'meme')} />
          <StatTile v={desk.considered} k="Clusters considered" s={`${Object.values(desk.excluded).reduce((a, b) => a + b, 0)} excluded by rule`} />
        </div>
      </header>

      <Section title={primary.length ? 'Worth your time today' : 'Nothing clears the bar today'} sub={primary.length ? 'Ordered by recommended action, then by the composite of evidence, timing and creator fit.' : 'An honest empty state: no cluster combined independent adoption, timing and production fit. The candidates below are being monitored.'}>
        <div className="stack" style={{ gap: 14 }}>
          {primary.map((o, i) => <OpportunityCard key={o.id} o={o} rank={i + 1} now={now} onOpen={() => setSel(o.id)} />)}
        </div>
      </Section>

      {secondary.length > 0 && (
        <Section title="Being monitored" sub="Promising but not yet proven, or a weak fit for the creator profile. Each one says why.">
          <div className="stack" style={{ gap: 14 }}>
            {secondary.map((o, i) => <OpportunityCard key={o.id} o={o} rank={primary.length + i + 1} now={now} onOpen={() => setSel(o.id)} />)}
          </div>
        </Section>
      )}

      <Section title="What was left out, and why" sub={`${desk.considered} microtrends and formats were considered this run.`}>
        <div className="row wrap" style={{ gap: 8 }}>
          {Object.entries(desk.excluded).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k} className="pill"><b className="num" style={{ marginRight: 6 }}>{v}</b>{k}</span>)}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Single viral events are not creator opportunities; broad tags (#funny) describe a subject, not a format; title fragments and description boilerplate are clustering noise, not trends. The full classified list, including events and uncertain clusters, is on the Trends page.</p>
      </Section>
    </>
  );
}

export function OpportunityCard({ o, rank, now, onOpen, compact }: { o: DeskOpportunity; rank?: number; now: number; onOpen: () => void; compact?: boolean }) {
  const cards = o.evidence.slice(0, compact ? 3 : 6).map(evidenceToCard);
  return (
    <article className={`opp card${compact ? ' tight' : ''}`}>
      <div className="opp-head">
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
            {rank != null && <span className="rank-chip num">{rank}</span>}
            <ActionPill action={o.action} />
            <TypePill type={o.type} />
            <TimingPill timing={o.timing} />
            <span className="pill kind">{o.category}</span>
          </div>
          <h3 style={{ margin: 0 }}><button className="linklike" onClick={onOpen}>{o.name}</button></h3>
          <div className="small muted" style={{ marginTop: 4 }}>{o.actionWhy}</div>
        </div>
        <div className="scores num small">
          <span title="composite of evidence, timing and fit"><b>{o.score}</b> score</span>
          <span title="0–100 fit with AI/animation/characters/music production in ≤2h, English/Spanish">fit {o.fit}</span>
          <span title="0–100 evidence strength">evidence {o.evidenceScore}</span>
          <span title="0–100 earliness × momentum">timing {o.timingScore}</span>
        </div>
      </div>
      <div className="opp-facts small">
        <span><b className="num">{o.facts.creators}</b> independent creators</span>
        <span><b className="num">{o.facts.videos}</b> videos ({o.facts.directVideos} verified)</span>
        {o.facts.newCreators48h ? <span><b className="num">+{o.facts.newCreators48h}</b> creators in 48h</span> : null}
        {o.facts.growth != null ? <span className="measured">measured <b className="num">{o.facts.growth}×</b></span> : <span className="dim">growth provisional</span>}
        {o.facts.topViews ? <span>best <b className="num">{fmtNum(o.facts.topViews)}</b> views{o.facts.topVelocity ? <>, <b className="num">+{fmtNum(o.facts.topVelocity)}/h</b></> : null}</span> : null}
      </div>
      {!compact && <VideoRail cards={cards} now={now} />}
      {compact && <VideoRail cards={cards} now={now} />}
      {!compact && (
        <ul className="small opp-why">
          {o.why.map((w, i) => <li key={i}>{w}</li>)}
          {o.caution && <li className="warn-text">Caution: {o.caution}</li>}
        </ul>
      )}
      <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn primary sm" onClick={onOpen}>Open the playbook →</button>
        <a className="btn sm" href={`#/trend/${encodeURIComponent(o.trendId)}`}>Trend evidence</a>
        <span className="tiny dim">{o.production.feasibleIn2h ? 'Feasible in ≤2h' : `Needs ${o.production.effortHours[0]}–${o.production.effortHours[1]}h`} · {o.monetization.platforms.join(' / ')}</span>
      </div>
    </article>
  );
}

function Playbook({ o, back, generatedAt, saved, onSave, toast }: { o: DeskOpportunity; back: () => void; generatedAt: string; saved: boolean; onSave: () => void; toast: (m: string) => void }) {
  const { now } = useApp();
  const briefs = useMemo(() => buildBriefs(o), [o]);
  const [tab, setTab] = useState(0);
  const b: Brief = briefs[tab] || briefs[0];
  const md = () => briefsToMarkdown(o, briefs, generatedAt);
  const cards = o.evidence.map(evidenceToCard);
  const langs = Object.entries(o.features.languages).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <>
      <button className="btn ghost sm" onClick={back}>← All opportunities</button>
      <header className="stack" style={{ gap: 8, marginTop: 8 }}>
        <div className="row wrap" style={{ gap: 6 }}><ActionPill action={o.action} /><TypePill type={o.type} /><TimingPill timing={o.timing} /><span className="pill kind">{o.category}</span></div>
        <h1 style={{ margin: 0 }}>{o.name}</h1>
        <p className="muted" style={{ margin: 0 }}>{o.actionWhy}</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn primary sm" onClick={() => { downloadText(`${o.name.replace(/[^\w-]+/g, '-').toLowerCase()}-brief.md`, md()); toast('Brief downloaded as Markdown'); }}>Export brief (.md)</button>
          <button className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(md()); toast('Brief copied'); } catch { toast('Copy failed — use Export'); } }}>Copy as text</button>
          <button className="btn sm" onClick={onSave} disabled={saved}>{saved ? 'In your journal' : 'Save to journal'}</button>
        </div>
      </header>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card"><h3>A · What is trending</h3><p className="small" style={{ marginTop: 6 }}><b>{o.name}</b> — {TYPE_LABEL[o.type].label.toLowerCase()} ({o.typeConfidence}% confidence) in {o.category}.{o.features.signature.length ? <> Recognisable title signature: <i>{o.features.signature.slice(0, 6).join(', ')}</i>.</> : ' No shared title signature beyond the name.'}{Object.keys(o.features.hooks).length ? <> Hooks observed in titles: {Object.entries(o.features.hooks).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v})`).join(', ')}.</> : null}</p></div>
        <div className="card"><h3>C · Why it matters</h3><ul className="small" style={{ marginTop: 6, paddingLeft: 18 }}>{o.why.map((w, i) => <li key={i}>{w}</li>)}{o.caution && <li className="warn-text">Caution: {o.caution}</li>}</ul></div>
        <div className="card"><h3>D · How early are we</h3><p className="small" style={{ marginTop: 6 }}><b>{TIMING_LABEL[o.timing]}.</b> {o.timingWhy}</p></div>
        <div className="card"><h3>E · Format type</h3><p className="small" style={{ marginTop: 6 }}><b>{TYPE_LABEL[o.type].label}.</b> {TYPE_LABEL[o.type].desc} Basis: {o.facts.creators} independent creators, top video holds {Math.round(o.features.dominance * 100)}% of the views, {o.features.repeatCreators} repeat creator{o.features.repeatCreators === 1 ? '' : 's'}, examples spread over {o.features.spreadHours < 48 ? `${Math.round(o.features.spreadHours)}h` : `${(o.features.spreadHours / 24).toFixed(1)} days`}.</p></div>
        <div className="card"><h3>F · Production opportunity</h3><p className="small" style={{ marginTop: 6 }}><b>{o.production.feasibleIn2h ? 'Yes — an original variation fits in ≤2 hours.' : `Plan ${o.production.effortHours[0]}–${o.production.effortHours[1]} hours.`}</b> {o.production.why} Approach: {o.production.approach.join('; ')}.{langs.length ? <> Languages of the examples: {langs.map(([k, v]) => `${k} ${v}`).join(', ')}.</> : null}{o.features.medianDurationSec ? <> Median length {Math.round(o.features.medianDurationSec)} s; {Math.round(o.features.shortsShare * 100)}% short-form.</> : null}</p></div>
        <div className="card"><h3>G · Monetization</h3><p className="small" style={{ marginTop: 6 }}>Platforms: <b>{o.monetization.platforms.join(', ')}</b>. Category suitability {o.monetization.suitability}/100.</p><ul className="small" style={{ paddingLeft: 18 }}>{o.monetization.mechanisms.map((m, i) => <li key={i}>{m}</li>)}</ul><p className="tiny dim" style={{ marginTop: 6 }}>{o.monetization.eligibility.join(' · ')}</p></div>
      </div>

      <Section title="B · The evidence" sub="Real videos with verified statistics, newest measurements. Tap to play in place.">
        <VideoRail cards={cards} now={now} why />
      </Section>

      <Section title="Production playbook — three original variations" sub="Deterministic briefs built from the observed hooks, signature words, durations and languages of the examples and your tools. Not AI-generated at runtime; what was not observed is listed under uncertainty.">
        <div className="seg" role="tablist" style={{ marginBottom: 12 }}>
          {briefs.map((x, i) => <button key={x.variation} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{x.variation}</button>)}
        </div>
        <div className="card playbook">
          <div className="kicker">{b.variation} · {b.variationWhy}</div>
          <h2 style={{ marginTop: 6 }}>{b.title}</h2>
          <div className="grid cols-2" style={{ marginTop: 12 }}>
            <div><h4>Concept</h4><p className="small">{b.concept}</p><h4>Opening hook</h4><p className="small">{b.hook}</p><h4>Structure</h4><ol className="small" style={{ paddingLeft: 18 }}>{b.structure.map((s) => <li key={s.beat}><b>{s.beat}:</b> {s.what}</li>)}</ol><h4>Suggested duration</h4><p className="small">{b.duration}</p></div>
            <div><h4>Production approach</h4><ul className="small" style={{ paddingLeft: 18 }}>{b.approach.map((a, i) => <li key={i}>{a}</li>)}</ul><h4>Production steps</h4><ol className="small" style={{ paddingLeft: 18 }}>{b.steps.map((s, i) => <li key={i}>{s}</li>)}</ol><h4>Estimated effort</h4><p className="small"><b>{b.effort.hours}</b> · {b.effort.difficulty} — {b.effort.why}</p></div>
          </div>
          <div className="grid cols-2" style={{ marginTop: 4 }}>
            <div><h4>Publishing strategy</h4><p className="small"><b>{b.publishing.platform}</b> · title idea: “{b.publishing.titleIdea}” · caption: {b.publishing.caption}</p><ul className="small" style={{ paddingLeft: 18 }}>{b.publishing.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
            <div><h4>Potential revenue model</h4><ul className="small" style={{ paddingLeft: 18 }}>{b.revenue.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
          </div>
          <h4>Uncertainty</h4>
          <ul className="small" style={{ paddingLeft: 18 }}>{b.uncertainty.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      </Section>
    </>
  );
}
