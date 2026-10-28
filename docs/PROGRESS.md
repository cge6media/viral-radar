# Progress

Last updated: 2026-10-28 (2.0 upgrade session in Anthropic's cloud workspace).

## 2.0 upgrade phases

| phase | status |
|---|---|
| 1 Audit & preserve (tag/branch `v1-stable`, confirmed defects with measurements → docs/AUDIT.md) | ✅ |
| 2 Data accuracy (separate timestamps/metrics, relevance validator, query bias removed, per-window scoring) | ✅ |
| 3 Video intelligence (production YouTube collector + quota ledger, verification of linked videos, oEmbed fallback) | ✅ code; **YouTube key pending** |
| 4 Ranking 2.0 (video-first microtrends, evidence grades, separated components, lifecycle) | ✅ |
| 5 Visual redesign (Discover, trend page, compass, studio, mobile tab bar; 1440/768/390 verified) | ✅ |
| 6 Money Engine v2 + Content Studio | ✅ |
| 7 Independent testing (34 tests, 12 runtime checks, hand relevance audit 97%, second independent review: 10 findings fixed) | ✅ |
| 8 Deploy & verify (release gate, live 2.0 run published) | ✅ |

## Checkpoints

| # | Checkpoint | Status |
|---|---|---|
| 1 | Cloud foundation — remote execution verified (sandboxed VM, no local access), repo initialised, app shell, persistent storage model (git-backed NDJSON history), builds remotely | ✅ done |
| 2 | Real trend data — collectors for Google Trends RSS, Bluesky (topics, feeds, searches), Mastodon tags, YouTube (Data API optional + oEmbed), TikTok (opt-in); real responses captured as fixtures; parsers tested on them | ✅ done |
| 3 | Trend intelligence — taxonomy (16 categories, 50+ subcategories), clustering with dynamic microtrends, momentum/confidence/monetization/creator scores, lifecycle stages, scoring history | ✅ done |
| 4 | Usable dashboard — Top 20, five daily recommendations, Trend Compass, time + platform filters, category pages, SVG charts, evidence links, trend detail | ✅ done |
| 5 | Money Engine — platform program research (Oct 2026), comparison table with sources, calculator (low/base/high, break-even, ROI, 100K–100M scenarios), category ratings | ✅ done |
| 6 | Production advisor — "Ride this trend" (what/why/characteristics/timing/3 original concepts/platforms/monetization/difficulty), Content Roadmap, Watchlist with statuses + actual tracking, preferences | ✅ done |
| 7 | Cloud deployment — `cge6media/viral-radar` (public); scheduled collector runs live every 30 min and commits real data; dashboard published to GitHub Pages at https://cge6media.github.io/viral-radar/ | ✅ live |
| 8 | Testing & refinement — 23 automated tests, two-run persistence/growth check, desktop + mobile rendering, independent code review (10 findings fixed), docs | ✅ done |

## Working now

- Live-verified sources: Google Trends, Bluesky, Mastodon, YouTube oEmbed. Collection every 30 min publishes the
  site itself when the release gate passes (a failed run keeps the previous release).
- Live 2.0 snapshots: ~200 clusters, 9 qualified opportunities (nothing padded), 12/12 quality checks, relevance
  check ≥ 98 %. Growth measurements accumulate: per-window creator growth from the second run ≥2h after the first
  2.0 record with per-window counts; *strong* grades once a cluster has ≥6h of history.
- Dashboard builds to a static site and renders all sections at 1440 / 768 / 390 px.

## Remaining work

1. **Add the `YOUTUBE_API_KEY` secret** (free) — the single biggest data upgrade still waiting on a credential; everything else is in place.
2. Watch the first days of measured history: video velocity, creator growth and lifecycle distribution; tune thresholds in `score.ts` if too many clusters sit in one stage.
3. Re-run the hand relevance audit after a week of YouTube-verified data; extend `relevance.ts` with new formats as they appear.
4. Optional embedding stage (semantic similarity) for microtrend grouping once YouTube provides richer titles/descriptions.
5. Subscription product path: see docs/SAAS_ARCHITECTURE.md.

## Known limitations

- Bluesky does not expose view counts; engagement (likes/reposts) is used instead and labelled.
- Google Trends RSS exposes ~10 items per region and a lower-bound traffic figure.
- TikTok has no public, documented trend API; the opt-in collector may stop working without notice.
- Growth is provisional until a second measurement ≥2h apart exists (by design — no invented growth).
