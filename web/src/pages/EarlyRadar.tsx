import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App';
import { selectCards, type PlatformFilter, type SortMode, STATE_LABEL } from '../lib/videos';
import { VideoGrid } from '../components/video';
import { PlatformBar, SortBar, CoverageNote, useAllCards } from './ViralNow';
import { fmtAgo, fmtNum } from '../lib/data';
import { StatTile } from '../components/ui';

const RADAR_SORTS = [
  { id: 'newest_breakouts' as SortMode, label: 'Newest breakouts', desc: 'Youngest videos with credible abnormal momentum' },
  { id: 'fastest_rising' as SortMode, label: 'Fastest rising', desc: 'Strongest measured recent growth' },
  { id: 'creator_outliers' as SortMode, label: 'Creator outliers', desc: 'Far above the creator\'s normal range' },
  { id: 'most_viral' as SortMode, label: 'Biggest', desc: 'Largest verified numbers among breakouts' },
];

export default function EarlyRadar() {
  const { snapshot, now } = useApp();
  const intel = snapshot.videos;
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [sort, setSort] = useState<SortMode>('newest_breakouts');
  const { cards, error } = useAllCards();
  useEffect(() => { try { const p = localStorage.getItem('vr.er.platform') as PlatformFilter | null; if (p) setPlatform(p); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem('vr.er.platform', platform); } catch { /* ignore */ } }, [platform]);

  const list = useMemo(() => {
    if (!intel) return [];
    const base = cards ?? [...intel.earlyRadar, ...intel.bluesky.earlyRadar];
    const uniq = Array.from(new Map(base.map((c) => [c.id, c])).values()).filter((c) => c.state === 'early_breakout');
    const sorted = selectCards(uniq, { platform, sort: sort === 'most_viral' ? 'most_viral' : sort, now });
    return sort === 'newest_breakouts' ? sorted.sort((a, b) => b.breakoutScore - a.breakoutScore || (a.ageHours ?? 1e9) - (b.ageHours ?? 1e9)) : sorted;
  }, [cards, intel, platform, sort, now]);
  const measured = list.filter((c) => c.velocityPerHour != null).length;
  const provisional = list.length - measured;

  if (!intel) return <div className="notice warn">The first 3.0 collection has not published yet.</div>;
  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <h1>Early Radar</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>Videos showing credible abnormal momentum before they are established hits: measured views per hour between real observations, acceleration, performance against the creator's own baseline, and age. A change from 4 to 8 likes is never a breakout here — every entry clears absolute and relative floors.</p>
        <div className="tiles">
          <StatTile v={intel.counts.early_breakout} k="Breakouts in the index" s="30-day window, all platforms" />
          <StatTile v={measured} k="With measured velocity" s="two real observations ≥1h apart" cls="good" />
          <StatTile v={provisional} k="Provisional" s="young videos judged on their lifetime average" na={provisional === 0} />
          <StatTile v={intel.counts.verified_hit} k="Already verified hits" s="see Viral Now" />
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <PlatformBar value={platform} onChange={setPlatform} coverage={intel.coverage} />
        </div>
        <SortBar value={sort} onChange={setSort} modes={RADAR_SORTS} />
        <CoverageNote platform={platform} coverage={intel.coverage} />
        {error && <div className="notice warn small">Full index unavailable ({error}); showing the snapshot's top lists.</div>}
        <div className="legend small muted">
          <span><i className="dot measured" aria-hidden /> measured rate (between observations)</span>
          <span><i className="dot avg" aria-hidden /> lifetime average (single observation — provisional)</span>
          <span title={STATE_LABEL.early_breakout.desc}>States: {Object.values(STATE_LABEL).map((s) => s.short).join(' · ')}</span>
        </div>
      </header>
      <section className="section">
        <div className="small muted" style={{ marginBottom: 10 }}>{list.length} breakout{list.length === 1 ? '' : 's'} · statistics as of {fmtAgo(intel.generatedAt, now)}{list[0]?.velocityPerHour != null ? ` · top measured rate +${fmtNum(list[0].velocityPerHour)}/h` : ''}</div>
        <VideoGrid cards={list.slice(0, 60)} now={now} why empty={sort === 'fastest_rising' ? 'No measured velocity yet — the collector measures the same videos every 30 minutes; velocity appears once two observations are ≥1h apart.' : 'No breakout clears the floors in this selection right now.'} />
      </section>
    </>
  );
}
