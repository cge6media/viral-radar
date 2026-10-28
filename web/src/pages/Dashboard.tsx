import { useMemo } from 'react';
import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { diversify, difficultyFor, growthLabel, recommendPlatform, topOpportunities, fmtNum } from '../lib/data';
import { advise } from '../lib/advisor';
import { STAGE, STAGE_ORDER, PLATFORM_LABEL } from '../lib/types';
import type { Trend } from '../lib/types';
import { Filters, Section, SourceStatusList, StageBadge, BasisBadge, TrendRow, ScoreBars } from '../components/ui';

export default function Dashboard() {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const { ranked, now, snapshot } = app;

  const top20 = useMemo(() => topOpportunities(ranked, 20), [ranked]);
  const recos = useMemo(() => {
    const pool = ranked.filter((t) => !t.isNewsEvent && t.lifecycle !== 'cooling');
    const strong = pool.filter((t) => t.lifecycle !== 'insufficient_data');
    const base = strong.length >= 5 ? strong : [...strong, ...pool.filter((t) => t.lifecycle === 'insufficient_data')];
    return diversify(base, 5, 2);
  }, [ranked]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    ranked.forEach((t) => (c[t.lifecycle] = (c[t.lifecycle] || 0) + 1));
    return c;
  }, [ranked]);

  const historyHours = snapshot.stats.earliestObservation ? (now - new Date(snapshot.stats.earliestObservation).getTime()) / 36e5 : 0;
  const videoTotal = ranked.reduce((s, t) => s + t.videoCount, 0);

  return (
    <>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <h1>What's gaining momentum right now</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {ranked.length} trends from {snapshot.stats.observationsTotal.toLocaleString()} observations · {videoTotal} real videos linked · history {Math.max(1, Math.ceil(historyHours))}h and growing.
          </p>
        </div>
        <Filters window={app.window} platforms={app.platforms} available={app.availablePlatforms} onWindow={app.setWindow} onPlatforms={app.setPlatforms} historyHours={historyHours} />
      </div>

      <Section title="What should I create today?" sub="Five actionable picks — diversified across categories, news events excluded, re-weighted by your preferences.">
        {recos.length === 0 ? (
          <div className="empty">No trends inside this window. Widen the time filter or wait for the next refresh.</div>
        ) : (
          <div className="recos">
            {recos.map((t, i) => (
              <RecoCard key={t.id} t={t} i={i} now={now} prefsTools={prefs.tools} watched={watch.some((w) => w.trendId === t.id)} onWatch={() => { wl.add({ trendId: t.id, name: t.name, category: t.category }); app.toast('Added to watchlist'); }} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Top 20 viral opportunities" sub="Ranked by opportunity = momentum, creator fit and monetization, discounted by evidence confidence." right={<a className="btn ghost sm" href="#/compass">Open compass</a>}>
        <div className="card tight">
          <div className="ranklist">
            {top20.map((t, i) => (
              <TrendRow key={t.id} t={t} n={i + 1} now={now} />
            ))}
            {top20.length === 0 && <div className="empty">Nothing to rank yet for this filter.</div>}
          </div>
        </div>
      </Section>

      <div className="grid cols-2 section">
        <div className="card">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <h2>Where attention is moving</h2>
            <a className="small" href="#/compass">Full compass</a>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {STAGE_ORDER.map((s) => (
              <a key={s} href={`#/compass?stage=${s}`} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="row"><StageBadge stage={s} /><span className="small muted">{STAGE[s].desc}</span></span>
                <b className="num">{stageCounts[s] || 0}</b>
              </a>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <h2>Sources</h2>
            <a className="small" href="#/settings">Refresh & setup</a>
          </div>
          <SourceStatusList sources={snapshot.sources} now={now} />
          <div className="hr" />
          <div className="small muted">
            Run {snapshot.runId} · generated {new Date(snapshot.generatedAt).toLocaleString()} · {snapshot.stats.observationsThisRun} observations this run · retention {snapshot.stats.historyDays} day{snapshot.stats.historyDays === 1 ? '' : 's'} of history
          </div>
        </div>
      </div>
    </>
  );
}

function RecoCard({ t, i, now, prefsTools, watched, onWatch }: { t: Trend; i: number; now: number; prefsTools: string[]; watched: boolean; onWatch: () => void }) {
  const [prefs] = usePrefs();
  const adv = advise(t, prefs);
  const g = growthLabel(t);
  const plat = recommendPlatform(t, prefs);
  const diff = difficultyFor(t.category, { ...prefs, tools: prefsTools });
  const examples = t.evidence.filter((e) => e.kind === 'video').slice(0, 2);
  const topExample = examples[0] || t.evidence[0];
  const c = adv.concepts[0];
  const evidenceLine = (() => {
    const v = t.evidence.filter((e) => e.kind === 'video');
    const views = v.map((e) => e.metrics.views || 0).filter(Boolean);
    const likes = v.map((e) => e.metrics.likes || 0).filter(Boolean);
    const parts: string[] = [];
    if (v.length) parts.push(`${v.length} video${v.length > 1 ? 's' : ''} from ${new Set(v.map((e) => e.creator?.name)).size} creators`);
    if (views.length) parts.push(`top ${fmtNum(Math.max(...views))} views`);
    else if (likes.length) parts.push(`top ${fmtNum(Math.max(...likes))} likes`);
    const s = t.evidence.find((e) => e.kind === 'search_interest');
    if (s) parts.push(`${fmtNum(s.metrics.approxTraffic || 0)}+ searches (${s.region})`);
    const h = t.evidence.find((e) => e.kind === 'hashtag');
    if (h && h.metrics.uses != null) parts.push(`${fmtNum(h.metrics.uses)} tagged posts/day`);
    if (t.evidence.some((e) => e.kind === 'social_topic')) parts.push('trending topic on Bluesky');
    return parts.join(' · ') || `${t.evidenceCount} supporting items`;
  })();
  return (
    <article className={`card reco${i === 0 ? ' top' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="kicker">{i === 0 ? "Today's top pick" : `Alternative ${i}`} · {t.category}</span>
        <StageBadge stage={t.lifecycle} />
      </div>
      <h3><a href={`#/trend/${encodeURIComponent(t.id)}`}>{c.title}</a></h3>
      <dl>
        <dt>Format</dt><dd>{c.format}</dd>
        <dt>Riding</dt><dd><a href={`#/trend/${encodeURIComponent(t.id)}`}>{t.name.replace(/ \(format\)$/, '')}</a> <span className="muted">· {t.subcategory}</span></dd>
        <dt>Evidence</dt><dd>{evidenceLine}</dd>
        <dt>Direction</dt><dd><span className={g.dir === 'down' ? 'muted' : ''}>{g.label}</span> <BasisBadge t={t} /></dd>
        <dt>Why now</dt><dd>{adv.why[0]} {adv.timing.detail}</dd>
        {topExample && (
          <>
            <dt>Example</dt>
            <dd className="clamp2">
              <a href={topExample.url} target="_blank" rel="noopener noreferrer">{topExample.title}</a>
              {topExample.creator?.name ? <span className="muted"> — {topExample.creator.name}</span> : null}
              {examples[1] && (<> · <a href={examples[1].url} target="_blank" rel="noopener noreferrer">{examples[1].creator?.name || 'second example'}</a></>)}
            </dd>
          </>
        )}
        <dt>Concept</dt><dd>{c.pitch}</dd>
        <dt>Publish on</dt><dd>{plat.platform}</dd>
        <dt>Money</dt><dd>{adv.monetization[0]}</dd>
        <dt>Difficulty</dt><dd>{diff.label} <span className="muted">— {diff.why}</span></dd>
      </dl>
      <ScoreBars t={t} compact />
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
        <span className="small muted num">{t.platforms.map((p) => PLATFORM_LABEL[p]).join(' · ')} · conf. {t.scores.confidence} · seen {Math.max(1, Math.round((now - new Date(t.lastSeen).getTime()) / 36e5))}h ago</span>
        <div className="row">
          <button className="btn sm" onClick={onWatch} disabled={watched}>{watched ? 'On watchlist' : 'Watch'}</button>
          <a className="btn sm primary" href={`#/trend/${encodeURIComponent(t.id)}`}>Ride this trend</a>
        </div>
      </div>
    </article>
  );
}
