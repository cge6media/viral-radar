# Data sources (Viral Radar 2.0)

Roles changed in 2.0: **video platforms are the primary evidence**; search and social signals corroborate.
A provider collecting 800 unrelated posts is not more valuable than one collecting 80 relevant videos — the
Source Quality panel (Settings → Data & quality) reports unique videos, direct measurements, relevance, age and
errors per source, every run.

| Source | Role | Endpoint | Evidence | Auth | Status |
|---|---|---|---|---|---|
| **YouTube Data API v3** | Primary video statistics + discovery | `search.list` query-less top-by-views probes (window × duration × region × category, 2 per run on a rolling schedule), `videos.list chart=mostPopular` (US/GB every run + 3 rotating regions, 6 categories), `videos.list id=…` (tracking refresh of every video seen in 7 days, 50 ids/unit), `channels.list` (50/unit), `playlistItems.list` baselines | `video`, **direct**: views, likes, comments, publish date, duration, channel size; repeated observations → velocity, acceleration | free API key (`YOUTUBE_API_KEY` secret, set 2026-10-28) | **Live** — project "Viral Radar" (viral-radar-513003), key restricted to this API |
| YouTube oEmbed | Verification without a key | `youtube.com/oembed` | verified title + channel for linked videos (no stats, no dates) | none | Live (60/run) |
| **Bluesky** | Video discovery pool + audience topics | `getTrendingTopics`, `getFeed` (topic feeds), `searchPosts?q=<format>&sort=top&since=7d` | native video = **direct** engagement (published by the post); external video links = **indirect** shares (video stats unknown until verified; post engagement kept apart); topic posts = interest | none | Live |
| Google Trends | Corroboration | `trends.google.com/trending/rss?geo=` | `search_interest` (approx traffic, news links). Mostly news/sports → never a video recommendation by itself | none | Live |
| Mastodon | Corroboration with history | `/api/v1/trends/tags` | `hashtag` with a 7-day daily series → measured growth from day one | none | Live |
| TikTok | Indirect only | links shared on Bluesky (`domain=tiktok.com`) + `tiktok.com/oembed` (title, author, thumbnail, official player) | `video` **indirect**: no view counts | none | Probed from the runner 2026-10-28: every Creative Center endpoint answers `code 40101 "no permission"` anonymously → **no statistics available**; oEmbed works |
| Instagram / Facebook | Indirect only | links shared on Bluesky (`domain=instagram.com` / `facebook.com`) | `video` **indirect**: share engagement only | none | No public read API; oEmbed requires an approved Meta app token |

## YouTube quota plan (official costs re-checked 2026-10-28 against the project's own quota page)

"Queries per day" = **10,000 units** for everything except search; `videos.list`, `channels.list`,
`playlistItems.list` = 1 unit each (≤50 ids); "Search Queries per day" = **100 `search.list` calls in their own
bucket** (1 unit each, not 100 units of the pool). Quotas reset at **midnight Pacific**; the ledger's day is the
Pacific date. Per run (48 runs/day): charts (2 + 3 rotating regions) × 7 = 35 units; tracking ≤1,500 videos = ≤30;
channel statistics ≤20; baselines ≤40; discovery details ≤4; diagnostics 1 → ≤ ~130 units/run, **≈ 4,000–6,000
units/day**, plus **2 searches/run = 90/day** (ledger cap). First live day: 465 units and 62 searches by 05:00 UTC.

Discovery schedule (49 slots, ~12h per cycle at 2 searches/run): US 24h Shorts every ~2h; 72h/7d/21d Shorts
windows with 2–3 pages; US 72h/7d all durations; 10 category leaderboards (15, 23, 20, 24, 22, 26, 1, 10, 27, 28);
12 regions (GB, IN, MX, BR, ID, PH, JP, KR, ES, DE, FR, VN); keyword probes `#shorts`, `videos virales`, 2 Bluesky
topics, 2 momentum microtrends, 4 rotating format probes.

### Configuration (done 2026-10-28)

Google Cloud project **Viral Radar** (`viral-radar-513003`, account DNA Collision) → YouTube Data API v3 enabled →
API key "Viral Radar collector (GitHub Actions)" restricted to the YouTube Data API, no application restriction
(GitHub runners rotate IPs) → stored as the repository secret `YOUTUBE_API_KEY` (transferred clipboard-to-form in
the browser; the value was never printed, logged or committed). Rotate: create a new key in the console, replace the
secret, delete the old key.

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
