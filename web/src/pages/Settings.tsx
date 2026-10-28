import { useState } from 'react';
import { useApp } from '../App';
import { usePrefs } from '../lib/store';
import { CATEGORIES } from '../../../pipeline/src/intel/taxonomy';
import { SourceList } from '../components/ui';
import { fmtAgo } from '../lib/data';

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
      <h1>Settings</h1>
      <div className="seg" style={{ margin: '12px 0 18px' }}>
        {[['prefs', 'Preferences'], ['data', 'Data & quality'], ['about', 'How scores work']].map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

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
          <div className="small muted" style={{ marginTop: 10 }}>Full formulas and weights: docs/SCORING.md in the repository.</div>
        </div>
      )}
    </>
  );
}
