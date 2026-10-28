# Viral Radar

**Viral-video intelligence for creators (4.0).** It answers: *which videos are people actually watching right
now, which ones are about to break out, which formats are independent creators adopting — what should I make
today for a realistic return — and, as history accumulates, were the radar's predictions actually right?*

Built, tested and operated entirely in the cloud: a scheduled collector runs on GitHub Actions every 30 minutes,
the data lives in this repository, and the dashboard is a static site on GitHub Pages. No personal machine is
involved at any point.

**Live dashboard:** https://cge6media.github.io/viral-radar/

## What it does (4.0)

| Section | What you get |
|---|---|
| **Creator Desk** (new) | *Today's creator opportunities*: up to eight clusters classified as **repeatable format / emerging meme / viral event**, each with its real evidence videos, why it matters, how early it is (emerging · accelerating · established · resurfacing · peaking · cooling), production fit for AI/animation/characters/music in ≤2 h, plausible monetization and ONE action (create today · participate selectively · research · monitor · skip). Opening one gives a **production playbook**: three different original briefs (concept, hook, structure, duration, approach, steps, effort, publishing, revenue, uncertainty), exportable as Markdown and saveable to the journal. Deterministic templates from observed facts — no live AI. |
| **Scorecard** (new) | Forward-looking **prediction scorecard**: every collection records the Early Radar's top entries plus two simple baselines before the outcome is known, later collections evaluate them at 24h / 48h / 72h / 7d (hit floor reached, doubled with ≥100K, rate sustained, top-10 % of cohort, creator jump, format spread), with pending ≠ success, recall against observable crossings, lead time and descriptive calibration. |
| **Alerts** (new) | New verified hits, exceptional acceleration, creator outliers, formats spreading, category momentum, older videos resurfacing — high thresholds, deduplicated, "new since your last visit", filters; optional free Discord/Telegram delivery via a secret. |
| **Journal** (new) | Content decision journal: Watching → Selected → Producing → Published → Completed / Skipped, with the assessment frozen at save time, real platform/date/URL/views/hours/cost/revenue, comparisons (recommendation vs reality, earlier vs later, formats worth repeating), export/import backup — private to the browser, never committed. |
| **Radar health** (new) | Freshness as a measured state (fresh / delayed / stale — never "live"), last collection and publication, measured collection success rate, unique/verified/breakout counts, quota, discovery yield per probe family and per search, rejection reasons, a failure taxonomy (collection / verification / classification / ranking / presentation) and the latest benchmark. |
| **Discover** | The current viral landscape (verified hits, breakouts, promising waves, platforms with direct statistics), **biggest viral videos right now** (verified, last 72h), **fastest-rising breakouts**, trending categories & microtrends, **what should I create today** (evidence-backed concepts for a 30-min–2h production window), cross-platform waves. |
| **Viral Now** | The biggest verified videos published in the last 24h / 48h / 72h / 7d / 30d, ranked on their own platform's statistics; platform filters that reflect the record's own platform; sorts: most viral, fastest rising, newest breakouts, most engaging, creator outliers. |
| **Early Radar** | Two kinds of attention that are not yet established hits (age-appropriate hit floor: 1M views in the first day → 5M by 30 days): **early breakouts** (young, below the floor, measured abnormal rise) and **delayed breakouts** (older videos resurfacing, never ranked as new). Measured views/hour between real observations, acceleration with a noise guard, creator-baseline outliers, confidence bands; provisional entries labelled; language and kind filters. |
| **Trends** | Format waves (independent creators adopting similar content), lifecycle compass, category activity, cross-platform map with the earliest verified evidence per platform. |
| **Money / Studio** | Monetization suitability, production economics, editable revenue scenarios, investment calculator, **production return comparison** (two ideas: time, cost, assumed views, qualified %, RPM → illustrative revenue, profit and return per hour); the 2.0 Studio concepts remain. |
| **Hall of Fame** | 38 historic viral videos (2004–2023), 35 verified through the YouTube API with view counts, originals vs re-uploads marked, by era/category/platform — plus documented **creative lessons** (why it mattered, what made it recognisable, one-off vs repeatable, derivatives) — entirely separate from live rankings. |
| **Diagnostics** | Source coverage per platform (direct / indirect / unavailable, verified videos, shares, freshness, quota), the discovery funnel with rejection reasons, 16 automated quality checks, how scores work. |

**Every video card** shows real thumbnails, title, creator, verified metrics, age, measured-vs-average momentum,
its evidence class and *why this video is here*; tapping opens an in-page official embed (YouTube, TikTok,
Instagram, Facebook, Bluesky) with a direct-link fallback — nothing is rehosted and nothing has fake controls.

**Evidence rules.** Video statistics come only from the video platform (YouTube Data API; Bluesky for its native
videos) and never mix with share engagement. Velocity exists only between two real observations ≥1h apart; a
lifetime average is labelled as such. Evidence classes — verified viral hit / early breakout / promising category
wave / unverified signal / not featured — are never mixed into one ranking. Nothing is padded. Details:
`docs/SCORING.md`, `docs/DISCOVERY.md`, `docs/BENCHMARK.md`, `docs/AUDIT.md`.

## Daily use (the morning routine)

1. **Discover** — the freshness badge (fresh / delayed / stale) and the first five tiles say what the index holds; the
   alert strip says what crossed a threshold since your last visit. Biggest videos (72h) and fastest-rising breakouts
   are the "what is viral / what is accelerating" answer; tap any card to watch in place and read "why it is here".
2. **Creator Desk** — "worth your time today" is ordered by action. Open one: evidence, type, timing, fit, money,
   and three briefs; export the brief and start producing, or save it to the journal as *Selected*. "Your lane this
   week" shows the current activity in your own formats even when nothing clears the desk gate.
3. **Early Radar** (filter *Early breakout*, language *English/Spanish*) for videos that are still below the hit
   floor but rising — the ones to study before everyone else does.
4. **Journal** — when you publish, record platform, date, URL, views, hours, cost, revenue; the journal compares
   the result with the assessment it was saved with. Export a backup now and then.
5. **Scorecard** (weekly) — are the radar's early calls turning into hits, and would "biggest by views" have done
   as well? Precision appears after ten evaluated predictions per horizon; nothing before that is a claim.
6. **Health** (when something looks stale) — collection success, quota, discovery yield, benchmark, failure classes.

## Architecture

```
Discovery (probes/charts/links) → Collection → Normalization → Dedup → Classification → Video records (velocity, outliers, states) → Clusters/waves → Funnel + quality gate → Dashboard

pipeline/   TypeScript (Node 22). Collectors, store, clustering, taxonomy, scoring. Runs in GitHub Actions.
data/       The database: append-only NDJSON history (observations + scores), latest.json snapshot, source cache.
web/        Vite + React dashboard (hash routing → works on GitHub Pages), hand-written dark design system, SVG charts.
.github/    collect.yml  — every 30 min + manual: collect → commit data → build → deploy Pages
            deploy.yml   — on code pushes: test → build → deploy Pages
docs/       PROGRESS.md · RESUME.md · DATA_SOURCES.md · SCORING.md · DISCOVERY.md · BENCHMARK.md · PREDICTIONS.md · ALERTS.md
            AUDIT_4.0.md · RECOMMENDATION_AUDIT.md · CODE_REVIEW_4.0.md · TEST_RESULTS.md
            diagnose.yml — manual: inspect videos, batch-verify ids, probe TikTok, run the discovery benchmark
            collect-b/c/d.yml — sibling schedules calling collect.yml (GitHub honours ~1 scheduled run per workflow per hour)
            qa.yml       — manual: real Chromium on the runner screenshots the live site at 1440/768/390 and verifies playback
qa/         Playwright QA script + briefs export; results in data/qa/
data/predictions/  append-only predictions, outcomes, crossings; scorecard.json
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
