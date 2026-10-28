import { useMemo } from 'react';
import { useApp } from '../App';
import { selectCards, type PlatformFilter, type SortMode, type LanguageFilter, STATE_LABEL, KIND_LABEL } from '../lib/videos';
import { VideoGrid } from '../components/video';
import { PlatformBar, SortBar, CoverageNote, LanguageBar, useAllCards, usePersisted } from './ViralNow';
import { fmtAgo, fmtNum } from '../lib/data';
import { StatTile } from '../components/ui';
import { Lede } from '../components/ui';

const RADAR_SORTS = [
  { id: 'strongest_momentum' as SortMode, label: 'Strongest momentum', desc: 'Breakout score: measured growth, acceleration, creator outlier, youth' },
  { id: 'newest_breakouts' as SortMode, label: 'Newest breakouts', desc: 'Youngest videos with credible abnormal momentum' },
  { id: 'fastest_rising' as SortMode, label: 'Fastest rising', desc: 'Strongest measured recent growth (views/hour between observations)' },
  { id: 'creator_outliers' as SortMode, label: 'Creator outliers', desc: 'Far above the creator\'s normal range' },
  { id: 'most_viral' as SortMode, label: 'Biggest', desc: 'Largest verified numbers among breakouts' },
];

export default function EarlyRadar() {
  const { snapshot, now } = useApp();
  const intel = snapshot.videos;
  const [platform, setPlatform] = usePersisted<PlatformFilter>('vr.er.platform', 'all');
  const [sort, setSort] = usePersisted<SortMode>('vr.er.sort', 'strongest_momentum');
  const [lang, setLang] = usePersisted<LanguageFilter>('vr.er.lang', 'all');
  const [kind, setKind] = usePersisted<'all' | 'early' | 'delayed'>('vr.er.kind', 'all');
  const { cards, error } = useAllCards();

  const list = useMemo(() => {
    if (!intel) return [];
    const base = cards ?? [...intel.earlyRadar, ...intel.bluesky.earlyRadar];
    const uniq = Array.from(new Map(base.map((c) => [c.id, c])).values()).filter((c) => c.state === 'early_breakout');
    return selectCards(uniq, { platform, sort, now, language: lang, kinds: kind === 'all' ? undefined : [kind] });
  }, [cards, intel, platform, sort, now, lang, kind]);
  const measured = list.filter((c) => c.velocityPerHour != null).length;
  const provisional = list.length - measured;
  const delayed = list.filter((c) => c.kind === 'delayed').length;

  if (!intel) return <div className="notice warn">The first 3.0 collection has not published yet.</div>;
  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <h1>Early Radar</h1>
        <Lede>Two kinds of attention that are <b>not yet established hits</b>: <b>early breakouts</b> — young videos below the hit floor for their age but on a measured abnormal rise (views/hour between real observations, acceleration, the creator's own baseline) — and <b>delayed breakouts</b> — older videos resurfacing with measured new velocity, labelled as such and never ranked as new uploads. Established hits live in Viral Now. Every entry clears absolute and relative floors; a change from 4 to 8 likes is never a breakout here.</Lede>
        <div className="tiles five">
          <StatTile v={intel.counts.early_breakout} k="Breakouts in the index" s="30-day window, all platforms" />
          <StatTile v={measured} k="With measured velocity" s="two real observations ≥1h apart" cls="good" />
          <StatTile v={provisional} k="Provisional" s="young videos judged on their lifetime average" na={provisional === 0} />
          <StatTile v={delayed} k="Resurfacing" s="older than a week, measured ≥3× lifetime" na={delayed === 0} />
          <StatTile v={intel.counts.verified_hit} k="Already established" s="see Viral Now" />
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="seg" role="group" aria-label="Kind">
            {([['all', 'Early + resurfacing'], ['early', KIND_LABEL.early.label], ['delayed', KIND_LABEL.delayed.label]] as const).map(([id, label]) => <button key={id} className={kind === id ? 'on' : ''} onClick={() => setKind(id)} title={id === 'all' ? 'Both kinds' : KIND_LABEL[id].desc}>{label}</button>)}
          </div>
          <PlatformBar value={platform} onChange={setPlatform} coverage={intel.coverage} />
        </div>
        <SortBar value={sort} onChange={setSort} modes={RADAR_SORTS} />
        <LanguageBar value={lang} onChange={setLang} />
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
