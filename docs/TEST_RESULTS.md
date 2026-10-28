# Test results — Viral Radar 4.0 (2026-10-28)

Everything below ran in the cloud (GitHub Actions runners or Anthropic's sandbox); no personal machine was used.

## Automated tests — `npm test` — 55/55 pass

| file | what it proves |
|---|---|
| predict.test.ts (4) | age-appropriate hit floor (1M@≤24h → 5M@30d, monotonic); kinds established/early/delayed from real histories; acceleration never claimed from <1,000-view intervals; language detection (scripts, stop-words, platform hint wins); predictions are frozen before outcomes, deduplicated while open, not due before the horizon, evaluated from the observation closest to the horizon, "unobserved" after 1.5× the horizon, never re-evaluated, precision null below ten; crossings only after predictions exist, lead time, recall not claimed from one crossing |
| discovery.test.ts (2) | reserve rule (budget ÷ runs still expected, rounded, 1…4, 0 when exhausted; Pacific-day hours left); bandit choice honours cooldowns, is deterministic per seed, exploits measured yield after cooldown, EWMA learning, day roll with history, depth only for paged probes with rich first pages |
| formats.test.ts (2) | name shapes (calendar, fragment incl. non-English stop-words and repeated words, hashtag, entity, phrase); descriptor tags incl. non-Latin; event vs format vs uncertain from dominance, independent creators, title share (boilerplate), sports/news; the desk includes the format, excludes boilerplate; alerts dedupe inside the 48h cooldown |
| desk.test.ts (4, 4.0.1) | clean evidence excludes streams, ≥30-min recordings, news clips, text posts and sub-100K videos, and labels mid-size successes; calendar countdown (3 days to Halloween, "today", "2 days ago"), a passed date cools; a young cluster's timing from its examples' measured rates; category from the verified examples (a Sports cluster leaves the desk whatever its label); a sub-format shared by 3 creators is found inside a pool; romanised Hindi is Hindi |
| videos.test.ts (6), intel (…), collectors, store, money | the 3.0 suite unchanged (states, velocity, cooling, outliers, duplicates, paid-reach pattern, big-channel normal range, quota day, taxonomy, relevance, money) |

## Live pipeline (GitHub Actions)

First 4.0 collection `202610281057_fd8cf25fe973` (10:57 UTC): 16/16 quality checks, gate passed, published.
Adaptive discovery allowance 1 (start of the Pacific day), fresh 6h probe → 50 new ids, 7 already ≥500K views;
hot-channel uploads → 125 new videos from 30 channels, 6 eligible; Shorts verification 150 checked (142 Shorts,
8 not, self-test reliable); 60 predictions recorded (20 radar, 20 views, 20 velocity), 240 horizons pending;
40 alerts (first run: everything is "new"). Second collection (11:24 UTC): 73 predictions, 8 observable crossings
after the first prediction (none predictable yet), yield ledger 3 searches → 47 new eligible videos, 14 new alerts.

## Discovery benchmark (4.0 cycle 1, dev set, 11:31 UTC — 35 minutes after the adaptive scheduler started)

53/98 discovered (54.1 %), precision@10/@20 100 % on all three lists, 0 negative leaks (142 low-engagement Bluesky,
15 duplicates, 105 streams, 196 unverified links, 208 sub-10K), classification agreement 96.0 %, 99/100 featured
videos embeddable, 100/100 thumbnails. **Unseen holdout (World/MX/GB), 12:20 UTC: 58/82 discovered (70.7 %)**,
precision 100 %, 0 leaks of 728 controls. Full tables in `data/benchmark/4.0-cycle1-dev.md`,
`4.0-cycle2-holdout.md` and `docs/BENCHMARK.md`.

## Browser QA (real Chromium on the GitHub runner, live site)

**4.0.1 re-run (13:17 UTC, run `202610281313` live):** 0 pages with horizontal overflow at 1440/768/390 (36
screenshots), Discover loads in 3.0 s / 2.3 s / 2.5 s, the desk → playbook → export flow passes at all three widths,
14/15 player embeds load; media was delivered in 2/15 because YouTube's datacenter anti-bot wall answered 12 (see
below). The desk screenshots show the 4.0.1 state (Seasonal & Holidays category from the evidence, "Mid-size" badges,
"No playbook yet" for monitored items).

`data/qa/report.json` + 36 screenshots. Three widths × eleven pages render with real thumbnails and no horizontal
overflow after the fixes (segments wrap, scores wrap, intros clamp on phones); the Creator Desk → playbook → export
flow works at 1440 / 768 / 390. Playback: the official embed loads in 14/15 cards; on the runner's datacenter IP
YouTube answers most embeds with "Sign in to confirm you're not a bot" (a YouTube anti-bot wall, visible in
`player-viral.png`), so media was delivered for 3/15 — the direct "Open original" fallback is shown in every modal.
A residential browser is not subject to that wall; it was not used because the owner limited browser use to
Google Cloud and GitHub.

## Recommendation audits and code review

Independent reviews (separate agents that did not build the system and did not read each other):

| review | run audited | result | response |
|---|---|---|---|
| `docs/RECOMMENDATION_AUDIT.md` | 11:24 UTC | desk 2.45/5, label agreement 45 % (30 % substantive) | fixes in the 12:08 run |
| `docs/RECOMMENDATION_AUDIT_2.md` | 12:08 UTC | desk **2.17/5** (8 items; three "not trends"), label agreement **37.5 %** (format 20 %, meme 0 %, event 40 %, uncertain 90 %), Viral Now 9/10 sound, Early Radar 5/10 | 4.0.1 (§9 of that file): evidence integrity, category/timing from evidence, calendar countdowns, hashtag/entity memes need a shared word, dominant video must carry the name, pools need a visible structure, Early Radar pace rule, lane sub-formats, playbooks only for actionable items; replay of the audited run: 8 desk items → 5, labels event 591/meme 25/format 16/uncertain 213 → 544/1/9/293 |
| `docs/CODE_REVIEW_4.0.md` | code | 0 critical, 4 high, 5 medium, 10 low | all 19 resolved |

The second audit's scores stand as the measured quality of the 12:08 desk; the 4.0.1 changes were verified by
replaying that run's observations offline (same data, new rules) and by the test suite, and a third audit of a live
4.0.1 run is recorded below when available.

---

# Test results — Viral Radar 3.0 (2026-10-28)

Environment: Anthropic cloud workspace (no personal machine involved); live verification on GitHub Actions runners
and the public GitHub Pages site. The 2.0 and 1.0 results follow below.

## Automated tests — `npm test` — 42/42 pass

New in 3.0 (`test/videos.test.ts`, `test/collectors.test.ts`, `test/intel.test.ts`): evidence classes follow
absolute + relative thresholds (4 → 8 likes is never a breakout; a 12M-view Short is a hit; a 6h-old 400K-view
video is a *provisional* breakout labelled as such; share likes never become video statistics); velocity only
between real observations ≥1h apart, acceleration from three points, windowed gains; measured growth beats the
lifetime average; cooling; delayed breakouts survive the 30-day rule; creator outliers with a baseline; live
streams and duplicates excluded; Bluesky never ranks among view-count platforms; a big channel's ordinary clip is
not a breakout even when it gains fast; "- Topic" channels carry no outlier ratios; paid-reach patterns are
rejected and hidden like counts are not evidence; the quota day follows Pacific time; corporate news is a news
event.

## Live collection (YouTube Data API)

First keyed run 03:52 UTC: 906 verified video records (titles, publish dates, views, likes, comments, durations,
channels, thumbnails on i.ytimg.com), 25 units + 18 searches. By 07:40 UTC after 28 runs: 4,484 unique videos in
the 30-day index (4,444 with verified statistics), 1,047 with measured velocity, 36 with acceleration; the day's
quota use was 1,133 units and 76 searches (limits 10,000 / 100; the ledger caps at 9,000 / 90). No key appears in
logs, data, code or the site (GitHub masks the secret; collector errors are redacted; the ledger stores no URLs).

## Discovery benchmark (docs/BENCHMARK.md)

| cycle | reference set | discovered | precision@10/@20 | negatives leaked |
|---|---|---|---|---|
| 1 baseline | ChartsList US + ShortsMonkey (98) | 4.1 % | 100 % | 0 |
| 1 after the collection fix | same | 40.8 % → 49.0 % | 100 % | 0 |
| 2 final | same | 49.0 % (80 % of videos ≥10M views) | 100 % | 0 |
| 3 unseen holdout | ChartsList Worldwide + MX + GB (82) | **65.9 %** (87 % of videos ≤7 days old) | 100 % | 0 |

Classification agreement with the uploader's specific YouTube category: 96–97 % (36 % before the platform prior).
Playback: 100/100 featured videos embeddable and 100/100 thumbnails reachable from the runner.

## Case video (IjQwPjLMbxI)

API-verified: "Angry grandpa kicks me out my fishing spot 😂" by Bird28thegr8, published 2025-08-21, 2.19M views,
59K likes (2.7 %), 2,285 comments, 71 s. ×440 the channel's median upload (4,971 views; 42.6K subscribers).
Diagnostic tracking 04:18–05:46 UTC: +2,520 views in 1.47 h = ~1,700 views/hour ≈ 8× its lifetime average — a
modest resurgence of a 14-month-old Short, below the 5K/hour delayed-breakout floor; it is a creator-outlier case,
not a current major hit. It was never injected into the feed.

## UI (real browser screenshots, Chromium)

1440 / 768 / 390 px: Discover, Viral Now, Early Radar, Trends, Hall of Fame, Diagnostics (coverage, funnel),
Studio, Money, Watchlist, a trend page, and the modal player (iframe present at every width). No horizontal overflow
after fixes (uniform 4:5 cards, 2-column grids on tablets, wrapping pills). Thumbnails and fonts are blocked in the
sandbox, so screenshots show the gradient fallback covers; the live site loads i.ytimg.com thumbnails (verified by
HEAD from the runner).

## Quality checks — 16 per run, 6 critical ones gate publishing

Every 3.0 run so far: 16/16 (relevance 100 %, 0 share-dates-as-publish-dates, 0 misattributed engagement,
0 featured videos without verified statistics, 0 unsupported breakouts, 0 tiny-sample videos featured, 0 stale
featured statistics).

---

# Test results — Viral Radar 2.0

Environment: Anthropic cloud workspace (Ubuntu 24.04, Node 22.23, sandboxed; no access to any personal machine,
GPU or local service). Live verification through GitHub Actions runners and the public GitHub Pages site.
Date: 2026-10-28 (UTC). The 1.0 results are preserved at the end.

## Automated tests — `npm test` — 34/34 pass

| file | what it verifies |
|---|---|
| `test/collectors.test.ts` | Google Trends parser on real feeds; Bluesky v2 semantics on real captures: native video = direct, published by the post; external YouTube link = indirect, **no publish date**, empty video metrics, post engagement in `postMetrics`, sharer ≠ creator, thumbnail; text-only search results are not evidence; duplicate shares merge with sharer count; adult markers dropped; Mastodon 7-day history; YouTube Data API item → direct record with `videoPublishedAt`, duration, platform category |
| `test/intel.test.ts` | Stage-1 classification and news detection (incl. sports fixtures and named figures); **relevance regression suite** — "cooking up an album", *Limmie & Family Cookin'*, "keeps cooking them", *Cat Stevens* / *Stray Cats* are not cat videos, political "satisfying" is not satisfying content, a text post is never format evidence, animal-comedy construction; second round from the live audit (Curry Barker, solar panels "fry", level design, `ep 2`, "no one ever explained", speedpaint ≠ gaming, archival "(1968)"); clustering (phrase microtrend across ≥3 creators, shares of one video count once, topic feeds, validated format pools); scoring (separated components, grades, provisional vs measured growth 1→3 creators = 1.5×, velocity 10K views/h, age-normalised rates, shares-only clusters capped at *early*); Mastodon partial-day handling; lifecycle rules (no acceleration without measurement, stale → cooling, format pools never emerging) |
| `test/intel.test.ts` (review round 2) | like-for-like creator growth per window (24h vs 24h; a 7d-only record leaves 24h provisional; 1.0 records never used as a baseline); new creators / cluster age from the whole cluster (a 4-day-old trend is not *emerging* in the 48h view); *strong* needs ≥6h of history; topic corroboration needs keyword coverage (*World Series* ≠ "anime series finale"); any publish date on an unverified share is flagged |
| `test/store.test.ts` | compact ticks, latest-state loader with `firstSeenAt`, score history, cache |
| `test/money.test.ts` | calculator arithmetic incl. break-even by views vs by output, no-cost case, negative-input clamping, presets, monotonic scaling, Instagram has no per-view revenue |

## Data-quality checks — run every collection (`pipeline/src/quality.ts`)

First live 2.0 run `202610280220_7f353411b42e`: **12/12 pass** — format evidence passes the validator 117/119 (98%),
0 duplicates, 0 share-dates-as-publish-dates, 0 misattributed engagement, 0 malformed links, 0 invalid growth
ratios, 0 lifecycle/grade inconsistencies, all live sources fresh, 9 qualified of 188, 0 news events qualified,
0 generic categories qualified without measured growth, every qualified trend carries evidence.
Six of these checks are **critical** and block publishing (`pipeline/src/gate.ts`); a blocked run keeps the
previous release live.

## Relevance test (target ≥ 90%)

`docs/RELEVANCE_AUDIT.md`: 95 trend–evidence pairs from the first live run, labelled by hand.
Before tightening: 77/95 relevant (**81%**). After the rule changes made from the audit: **75/77 = 97%** of the
pairs the validator still accepts are relevant; 2 ambiguous items kept; 3 relevant items dropped (conservative).

## Ranking test (top 20)

1.0 top 20: 14 predefined format pools, 5 audience topics, 1 hashtag cluster → under 2.0 rules 14 become *proven
formats* (category activity), 3 topics are news/sports events (excluded), 2 keep real native-video evidence.
2.0 first live run: 9 qualified — 1 topic with 3 native videos (*strong*), 3 hashtag microtrends (*developing*),
2 topics and 2 formats at *early*, 1 share-only microtrend at *early* with the note "needs platform verification".
Nothing is padded to reach 20.

## Freshness test

Quality check "publication dates are not share dates and not in the future" = 0 violations on live data;
unit test asserts an external share has `publishedAt` undefined and `postPublishedAt` = the post time; the UI
labels "published" vs "shared" separately; windows use content time (unit test: a 30h-old video is outside 24h
and inside 48h).

## Financial test

Independent arithmetic in `test/money.test.ts` (e.g. 1M Shorts views × 90% × $0.06 = $54; long-form $4 RPM → $3,400;
break-even 11.1M views ≈ 1.11M per video; each Short nets −$44.60 after a $50 cost → "more videos never break
even"); investment calculator rows are monotonic in views and omit Instagram (no per-view program).

## UI test

Headless Chromium at **1440 / 768 / 390 px**: Discover, Compass, Money, Studio, Watchlist, Settings (prefs + data) and
a trend page. No horizontal overflow at any width after fixes (`.tiles`/`.kv` min-width, hero media fill); no
JavaScript errors. Font loads from Google Fonts in production (blocked in the sandbox, system fallback shown).

## Real-world workflow test (two minutes)

Discover → hero card states the trend, grade, direction, creators and a concrete format → "Explore opportunity" →
trend page shows relevant examples with thumbnails that open the originals, growth facts, cautions, three concepts
with budget/difficulty → "Save to production queue" → Studio/Watchlist. Verified on the 390 px screenshots.

## Regression test

All 1.0 capabilities remain: five sources, watchlist statuses + actual tracking, earnings calculator and example
scenarios, platform comparison, preferences, compass, scheduled collection, Pages publishing, continuity docs.
v1 history records load through `migrate()`.

## Independent review (round 2)

Ten findings on the 2.0 logic (growth baselines, window-relative "new" creators, evidence counts, category deltas,
movers captions, corroboration, summaries, a dead preference, a weak date check, docs/code drift) — all fixed with
regression tests; details in `docs/AUDIT.md`. Offline re-run of the fixed pipeline on the live history: 196 trends,
9 qualified, 12/12 checks, 0 stale relevance labels.

## Live deployment

GitHub Actions "Collect trends" #4 (2.0 pipeline): `collect` ✓ (gate: true), `publish` ✓. After the second review
round, run `202610280334_b91b24cdef8b` (03:34 UTC, corrected pipeline): 650 observations this run, 1,753 in history,
246 clusters, **11 qualified**, relevance check **147/147 (100 %)**, **12/12** checks, gate passed, Pages published;
https://cge6media.github.io/viral-radar/ serves that snapshot (verified by fetching `data/latest.json`) and the
dashboard build of commit `7b25719`. Grades after the persistence rule: 29 developing, 50 early, 167 insufficient,
0 strong (a *strong* grade needs ≥6h of history — first possible around 09:00 UTC). Per-window creator growth
becomes measurable from the first run ≥2h after 03:34 UTC.

---

## 1.0 results (kept for history)

23/23 tests; two successful live runs (920 and 903 observations); independent review with 10 findings fixed;
desktop + iPhone rendering; Pages deployment verified.
