import { useMemo } from 'react';
import { useApp } from '../App';
import { usePrefs, useWatchlist } from '../lib/store';
import { bestThumb, categoryLabelDelta, diversify, fmtAgo, growthLabel, isQualified, recommendPlatform, type ViewTrend } from '../lib/data';
import { advise } from '../lib/studio';
import { monetizationSuitability } from '../lib/money';
import { GRADE, STAGE, STAGE_ORDER, WINDOW_LABEL } from '../lib/types';
import { GradePill, Section, StagePill, Thumb, TrendCard, TrendRow, WindowSwitch, GrowthPill, KindPill } from '../components/ui';
import { HBarChart } from '../components/charts';

export default function Discover() {
  const app = useApp();
  const [prefs] = usePrefs();
  const [watch, wl] = useWatchlist();
  const { ranked, now, snapshot } = app;

  const qualified = useMemo(() => ranked.filter((v) => isQualified(v, prefs)), [ranked, prefs]);
  const hero = qualified[0];
  const emerging = useMemo(() => diversify(qualified.slice(1), 9, 3), [qualified]);
  const provenFormats = useMemo(() => ranked.filter((v) => v.kind === 'format' && v.w.grade !== 'insufficient' && !isQualified(v, prefs)).slice(0, 6), [ranked, prefs]);
  const topics = useMemo(() => ranked.filter((v) => v.kind === 'topic' && !v.isNewsEvent && v.w.grade !== 'insufficient' && !isQualified(v, prefs)).slice(0, 5), [ranked, prefs]);
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    ranked.filter((v) => !v.isNewsEvent).forEach((v) => (c[v.w.lifecycle] = (c[v.w.lifecycle] || 0) + 1));
    return c;
  }, [ranked]);
  const moneyPicks = useMemo(() => {
    const seen = new Set<string>();
    return qualified.filter((v) => (seen.has(v.category) ? false : (seen.add(v.category), true))).sort((a, b) => b.monetizationSuitability - a.monetizationSuitability).slice(0, 3);
  }, [qualified]);
  const activeSources = snapshot.sources.filter((s) => s.ok).length;
  const ageH = (now - new Date(snapshot.generatedAt).getTime()) / 36e5;

  return (
    <>
      <header className="stack" style={{ gap: 14 }}>
        <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
          <div>
            <h1>Discover what's gaining attention before you decide what to create.</h1>
            <div className="statstrip" style={{ marginTop: 10 }}>
              <span>Updated <b>{fmtAgo(snapshot.generatedAt, now)}</b></span>
              <span>Freshness <b>{ageH <= 1 ? 'live' : ageH <= 3 ? 'recent' : 'stale'}</b></span>
              <span>Qualified opportunities <b>{qualified.length}</b></span>
              <span>New in 24h <b>{qualified.filter((v) => (now - new Date(v.firstDetected).getTime()) / 36e5 <= 24).length}</b></span>
              <span>Active sources <b>{activeSources}/{snapshot.sources.filter((s) => s.mode !== 'disabled').length}</b></span>
            </div>
          </div>
          <WindowSwitch value={app.window} onChange={app.setWindow} />
        </div>
      </header>

      <section className="section" style={{ marginTop: 22 }}>
        {hero ? (
          <Hero v={hero} now={now} prefsTools={prefs.tools} watched={watch.some((w) => w.trendId === hero.id)} onSave={() => { wl.add({ trendId: hero.id, name: hero.name, category: hero.category, status: 'planning' }); app.toast('Saved to your content plan'); }} />
        ) : (
          <div className="empty">No opportunity clears the evidence bar in the {WINDOW_LABEL[app.window].toLowerCase()} yet. Widen the window, or check back after the next collection — nothing is padded in to fill the space.</div>
        )}
      </section>

      <Section title="Emerging now" sub={`Opportunities with at least an early signal in the ${WINDOW_LABEL[app.window].toLowerCase()}, re-ranked for your interests. ${qualified.length <= 1 ? 'Thin today — honest, not padded.' : ''}`} more="Open compass" moreHref="#/compass">
        {emerging.length ? <div className="tgrid">{emerging.map((v) => <TrendCard key={v.id} v={v} now={now} />)}</div> : <div className="empty">Nothing else qualifies in this window.</div>}
      </Section>

      <Section title="Trend momentum" sub="Where video activity is moving, measured from relevance-checked videos by publication time." more="Full compass" moreHref="#/compass">
        <div className="grid cols-2">
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Category activity</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>Videos in the last 24 hours, with the change against the prior 24 hours.</div>
            {snapshot.categories.length ? (
              <HBarChart data={snapshot.categories.slice(0, 10).map((c) => ({ label: c.category, value: c.videos24h, href: `#/compass?c=${encodeURIComponent(c.category)}`, tip: `${c.category}: ${c.videos24h} videos in 24h (${c.videos7d} in 7d) · ${c.creators7d} creators · ${categoryLabelDelta(c).label}` }))} valueFmt={(v) => `${Math.round(v)}`} />
            ) : <div className="empty">No category activity yet.</div>}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Lifecycle mix</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>How the non-news trends in this window are distributed. Stages come from measured growth where it exists.</div>
            <div className="stack" style={{ gap: 6 }}>
              {STAGE_ORDER.map((s) => (
                <a key={s} href={`#/compass?stage=${s}`} className="row between" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="row"><StagePill stage={s} /><span className="small muted">{STAGE[s].desc}</span></span>
                  <b className="num">{stageCounts[s] || 0}</b>
                </a>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Explore categories" sub="Entertainment, animation, animals, comedy, gaming, music and more — only what the data supports.">
        {snapshot.categories.length ? (
          <div className="catgrid">
            {snapshot.categories.map((c) => {
              const d = categoryLabelDelta(c);
              return (
                <a key={c.category} className="cat" href={`#/compass?c=${encodeURIComponent(c.category)}`}>
                  <div className="n">{c.category}</div>
                  <div className="m">{c.videos7d} videos · {c.creators7d} creators · {c.qualifiedTrends} qualified</div>
                  <div className={`d ${d.dir === 'up' ? 'up' : d.dir === 'down' ? 'down' : ''}`}>{d.label}</div>
                </a>
              );
            })}
          </div>
        ) : <div className="empty">Category activity appears after the first 2.0 collection.</div>}
      </Section>

      {(provenFormats.length > 0 || topics.length > 0) && (
        <div className="grid cols-2 section">
          {provenFormats.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 4 }}>Proven formats, still active</h3>
              <div className="small muted" style={{ marginBottom: 6 }}>Evergreen categories with fresh, relevance-checked examples. Reliable, crowded — not listed as emerging.</div>
              {provenFormats.map((v) => <TrendRow key={v.id} v={v} now={now} />)}
            </div>
          )}
          {topics.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 4 }}>Audience topics to watch</h3>
              <div className="small muted" style={{ marginBottom: 6 }}>Search and social interest without enough video examples yet.</div>
              {topics.map((v) => <TrendRow key={v.id} v={v} now={now} />)}
            </div>
          )}
        </div>
      )}

      <Section title="Monetization opportunities" sub="Qualified trends in the categories that convert best. Suitability is a category profile, not measured earnings." more="Open Money Engine" moreHref="#/money">
        {moneyPicks.length ? (
          <div className="grid cols-3">
            {moneyPicks.map((v) => {
              const ms = monetizationSuitability(v.category);
              return (
                <a key={v.id} className="card" href={`#/trend/${encodeURIComponent(v.id)}`}>
                  <div className="row between"><KindPill kind={v.kind} /><GradePill grade={v.w.grade} /></div>
                  <h3 style={{ margin: '8px 0 4px' }}>{v.name}</h3>
                  <div className="small muted">{v.category} · {recommendPlatform(v, prefs).platform}</div>
                  <div className="row" style={{ marginTop: 10, gap: 14 }}>
                    <div><div className="tiny dim">Money fit</div><b className="num" style={{ color: 'var(--money-ink)', fontSize: 18 }}>{ms.score}</b></div>
                    <div><div className="tiny dim">Audience</div><b className="num" style={{ fontSize: 18 }}>{v.w.audienceInterest}</b></div>
                    <div><div className="tiny dim">Momentum</div><b className="num" style={{ fontSize: 18 }}>{v.w.momentum}</b></div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : <div className="empty">Money picks appear once trends qualify.</div>}
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
