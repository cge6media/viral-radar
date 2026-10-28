# Data sources

Status as of the build session (2026-10-28 UTC). "Verified live" means the endpoint was fetched from the cloud
build session and the parser was written and tested against the real response. Live collection runs on GitHub
Actions runners; the build sandbox itself had no direct route to these hosts, so every live response was captured
through the session's fetch tool and stored verbatim as fixtures (`pipeline/fixtures/`).

| Source | Endpoint | Evidence kind | Auth | Status | Refresh |
|---|---|---|---|---|---|
| Google Trends — Trending now | `https://trends.google.com/trending/rss?geo=<REGION>` | `search_interest` (approx. traffic, pubDate, up to 3 news links) | none | **Verified live** (US, GB) | every run; regions `US,GB,CA,AU` by default |
| Bluesky — trending topics | `https://api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics` | `social_topic` | none | **Verified live** (25 topics) | every run |
| Bluesky — topic feeds | `https://api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://…` | `post` / `video` (likes, reposts, replies, quotes; native video playlists & thumbnails; external video links) | none | **Verified live** | every run, 15 posts per topic |
| Bluesky — format searches | `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<format>&sort=top` | `video` / `post` | none | **Verified live** (`animation`, `cat video`, `ai video`) | every run, 20 default queries |
| Mastodon — trending tags | `https://mastodon.social/api/v1/trends/tags` | `hashtag` with **7-day uses/accounts history** | none | **Verified live** (20 tags) | every run |
| YouTube oEmbed | `https://www.youtube.com/oembed?url=…&format=json` | enrichment (verified title, channel, thumbnail) | none | **Verified live** | up to 40 links per run |
| YouTube Data API v3 | `videos.list chart=mostPopular`, `search.list` + `videos.list` | `video` with real `viewCount` / `likeCount` / `commentCount` | free API key (`YOUTUBE_API_KEY`) | Implemented against the documented schema; **not exercised live** (no key in the build session). Reported as "disabled" until the secret is set. | every run; budget ≤ 2,500 units/run (10,000/day quota) |
| TikTok Creative Center | `ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list` (undocumented) | `hashtag` (post count, views, 7-day trend) | none | **Opt-in, unverified** (`VR_TIKTOK=1`); not a critical dependency; failures are reported, never fatal | every run when enabled |

Not used: Reddit (blocked from the build environment; its API now requires app credentials), Wikipedia pageviews
(endpoint returned not-found for 2026 dates during the session), YouTube RSS feeds (robots-disallowed).

## What each kind of evidence means

- **Search spike** (`search_interest`): people are searching for a term; it is *not* video performance.
- **Social topic**: Bluesky's trending topic cluster; the topic feed supplies the posts and engagement.
- **Hashtag**: posting volume per day (Mastodon gives a real 7-day series → measured growth from day one).
- **Video**: an actual video with a URL. Bluesky exposes likes/reposts/replies (no view counts); YouTube Data API exposes
  views/likes/comments. YouTube links found in posts are verified with oEmbed (title + channel).
- **Post**: a social post with engagement but no video.

## Provenance stored per observation

`source`, `kind`, `url`, `observedAt` (collection time), `publishedAt` (when the source states it), `region`,
`creator` (name + URL), `thumbnail`, `metrics`, `links` (news articles / original post), `query` (which collector query
produced it). History is append-only NDJSON per day in `data/history/observations/`.

## Freshness checks

- Google Trends items carry `pubDate` (when the term started trending); the collector stores it as `publishedAt`.
- Bluesky posts carry `record.createdAt`; the dashboard shows "published Xh ago" and "seen Xh ago" separately.
- A source that fails is served from its last successful cache (`data/cache/<source>.json`) and marked **cached** in the
  dashboard; cached observations keep their original timestamps so they age out naturally.

## Refresh schedule

GitHub Actions cron `7,37 * * * *` (every 30 minutes; GitHub may delay runs under load). Each run performs roughly:
4 Google Trends feeds + 1 topics call + ≤25 topic feeds + 20 searches + 1 Mastodon call + ≤40 oEmbed calls
(+ YouTube when configured) — well inside all public rate limits. Request volume can be tuned with the `VR_*` variables.
