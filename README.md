# Viral Radar

**Creator intelligence for video trends (2.0).** Answers one question every morning:
*what entertainment formats are demonstrably gaining attention, how early can I participate, and which opportunities are worth my production time?*

Built, tested and operated entirely in the cloud: a scheduled collector runs on GitHub Actions, the data lives in
this repository, and the dashboard is a static site on GitHub Pages. No personal machine is involved at any point.

**Live dashboard:** https://cge6media.github.io/viral-radar/

## What it does (2.0)

| Section | What you get |
|---|---|
| **Discover** | Daily overview (last update, freshness, qualified opportunities, new in 24h, active sources), **Today's best opportunity** (thumbnail, stage, evidence grade, why it matters, recommended format, save), **Emerging now** grid, **Trend momentum** (category activity by publication time, lifecycle mix), **Explore categories**, **Monetization opportunities**. A 24h / 48h / 7d switch changes every number on the page. |
| **Trend page** | Overview, **actual video examples** (thumbnails → originals, measured vs shared), growth analysis (adoption, video performance, video momentum, audience interest — `n/a` when not measurable), why it matters + cautions, three original concepts with hook/opening/structure/length/budget, revenue scenarios per platform. |
| **Compass** | Lifecycle columns, measured movers, category activity, category drill-down. |
| **Money Engine** | Four separated questions: monetization suitability (category profile), audience opportunity (live), production economics (your tools), financial scenarios (editable). Content investment calculator across platforms; full calculator with low/base/high, two break-evens, ROI; platform comparison with sourced requirements. |
| **Content Studio** | "Turn this trend into a video idea": three concepts derived from the evidence; production queue. |
| **Watchlist** | Statuses (watching → published) with actual views/cost/revenue. |
| **Settings** | Preferences, data sources & quality (source quality framework, 12 automated checks, YouTube quota), how scores work. |

**Evidence rules.** Only videos measured on their platform (or verified there) prove a format; social shares corroborate.
A video's publish date comes only from its platform — the time a post shared it is shown as "shared". Evidence grades
(Strong / Developing / Early / Insufficient) decide what can be recommended; news/person events and evergreen categories
without a measured shift never qualify. Rankings are not padded. Details: `docs/SCORING.md`, `docs/AUDIT.md`,
`docs/RELEVANCE_AUDIT.md`.

## Architecture

```
Source discovery → Collection → Normalization → Dedup → Classification → Scoring → Dashboard

pipeline/   TypeScript (Node 22). Collectors, store, clustering, taxonomy, scoring. Runs in GitHub Actions.
data/       The database: append-only NDJSON history (observations + scores), latest.json snapshot, source cache.
web/        Vite + React dashboard (hash routing → works on GitHub Pages), hand-written dark design system, SVG charts.
.github/    collect.yml  — every 30 min + manual: collect → commit data → build → deploy Pages
            deploy.yml   — on code pushes: test → build → deploy Pages
docs/       PROGRESS.md · RESUME.md · DATA_SOURCES.md · SCORING.md · TEST_RESULTS.md
```

**Sources** (details, status and verification in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)):
Google Trends trending-searches RSS · Bluesky public API (trending topics, topic feeds, creator-format searches — native videos and YouTube/TikTok links with engagement) · Mastodon trends API (hashtags with a 7-day history) · YouTube Data API v3 (optional free key → real view/like counts) · YouTube oEmbed (verifies titles/channels of linked videos) · TikTok Creative Center (opt-in, best-effort).

## Deploy (one-time, ~5 minutes, all in the cloud)

1. Push this repository to GitHub (private is fine).
2. **Settings → Pages → Build and deployment → Source: "GitHub Actions".**
3. **Actions → "Collect trends" → Run workflow** (or wait ≤30 min for the schedule). The run collects live data,
   commits it to `data/`, builds the dashboard and publishes it at `https://<owner>.github.io/<repo>/`.
4. **Recommended:** add the free YouTube Data API key as the repository secret `YOUTUBE_API_KEY`
   (Google Cloud Console → enable *YouTube Data API v3* → API key). It turns on direct video statistics, verified
   publish dates and view velocity; the quota ledger keeps usage inside the free limits (docs/DATA_SOURCES.md).
5. Optional repository *variables*: `VR_GT_REGIONS` (default `US,GB,CA,AU`), `VR_YT_REGIONS`, `VR_YT_QUERIES`,
   `VR_MASTODON_INSTANCES`, `VR_TIKTOK=1` to try the TikTok Creative Center collector.

Manual refresh: Settings → "Run collection now ↗" opens the workflow's Actions page, where **Run workflow** starts a
collection (2.0 no longer stores a GitHub token in the browser — see docs/SAAS_ARCHITECTURE.md for the server-side
trigger planned for the hosted product).

Releases: the collector's publish job and the code deploy share one Pages queue; whichever finishes last wins, and
both build the *current* `main`, so a code push that lands while a collection is publishing is live by the next
collection at the latest (≤30 min). A collection whose release gate fails commits its data but does not publish, so
the previous release stays up.

## Develop (cloud workspace or any machine you choose)

```bash
npm install
npm run collect:fixtures   # offline run against captured real responses → data/latest.json
npm run collect            # live run (needs internet; YOUTUBE_API_KEY optional)
npm test                   # 34 tests: parsers on real fixtures, dedup/history, clustering, scoring, calculator
npm run build              # web/dist (static)
npx tsx pipeline/src/gate.ts  # release gate on data/latest.json
npm run dev                # local dev server for the dashboard
```

## Honesty rules baked in

- No fabricated metrics, trends or videos. If a trend has only search/hashtag evidence it says so.
- Growth is only shown when ≥2 measurements exist ("Measured growth"); otherwise the trend is marked "Provisional".
- RPM figures in the Money Engine are planning ranges from public reports with sources, not verified payouts, and all editable.
- Adult-labelled content is filtered out of creator opportunities.
- Twelve automated quality checks run every collection; six critical ones block publishing (the previous release stays live).

## License

Private project. Third-party data belongs to its platforms and creators; links point back to the original sources.
