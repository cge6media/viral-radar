# Data sources (Viral Radar 2.0)

Roles changed in 2.0: **video platforms are the primary evidence**; search and social signals corroborate.
A provider collecting 800 unrelated posts is not more valuable than one collecting 80 relevant videos — the
Source Quality panel (Settings → Data & quality) reports unique videos, direct measurements, relevance, age and
errors per source, every run.

| Source | Role | Endpoint | Evidence | Auth | Status |
|---|---|---|---|---|---|
| **YouTube Data API v3** | Primary video statistics | `videos.list chart=mostPopular` (per region + entertainment categories 1,10,15,20,23,24), `videos.list id=…` (tracking refresh, 50 ids/unit), `search.list` (rationed discovery) | `video`, **direct**: views, likes, comments, publish date, duration, channel; repeated observations → velocity | free API key (`YOUTUBE_API_KEY` secret) | Implemented, quota-ledgered, **waiting for the key** (reported "disabled" until set; nothing fabricated) |
| YouTube oEmbed | Verification without a key | `youtube.com/oembed` | verified title + channel for linked videos (no stats, no dates) | none | Live (60/run) |
| **Bluesky** | Video discovery pool + audience topics | `getTrendingTopics`, `getFeed` (topic feeds), `searchPosts?q=<format>&sort=top&since=7d` | native video = **direct** engagement (published by the post); external video links = **indirect** shares (video stats unknown until verified; post engagement kept apart); topic posts = interest | none | Live |
| Google Trends | Corroboration | `trends.google.com/trending/rss?geo=` | `search_interest` (approx traffic, news links). Mostly news/sports → never a video recommendation by itself | none | Live |
| Mastodon | Corroboration with history | `/api/v1/trends/tags` | `hashtag` with a 7-day daily series → measured growth from day one | none | Live |
| TikTok Creative Center | Supporting, opt-in | undocumented `creative_radar_api` hashtag list | `hashtag` (post count, views, 7-day trend) | none | Opt-in (`VR_TIKTOK=1`); **unverified**; failure is reported, never fatal |

## YouTube quota plan (official costs, checked 2026-10-28)

`videos.list` = 1 unit per call (≤50 ids); 10,000 units/day for everything except `search.list`, which has its own
**100 calls/day** bucket. Per run (48 runs/day): 2 regions × 7 chart calls = 14 units; tracking ≤1,500 videos = ≤30
units; discovery every 6h: 18 queries × 100-unit search calls (counted against the 100/day search bucket, 72/day
budget) + ≤10 detail units. Daily total ≈ 2,200 units + 72 search calls. The ledger (`data/cache/youtube-quota.json`)
stops the collector at 9,000 units or the search budget.

Discovery queries target creator formats, not news: *animated skit, animal interview, talking cat, ai animation
short, puppet comedy, rapping cat, cartoon short film, comedy skit, street interview, stop motion, asmr, oddly
satisfying, cooking recipe short, indie animation, dubbed animals, original character animation, parody song,
storytime animation* plus the run's entertainment topics. `publishedAfter` = 72h, `order=viewCount`.

### Configuration (one-time, free)

1. Google Cloud Console → create a project → APIs & Services → Enable **YouTube Data API v3** → Credentials →
   API key (restrict it to the YouTube Data API).
2. GitHub → `cge6media/viral-radar` → Settings → Secrets and variables → Actions → **New repository secret**
   `YOUTUBE_API_KEY`.
3. Next collection run: the YouTube row turns "live", charts and tracking start, linked Bluesky videos get
   verified publish dates, channels and views; microtrends can reach *Developing* / *Strong* grades.

## Timestamps stored per observation

`videoPublishedAt` (platform), `postPublishedAt` (social post), `publishedAt` (content time used for windows =
video publish ?? native post time ?? spike time — never a share time), `firstSeenAt` (discovery),
`observedAt` (latest metrics), `verifiedAt` (last direct fetch).

## Storage

Append-only NDJSON (`data/history/observations/`, compact ticks after first sight; 35-day retention), score history
(`data/history/scores/`, 14 days), `data/latest.json` (snapshot v2), `data/quality/report.json`,
`data/cache/<source>.json` (fallback) and `data/cache/youtube-quota.json` (ledger). v1 records are migrated on load.

## Not used and why

Reddit (API requires app credentials; blocked from the build environment), Wikipedia pageviews (2026 endpoints
returned not-found during the session), YouTube RSS (robots-disallowed for the fetch tool), Instagram/Facebook
(no public read API for discovery).
