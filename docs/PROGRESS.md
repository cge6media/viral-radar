# Progress

Last updated: 2026-10-28 (build session in Anthropic's cloud workspace).

## Checkpoints

| # | Checkpoint | Status |
|---|---|---|
| 1 | Cloud foundation — remote execution verified (sandboxed VM, no local access), repo initialised, app shell, persistent storage model (git-backed NDJSON history), builds remotely | ✅ done |
| 2 | Real trend data — collectors for Google Trends RSS, Bluesky (topics, feeds, searches), Mastodon tags, YouTube (Data API optional + oEmbed), TikTok (opt-in); real responses captured as fixtures; parsers tested on them | ✅ done |
| 3 | Trend intelligence — taxonomy (16 categories, 50+ subcategories), clustering with dynamic microtrends, momentum/confidence/monetization/creator scores, lifecycle stages, scoring history | ✅ done |
| 4 | Usable dashboard — Top 20, five daily recommendations, Trend Compass, time + platform filters, category pages, SVG charts, evidence links, trend detail | ✅ done |
| 5 | Money Engine — platform program research (Oct 2026), comparison table with sources, calculator (low/base/high, break-even, ROI, 100K–100M scenarios), category ratings | ✅ done |
| 6 | Production advisor — "Ride this trend" (what/why/characteristics/timing/3 original concepts/platforms/monetization/difficulty), Content Roadmap, Watchlist with statuses + actual tracking, preferences | ✅ done |
| 7 | Cloud deployment — pushed to `cge6media/viral-radar`; scheduled collector ran live and committed real data (920 observations); Pages publish pending the repository becoming public | ⚙️ collector live; **Pages publish pending visibility change** |
| 8 | Testing & refinement — 20 automated tests, two-run persistence/growth check, desktop + mobile rendering, docs | ✅ done |

## Working now

- Live-verified sources: Google Trends, Bluesky, Mastodon, YouTube oEmbed.
- Offline pipeline run from captured real data produces 60 trends (2 clusters with 23 real videos) in `data/latest.json`.
- Dashboard builds to a static site and renders all sections on desktop and iPhone widths.

## Remaining work

1. Owner makes `cge6media/viral-radar` public (Settings → General → Change visibility) and confirms Pages source = GitHub Actions; then re-run "Collect trends" and verify `https://cge6media.github.io/viral-radar/`.
2. Watch the second and third live runs: growth should switch from provisional to measured; check lifecycle distribution.
3. Add `YOUTUBE_API_KEY` secret to turn on real YouTube view counts (optional, free).
4. After a few runs: tune growth thresholds with real run-to-run data; consider 15-minute cron if runs stay short.
5. Nice-to-have: category-level daily digests, export of watchlist, more Mastodon instances, Bluesky video view counts if the API exposes them.

## Known limitations

- Bluesky does not expose view counts; engagement (likes/reposts) is used instead and labelled.
- Google Trends RSS exposes ~10 items per region and a lower-bound traffic figure.
- TikTok has no public, documented trend API; the opt-in collector may stop working without notice.
- Growth is provisional until the second run (by design — no invented growth).
