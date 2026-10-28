import { useMemo } from 'react';
import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { bestThumb, categoryLabelDelta, fmtAgo, growthLabel, isQualified, recommendPlatform, type ViewTrend } from '../lib/data';
import { advise } from '../lib/studio';
import { monetizationSuitability } from '../lib/money';
import { GRADE } from '../lib/types';
import { GradePill, Section, StagePill, Thumb, GrowthPill, KindPill, StatTile } from '../components/ui';
import { VideoRail } from '../components/video';
import { PLATFORM_NAME } from '../lib/videos';
import { WaveCard } from './Trends';
import { OpportunityCard } from './Desk';
import { useAlertState } from './Alerts';
import { freshness } from '../components/health';

export default function Discover() {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const { ranked, now, snapshot } = app;
  const intel = snapshot.videos;

  const qualified = useMemo(() => ranked.filter((v) => isQualified(v, prefs)), [ranked, prefs]);
  const hero = qualified[0];
  const moneyPicks = useMemo(() => {
    const seen = new Set<string>();
    return qualified.filter((v) => v.id !== hero?.id && (seen.has(v.category) ? false : (seen.add(v.category), true))).sort((a, b) => b.monetizationSuitability - a.monetizationSuitability).slice(0, 3);
  }, [qualified, hero]);
  const viral = intel?.viralNow['72h'].slice(0, 10) || [];
  const rising = intel?.earlyRadar.slice(0, 10) || [];
  const waves = intel?.waves.filter((w) => w.state === 'promising_wave').slice(0, 6) || [];
  const crossWaves = intel?.waves.filter((w) => w.platforms.length >= 2).slice(0, 4) || [];
  const direct = intel?.coverage.filter((c) => c.status === 'direct').map((c) => PLATFORM_NAME[c.platform]) || [];
  const fresh = freshness(snapshot.generatedAt, now);
  const desk = snapshot.desk;
  const deskTop = desk?.opportunities.filter((o) => o.action === 'create_today' || o.action === 'participate' || o.action === 'research').slice(0, 3) || [];
  const { unseen } = useAlertState(snapshot.alerts || []);

  return (
    <>
      <header className="stack" style={{ gap: 12 }}>
        <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="kicker">Current viral landscape · data {fresh.label.toLowerCase()} · collected {fmtAgo(snapshot.generatedAt, now)}{fresh.state !== 'fresh' ? ' · the collector is behind schedule' : ''}</div>
            <h1>What people are actually watching right now — and what to make next.</h1>
          </div>
        </div>
        {intel ? (
          <div className="tiles five">
            <StatTile v={intel.viralNow['72h'].length} k="Verified hits (72h)" s="published in the last 3 days" cls="good" />
            <StatTile v={intel.counts.early_breakout} k="Early breakouts" s="credible abnormal momentum" />
            <StatTile v={waves.length} k="Promising waves" s="formats with new independent creators" na={waves.length === 0} />
            <StatTile v={direct.length} k="Platforms with direct stats" s={direct.join(', ') || 'none'} />
            <StatTile v={deskTop.length} k="Worth creating today" s={desk ? `${desk.opportunities.length} on the Creator Desk` : 'Creator Desk'} cls={deskTop.length ? 'good' : ''} na={!deskTop.length} />
          </div>
        ) : (
          <div className="notice warn">The first 3.0 collection has not published yet — the video rankings appear after the next cloud run.</div>
        )}
      </header>

      {unseen.length > 0 && (
        <a className="notice ok small alertstrip" href="#/alerts"><b>{unseen.length} new alert{unseen.length === 1 ? '' : 's'}</b> since your last visit: {unseen.slice(0, 3).map((a) => a.subject.title.slice(0, 40)).join(' · ')}{unseen.length > 3 ? ' · …' : ''} →</a>
      )}

      <Section title="Biggest viral videos right now" sub="Verified platform statistics, published in the last 72 hours. Tap to play in place." more="All of Viral Now" moreHref="#/viral">
        <VideoRail cards={viral} now={now} why />
      </Section>

      <Section title="Fastest-rising breakouts" sub="Credible abnormal momentum: measured velocity, exceptional averages for very young videos, and creator outliers. Provisional entries are labelled." more="Open Early Radar" moreHref="#/radar">
        <VideoRail cards={rising} now={now} why />
      </Section>

      <Section title="Trending categories & microtrends" sub="Where independent creators are moving — not one big video, but several creators producing similar content." more="All trends" moreHref="#/trends">
        {waves.length ? (
          <div className="grid cols-3">{waves.map((w) => <WaveCard key={w.trendId} w={w} now={now} />)}</div>
        ) : (
          <div className="empty">No promising wave clears the bar right now (3+ independent creators with new entrants in 48h). Category activity is on the Trends page.</div>
        )}
        {snapshot.categories.length > 0 && (
          <div className="catstrip" style={{ marginTop: 12 }}>
            {snapshot.categories.slice(0, 8).map((c) => {
              const d = categoryLabelDelta(c);
              return <a key={c.category} className="chip" href={`#/trends?c=${encodeURIComponent(c.category)}`}><b>{c.category}</b><span className="num">{c.videos24h} in 24h</span><span className={`d ${d.dir}`}>{d.label}</span></a>;
            })}
          </div>
        )}
      </Section>

      <Section title="What's worth creating today" sub="The Creator Desk's actionable opportunities: real evidence, opportunity type, timing, production fit and one recommended action. Open one for the playbook." more="Creator Desk" moreHref="#/desk">
        {deskTop.length ? (
          <div className="stack" style={{ gap: 12 }}>{deskTop.map((o, i) => <OpportunityCard key={o.id} o={o} rank={i + 1} now={now} compact onOpen={() => { location.hash = `#/desk?o=${encodeURIComponent(o.id)}`; }} />)}</div>
        ) : (
          <div className="empty">{desk ? 'No opportunity clears the bar today (independent adoption + timing + production fit). The Creator Desk lists what is being monitored and why the rest was excluded.' : 'The Creator Desk appears after the next collection.'}</div>
        )}
      </Section>

      <Section title="Trend concepts (2.0 Studio)" sub="Evidence-backed trend ideas re-ranked for your tools and interests." more="Content Studio" moreHref="#/studio">
        {hero ? (
          <Hero v={hero} now={now} prefsTools={prefs.tools} watched={watch.some((w) => w.trendId === hero.id)} onSave={() => { wl.add({ trendId: hero.id, name: hero.name, category: hero.category, status: 'selected', formatType: hero.opportunity?.type }); app.toast('Saved to your content plan'); }} />
        ) : (
          <div className="empty">No opportunity clears the evidence bar yet — nothing is padded in to fill the space.</div>
        )}
        {moneyPicks.length > 0 && (
          <div className="grid cols-3" style={{ marginTop: 12 }}>
            {moneyPicks.map((v) => {
              const ms = monetizationSuitability(v.category);
              const a = advise(v, v.w, prefs);
              return (
                <a key={v.id} className="card" href={`#/trend/${encodeURIComponent(v.id)}`}>
                  <div className="row between"><KindPill kind={v.kind} /><GradePill grade={v.w.grade} /></div>
                  <h3 style={{ margin: '8px 0 4px' }}>{v.name}</h3>
                  <div className="small muted">{v.category} · {recommendPlatform(v, prefs).platform}</div>
                  <div className="small" style={{ marginTop: 6 }}>{a.concepts[0]?.title}</div>
                  <div className="row" style={{ marginTop: 10, gap: 14 }}>
                    <div><div className="tiny dim">Money fit</div><b className="num" style={{ color: 'var(--money-ink)', fontSize: 18 }}>{ms.score}</b></div>
                    <div><div className="tiny dim">Creators</div><b className="num" style={{ fontSize: 18 }}>{v.w.creators}</b></div>
                    <div><div className="tiny dim">Momentum</div><b className="num" style={{ fontSize: 18 }}>{v.w.momentum}</b></div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Cross-platform waves" sub="Formats with supporting evidence on more than one platform. The order shown is the order of the earliest verified content on each platform — when it is unknown, it is not invented." more="Trend map" moreHref="#/trends?tab=map">
        {crossWaves.length ? (
          <div className="grid cols-2">{crossWaves.map((w) => <WaveCard key={w.trendId} w={w} now={now} showSequence />)}</div>
        ) : (
          <div className="empty">No wave has verified evidence on two platforms yet. Direct statistics currently come from {direct.join(' and ') || 'no platform'}; TikTok, Instagram and Facebook appear only as shares (see Diagnostics).</div>
        )}
      </Section>
    </>
  );
}

function Hero({ v, now, prefsTools, watched, onSave }: { v: ViewTrend; now: number; prefsTools: string[]; watched: boolean; onSave: () => void }) {
  const [prefs] = usePrefs();
  const th = bestThumb(v);
  const a = advise(v, v.w, { ...prefs, tools: prefsTools });
  const g = growthLabel(v.w);
  const c = a.concepts[0];
  const href = `#/trend/${encodeURIComponent(v.id)}`;
  return (
    <article className="hero">
      <a className="media" href={href} aria-label={`Open ${v.name}`}>
        <Thumb src={th.src} name={v.name} className="" play={v.videoCount > 0} overlay={<><div className="shade" /><div className="tl"><StagePill stage={v.w.lifecycle} onDark /><GradePill grade={v.w.grade} onDark /></div></>} />
      </a>
      <div className="body">
        <div className="kicker">Today's best opportunity · {v.category}</div>
        <h2>{v.name}</h2>
        <div className="row wrap" style={{ gap: 6 }}>
          <KindPill kind={v.kind} />
          {v.platforms.map((p) => <span key={p} className="pill kind">{{ google_trends: 'Google Trends', youtube: 'YouTube', bluesky: 'Bluesky', mastodon: 'Mastodon', tiktok: 'TikTok' }[p]}</span>)}
          <GrowthPill v={v} />
        </div>
        <p className="why">{v.summary}</p>
        <div className="facts">
          <div className="fact"><div className="k">Evidence</div><div className="v">{GRADE[v.w.grade].label}</div></div>
          <div className="fact"><div className="k">Direction</div><div className="v">{g.label}</div></div>
          <div className="fact"><div className="k">Independent creators</div><div className="v num">{v.w.creators}{v.w.newCreators ? ` · ${v.w.newCreators} new` : ''}</div></div>
          <div className="fact"><div className="k">Recommended format</div><div className="v">{c.title}</div></div>
        </div>
        <div className="actions">
          <a className="btn primary lg" href={href}>Explore opportunity</a>
          <button className="btn lg" onClick={onSave} disabled={watched}>{watched ? 'In your content plan' : 'Save to content plan'}</button>
        </div>
        <div className="tiny dim num">Updated {fmtAgo(v.lastSeen, now)} · first detected {fmtAgo(v.firstDetected, now)}</div>
      </div>
    </article>
  );
}
