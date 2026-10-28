# Viral Radar

**Viral-video intelligence for creators (3.0).** It answers: *which videos are people actually watching right
now, which ones are about to break out, which formats are independent creators adopting — and what should I make
today for a realistic return?*

Built, tested and operated entirely in the cloud: a scheduled collector runs on GitHub Actions every 30 minutes,
the data lives in this repository, and the dashboard is a static site on GitHub Pages. No personal machine is
involved at any point.

**Live dashboard:** https://cge6media.github.io/viral-radar/

## What it does (3.0)

| Section | What you get |
|---|---|
| **Discover** | The current viral landscape (verified hits, breakouts, promising waves, platforms with direct statistics), **biggest viral videos right now** (verified, last 72h), **fastest-rising breakouts**, trending categories & microtrends, **what should I create today** (evidence-backed concepts for a 30-min–2h production window), cross-platform waves. |
| **Viral Now** | The biggest verified videos published in the last 24h / 48h / 72h / 7d / 30d, ranked on their own platform's statistics; platform filters that reflect the record's own platform; sorts: most viral, fastest rising, newest breakouts, most engaging, creator outliers. |
| **Early Radar** | Credible abnormal momentum before a video is an established hit: measured views/hour between real observations, acceleration, creator-baseline outliers, delayed breakouts. Provisional (single-observation) entries are labelled; tiny samples never qualify. |
| **Trends** | Format waves (independent creators adopting similar content), lifecycle compass, category activity, cross-platform map with the earliest verified evidence per platform. |
| **Money / Studio / Watchlist** | Monetization suitability, production economics, editable revenue scenarios, investment calculator; three original concepts per opportunity with hook/structure/length/budget; production queue with actuals. |
| **Hall of Fame** | 38 historic viral videos (2004–2023), 35 verified through the YouTube API with view counts, originals vs re-uploads marked, by era/category/platform — entirely separate from live rankings. |
| **Diagnostics** | Source coverage per platform (direct / indirect / unavailable, verified videos, shares, freshness, quota), the discovery funnel with rejection reasons, 16 automated quality checks, how scores work. |

**Every video card** shows real thumbnails, title, creator, verified metrics, age, measured-vs-average momentum,
its evidence class and *why this video is here*; tapping opens an in-page official embed (YouTube, TikTok,
Instagram, Facebook, Bluesky) with a direct-link fallback — nothing is rehosted and nothing has fake controls.

**Evidence rules.** Video statistics come only from the video platform (YouTube Data API; Bluesky for its native
videos) and never mix with share engagement. Velocity exists only between two real observations ≥1h apart; a
lifetime average is labelled as such. Evidence classes — verified viral hit / early breakout / promising category
wave / unverified signal / not featured — are never mixed into one ranking. Nothing is padded. Details:
`docs/SCORING.md`, `docs/DISCOVERY.md`, `docs/BENCHMARK.md`, `docs/AUDIT.md`.

## Architecture

```
Discovery (probes/charts/links) → Collection → Normalization → Dedup → Classification → Video records (velocity, outliers, states) → Clusters/waves → Funnel + quality gate → Dashboard

pipeline/   TypeScript (Node 22). Collectors, store, clustering, taxonomy, scoring. Runs in GitHub Actions.
data/       The database: append-only NDJSON history (observations + scores), latest.json snapshot, source cache.
web/        Vite + React dashboard (hash routing → works on GitHub Pages), hand-written dark design system, SVG charts.
.github/    collect.yml  — every 30 min + manual: collect → commit data → build → deploy Pages
            deploy.yml   — on code pushes: test → build → deploy Pages
docs/       PROGRESS.md · RESUME.md · DATA_SOURCES.md · SCORING.md · DISCOVERY.md · BENCHMARK.md · TEST_RESULTS.md
            diagnose.yml — manual: inspect videos, batch-verify ids, probe TikTok, run the discovery benchmark
```

**Sources** (details, status and verification in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)):
YouTube Data API v3 (query-less top-by-views discovery probes by window/region/category, Trending charts, tracking of every video seen in 7 days, channel statistics and upload baselines — live since 2026-10-28) · Bluesky public API (trending topics, feeds, format searches, domain link discovery for YouTube/TikTok/Instagram/Facebook) · Google Trends RSS · Mastodon trends · TikTok oEmbed (verification + embeds; TikTok publishes no statistics anonymously) · Instagram/Facebook via shares only.

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
npm test                   # 41 tests: parsers on real fixtures, dedup/history, clustering, scoring, video states, velocity, calculator
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
