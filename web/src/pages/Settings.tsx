import { useState } from 'react';
import { useApp } from '../App';
import { usePrefs } from '../lib/store';
import { CATEGORIES } from '../../../pipeline/src/intel/taxonomy';
import { SourceList, StatTile } from '../components/ui';
import { fmtAgo, fmtNum } from '../lib/data';
import { PLATFORM_NAME } from '../lib/videos';

const TOOLS = [['editing', 'Professional video editing'], ['animation', 'Animation'], ['ai-video', 'AI video generation'], ['image', 'Image generation'], ['audio', 'Audio production'], ['music', 'Music / songwriting'], ['camera', 'On-camera / live action']] as const;
const PLATFORMS = [['youtube_shorts', 'YouTube Shorts'], ['youtube', 'YouTube long-form'], ['tiktok', 'TikTok'], ['instagram', 'Instagram Reels'], ['facebook', 'Facebook'], ['bluesky', 'Bluesky']] as const;
const REPO = (import.meta.env.VITE_REPO as string | undefined) || '';

export default function Settings() {
  const app = useApp();
  const [prefs, update] = usePrefs();
  const initialTab = new URLSearchParams(location.hash.split('?')[1] || '').get('tab') || 'prefs';
  const [tab, setTab] = useState(initialTab);
  const toggle = (key: 'interests' | 'tools' | 'platforms', v: string) => {
    const cur = prefs[key];
    update({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as never);
  };
  const s = app.snapshot;
  const repo = prefs.githubRepo || REPO;

  return (
    <>
      <h1>Diagnostics & settings</h1>
      <div className="seg wrap" style={{ margin: '12px 0 18px' }}>
        {[['coverage', 'Source coverage'], ['funnel', 'Discovery funnel'], ['data', 'Data & quality'], ['prefs', 'Preferences'], ['about', 'How scores work']].map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === 'coverage' && (
        <Coverage />
      )}
      {tab === 'funnel' && (
        <Funnel />
      )}

      {tab === 'prefs' && (
        <div className="grid cols-2">
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Your interests</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>+10 creator fit for these categories.</div>
            <div className="chips">{CATEGORIES.map((c) => <button key={c.name} className={`chip${prefs.interests.includes(c.name) ? ' on' : ''}`} onClick={() => toggle('interests', c.name)}>{c.name}</button>)}</div>
            <div className="hr" />
            <h3 style={{ marginBottom: 4 }}>Your tools</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>+5 creator fit when a trend suits them; lowers estimated difficulty and budget.</div>
            <div className="chips">{TOOLS.map(([id, label]) => <button key={id} className={`chip${prefs.tools.includes(id) ? ' on' : ''}`} onClick={() => toggle('tools', id)}>{label}</button>)}</div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Publishing platforms</h3>
            <div className="chips" style={{ marginTop: 8 }}>{PLATFORMS.map(([id, label]) => <button key={id} className={`chip${prefs.platforms.includes(id) ? ' on' : ''}`} onClick={() => toggle('platforms', id)}>{label}</button>)}</div>
            <div className="hr" />
            <h3 style={{ marginBottom: 4 }}>Risk appetite</h3>
            <div className="chips" style={{ marginTop: 8 }}>
              {([['early', 'Early — catch trends before they peak'], ['balanced', 'Balanced'], ['proven', 'Proven — breaking out / peaking only']] as const).map(([id, label]) => <button key={id} className={`chip${prefs.appetite === id ? ' on' : ''}`} onClick={() => update({ appetite: id })}>{label}</button>)}
            </div>
            <div className="hr" />
            <label className="row small" style={{ gap: 10, marginTop: 8 }}><input type="checkbox" checked={prefs.showGeneric} onChange={(e) => update({ showGeneric: e.target.checked })} /> Let evergreen categories (cooking, cat videos…) count as opportunities without measured growth</label>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="grid cols-2">
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Sources</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>Quality over quantity: unique videos, direct measurements, relevance and freshness per source. Data generated {fmtAgo(s.generatedAt, app.now)}.</div>
            <SourceList sources={s.sources} quality={s.sourceQuality} now={app.now} />
            <div className="hr" />
            <div className="small muted">
              YouTube quota today: {s.stats.youtube?.quotaUnitsToday ?? 0} units · {s.stats.youtube?.searchCallsToday ?? 0} search calls · {s.stats.youtube?.trackedVideos ?? 0} tracked videos.
              {s.sources.find((x) => x.source === 'youtube')?.mode === 'disabled' && ' Add a free YouTube Data API key as the repository secret YOUTUBE_API_KEY to enable direct video statistics (README).'}
            </div>
            <div className="hr" />
            <h3 style={{ marginBottom: 4 }}>Refresh</h3>
            <div className="small muted" style={{ marginBottom: 8 }}>Collection runs automatically in the cloud every 30 minutes. A manual run starts from the cloud collector page (GitHub sign-in required) — no credentials are stored in this browser.</div>
            <div className="row wrap">
              <button className="btn" onClick={() => { app.reload(); app.toast('Reloading latest data'); }}>Reload latest data</button>
              {repo && <a className="btn" href={`https://github.com/${repo}/actions/workflows/collect.yml`} target="_blank" rel="noopener noreferrer">Run collection now ↗</a>}
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 4 }}>Quality checks (this run)</h3>
            <div className="small muted" style={{ marginBottom: 8 }}>Automated checks run at the end of every collection. Relevance rate = format evidence that passes the validator.</div>
            {s.quality.checks.map((c) => (
              <div className="check" key={c.name}><span className={c.ok ? 'ok' : 'fail'}>{c.ok ? '✓' : '✕'}</span><span>{c.name}</span><span className="muted num">{c.detail}</span></div>
            ))}
            <div className="hr" />
            <div className="small muted">Run {s.runId} · {s.stats.observationsThisRun} observations this run · {s.stats.observationsTotal} in the 35-day window · {s.stats.historyDays} day{s.stats.historyDays === 1 ? '' : 's'} of history.</div>
          </div>
        </div>
      )}

      {tab === 'about' && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>How Viral Radar scores a trend</h3>
          <ul className="explain">
            <li><b>Evidence grade</b> — Strong: ≥3 verified creators, ≥3 directly measured videos, seen across ≥3 collection runs spanning ≥6 hours. Developing: ≥3 verified creators and examples. Early: at least one video with some corroboration. Insufficient: anything less — never recommended.</li>
            <li><b>Video performance</b> — views (or engagement) per hour since the video's own publish time, on videos measured at their platform. Not available for unverified shares.</li>
            <li><b>Video momentum</b> — the same videos re-measured across runs: current views/hour vs. lifetime average. Needs ≥2 observations ≥1h apart.</li>
            <li><b>Category adoption</b> — independent creators (channels/authors; a video shared by many accounts counts once) with examples inside the window, plus creators new in the last 48h.</li>
            <li><b>Audience interest</b> — search spikes, hashtags, trending topics and the engagement of posts that share a video.</li>
            <li><b>Confidence</b> — videos, direct measurements, verified creators, independent sources and observation history.</li>
            <li><b>Momentum</b> = 30% adoption + 25% measured signal (momentum → performance → interest) + 20% recency + 15% audience interest + 10% measured growth. <b>Opportunity</b> adds creator fit and monetization suitability, discounted by confidence and grade.</li>
            <li><b>Timestamps</b> — a video's publish date comes only from its platform; the time a post shared it is shown as “shared”. Time windows use these content times, not our collection time.</li>
            <li><b>What never qualifies</b> — news/person events, generic evergreen categories without measured growth, and anything with insufficient evidence. Rankings are not padded.</li>
          </ul>
          <h3 style={{ margin: '18px 0 8px' }}>How Viral Radar classifies a video (3.0)</h3>
          <ul className="explain">
            <li><b>Verified viral hit</b> — YouTube: ≥5M views within 30 days, or ≥1M views with ≥50K views/hour (measured or lifetime). Bluesky (its own like-based scale): ≥5,000 likes.</li>
            <li><b>Early breakout</b> — measured ≥10K views/hour (≥50K views), or ≥3K/hour accelerating ≥1.5× (≥20K views), or a ≤48h-old video averaging ≥10K/hour with ≥100K views and above the creator's normal range, or a creator outlier (≥20× the channel's median upload, ≥100K views, ≤14 days), or a delayed breakout (≥30 days old but measured ≥5K/hour at ≥5× its lifetime average).</li>
            <li><b>Unverified signal</b> — shared by ≥3 accounts or ≥500 post likes with no platform statistics (TikTok, Instagram, Facebook links).</li>
            <li><b>Not featured</b> — below the candidate floor (10K views / 100 likes), below thresholds for its age, cooling (measured ≤0.3× lifetime over ≥6h), live streams, duplicates of a larger upload, or older than 30 days without a measured resurgence.</li>
            <li><b>Velocity</b> is only ever computed between two real observations ≥1h apart; the lifetime average is labelled as such and never presented as a measured rate. Acceleration needs three observations.</li>
            <li><b>Scores</b> — viral (popularity for age), breakout (measured growth, acceleration, creator outlier, youth), engagement (likes/comments per view, ≥10K views), outlier (vs. creator baseline), confidence (observations, measurement, baseline, cross-platform evidence). They are separate on purpose.</li>
          </ul>
          <div className="small muted" style={{ marginTop: 10 }}>Full formulas and weights: docs/SCORING.md in the repository.</div>
        </div>
      )}
    </>
  );
}


function Coverage() {
  const app = useApp();
  const s = app.snapshot;
  const intel = s.videos;
  if (!intel) return <div className="notice warn">Coverage appears after the first 3.0 collection.</div>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="small muted">What the intelligence system is actually collecting, per platform. <b>Direct</b> = statistics from the video platform itself. <b>Indirect</b> = social shares, search interest, third-party mentions. <b>Unavailable</b> = no usable data from that platform.</div>
      <div className="tablewrap">
        <table className="data">
          <thead><tr><th>Platform</th><th>Status</th><th>Collector</th><th>Last success</th><th className="num">Unique videos</th><th className="num">Verified</th><th className="num">Unverified shares</th><th className="num">Fresh</th><th className="num">Errors</th><th className="num">Candidates</th><th className="num">In feed</th><th className="num">Rejected</th><th>Quota</th></tr></thead>
          <tbody>
            {intel.coverage.map((c) => (
              <tr key={c.platform}>
                <td><b>{PLATFORM_NAME[c.platform]}</b></td>
                <td><span className={`pill cov ${c.status}`}>{c.status}</span></td>
                <td className="small">{c.collector}</td>
                <td className="small">{c.lastSuccess ? fmtAgo(c.lastSuccess, app.now) : '—'}</td>
                <td className="num">{c.uniqueVideos}</td><td className="num">{c.verifiedVideos}</td><td className="num">{c.unverifiedShares}</td>
                <td className="num">{c.freshnessHours != null ? `${c.freshnessHours}h` : '—'}</td><td className="num">{c.errors}</td>
                <td className="num">{c.candidates}</td><td className="num">{c.inFeed}</td><td className="num">{c.rejected}</td>
                <td className="small num">{c.quota ? `${c.quota.used}/${c.quota.limit} units · ${c.quota.searches}/${c.quota.searchLimit} searches` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid cols-2">
        {intel.coverage.map((c) => <div key={c.platform} className="card tight"><b>{PLATFORM_NAME[c.platform]}</b> <span className={`pill cov ${c.status}`}>{c.status}</span><div className="small muted" style={{ marginTop: 6 }}>{c.note}</div></div>)}
      </div>
      <div className="small muted">Generated {fmtAgo(intel.generatedAt, app.now)} · run {s.runId}.</div>
    </div>
  );
}

function Funnel() {
  const app = useApp();
  const intel = app.snapshot.videos;
  if (!intel) return <div className="notice warn">The funnel appears after the first 3.0 collection.</div>;
  const f = intel.funnel;
  const steps: [string, number, string][] = [
    ['Videos discovered', f.discovered, 'unique videos seen in the last 30 days (all platforms)'],
    ['With usable metadata', f.withMetadata, 'title plus a publish date or creator'],
    ['With verified statistics', f.verified, 'measured on the video platform (YouTube API / Bluesky native)'],
    ['Meeting candidate criteria', f.candidates, '≥10K views (YouTube) or ≥100 likes (Bluesky)'],
    ['Passing relevance checks', f.relevant, 'not a duplicate of a larger upload'],
    ['Qualifying as viral or breakout', f.qualified, 'verified hit or early breakout'],
    ['Appearing in the user-facing feed', f.inFeed, 'top lists of Viral Now and Early Radar'],
  ];
  const max = Math.max(1, f.discovered);
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="small muted">Where videos are lost between discovery and the feed. If a 3M-view video never reaches the feed, the rejection list says which rule excluded it. Nothing here is hard-coded.</div>
      <div className="card">
        {steps.map(([label, n, desc], i) => (
          <div key={label} className="funnel-row">
            <div className="lbl"><b>{i + 1}. {label}</b><span className="tiny dim">{desc}</span></div>
            <div className="bar"><i style={{ width: `${(100 * n) / max}%` }} /></div>
            <b className="num">{fmtNum(n)}</b>
          </div>
        ))}
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Why videos were not featured</h3>
          {Object.entries(f.rejections).map(([k, n]) => <div key={k} className="check"><span className="muted">·</span><span>{k}</span><span className="muted num">{n}</span></div>)}
        </div>
        <div className="tiles">
          <StatTile v={intel.counts.verified_hit} k="Verified hits" cls="good" />
          <StatTile v={intel.counts.early_breakout} k="Early breakouts" />
          <StatTile v={intel.counts.unverified_signal} k="Unverified signals" />
          <StatTile v={intel.counts.rejected} k="Rejected" />
        </div>
      </div>
    </div>
  );
}
