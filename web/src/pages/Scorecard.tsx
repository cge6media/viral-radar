import { useEffect, useState } from 'react';
import { useApp } from '../App';
import type { Scorecard } from '../lib/types';
import { PREDICTION_HORIZONS } from '../lib/types';
import { fmtAgo, fmtNum } from '../lib/data';
import { Section, StatTile } from '../components/ui';
import { KIND_LABEL } from '../lib/videos';

const H_LABEL: Record<string, string> = { '24': '24h', '48': '48h', '72': '72h', '168': '7d' };
const STRAT: Record<string, { label: string; desc: string }> = {
  radar: { label: 'Early Radar (breakout model)', desc: 'The top-20 of the Early Radar at prediction time: measured velocity, acceleration, creator baseline, youth.' },
  views: { label: 'Baseline: biggest by views', desc: 'The 20 largest non-hit videos ≤72h old, ranked by raw views — the simplest strategy.' },
  velocity: { label: 'Baseline: fastest by velocity', desc: 'The 20 non-hit videos with the highest measured views/hour.' },
};
const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export default function ScorecardPage() {
  const { snapshot, now } = useApp();
  const [card, setCard] = useState<Scorecard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/predictions/scorecard.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error(`scorecard ${r.status}`); setCard((await r.json()) as Scorecard); })
      .catch((e) => setErr((e as Error).message));
  }, []);
  const s = snapshot.scorecard;
  if (!s) return <div className="notice warn">The prediction scorecard starts with the first 4.0 collection.</div>;
  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <div className="kicker">Prediction scorecard · as of {fmtAgo(s.generatedAt, now)}{s.firstPredictionAt ? ` · recording since ${new Date(s.firstPredictionAt).toLocaleString()}` : ''}</div>
        <h1>Does the radar predict anything?</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 780 }}>Every collection writes immutable predictions — the Early Radar's top entries and two simple baselines drawn from the same candidates — and later collections evaluate each one at 24h, 48h, 72h and 7 days from real observations. A prediction counts as a <b>breakout</b> when the video reaches the age-appropriate hit floor or doubles its views with at least 100K gained. A horizon that has not elapsed is <b>pending</b>, never a success; a horizon without an observation is <b>unobserved</b> and excluded. Precision is only stated from ten or more evaluated predictions; nothing here is a probability.</p>
        <div className="tiles five">
          <StatTile v={s.predictions} k="Predictions recorded" s="radar + two baselines, ≤60 days" />
          <StatTile v={s.pending} k="Horizons pending" s="outcome window not elapsed" />
          <StatTile v={s.evaluated} k="Outcomes evaluated" s="from later observations" cls={s.evaluated ? 'good' : ''} na={!s.evaluated} />
          <StatTile v={s.unobserved} k="Unobserved" s="window passed without a measurement" na={!s.unobserved} />
          <StatTile v={s.leadTimeHours ? `${s.leadTimeHours.median}h` : '—'} k="Median lead time" s={s.leadTimeHours ? `${s.leadTimeHours.n} predicted crossings` : 'no predicted crossing yet'} na={!s.leadTimeHours} />
        </div>
      </header>

      <Section title="Precision by horizon — radar vs simple baselines" sub="Share of evaluated predictions that became breakouts. A cell stays “—” until ten predictions at that horizon have been evaluated. If the baselines match or beat the radar, the model is not adding skill and will be simplified.">
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>Strategy</th>{PREDICTION_HORIZONS.map((h) => <th key={h} className="num">{H_LABEL[String(h)]}</th>)}<th className="num">predictions</th></tr></thead>
            <tbody>
              {(['radar', 'views', 'velocity'] as const).map((k) => (
                <tr key={k} className={k === 'radar' ? 'hl' : ''}>
                  <td><b>{STRAT[k].label}</b><div className="tiny dim">{STRAT[k].desc}</div></td>
                  {PREDICTION_HORIZONS.map((h) => {
                    const cell = card?.byStrategy?.[k]?.horizons?.[String(h)];
                    const p = s.baselines?.[k]?.[String(h)];
                    return <td key={h} className="num" title={cell ? `${cell.evaluated} evaluated, ${cell.pending} pending, ${cell.unobserved} unobserved` : ''}>{pct(p)}<div className="tiny dim">{cell ? `${cell.breakout}/${cell.evaluated} · ${cell.pending} pending` : ''}</div></td>;
                  })}
                  <td className="num">{card?.byStrategy?.[k]?.predictions ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {card && (
        <Section title="Radar outcomes by criterion" sub="Each criterion is evaluated on its own; null means the criterion could not be measured for that prediction (no cohort of 20 comparable videos, no channel reading, no trend membership).">
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th>Horizon</th><th className="num">evaluated</th><th className="num">reached hit floor</th><th className="num">doubled (+100K)</th><th className="num">rate sustained</th><th className="num">top-10% of cohort</th><th className="num">creator +5% subs</th><th className="num">format spread</th><th className="num">pending</th><th className="num">unobserved</th></tr></thead>
              <tbody>
                {PREDICTION_HORIZONS.map((h) => { const c = card.byStrategy.radar.horizons[String(h)]; return (
                  <tr key={h}><td><b>{H_LABEL[String(h)]}</b></td><td className="num">{c.evaluated}</td><td className="num">{c.reachedHit}</td><td className="num">{c.multiplied}</td><td className="num">{c.accelerated}/{c.acceleratedN}</td><td className="num">{c.outperformed}/{c.outperformedN}</td><td className="num">{c.creatorJump}/{c.creatorJumpN}</td><td className="num">{c.formatSpread}/{c.formatSpreadN}</td><td className="num">{c.pending}</td><td className="num">{c.unobserved}</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Recall against observable crossings" sub="A crossing is a tracked video that reached its hit floor while it had already been in the index for at least six hours — a prediction was possible. Recall = crossings the radar had predicted before they crossed ÷ all observable crossings (stated from ten or more).">
        <div className="tiles">
          <StatTile v={s.crossings.observed} k="Observable crossings" />
          <StatTile v={s.crossings.predictedBefore} k="Predicted before crossing" cls={s.crossings.predictedBefore ? 'good' : ''} na={!s.crossings.predictedBefore} />
          <StatTile v={s.crossings.missed} k="Missed" s="crossed without a prior radar prediction" />
          <StatTile v={pct(s.crossings.recall)} k="Recall" s={s.crossings.recall == null ? 'needs ≥10 crossings' : ''} na={s.crossings.recall == null} />
        </div>
        {card?.crossingsRecent?.length ? (
          <div className="tablewrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead><tr><th>Video</th><th className="num">crossed at</th><th className="num">views</th><th className="num">floor</th><th className="num">observable since</th><th className="num">lead time</th></tr></thead>
              <tbody>{card.crossingsRecent.slice(0, 20).map((c) => <tr key={c.videoId}><td className="truncate" style={{ maxWidth: 360 }}><a href={`https://www.youtube.com/watch?v=${c.platformId}`} target="_blank" rel="noopener noreferrer">{c.title}</a></td><td className="num">{new Date(c.crossedAt).toLocaleString()}</td><td className="num">{fmtNum(c.views)}</td><td className="num">{fmtNum(c.floor)}</td><td className="num">{fmtAgo(c.observableSince, now)}</td><td className="num">{c.leadHours != null ? `${c.leadHours}h` : <span className="dim">not predicted</span>}</td></tr>)}</tbody>
            </table>
          </div>
        ) : null}
      </Section>

      {card && (
        <Section title="Calibration (descriptive)" sub="Empirical 48h breakout rate of radar predictions by breakout-score band. Shown only from 20 evaluated predictions per band; until then scores are descriptive, not probabilities.">
          <div className="row wrap" style={{ gap: 10 }}>
            {card.calibration.map((b) => <div className="card tight" key={b.band}><div className="kicker">score {b.band}</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{b.breakout48 == null ? '—' : pct(b.breakout48)}</div><div className="tiny dim">{b.n} evaluated{b.breakout48 == null ? ' (needs 20)' : ''}</div></div>)}
            {Object.entries(card.byKind).map(([k, v]) => <div className="card tight" key={k}><div className="kicker">{KIND_LABEL[k]?.label || k}</div><div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{v.evaluated48 ? pct(v.breakout48 / v.evaluated48) : '—'}</div><div className="tiny dim">{v.predictions} predictions · {v.evaluated48} evaluated at 48h</div></div>)}
          </div>
        </Section>
      )}

      {card && (
        <Section title="Recent predictions" sub="Newest first. Status per horizon: pending · hit (reached the floor) · ×2 (doubled with ≥100K gained) · miss · unobserved.">
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th>Video</th><th>strategy</th><th className="num">predicted</th><th className="num">views then</th><th className="num">velocity then</th><th className="num">score</th>{PREDICTION_HORIZONS.map((h) => <th key={h} className="num">{H_LABEL[String(h)]}</th>)}</tr></thead>
              <tbody>
                {card.recent.map((p) => (
                  <tr key={p.id}>
                    <td className="truncate" style={{ maxWidth: 320 }}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a>{p.kind ? <span className="tiny dim"> · {KIND_LABEL[p.kind]?.short || p.kind}</span> : null}</td>
                    <td className="tiny">{p.strategy}</td>
                    <td className="num tiny">{fmtAgo(p.predictedAt, now)}</td>
                    <td className="num">{p.views != null ? fmtNum(p.views) : '—'}</td>
                    <td className="num">{p.velocityPerHour != null ? `+${fmtNum(p.velocityPerHour)}/h` : <span className="dim">provisional</span>}</td>
                    <td className="num">{p.breakoutScore} <span className="tiny dim">{p.confidenceBand}</span></td>
                    {PREDICTION_HORIZONS.map((h) => { const st = p.status[String(h)]; return <td key={h} className={`num status ${st}`}>{st === 'multiplied' ? '×2' : st}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {err && <div className="notice warn small">Detailed scorecard unavailable ({err}); the summary above comes from the snapshot.</div>}
    </>
  );
}
