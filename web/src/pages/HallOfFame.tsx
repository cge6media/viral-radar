import { useMemo, useState } from 'react';
import type { VideoCard } from '../lib/types';
import { lessonFor } from '../data/hofLessons';
import { HALL_OF_FAME, HOF_ERAS, type HofEntry } from '../data/hallOfFame';
import { VideoThumb, usePlayer } from '../components/video';
import { fmtNum } from '../lib/data';
import { Icon } from '../components/ui';

const PLATFORM: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', newgrounds: 'Newgrounds' };

function toCard(e: HofEntry): VideoCard {
  return {
    id: e.id, platform: e.platform === 'newgrounds' ? 'other' : e.platform, platformId: e.platformId, url: e.url, title: e.title,
    thumbnail: e.platform === 'youtube' ? `https://i.ytimg.com/vi/${e.platformId}/hqdefault.jpg` : undefined,
    creator: e.creator, publishedAt: undefined, views: e.views, state: 'verified_hit', viralScore: 0, breakoutScore: 0, engagementScore: 0, outlierScore: 0,
    category: e.category, formats: [], reasons: [`Hall of Fame entry (${e.year}): ${e.context}`, e.views ? `${fmtNum(e.views)} views verified through the YouTube API on ${e.verifiedAt}.` : 'Original lives on a platform without a public statistics API; the link is the original source.', `Link status: ${e.originalStatus}.`], crossPlatform: 0, verified: !!e.views,
  };
}

export default function HallOfFame() {
  const player = usePlayer();
  const [era, setEra] = useState<string>('');
  const [cat, setCat] = useState<string>('');
  const [plat, setPlat] = useState<string>('');
  const [sort, setSort] = useState<'era' | 'influence' | 'views'>('era');
  const categories = useMemo(() => Array.from(new Set(HALL_OF_FAME.map((e) => e.category))).sort(), []);
  const platforms = useMemo(() => Array.from(new Set(HALL_OF_FAME.map((e) => e.platform))), []);
  const list = useMemo(() => {
    const l = HALL_OF_FAME.filter((e) => (!era || e.era === era) && (!cat || e.category === cat) && (!plat || e.platform === plat));
    if (sort === 'influence') return l.sort((a, b) => b.influence - a.influence || a.year - b.year);
    if (sort === 'views') return l.sort((a, b) => (b.views || 0) - (a.views || 0));
    return l.sort((a, b) => a.year - b.year);
  }, [era, cat, plat, sort]);
  const verified = HALL_OF_FAME.filter((e) => e.views != null).length;

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <div className="kicker">Viral Hall of Fame · entertainment history & creative inspiration</div>
        <h1>The videos that taught the internet how to go viral.</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>{HALL_OF_FAME.length} entries from 2004 to 2023, organised by era, category and platform. {verified} YouTube originals were verified through the YouTube Data API on 28 Oct 2026 (view counts as of that day); originals that live on Facebook, TikTok or Newgrounds link to their source and are marked unverified. This archive is kept entirely apart from the live rankings — history never distorts today's breakout detection.</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg wrap" role="group" aria-label="Era"><button className={!era ? 'on' : ''} onClick={() => setEra('')}>All eras</button>{HOF_ERAS.map((e) => <button key={e} className={era === e ? 'on' : ''} onClick={() => setEra(e)}>{e}</button>)}</div>
          <div className="seg wrap" role="group" aria-label="Sort"><button className={sort === 'era' ? 'on' : ''} onClick={() => setSort('era')}>By year</button><button className={sort === 'influence' ? 'on' : ''} onClick={() => setSort('influence')}>By influence</button><button className={sort === 'views' ? 'on' : ''} onClick={() => setSort('views')}>By verified views</button></div>
        </div>
        <div className="chips">
          <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>All categories</button>
          {categories.map((c) => <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
          <span className="dim">·</span>
          <button className={`chip${!plat ? ' on' : ''}`} onClick={() => setPlat('')}>All platforms</button>
          {platforms.map((p) => <button key={p} className={`chip${plat === p ? ' on' : ''}`} onClick={() => setPlat(p)}>{PLATFORM[p]}</button>)}
        </div>
      </header>
      <section className="section hofgrid">
        {list.map((e) => {
          const c = toCard(e);
          const playable = e.platform === 'youtube' || e.platform === 'tiktok' || e.platform === 'facebook';
          return (
            <article key={e.id} className="hof">
              {playable ? (
                <button className="media" onClick={() => player.open(c)} aria-label={`Play: ${e.title}`}>
                  <VideoThumb c={c}><span className="shade" /><span className="play" aria-hidden>{Icon.play}</span><span className="tl"><span className="pill kind on-dark">{e.year} · {PLATFORM[e.platform]}</span></span></VideoThumb>
                </button>
              ) : (
                <a className="media" href={e.url} target="_blank" rel="noopener noreferrer" aria-label={`Open: ${e.title}`}>
                  <VideoThumb c={c}><span className="shade" /><span className="tl"><span className="pill kind on-dark">{e.year} · {PLATFORM[e.platform]}</span></span></VideoThumb>
                </a>
              )}
              <div className="body">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}><div className="t">{e.title}</div><div className="small muted">{e.creator} · {e.category}</div></div>
                  <span className="infl num" title="Editorial influence on internet culture (1–5)">{'★'.repeat(e.influence)}</span>
                </div>
                <p className="small" style={{ margin: '8px 0' }}>{e.context}</p>
                <div className="row between wrap tiny dim">
                  <span>{e.views != null ? `${fmtNum(e.views)} views · verified ${e.verifiedAt}` : 'views unverified (no public API)'}</span>
                  <span>{e.originalStatus}</span>
                </div>
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  {playable && <button className="btn sm primary" onClick={() => player.open(c)}>Play</button>}
                  <a className="btn sm" href={e.url} target="_blank" rel="noopener noreferrer">Original ↗</a>
                </div>
                {(() => { const l = lessonFor(e.title); return l ? (
                  <details className="lesson">
                    <summary className="small"><b>Creative lesson</b> · <span className={`pill otype ${l.repeatable === 'repeatable format' ? 'format' : l.repeatable === 'one-off event' ? 'event' : 'meme'}`}><i aria-hidden />{l.repeatable}</span></summary>
                    <div className="small stack" style={{ gap: 6, marginTop: 8 }}>
                      <div><b>Why it mattered.</b> {l.why}</div>
                      <div><b>What made it recognisable.</b> {l.recognisable}</div>
                      <div><b>Derivatives.</b> {l.derivatives}</div>
                      <div className="row wrap" style={{ gap: 6 }}>{l.mechanisms.map((m) => <span key={m} className="pill kind">{m}</span>)}</div>
                    </div>
                  </details>
                ) : <div className="tiny dim" style={{ marginTop: 8 }}>No documented creative lesson for this entry.</div>; })()}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
