# Progress

Last updated: 2026-10-28 (4.0 release session in Anthropic's cloud workspace; see the 4.0 table below).

## 4.0 — reliable discovery, forward-looking scorecard, creator intelligence (2026-10-28)

| stage | status |
|---|---|
| 1 Audit & baseline (`docs/AUDIT_4.0.md`): measured 53 % scheduled-run start rate (one run per hour), Early Radar conflating established hits/young breakouts/resurgences, trend recommendations surfacing tags/fragments/calendar days, 7 MB payload | ✅ |
| 2 Core intelligence: adaptive discovery (yield ledger, reserve rule, bandit with 25 % exploration, depth pages, hot-channel uploads at zero search cost, Shorts verification); age-aware hit floor + established/early/delayed kinds + confidence bands + language; prediction scorecard (immutable predictions, radar vs views/velocity baselines, outcomes at 24h/48h/72h/7d, crossings, lead time, calibration bands); opportunity types (event/meme/format/uncertain) from title-level structure; Creator Desk engine; alerts; health | ✅ 51 tests |
| 3 Creator workflow & reliability: Creator Desk page + playbooks (three duration-scaled variations with format-specific risk, Markdown export), Scorecard page, Alerts (new since last visit, filters, optional free webhook), Journal (statuses, real numbers, comparisons, backup/restore), Radar health tab (freshness states, collection success, yield per search, rejection reasons, failure taxonomy, latest benchmark), Viral Now language filter, Early Radar kinds, production return comparison, Hall of Fame creative lessons (37 entries documented), navigation regrouped (5 primary + More), four sibling schedules + freshness gate, cached builds, actions history export | ✅ |
| 4 Adversarial evaluation: 4.0 dev benchmark (54.1 % recall, 100 % precision, 0 leaks, 96 % classification agreement, 99/100 embeddable); unseen holdout 70.7 %; two independent recommendation audits (`docs/RECOMMENDATION_AUDIT.md` 2.45/5 · 45 %, `_2.md` 2.17/5 · 37.5 %) with rubric scores and microtrend label validation; independent code review (`docs/CODE_REVIEW_4.0.md`, 19 findings, all resolved); browser QA on the live site at 1440/768/390 with real clicks (`data/qa/`); prediction workflow tested on synthetic histories (no real outcomes could exist yet on release day) | ✅ |
| 4.0.1 Fix cycle from the second audit (`docs/RECOMMENDATION_AUDIT_2.md` §9): desk evidence integrity (qualified or ≥100K mid-size only; no streams, long recordings, news clips, text posts; counts match what is shown; matched term per card), category and timing from the verified examples, calendar countdowns, dominant video must carry the name, hashtag/entity memes need a shared word, pools need a visible structure, boilerplate blocked before clustering, Early Radar pace rule + ranking, hashtag-only titles demoted, per-channel title dedupe, romanised-Hindi detection, lane from the whole pool with sub-formats (promoted to *research* when strong), playbooks only for actionable items, honest difficulty; keeper job chains collections (GitHub honoured 1 of 7 scheduled slots after the sibling workflows); third independent audit on the first live 4.0.1 run (`docs/RECOMMENDATION_AUDIT_3.md`) | ✅ 55 tests |


## 3.0 upgrade (2026-10-28)

| phase | status |
|---|---|
| 1 YouTube activation: Google Cloud project, API enabled, restricted key, GitHub secret (browser, no exposure); quota accounting fixed (search bucket, Pacific day); first live collection verified | ✅ |
| 2 Discovery diagnosis: benchmark baseline 4/98 (4.1 %) discovered; root cause = no leaderboard-style discovery; case video IjQwPjLMbxI verified (2.19M views, 14 months old, ×440 creator outlier, slow resurgence) | ✅ |
| 3 Viral Now + Early Radar (video records, velocity, states, scores, per-platform scale) | ✅ |
| 4 Multiplatform: query-less YouTube probes (windows/regions/categories), Bluesky domain link discovery, TikTok oEmbed; Creative Center/IG/FB documented as unavailable | ✅ |
| 5 Benchmark tool + cycles: cycle 1 4.1 % → 40.8 % → 49 % discovered (dev); cycle 2 rolling schedule, classification prior 36 % → 97 %, paid-reach filter; cycle 3 unseen holdout **65.9 %** (87 % of videos ≤7 days old), precision 100 %, 0 negative leaks | ✅ docs/BENCHMARK.md |
| 6 Playback: in-page official embeds + fallback, real thumbnails, uniform cards; 100/100 featured videos embeddable | ✅ |
| 7 Navigation: Discover / Viral Now / Early Radar / Trends / Money / Studio / Hall of Fame / Watchlist; diagnostics | ✅ |
| 8 Hall of Fame: 38 entries, 35 API-verified | ✅ |
| 9 Money Engine + Studio preserved | ✅ |
| 10 Tests (42), 16/16 runtime checks, deploy, live verification (run 202610280751) | ✅ |

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

1. **TikTok / Instagram / Facebook direct statistics** need an approved data access (TikTok Research API or Meta app review); until then those platforms are share-evidence only.
2. Watch the first days of measured history: video velocity, creator growth and lifecycle distribution; tune thresholds in `score.ts` if too many clusters sit in one stage.
3. Re-run the hand relevance audit after a week of YouTube-verified data; extend `relevance.ts` with new formats as they appear.
4. Optional embedding stage (semantic similarity) for microtrend grouping once YouTube provides richer titles/descriptions.
5. Subscription product path: see docs/SAAS_ARCHITECTURE.md.

## Known limitations (4.0.1)

- **Relevance is title-level.** Tags and descriptions are not stored in the index (payload size), so a microtrend's
  evidence is matched on titles and a pool's on its include/exclude rules; the matched term is shown on every card so
  a keyword coincidence is visible, but it is not impossible.
- **GitHub's scheduler drops most slots** (1 of 7 honoured in the hour after the four sibling workflows went live).
  The keeper chain (a run dispatches the next after 25 minutes) is the mitigation; its measured cadence is in
  `data/health.json` and on the Radar health tab.
- **No real prediction outcomes exist yet**: the scorecard fills from 24 h after each prediction; precision is `null`
  below ten evaluated predictions by design.
- **Most monitored desk items are not in English/Spanish**; the desk says so and keeps them as monitors.
- **Sub-formats are shared words**, not validated clusters; they are labelled that way and only reach the desk as
  "research".
- **YouTube's anti-bot wall** blocks most embeds on datacenter IPs (the QA runner); a residential browser is not
  affected, and every player has the "Open original" fallback.

- Bluesky does not expose view counts; engagement (likes/reposts) is used instead and labelled.
- Google Trends RSS exposes ~10 items per region and a lower-bound traffic figure.
- TikTok has no public, documented trend API; the opt-in collector may stop working without notice.
- Growth is provisional until a second measurement ≥2h apart exists (by design — no invented growth).
