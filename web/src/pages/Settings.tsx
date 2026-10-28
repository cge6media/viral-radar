import { useState } from 'react';
import { useApp } from '../App';
import { usePrefs } from '../lib/store';
import { CATEGORIES } from '../../../pipeline/src/intel/taxonomy';
import { SourceStatusList } from '../components/ui';
import { fmtAgo } from '../lib/data';

const TOOLS = [
  ['editing', 'Professional video editing'],
  ['animation', 'Animation'],
  ['ai-video', 'AI video generation'],
  ['image', 'Image generation'],
  ['audio', 'Audio production'],
  ['music', 'Music / songwriting'],
  ['camera', 'On-camera / live action'],
] as const;
const PLATFORMS = [
  ['youtube_shorts', 'YouTube Shorts'],
  ['youtube', 'YouTube long-form'],
  ['tiktok', 'TikTok'],
  ['instagram', 'Instagram Reels'],
  ['facebook', 'Facebook'],
  ['bluesky', 'Bluesky'],
] as const;

const REPO_DEFAULT = (import.meta.env.VITE_REPO as string | undefined) || '';

export default function Settings() {
  const app = useApp();
  const [prefs, update] = usePrefs();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const repo = prefs.githubRepo || REPO_DEFAULT;
  const toggle = (key: 'interests' | 'tools' | 'platforms', v: string) => {
    const cur = prefs[key];
    update({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as never);
  };

  const dispatch = async () => {
    if (!repo || !prefs.githubToken) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${prefs.githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' }),
      });
      if (res.status === 204) setMsg('Collection started in the cloud. It usually takes 2–4 minutes; then reload the data.');
      else setMsg(`GitHub answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (e) {
      setMsg(`Could not reach GitHub: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Settings</h1>
      <p className="muted" style={{ margin: '4px 0 14px' }}>Preferences shape the creator-fit score and the recommendations. Everything here stays in this browser.</p>

      <div className="grid cols-2">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Refresh</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>Collection runs automatically in the cloud on a schedule (every 30 minutes by default). Data last generated {fmtAgo(app.snapshot.generatedAt, app.now)}.</div>
          <div className="row wrap">
            <button className="btn" onClick={() => { app.reload(); app.toast('Reloading latest data'); }}>Reload latest data</button>
            {repo && <a className="btn" href={`https://github.com/${repo}/actions/workflows/collect.yml`} target="_blank" rel="noopener noreferrer">Open cloud collector</a>}
            <button className="btn primary" onClick={dispatch} disabled={busy || !repo || !prefs.githubToken} title={!prefs.githubToken ? 'Add a GitHub token below to trigger a run from here' : 'Trigger a collection run now'}>{busy ? 'Starting…' : 'Run collection now'}</button>
          </div>
          {msg && <div className="notice" style={{ marginTop: 10 }}>{msg}</div>}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field"><label>GitHub repository (owner/name)</label><input type="text" value={prefs.githubRepo ?? REPO_DEFAULT} placeholder="you/viral-radar" onChange={(e) => update({ githubRepo: e.target.value })} /></div>
            <div className="field"><label>Fine-grained token (Actions: read & write)</label><input type="password" value={prefs.githubToken || ''} placeholder="github_pat_…" onChange={(e) => update({ githubToken: e.target.value })} /><div className="hint">Optional. Lets the button above start a run. Stored only in this browser; without it, use "Open cloud collector" → Run workflow.</div></div>
          </div>
          <div className="hr" />
          <SourceStatusList sources={app.snapshot.sources} now={app.now} />
          <div className="small muted" style={{ marginTop: 10 }}>To add YouTube view/like statistics, add a free YouTube Data API key as the repository secret <code>YOUTUBE_API_KEY</code> (see README).</div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Your interests</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>+10 creator fit for these categories.</div>
          <div className="chips">{CATEGORIES.map((c) => <button key={c.name} className={`chip${prefs.interests.includes(c.name) ? ' on' : ''}`} onClick={() => toggle('interests', c.name)}>{c.name}</button>)}</div>
          <div className="hr" />
          <h2 style={{ marginBottom: 4 }}>Your tools</h2>
          <div className="small muted" style={{ marginBottom: 10 }}>+5 creator fit when a trend suits them; lowers estimated difficulty.</div>
          <div className="chips">{TOOLS.map(([id, label]) => <button key={id} className={`chip${prefs.tools.includes(id) ? ' on' : ''}`} onClick={() => toggle('tools', id)}>{label}</button>)}</div>
          <div className="hr" />
          <h2 style={{ marginBottom: 4 }}>Publishing platforms</h2>
          <div className="chips" style={{ marginTop: 8 }}>{PLATFORMS.map(([id, label]) => <button key={id} className={`chip${prefs.platforms.includes(id) ? ' on' : ''}`} onClick={() => toggle('platforms', id)}>{label}</button>)}</div>
          <div className="hr" />
          <h2 style={{ marginBottom: 4 }}>Risk appetite</h2>
          <div className="chips" style={{ marginTop: 8 }}>
            {([['early', 'Early — catch trends before they peak'], ['balanced', 'Balanced'], ['proven', 'Proven — only breaking out / peaking']] as const).map(([id, label]) => (
              <button key={id} className={`chip${prefs.appetite === id ? ' on' : ''}`} onClick={() => update({ appetite: id })}>{label}</button>
            ))}
          </div>
          <div className="hr" />
          <label className="row small"><input type="checkbox" checked={prefs.hideNews} onChange={(e) => update({ hideNews: e.target.checked })} /> Hide news / person events from rankings and recommendations</label>
        </div>
      </div>

      <div className="card section">
        <h2 style={{ marginBottom: 6 }}>How scores work</h2>
        <ul className="explain">
          <li><b>Momentum (0–100)</b> = 25% recency + 30% growth + 10% acceleration + 20% breadth (sources × evidence count) + 15% attention level. Growth is only "measured" with ≥2 data points; otherwise neutral and marked provisional.</li>
          <li><b>Confidence (0–100)</b> = evidence count, independent sources, videos with real statistics, number of creators and how many runs/days the trend has been observed.</li>
          <li><b>Monetization (0–100)</b> = category profile (advertiser suitability, sponsorship, affiliate, longevity, demand, cost) with a −45% penalty for news/person events and a small bonus when YouTube videos are present.</li>
          <li><b>Creator fit (0–100)</b> = 35% momentum + 20% repeatability + 15% (1 − saturation) + 15% (1 − cost) + 15% monetization, then your preferences (interests +10, tools +5, appetite +6).</li>
          <li><b>Opportunity</b> = (40% momentum + 35% creator fit + 25% monetization) × (0.3 + 0.7 × confidence). This is the Top 20 order.</li>
        </ul>
      </div>
    </>
  );
}
