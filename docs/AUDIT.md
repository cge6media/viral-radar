# Viral Radar 2.0 — product audit and before/after

Audit performed 2026-10-28 (UTC) against the live 1.0 application and its collected data, before any 2.0 change.
Baseline snapshot: run `202610280123_9d47113c6ec1` (01:23 UTC), 154 trends from 920 observations.

## Confirmed defects (with measurements)

| # | Finding | Evidence (1.0 data) | Root cause | 2.0 fix |
|---|---|---|---|---|
| 1 | **"Cooking Video (format)" ranked #1 (opportunity 59, monetization 87) on keyword false positives** | Its 15 "videos" included *Polyphia – LET THERE BE LIGHT (Official Video)*, *How to Deal with Elon Musk*, *Limmie & Family Cookin' – You Can Do Magic*, "He just keeps cooking them", a "sneak peek" clip, an NYT restaurant deep-cleaner feature | Format membership came from the Bluesky *post text* matching the search query, not from the video | Relevance validator (`pipeline/src/intel/relevance.ts`): only the video-level text counts; sense-disambiguation exclusions ("cooking up", "cookin'", music-release markers), a category veto (a music video is never a cooking tutorial), and **only videos** can be format evidence. Regression tests cover every listed false positive. |
| 2 | **Social share time shown as the video's publication time** | All 79 YouTube-linked evidence items carried the Bluesky post's `createdAt` as `publishedAt`; "creator" was the Bluesky poster (e.g. *Anfor*, *Manny*) | One `publishedAt` field for everything | Separate `videoPublishedAt` / `postPublishedAt` / `firstSeenAt` / `observedAt` / `verifiedAt`. An external share has **no** publish date until the YouTube API verifies it; the UI says "shared Xh ago". v1 history is migrated on load. Quality check: "publication dates are not share dates". |
| 3 | **Post engagement attributed to the linked video** | Likes/reposts of the share were stored as the video's `metrics` | Same field for both | `metrics` = the video's own stats (empty until verified); `postMetrics` = the share's engagement; separate `level: direct \| indirect`. Quality check: "no social engagement attributed to an unverified video". |
| 4 | **4h / 24h filters used collection time** | 154/154 trends passed "last 4 hours"; by publication time only 85 would | Filter on `observedAt` and scores unchanged | Pipeline computes scores **per window** (24h/48h/7d) from content time; the UI switches the whole view (hero, grid, compass, detail) with the window. |
| 5 | **Predefined format searches dominated the Top 20** | 14 of the top 20 were `f_*` clusters ("Satisfying", "Timelapse", "Storytime"…) produced by always-25-results queries | A query result set was treated as a trend | Searches are **discovery pools** feeding relevance validation and category activity. Format pools are `kind: format`, marked `isGeneric`, never qualify without a measured ≥1.5× shift, and are shown as "Proven formats, still active" — not as emerging. |
| 6 | Topic spikes (sports fixtures, politics) surfaced as opportunities | "Brewers play World Series Game 4", "Trump…" topics in the ranked list | News heuristics incomplete | Named-figure, sports-fixture and lawsuit patterns added; news never qualifies; Google Trends is corroboration only. |
| 7 | Provisional stages mislabelled as *Accelerating* | First-run clusters got `accelerating` from a momentum threshold | Lifecycle rule | Acceleration requires a measurement (creator growth or video velocity); evergreen pools are never *Emerging*. |
| 8 | GitHub PAT stored in `localStorage` for the refresh button | Settings page | Convenience feature | Removed. Manual runs start from the Actions page (GitHub sign-in). See `docs/SAAS_ARCHITECTURE.md` for the server-side trigger design. |
| 9 | History growth: 30+ MB/day at 48 runs/day | Every run re-appended every observation | Dedup only on identical metrics | Compact ticks (≥3h or ≥15% change), latest-state loader; measured on the live repo: 1,064 lines after two runs. (Fixed in 1.0.1, kept.) |

## Query bias investigation

Bluesky `searchPosts` for a format term returns the 25 "top" posts whether or not anything is trending; in 1.0 each query became a cluster with ~20 members and therefore high "breadth". In 2.0 the queries only *supply candidates*; a cluster of validated examples is reported as category activity (videos in 24h vs. prior 24h, creators) and qualifies as an opportunity only when the activity measurably shifts. Microtrends are discovered from the videos themselves (shared distinctive phrases/hashtags across ≥3 independent creators), not from the query list.

## Before / after (same history, 2.0 pipeline)

| metric | 1.0 (run 01:23Z) | 2.0 (same history, offline re-run) |
|---|---|---|
| trends shown as opportunities | 154 ranked, 20 "Top" | **4 qualified** (nothing padded) |
| "Cooking Video" | #1, 15 videos, monetization 87 | 11 relevance-checked videos, *proven format*, not an opportunity (no measured shift) |
| YouTube links with share-date as publish date | 79 | **0** (quality check) |
| format evidence passing the validator | not measured | **100/101 (99%)** |
| trends with growth labelled measured on first sight | 60/60 "observed" from 3h-old history | measured only with ≥2 runs ≥2h apart or a daily series |
| automated quality checks | none | 12 checks per run, 6 critical ones gate publishing |

## Ranking review (top 20 of 1.0 vs. 2.0 classification)

1.0 top 20 non-news: 14 generic format pools, 5 audience topics, 1 hashtag microtrend. Under 2.0 rules: 14 → *proven format* (activity, not trend); 3 topics → news/sports events (excluded); 2 topics keep *early* / *strong* grades with real native videos; the `#musicchallenge` cluster is kept as a microtrend but graded **early** because its 28 "videos" are unverified shares of old music videos (needs YouTube verification to grade higher).

## Relevance audit (≥50 matches)

See `docs/RELEVANCE_AUDIT.md` — filled from the first live 2.0 run.

## Independent review of the 2.0 logic (second round, 2026-10-28 02:xx UTC)

A separate reviewer (no part in writing the code) read `score.ts`, `cluster.ts`, `run.ts`, `quality.ts`, `gate.ts`,
`data.ts`, `money.ts`, `TrendDetail.tsx`, `Discover.tsx` against SCORING.md and probed the live snapshot. Found
nothing in the money engine, the gate, the evidence labels or the rate/velocity arithmetic. Ten findings, all fixed:

| # | finding (measured on the live snapshot) | fix |
|---|---|---|
| 1 | creator growth compared the *window's* creators with the previous run's *7-day* creators: 10 creators/7d, 3 in 24h → "−70 % over 3h", lifecycle *cooling* in the default 48h view; 1.0 records were used as a fallback baseline | history stores creators per window (`a`, `a1`, `a2`); growth compares like with like; records without creator counts are skipped |
| 2 | "new creators" and cluster age were computed from in-window members, so every creator was new and every trend *emerging* in the 24h/48h views (m_musicchallenge: content since 10-24, "Emerging, 14 new" at 48h) | first video per creator and cluster age come from the whole cluster |
| 3 | trend page: "10 relevant examples — 34 with platform statistics" (capped evidence list vs window totals) | window totals + "showing N" |
| 4 | category change was smoothed `(v+1)/(p+1)` but labelled "+X % vs prior 24h" (Film & TV: true +300 %, shown +150 %) | true ratio, only when both days have ≥2 videos and ≥4 together |
| 5 | Compass "Measured movers" caption claimed creator ratios while all 75 measurements were Mastodon daily series; "+11400 % over 120h" | each row names its metric and comparison; ≥5× shown as "×N"; movers need at least early evidence |
| 6 | a topic corroborated a microtrend on a single shared token (*World Series* ← "Bleach anime series finale" → interest 86) | the seed must cover the microtrend's keywords (≥50 % and ≥2, or the single keyword) |
| 7 | summary "the strongest is gaining ~0/hour" (lifetime average, unit-less, rounded) | "averages N views/engagements per hour since publish", omitted below 1 |
| 8 | "Hide news" preference was a no-op (news is unconditionally excluded from recommendations) | preference removed; the Compass keeps its explicit "show news" toggle |
| 9 | the publish-date check only caught `publishedAt === postPublishedAt`; merged shares could slip through | any publish date on an unverified external video is flagged |
| 10 | SCORING.md lifecycle table out of order vs code; "strong" after three runs five minutes apart | table rewritten in evaluation order; *strong* needs ≥3 runs spanning ≥6h |

Also found while re-running the pipeline offline: stored `formats` were a cache from the rules of the day an item was
first seen — with the fixture sources the check dropped to 108/123 (88 %). Every observation is now re-validated with
the current rules on every run (12/12 again, 0 stale items). Evidence lists now also carry the newest examples so
the 24h/48h views are not empty when the strongest videos are older (≤16 videos + 4 signals per trend).
