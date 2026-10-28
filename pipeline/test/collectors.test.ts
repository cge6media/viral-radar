import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseGoogleTrendsRss } from '../src/collectors/googleTrends.js';
import { postToObservation, topicToObservation, topicFeedUri } from '../src/collectors/bluesky.js';
import { tagToObservation } from '../src/collectors/mastodon.js';
import { videoToObservation, isoDurationSeconds } from '../src/collectors/youtube.js';
import { FIXTURE_DIR } from '../src/lib/http.js';

const fx = (f: string) => readFile(path.join(FIXTURE_DIR, f), 'utf8');

test('Google Trends RSS parser reads real feed items, traffic, news links', async () => {
  const items = parseGoogleTrendsRss(await fx('google-trends-US.xml'), 'US', '2026-10-28T00:20:00.000Z');
  assert.equal(items.length, 10);
  const nz = items.find((i) => i.title === 'nz vs ind')!;
  assert.ok(nz);
  assert.equal(nz.kind, 'search_interest');
  assert.equal(nz.metrics.approxTraffic, 2000);
  assert.equal(nz.metrics.rank, 1);
  assert.equal(nz.region, 'US');
  assert.equal(nz.links?.length, 3);
  assert.match(nz.links![0].url, /^https:\/\/www\.cricinfo\.com\//);
  assert.equal(nz.id, 'google_trends:search_interest:nz vs ind:US');
  assert.equal(nz.key, 'nz vs ind');
  assert.equal(nz.publishedAt, '2026-10-27T06:50:00.000Z');
  assert.match(nz.url, /trends\.google\.com\/trending\?geo=US&q=nz%20vs%20ind/);
});

test('Google Trends: same term in two regions shares a key (clusters together) but keeps distinct ids (both kept as evidence)', async () => {
  const us = parseGoogleTrendsRss(await fx('google-trends-US.xml'), 'US');
  const gb = parseGoogleTrendsRss(await fx('google-trends-GB.xml'), 'GB');
  const a = us.find((i) => i.title === 'nz vs ind')!;
  const b = gb.find((i) => i.title === 'nz vs ind')!;
  assert.equal(a.key, b.key);
  assert.notEqual(a.id, b.id);
  assert.equal(b.metrics.approxTraffic, 5000);
});

test('Bluesky: trending topic → social_topic observation with feed URI', async () => {
  const { topics } = JSON.parse(await fx('bsky-trending.json'));
  const o = topicToObservation(topics[3], 4);
  assert.equal(o.kind, 'social_topic');
  assert.equal(o.title, 'Spooky month stream schedules');
  assert.equal(o.url, 'https://bsky.app/profile/did:plc:qrz3lhbyuxbeilrc6nekdqme/feed/5417c6b9b399');
  assert.equal(topicFeedUri(topics[3].link), 'at://did:plc:qrz3lhbyuxbeilrc6nekdqme/app.bsky.feed.generator/5417c6b9b399');
  assert.equal(o.metrics.rank, 4);
});

test('Bluesky: native video post → video observation; external YouTube link → video keyed by YouTube id', async () => {
  const { posts } = JSON.parse(await fx('bsky-search-cat-video.json'));
  const native = postToObservation(posts[0], 'search:cat video')!;
  assert.equal(native.kind, 'video');
  assert.equal(native.metrics.likes, 3077);
  assert.equal(native.metrics.reposts, 374);
  assert.match(native.url, /^https:\/\/bsky\.app\/profile\/rainmaker1973-m\.bsky\.social\/post\//);
  assert.match(native.thumbnail!, /thumbnail\.jpg$/);
  const yt = postToObservation(posts[1], 'search:cat video')!;
  assert.equal(yt.kind, 'video');
  assert.equal(yt.key, 'yt:vEtbfzMLVWU');
  assert.equal(yt.id, 'bluesky:video:yt:vEtbfzMLVWU');
  assert.match(yt.url, /youtu\.be\/vEtbfzMLVWU/);
  assert.deepEqual(yt.tags, ['musicchallenge', 'emojisounds']);
  assert.equal(yt.title, 'Stray Cats - Stray Cat Strut (Official Music Video)');
});

test('Bluesky: adult-labelled or 🔞 posts are dropped', () => {
  const base = { uri: 'at://did:plc:x/app.bsky.feed.post/abc', cid: 'c', author: { did: 'did:plc:x', handle: 'h.bsky.social' }, record: { text: 'hello' } };
  assert.ok(postToObservation(base as never, 'q'));
  assert.equal(postToObservation({ ...base, labels: [{ val: 'porn' }] } as never, 'q'), undefined);
  assert.equal(postToObservation({ ...base, record: { text: 'hi 🔞' } } as never, 'q'), undefined);
});

test('Mastodon: tag → hashtag observation with sorted 7-day history', async () => {
  const tags = JSON.parse(await fx('mastodon-tags.json'));
  const o = tagToObservation(tags[0], 'mastodon.social', 1);
  assert.equal(o.kind, 'hashtag');
  assert.equal(o.title, '#TuneTuesday');
  assert.equal(o.metrics.uses, 109);
  assert.equal(o.metrics.accounts, 81);
  assert.equal(o.history?.length, 7);
  assert.ok(o.history![0].t < o.history![6].t);
  assert.equal(o.history![6].value, 109);
});

test('YouTube: documented videos.list item → video observation (Shorts detection, numeric stats)', () => {
  const v = {
    id: 'abc123XYZ_0', snippet: { publishedAt: '2026-10-27T10:00:00Z', channelId: 'UC1', title: 'Test #shorts', description: 'd', channelTitle: 'Chan', categoryId: '23', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc123XYZ_0/mqdefault.jpg' } } },
    statistics: { viewCount: '1234567', likeCount: '1000', commentCount: '10' }, contentDetails: { duration: 'PT45S' },
  };
  const o = videoToObservation(v, 'US', 3, 'mostPopular US');
  assert.equal(o.url, 'https://www.youtube.com/shorts/abc123XYZ_0');
  assert.equal(o.metrics.views, 1234567);
  assert.equal(o.creator?.name, 'Chan');
  assert.match(o.text!, /Comedy/);
  assert.equal(isoDurationSeconds('PT1H2M3S'), 3723);
});
