import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoRecords, measureVelocity, THRESHOLDS, viralNowLists, earlyRadarList, linkCrossPlatform } from '../src/intel/videos.js';
import { buildFunnel, markDuplicates } from '../src/intel/funnel.js';
import type { Observation } from '../src/types.js';

const NOW = '2026-10-28T06:00:00.000Z';
const h = (hoursAgo: number) => new Date(new Date(NOW).getTime() - hoursAgo * 36e5).toISOString();
const yt = (id: string, title: string, views: number, hoursOld: number, extra: Partial<Observation> = {}, channel = 'chan'): Observation => ({
  id: `youtube:video:${id}`, source: 'youtube', kind: 'video', level: 'direct', key: `yt:${id}`, title, url: `https://www.youtube.com/shorts/${id}`,
  observedAt: NOW, verifiedAt: NOW, firstSeenAt: h(Math.min(hoursOld, 10)), publishedAt: h(hoursOld), videoPublishedAt: h(hoursOld),
  metrics: { views, likes: Math.round(views * 0.03), comments: Math.round(views * 0.001) },
  video: { platform: 'youtube', id, durationSec: 30, channelId: `UC${channel}`, statsDirect: true }, creator: { name: channel, url: `https://www.youtube.com/channel/UC${channel}` }, ...extra,
});
const bsky = (id: string, likes: number, hoursOld: number): Observation => ({
  id: `bluesky:video:bsky:${id}`, source: 'bluesky', kind: 'video', level: 'direct', key: `bsky:${id}`, title: `post ${id}`, url: `https://bsky.app/profile/x/post/${id}`,
  observedAt: NOW, firstSeenAt: h(hoursOld), publishedAt: h(hoursOld), postPublishedAt: h(hoursOld), videoPublishedAt: h(hoursOld), metrics: { likes, reposts: 1 },
  video: { platform: 'bluesky', id, statsDirect: true }, creator: { name: 'someone' },
});
const share = (id: string, likes: number, accounts = 1): Observation => ({
  id: `bluesky:video:tt:${id}`, source: 'bluesky', kind: 'video', level: 'indirect', key: `tt:${id}`, title: `tiktok ${id}`, url: `https://www.tiktok.com/@a/video/${id}`,
  observedAt: NOW, firstSeenAt: NOW, postPublishedAt: h(2), metrics: {}, postMetrics: { likes, accounts }, video: { platform: 'tiktok', id, statsDirect: false }, sharedBy: { name: 'fan' },
});
const build = (obs: Observation[], hist = new Map(), channels = new Map()) => buildVideoRecords({ observations: obs, metricHistory: hist, channels, now: NOW });

test('videos: states follow absolute + relative thresholds; tiny engagement is never a breakout', () => {
  const recs = build([
    yt('hit1', 'Big short', 12_000_000, 40),
    yt('young', 'Fresh and fast', 400_000, 6), // 66K/h average, 6h old → provisional breakout
    yt('small', 'Ordinary upload', 3_500, 5), // below candidate floor
    yt('slow', 'Steady older', 2_100_000, 160), // 13K/h over a week, 2.1M → below hit thresholds
    bsky('b1', 8, 3), // 4→8 likes is nothing
    bsky('b2', 6_200, 30), // Bluesky-scale hit
    share('t1', 900, 4), // TikTok link shared by 4 accounts: unverified signal
  ]);
  const by = Object.fromEntries(recs.map((r) => [r.platformId, r]));
  assert.equal(by.hit1.state, 'verified_hit');
  assert.equal(by.young.state, 'early_breakout');
  assert.ok(by.young.reasons.some((x) => /provisional/.test(x)), 'a single observation is labelled provisional');
  assert.ok(by.young.reasons.some((x) => /an average, not a measured recent rate/.test(x)));
  assert.equal(by.small.state, 'rejected');
  assert.match(by.small.rejectedBy!, /candidate floor/);
  assert.equal(by.slow.state, 'rejected');
  assert.equal(by.b1.state, 'rejected');
  assert.match(by.b1.rejectedBy!, /Bluesky candidate floor/);
  assert.equal(by.b2.state, 'verified_hit');
  assert.equal(by.t1.state, 'unverified_signal');
  assert.equal(by.t1.viralScore, 0, 'unverified signals carry no viral score');
  assert.equal(by.t1.metrics.views, undefined, 'share likes never become video statistics');
});

test('videos: velocity is measured only between real observations ≥1h apart; acceleration needs three points', () => {
  const v = measureVelocity([
    { t: h(6), metrics: { views: 100_000 } }, { t: h(5.5), metrics: { views: 105_000 } }, { t: h(3), metrics: { views: 160_000 } }, { t: h(0), metrics: { views: 400_000 } },
  ], NOW, 'views');
  assert.equal(v.velocity.length, 2, 'two ≥1h intervals (the 30-minute tick is merged)');
  assert.equal(v.velocity[0].perHour, 80_000, 'latest: +240K over 3h');
  assert.equal(v.velocity[1].perHour, 22_000, 'previous: +55K over the 2.5h back to the nearest point ≥1h earlier');
  assert.equal(v.acceleration, 3.64, 'latest ÷ previous');
  assert.equal(v.gained?.['3h'], 240_000);
  assert.equal(measureVelocity([{ t: h(0.5), metrics: { views: 1 } }, { t: h(0), metrics: { views: 2 } }], NOW, 'views').velocity.length, 0, 'no claim from 30 minutes of data');
});

test('videos: measured growth beats the lifetime average; cooling is detected; delayed breakouts survive the 30-day rule', () => {
  const steady = yt('st', 'Resurging classic', 3_000_000, 24 * 60); // 60 days old, 2K/h lifetime
  const hist = new Map([[steady.id, [{ t: h(8), metrics: { views: 2_800_000 } }, { t: h(4), metrics: { views: 2_900_000 } }, { t: h(0), metrics: { views: 3_000_000 } }]]]);
  const r = build([steady], hist)[0];
  assert.equal(r.velocity![0].perHour, 25_000);
  assert.equal(r.state, 'early_breakout', 'a 60-day-old video gaining 25K/h is a delayed breakout');
  assert.ok(r.reasons.some((x) => /Delayed breakout/.test(x)));

  const cooling = yt('co', 'Past its peak', 1_200_000, 100); // 12K/h lifetime
  const coolHist = new Map([[cooling.id, [{ t: h(9), metrics: { views: 1_190_000 } }, { t: h(4), metrics: { views: 1_196_000 } }, { t: h(0), metrics: { views: 1_200_000 } }]]]);
  const c = build([cooling], coolHist)[0];
  assert.ok(c.velocityRatio! < 0.3);
  assert.equal(c.state, 'rejected');
  assert.match(c.rejectedBy!, /cooling/);
});

test('videos: creator outliers qualify with a baseline; live streams and duplicates are excluded; lists stay per scale', () => {
  const channels = new Map([['UCsmall', { subscribers: 4_000, medianRecentViews: 5_000 }]]);
  const outlier = yt('out', 'Tiny channel, huge video', 600_000, 24 * 5, {}, 'small');
  const live = yt('lv', '🔴 LIVE finals', 900_000, 3, { video: { platform: 'youtube', id: 'lv', durationSec: 0, channelId: 'UCx', statsDirect: true, live: 'live' } });
  const a = yt('dupA', 'Same exact title here now', 9_000_000, 30, {}, 'orig');
  const b = yt('dupB', 'Same exact title here now', 1_000_000, 20, {}, 'copycat');
  const recs = build([outlier, live, a, b, bsky('bb', 7_000, 10)], new Map(), channels);
  const by = Object.fromEntries(recs.map((r) => [r.platformId, r]));
  assert.equal(by.out.baselineRatio, 120);
  assert.equal(by.out.state, 'early_breakout');
  assert.ok(by.out.reasons.some((x) => /Creator outlier/.test(x)));
  assert.equal(by.lv.state, 'rejected');
  assert.match(by.lv.rejectedBy!, /live stream/);
  // cross-platform/duplicate detection
  linkCrossPlatform(recs, []);
  markDuplicates(recs);
  assert.equal(by.dupA.state, 'verified_hit');
  assert.equal(by.dupB.state, 'rejected');
  assert.match(by.dupB.rejectedBy!, /duplicate/);
  const vn = viralNowLists(recs, NOW);
  assert.ok(vn['7d'].every((c) => c.platform !== 'bluesky'), 'Bluesky never ranks among view-count platforms');
  assert.ok(earlyRadarList(recs).every((c) => c.platform !== 'bluesky'));
  const f = buildFunnel(recs, new Set(vn['7d'].map((c) => c.id)));
  assert.equal(f.discovered, 5);
  assert.equal(f.qualified, 3, 'hit + outlier + bluesky hit');
  assert.ok(f.rejections['duplicate of a larger upload'] === 1);
  assert.ok(THRESHOLDS.youtube.candidateViews === 10_000);
});
