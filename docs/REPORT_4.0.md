# Viral Radar 4.0 — final engineering report (2026-10-28)

Everything below was built, run and verified in the cloud (Anthropic's sandbox + GitHub Actions runners + GitHub
Pages); no personal machine, local model or local service was used. External spend: $0 (free YouTube Data API
quota, public-repository Actions minutes, GitHub Pages). Numbers are from the live runs `202610281313_036c3ccb99f8`
(13:13 UTC, the audited 4.0.1 run) and `202610281407_763b35da2e7f` (14:07 UTC, the first 4.0.2 run, live on the
site: `health.json` → `lastCollectionAt 14:07:55Z`) and the documents named in each section; nothing is claimed that
is not in a file in this repository.

## 1. Product status

Live at https://cge6media.github.io/viral-radar/ — 4.0.2 build, data of the 14:07 UTC run (health.json on the site
confirms it). Eight primary surfaces: Discover, Viral Now, Early Radar, Trends, Creator
Desk (with playbooks, Scorecard, Alerts, Journal, Radar health under More), Money, Hall of Fame, Watchlist/Journal.
Recovery checkpoints: `v1-stable`, `v2-stable`, `v3-stable` (3.0 as deployed) remain; 4.0 is on `main`
(`90d4891`). 55/55 automated tests; 15/16 runtime quality checks on the live runs (the one non-critical warning:
203 featured videos' statistics were last observed more than 6 h ago — tracking is rationed to the free quota and
the index is one day old; the check is informational, not a gate); release gate passed on every published run.

## 2. Discovery performance — before vs after

| | 3.0 (same day, before 4.0) | 4.0 (adaptive discovery, 11:31 / 12:20 UTC) | 4.0.1 (13:17 UTC) |
|---|---|---|---|
| dev set (ChartsList US + ShortsMonkey, 98 verified positives) | 49.0 % discovered | **54.1 %** (53/98) | — |
| unseen holdout (ChartsList World/MX/GB, 82) | 65.9 % | **70.7 %** (58/82) | **70.7 %** (58/82), 57/82 qualified |
| precision P@10/P@20 (Viral Now 72h/7d, Early Radar) | 100 % | 100 % | 100 % |
| negative-control leaks (low-engagement, >30 d, duplicates, streams, unverified, sub-10K) | 0 | 0 of 728 | 0 of 741 |
| classification agreement (platform category vs ours) | 97 % | 96.0 % (2,322/2,420) | — |

Adaptive discovery on the free quota: 2,362 of 9,000 units and 29 of 90 search calls used by 13:13 UTC across
5 runs; the yield ledger shows the "fresh" probe family at 11 new eligible videos per search, "trend" at 5, and
hot-channel uploads (zero search cost) adding 450 new ids / 64 eligible today. Index: 5,642 unique videos
discovered, 5,500 verified, 2,658 qualified hits/breakouts, 177 in the feeds (`data/diagnostics/`).

What was not achieved: recall on the dev set stays near half — ShortsMonkey's list (15/50) is dominated by videos
our probes cannot reach without more search quota; the quota ceiling (100 search units/day) is the binding limit
and is documented in `docs/DISCOVERY.md`.

## 3. Early detection

Per-video kinds are separated and labelled: *established* (age-normalised hit floor: 1M at ≤24 h → 2M at 72 h →
3M at 7 d → 5M at 30 d), *early* (below the floor, rising: measured ≥10K/h while holding ≥ its lifetime pace, or
accelerating ≥1.5× vs the previous interval, or a creator outlier ≥10× within 7 d), *delayed* (older than a week,
≥3× its lifetime average). Lifetime average, measured interval rate and acceleration are three separate numbers
on every card; acceleration is never claimed from intervals under 1,000 views; Shorts are *verified* by a HEAD
request (142 of 150 confirmed in the first run; the rest labelled "short-form candidate"). 4.0.1 added the pace
rule (a 4-day-old clip at 0.97× its average is "past its peak", not early) and pace/youth ranking: in the 13:13
radar 7/40 entries are older than 72 h (14/40 before), 19/40 measured below 1× (22/40 before), 14/40 above 1M views
(21/40 before — allowed by design: below the floor for their age is "early").

## 4. Prediction scorecard

93 immutable predictions recorded since 10:57 UTC (radar top-20 vs two baselines: views-rank and velocity-rank);
372 horizons pending (24 h / 48 h / 72 h / 7 d); **0 evaluated, 0 confirmed, 0 crossings, precision `null`** — by
construction nothing can be evaluated on release day (the earliest horizon is 24 h after the first prediction, at
~10:57 UTC on 2026-10-29); precision is reported only from ten evaluated predictions and calibration bands from
twenty. The scorecard page shows pending ≠ success explicitly. No hindsight: predictions are appended to NDJSON
before outcomes exist and archived monthly (`data/predictions/`).

## 5. Creator Desk

What it does: classifies every cluster as viral event / emerging meme / repeatable format / uncertain from title-
level structure; builds "Today's creator opportunities" with A–H blocks (what, evidence, why, how early, type,
production, monetization, action), one action each (create today / participate / research / monitor / skip),
three deterministic brief variations with Markdown export, a journal with statuses and real numbers, alerts, and
the owner's lane with sub-formats. On the audited 13:13 run: 1 participate (Halloween), 4 monitors with "what
would change the verdict", 316 clusters considered, 310 excluded with counted reasons. On the first 4.0.2 run
(14:07, live): 5 create-today items — "mbappe / haaland · Comedy skits" (the 3D football-star parody format: 6
creators, 8 qualified hits, 3 of them younger than 72 h, English, 13–31 s), "tf2 / diaper · Animation shorts" (6
creators, SFM gags; IP risk flagged), "AI-generated video" (9 creators, 10 qualified), "Black Cat" (10 creators —
the AI animal-story shorts riding the black-cat day tag; the clustering's name, the evidence's format) and a
duplicate of the football parody from the animation pool that the next run removes (cross-pool dedupe pushed at
14:17) — plus Halloween (participate, 3 days to the date), Minecraft Mod (research) and one monitor; 316 clusters
considered, every exclusion counted. Nothing padded in: when fewer qualify, fewer are shown.

Measured quality (three independent audits, same rubric, three separate agents that did not build the system and
did not read each other): `docs/RECOMMENDATION_AUDIT.md` (11:24 run) desk 2.45/5, labels 45 %; `_2.md` (12:08 run)
desk **2.17/5**, labels **37.5 %**; `_3.md` (13:13 run, first live 4.0.1) desk **2.56/5**, labels **58.1 %**
(Viral Now 9/10 sound, Early Radar 5/10). Each audit's weaknesses were specific and each was answered in code the
same day (4.0.1 after the second: evidence integrity, category/timing from evidence, calendar countdowns, honest
labels; 4.0.2 after the third: timing by the flow of new hits, sub-formats merged and promoted — the 3D football-star
parody format the auditor called "the best opportunity in the data" is now a create-today item on the replay —
broadcaster/brand channels, template fragments, radar noise rules). The third audit's numbers are the last
independent measurement; 4.0.2 is verified by an offline replay and 55 tests, not by a fourth audit.

## 6. Data reliability

Measured, not assumed: GitHub started **57 %** of the 30-minute scheduled slots since 03:00 UTC (12 of 21) and
**1 of 7** in the hour after the four staggered sibling workflows went live — GitHub's scheduler, not the pipeline,
drops them. 4.0.1 therefore chains collections: every scheduled or chained run starts a keeper job that waits 25
minutes and dispatches the next collection unless one started meanwhile; the freshness gate keeps collectors from
overlapping and the concurrency group is at job level so a sleeping keeper never blocks a scheduled run. Measured
so far: collections at 10:57, 11:24, 12:08, 12:27, 13:13, 13:40 and 14:07 UTC — 7 in the 6 expected slots since
the first 4.0 run, mean gap 32 min, max 64 min (`data/health.json` on the site); the first keeper-chained
collection ran at 14:07 after the scheduler had skipped the 13:48, 13:56 and 14:03 slots. GitHub's scheduler
remains bursty (three slots fired within six minutes at 13:33–13:39 after an hour of silence); the chain, the gate
and the job-level group absorb that. Freshness is a state (fresh <45
min, delayed <2 h, stale), never "Live" on old data. Quota: 2,362/9,000 units, 29/90 searches at 13:13 UTC; the
collector stops at the first quotaExceeded answer. Sources on the 13:13 run: YouTube, Bluesky, Google Trends,
Mastodon ok; TikTok disabled (no anonymous statistics).

## 7. Video relevance audit

See §5 for the desk audits. Feeds: the second and third audits judged Viral Now's top 10 sound (9/10 twice —
aggregator reposts, mega-channel uploads and one uploader-category error are verified hits but not creator
formats) and Early Radar 5/10 twice ("not early enough": entries below their own lifetime average carried by a
noisy acceleration ratio, a broadcaster promo, kids-autoplay compilations); 4.0.2 answered those with the credible-
acceleration rule, the 0.35× subscriber floor, the autoplay and broadcast-recording exclusions. Benchmark precision
is 100 % with 0 of 741 negative controls leaking (holdout re-run after the changes: unchanged 70.7 % recall).

## 8. Platform coverage (honest)

YouTube: direct statistics (API), 5,184 verified videos in the index. Bluesky: direct engagement (public API).
TikTok and Instagram: indirect only — links shared on Bluesky, oEmbed verification, no statistics ("not
verifiable" is shown, never a number). Facebook: unavailable. Cross-platform links are typed (A: same canonical
video shared elsewhere; B: same creator; C: same title/phrase) with explicit confidence; no generic-word merging.

## 9. UX improvements

Navigation regrouped (five primary tabs + More; bottom tab bar on phones), Creator Desk with playbooks and export,
Scorecard, Alerts with "new since last visit", Journal with backup/restore, Radar health, language filter and kinds
on the feeds, production-return comparison in Money, Hall of Fame lessons. Browser QA on the live site with real
Chromium (`data/qa/`, 36 screenshots, 13:17 UTC): 0 pages with horizontal overflow at 1440/768/390, Discover loads
in 2.3–3.0 s, desk → playbook → export passes at all widths, 14/15 embeds load; media delivered 2/15 because
YouTube's datacenter anti-bot wall answered 12 — a limitation of the runner's IP, not of the app (every player has
the "Open original" fallback; a residential browser was not used because browser use was limited to Google Cloud
and GitHub).

## 10. Remaining limitations

- Relevance is title-level (tags/descriptions not stored); keyword coincidences remain possible and are now visible
  (the matched term is on every card).
- The desk is thin on English/Spanish opportunities on a given day: most monitored items are Hindi/Korean/
  Indonesian clusters, and the desk says so instead of recommending them.
- Sub-formats are shared words, not validated clusters; they reach the desk as "research", or as "create today"
  only with ≥4 creators, ≥2 fresh qualified hits, mostly English/Spanish, short-form and feasible in ≤2 h — and the
  card says they were found by shared title words.
- Briefs are deterministic templates (as the spec requires); they claim a hook only when ≥25 % of the clean examples
  carry it, but they do not yet derive variations from observed sub-mechanisms.
- No real prediction outcomes until 2026-10-29; the scorecard is a promise with a mechanism, not a result.
- GitHub's scheduler; the keeper chain is a workaround whose cadence must be watched over days.
- Dev-set recall ~54 % under the free search quota; the holdout (70.7 %) is the more representative number.
- Playback on datacenter IPs is blocked by YouTube; thumbnails and embeds are fine on residential connections.

## 11. Daily use

README → "Daily use (the morning routine)": open Creator Desk (one actionable item or an honest empty state, the
lane with sub-formats, what was excluded and why), check Alerts since the last visit, Early Radar for the day's
rising videos with kinds and confidence bands, Scorecard once outcomes accumulate, Journal to record selected →
producing → published with real numbers, Money for the production-return comparison. Hall of Fame and
`docs/MECHANISMS.md` for what repeats (hits: 90 % Shorts, median 45 s; questions and emojis in titles over-index
2.2–2.4×; "AI" in the title under-indexes 7×).

## 12. Final recommendation

Use it daily as a *verified-evidence* desk, not as an oracle: the discovery, verification, early-detection and
honesty layers are solid and measured (100 % precision, 0 leaks, 70.7 % holdout recall, every number traceable to
a video), while the recommendation layer is still young — two independent audits scored the desk 2.45 and 2.17 out
of 5 before the 4.0.1 fixes and 2.56 after them (58 % label agreement), and the 4.0.2 replay — the owner's lane
opportunities now reach the desk — has not been audited. Give the prediction scorecard a
week before trusting any precision figure; watch the keeper chain's cadence on the Radar health tab for two days;
re-run the audits after the index has a week of history. The next real upgrade would store tags/descriptions in
a compact form and validate sub-formats as clusters — both within the free infrastructure.
