# Viral Radar

**AI viral video trend hunter & creator revenue intelligence.** Answers one question every morning:
*what's gaining viral momentum right now, what kind of video should I create today, and what is the realistic earning opportunity?*

Built, tested and operated entirely in the cloud: a scheduled collector runs on GitHub Actions, the data lives in
this repository, and the dashboard is a static site on GitHub Pages. No personal machine is involved at any point.

**Live dashboard:** https://cge6media.github.io/viral-radar/

## What it does

| Section | What you get |
|---|---|
| **Dashboard** | *What should I create today?* — five actionable picks (format, evidence, direction, real examples, original concept, platform, money, difficulty) and the **Top 20 viral opportunities** with momentum / money / creator-fit / confidence scores, lifecycle stage, platforms, last update. Time (4h–30d) and platform filters. |
| **Trend Compass** | Every trend placed on its lifecycle: Emerging → Accelerating → Breaking out → Peaking → Cooling, plus Insufficient data. Category momentum and the biggest *measured* movers. |
| **Viral Categories** | Parent category → subcategory → microtrend, with monetization profiles. Microtrends are discovered from data (hashtags / bigrams shared by ≥3 creators), not hard-coded. |
| **Money Engine** | Platform comparison (YouTube long-form, Shorts, TikTok Creator Rewards, Facebook CMP, Instagram), an editable earnings calculator (low/base/high, costs, break-even, ROI, 100K–100M scenarios) and category monetization ratings. |
| **Content Roadmap** | Today's top pick, four alternatives, emerging categories, highest monetization, easiest to produce, trends to avoid. |
| **Watchlist** | Watching / Planning / Producing / Published, with optional actual views, cost and revenue. |
| **Settings** | Interests, tools, platforms, risk appetite (they re-weight creator fit), manual refresh, source status, scoring explainer. |

Every trend links to its real evidence (video URL, creator, platform, publication date, thumbnail, view/like counts where
the source provides them). Search spikes and hashtags are labelled as such and never presented as video performance.

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
4. Optional: **Settings → Secrets and variables → Actions → New repository secret** `YOUTUBE_API_KEY`
   (a free YouTube Data API v3 key from Google Cloud; 10,000 units/day, no billing). Enables the YouTube source.
5. Optional repository *variables*: `VR_GT_REGIONS` (default `US,GB,CA,AU`), `VR_YT_REGIONS`, `VR_YT_QUERIES`,
   `VR_MASTODON_INSTANCES`, `VR_TIKTOK=1` to try the TikTok Creative Center collector.

Manual refresh from the dashboard: Settings → "Run collection now" (needs a fine-grained GitHub token with *Actions:
read & write* for this repo, stored only in your browser). Without a token the button links to the Actions page.

## Develop (cloud workspace or any machine you choose)

```bash
npm install
npm run collect:fixtures   # offline run against captured real responses → data/latest.json
npm run collect            # live run (needs internet; YOUTUBE_API_KEY optional)
npm test                   # 23 tests: parsers on real fixtures, dedup/history, clustering, scoring, calculator
npm run build              # web/dist (static)
npm run dev                # local dev server for the dashboard
```

## Honesty rules baked in

- No fabricated metrics, trends or videos. If a trend has only search/hashtag evidence it says so.
- Growth is only shown when ≥2 measurements exist ("Measured growth"); otherwise the trend is marked "Provisional".
- RPM figures in the Money Engine are planning ranges from public reports with sources, not verified payouts, and all editable.
- Adult-labelled content is filtered out of creator opportunities.

## License

Private project. Third-party data belongs to its platforms and creators; links point back to the original sources.
