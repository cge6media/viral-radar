# Code review — Viral Radar 4.0

Independent review of the 4.0 additions (prediction scorecard, adaptive discovery, video kinds/confidence, Creator Desk,
alerts, health, dashboard pages, workflows). Scope and priorities follow the owner's brief. Nothing outside this file
was modified; no network commands were run.

**Method.** Every finding was traced through the code paths named below. `cd pipeline && npm test` → 50/50 pass;
`cd web && npx tsc --noEmit -p .` → clean. Two findings (1 and 3) were additionally reproduced with a throw-away test
against the real `predict.ts` / `videos.ts` functions (not committed); finding 3 was also checked against the live
data in `data/predictions/*.ndjson` and `data/history/observations/2026-10-28.ndjson`. **CONFIRMED** = traced and/or
reproduced; **PLAUSIBLE** = the code path is real but the trigger depends on an external fact I could not verify
offline (GitHub Actions semantics, YouTube quota pricing, YouTube redirect behaviour).

Line numbers refer to the working tree as of this review (HEAD 4a60c98 plus the uncommitted edits to
`pipeline/src/intel/{desk,formats,videos}.ts` that landed while the review was running; those edits — extra
news/release regex terms, a long-recording rule, an engagement-anomaly discount, `outlierMaxHours` 14 d → 7 d — do not
affect any finding below).

## Summary

| # | Severity | Area | Finding | Status |
|---|---|---|---|---|
| 1 | **High** | predict.ts | A horizon is evaluated from the first observation after 0.85 H, so every outcome is measured ~13–15 % early against a floor frozen for the full horizon; outcomes are immutable, so the bias is permanent | CONFIRMED (repro) |
| 2 | **High** | run.ts | Open predictions are only tracked while the video is ≤ 7 days from first sight (and only while ≤ 30 days old by content time), so the 7-day horizon is mostly unobservable or measured at ~143 h | CONFIRMED (trace) |
| 3 | **High** | predict.ts | Crossings use the first above-floor tick as the crossing time and count a video as "missed" even when it was already above the floor at every run that could have predicted it; `recall: 0` (0/12) was published on release day; lead time overstated by the tick gap | CONFIRMED (data + repro) |
| 4 | **High** | collect-b/c/d.yml, collect.yml | The sibling schedules carry no `concurrency` group and the called workflow's top-level group does not protect them; the freshness gate only sees *committed* data, so two collectors can run at once → double quota spend and a lost run on rebase conflict | PLAUSIBLE (GitHub semantics) / CONFIRMED (no group in B/C/D) |
| 5 | Medium | youtube.ts, DATA_SOURCES.md | `search.list` is metered in "its own bucket" at 1 unit; if the documented 100-unit cost applies, the unit ledger undercounts by 100 per search and the real daily quota is exhausted mid-day | PLAUSIBLE |
| 6 | Medium | run.ts / health.ts | `published` = *all* quality checks ok, but the gate blocks only on the six critical checks → "Last successful publication" freezes while publishing continues | CONFIRMED |
| 7 | Medium | web/lib/store.ts, Watchlist.tsx | Journal import in *replace* mode writes unvalidated JSON to localStorage; a malformed backup crashes Journal/Desk/Alerts on every load until storage is cleared | CONFIRMED |
| 8 | Medium | run.ts / store.ts | `predictions.ndjson`, `outcomes.ndjson`, `crossings.ndjson` grow without bound (~1.4 KB per prediction, 4 outcome rows each), are fully parsed every run and committed every 30 min | CONFIRMED |
| 9 | Medium | youtube.ts | Shorts HEAD check: any redirect that is not `/watch` and not a consent page is recorded as `not_short` and cached forever; the self-test cannot catch it | PLAUSIBLE |
| 10 | Low | predict.ts | An observation inside the tolerance window that lacks the metric is scored as a *miss*, not *unobserved* | CONFIRMED |
| 11 | Low | youtube.ts / discovery.ts | A probe whose `search.list` call throws never reaches `recordYield`, so it has no cooldown and is re-picked every run | CONFIRMED (path) |
| 12 | Low | youtube.ts / health.tsx | Hot-channel uploads are recorded into *today's* yield totals with 0 searches → "useful discoveries per search" is inflated | CONFIRMED |
| 13 | Low | collect.yml | `gh run list --workflow collect.yml` exports only one of the four schedules → health "failures"/dropped-run counts are incomplete | CONFIRMED |
| 14 | Low | predict.ts | Scorecard summary mixes a 60-day prediction cut with all-time outcome counts | CONFIRMED |
| 15 | Low | videos.ts | `observations` double-counts the direct record → confidence band inflated, "Seen once so far" never shown for direct videos | CONFIRMED |
| 16 | Low | web/pages/Settings.tsx, App.tsx | `#/settings?tab=…` links do not switch tabs when already on Settings; the bell count stays stale after "Mark all as seen"; `#/trend/<bad %>` throws; unknown alert kinds throw | CONFIRMED |
| 17 | Low | diagnose.yml, qa.yml | `workflow_dispatch` inputs interpolated into `run:` shell lines (unquoted in diagnose.yml) with the YouTube key in the step env | CONFIRMED (pattern) |
| 18 | Low | youtube.ts | Quota ledger is saved only at the end of `collectYouTube` and written non-atomically → a crash loses the run's spend; a truncated file resets the day to 0 | CONFIRMED (path) |
| 19 | Low | predict.ts / PREDICTIONS.md | Bluesky branches in prediction/evaluation are dead code (`strategyPool`/radar require `VIEW_PLATFORMS`), yet the docs describe Bluesky predictions; "append-only" is not enforced (crossings were hand-purged in commit dd0c727) | CONFIRMED |

Counts: **critical 0 · high 4 · medium 5 · low 10.**

---

## Details

### 1. HIGH — horizons are evaluated at the first observation after 0.85 H, not at the horizon — CONFIRMED

`pipeline/src/intel/predict.ts:146` gates evaluation on `elapsed < h * TOLERANCE.early` (0.85 H) and `:147` takes the
observation closest to H *among those that already exist* (`pointAt`, `:99-109`). Collections run every ~30 min and the
run that first finds `elapsed ≥ 0.85 H` also finds its own tick in `metricHistory30` (ticks are written in step 4,
`run.ts:188`, before step 8c evaluates), so in production the "24 h" outcome is measured at ~20.4–23.4 h, the "7 d"
outcome at ~143–146 h. The floor it is compared with is frozen for the age the video has at the *full* horizon
(`:77`, `:156`), and `multiplied`/`accelerated` use the shorter elapsed time. The header comment (`:11-12`) and
`docs/PREDICTIONS.md` say "views at the horizon" / "first observation at or after the horizon"; the unit test passes
only because it evaluates at +25 h with a point at +24.5 h.

Reproduced: prediction at T (300 K views, frozen 24 h floor 1.47 M), tick at T+20.5 h = 1.1 M → the run at T+20.6 h
writes `reachedHit:false, observedHours:20.5`; a tick at T+24 h = 1.6 M (above the floor) can never change it because
the (prediction, horizon) key is in `done` (`:134`, `:144`).

Failure scenario: every `reachedHit` and `multiplied` outcome in the scorecard is biased against the prediction by up to
15 % of the horizon; precision figures published after ≥10 evaluations are systematically low and cannot be
recomputed because outcomes are append-only.

Fix: gate on `elapsed >= h` (keep the [0.85 H, 1.5 H] window only for *choosing* the observation), and prefer the first
observation at or after H; fall back to the closest point below H only once `elapsed >= 1.5 H` and nothing later
exists. Add a test that evaluates at `elapsed = 0.9 H` with a point at 0.86 H and expects *pending*.

### 2. HIGH — open predictions fall out of the tracking set before the 7-day horizon — CONFIRMED

`run.ts:99` builds `knownYt` only from YouTube observations with `firstSeenAt ≤ 7 days`; `run.ts:118` derives
`trackIds` from that set, and `rank()` (`:119-123`) only *orders* it. `openPredictionIds` (`:107-109`) are added to
`featured` (rank 0) but never to `knownYt`, so a video predicted *d* hours after first sight stops being refreshed at
168 h after first sight, while its 168 h-horizon window is [142.8 + d, 252 + d] h after first sight. For d > 25 h the
window has no tracked observation at all → `unobserved`; for smaller d it is measured in the first ~1–2 days of the
window (compounding finding 1). The comment at `:105` ("open predictions stay in the priority tracking set until their
7-day horizon has been evaluated") does not hold.

Second cause, same symptom: `metricHistory30` (`run.ts:257`) is loaded only for observations whose *content time* is
≤ 30 days (`recent30`, `:256`). A "delayed"-kind prediction made on a 24–30-day-old video has ticks on disk but they
are not loaded when its 7 d (or 24 h) horizon comes due → `unobserved`.

Failure scenario: the 7 d column of the scorecard stays "unobserved"/empty for most radar predictions; `docs/PREDICTIONS.md`
promises "the 7-day figures a week later".

Fix: `for (const id of openPredictionIds) knownYt.add(id)` (and `firstSeenById` fallback) before `trackIds` is built,
bounded by the 10.5-day open window; load `metricHistory30` for the union of `recent30` ids and the open predictions'
`videoId`s. Note `TRACK_MAX = 2500` (`youtube.ts:46`) vs 4,841 known ids today: featured ids are rank 0 so they fit,
but `stats.youtube.trackedVideos` (`run.ts:324`) reports `knownYt.size`, not what was refreshed.

### 3. HIGH — crossings are timed at the first above-floor tick and counted as "missed" when no prediction was possible — CONFIRMED

`predict.ts:202-206` takes `crossed` = first observation with `views ≥ floor(age)`; `:209` only requires
`crossed.t ≥ since` (first prediction ever); `:211` looks for a radar prediction before `crossed.t`; `:213` measures
lead time to `crossed.t`. Ticks are written only every ≥3 h or on a ≥15 % move (`store.ts:165`), so the true crossing
lies anywhere in the previous tick gap.

Live data: all 8 rows in `data/predictions/crossings.ndjson` have `crossedAt = 11:24:28Z`, 26 minutes after the first
4.0 prediction (`firstPredictionAt 10:58:57Z`). Their histories (e.g. `youtube:video:4ybAIEjn_Ak`: 978 K at 08:00,
1.13 M at 11:24, floor 1 M; `R0jkhwlMlFk`: 1.08 M at 08:00 vs floor ≈1.13 M, 1.27 M at 11:24 vs floor ≈1.21 M) show the
floor was crossed between 08:00 and 11:24 — by interpolation before 10:58 for most of them — so the only run that
existed before `crossed.t` saw them already as `verified_hit` (excluded from every strategy pool, `:50`). They were
unpredictable, yet `data/predictions/scorecard.json` and `latest.json.scorecard` publish
`crossings: {observed: 12, predictedBefore: 0, missed: 12, recall: 0}` and the Scorecard page renders "Recall 0 %"
(`web/src/pages/Scorecard.tsx:85`, shown because observed ≥ 10). Commit dd0c727 hand-purged 4 earlier rows for the same
reason; the remaining 8 are a permanent bias in the recall denominator.

Reproduced with synthetic data: last below-floor tick at T0+8 h, first prediction at T0+10 h, first above-floor tick
at T0+11.4 h → counted as an observable, missed crossing.

Fix: require `lastBelow.t >= since` (the video was observed below the floor after predictions started) and, better,
that at least one run between `lastBelow.t` and `crossed.t` had the video in the candidate pool; record both bounds
(`lastBelowAt`, `crossedAt`) and compute lead time against `lastBelow.t` (conservative) or the midpoint; purge the 8
release-day rows the same way the 4 were purged, or add a `predictable: false` flag and exclude them in
`buildScorecard`.

### 4. HIGH — the four schedules are not serialised; the freshness gate cannot see an in-flight run — PLAUSIBLE/CONFIRMED

`collect.yml:19-21` declares `concurrency: group: collect` at the *workflow* level. `collect-b.yml`, `collect-c.yml`,
`collect-d.yml` declare no `concurrency` at all and call `collect.yml` with `uses:` (CONFIRMED). When a reusable
workflow is called, the caller's run is what is grouped; the called workflow's top-level `concurrency` is not applied to
the caller (only a job-level `concurrency` on the called `collect` job, or one on the calling job, would be) — this is
the GitHub semantics I could not verify offline, hence PLAUSIBLE. The freshness gate (`collect.yml:39-47`) reads
`generatedAt` from the *committed* `latest.json`, so it cannot see a collector that started minutes earlier and has not
pushed yet.

Failure scenario (uses the owner's own measurement of 8–23 min schedule delays and the 2–3 min run time in
`data/health.json`): slot :03 starts at :21, slot :18 (B) starts at :23; both read a `latest.json` from :50 (>22 min)
and both collect. Each spends its own search allowance from the same ledger baseline (double spend; the committed
ledger then undercounts by one run), both append to `history/observations/<day>.ndjson` and both rewrite
`latest.json`, `cache/youtube-quota.json`, `health.json`. The second `git push` fails, `git pull --rebase`
(`collect.yml:105`) hits conflicts on every one of those files, the three retries fail, the step fails and that run's
observations, ticks, predictions and outcomes are lost while its quota was spent. `diagnose.yml` and `qa.yml` share the
`collect` group but are likewise unprotected against B/C/D.

Fix: add `concurrency: { group: collect, cancel-in-progress: false }` at the top of collect-b/c/d.yml (or on the
`collect` job inside collect.yml, which applies when called). Keep the freshness gate as a second line.

### 5. MEDIUM — `search.list` accounted outside the unit pool — PLAUSIBLE

`youtube.ts:7-8` and `:151-156` (`spend`) count a search as `searchCalls += 1` and add **0** units; `DATA_SOURCES.md:20-22`
states search calls live in a separate "Search Queries per day" bucket at 1 unit. The YouTube Data API documentation I
know lists `search.list` at **100 units** of the single 10,000-unit daily quota and no separate search bucket. The owner
says this was re-checked on the project's quota page on 2026-10-28; I cannot verify that offline, so this stays
PLAUSIBLE — but the downside is large and the data so far cannot distinguish the two models: the full-day figures in
`docs/TEST_RESULTS.md` (76 searches, 1,133 units) are 8,733 units under the 100-unit model, still under 10,000, so no
403 would have appeared either way. At the 4.0 cadence (`SEARCH_BUDGET` 90, ~162 units/run measured today → ~7,800
units/day) the 100-unit model gives ~16,800 units/day: every YouTube call (tracking, charts, channel stats) would start
failing with `quotaExceeded` mid-afternoon Pacific while the ledger believes ~1,900 of 9,000 units are used.

Fix: verify once against the Cloud console "Queries per day" usage graph after a run with N searches (does it rise by
≈100 N?). If the 100-unit cost applies, charge 100 units per search in `spend` and cut `SEARCH_BUDGET` to ~40–50; in
either case make the collector stop spending for the Pacific day on the first `quotaExceeded` 403 instead of running
every remaining call into the same error.

### 6. MEDIUM — health "published" disagrees with the release gate — CONFIRMED

`run.ts:315` passes `published: quality.checks.every((c) => c.ok)`; `gate.ts:13-20` blocks only on six critical checks.
`health.ts:30` then carries `lastPublishedAt` forward only when *all* 16 checks pass. The day a non-critical check fails
(e.g. "at least one qualified opportunity", "live sources refreshed within 3h"), the dashboard still publishes but
`health.lastPublishedAt` freezes and the run bar is drawn dark ("not published", `web/src/components/health.tsx:48`).
The value is also recorded *before* the publish job runs, so a failed Pages deploy is never reflected.

Fix: compute `published` with the same `CRITICAL` set (export it from `gate.ts`), or record the publish result in a
follow-up step of the workflow (e.g. commit `data/health/published.json` from the `publish` job).

### 7. MEDIUM — journal import can brick the app — CONFIRMED

`web/src/lib/store.ts:88` (`replace` mode) writes any array straight to `vr.watchlist.v1`; only `merge` mode filters
on `typeof x.trendId === 'string'` (`:89`). `readList()` (`:96-103`) returns whatever is stored. Consumers assume the
shape: `Watchlist.tsx:93` (`a.addedAt.localeCompare`), `:121` (`ActionPill`/`TypePill` with
`ACTION_LABEL[action].desc`, `ui.tsx:41-43` → TypeError on an unknown string), `Thumb` (`ui.tsx:107`, `name.replace`),
and every page calling `useWatchlist()` (`Desk.tsx:24`, `Alerts.tsx:41` → `watch.map((w) => w.trendId)` on `null`).
Preferences are also written unvalidated (`:91`); `interests` not being an array breaks `rankView`.

Failure scenario: a user imports a hand-edited or truncated backup (or another app's JSON that happens to carry the key)
in replace mode → the Journal, Desk and Alerts pages throw on every load; the only recovery is clearing site data.

Fix: validate on import (object with string `trendId`, `name`, `category`, `status` in the allowed set, ISO `addedAt`,
numeric published fields) in both modes, and make `readList()`/`read()` defensive (filter invalid entries, fall back to
defaults). Render pills via `ACTION_LABEL[action] ?? ACTION_LABEL.monitor`.

### 8. MEDIUM — unbounded append-only logs parsed every run — CONFIRMED

`data/predictions/predictions.ndjson` is 104 KB after two runs (73 rows ≈ 1.4 KB each: 4 reasons + 8 history points);
outcomes add 4 rows per prediction. `run.ts:106`, `:288-289` parse the whole files every run and
`evaluatePredictions` iterates every prediction ever (`:292`); only the scorecard applies the 60-day cut (`:299`).
Nothing prunes these files (observations are pruned at 35 days, `store.ts:224`). At a steady 10–30 new predictions per
run this is 0.3–1 MB/day of predictions plus a similar volume of outcomes, committed 48×/day to a repository that is
already cloned with `fetch-depth: 0` (`collect.yml:37`) and gains ~11 MB/day of observation history.

Fix: write predictions/outcomes/crossings as daily files (like observations), load only the last 60 days for the
scorecard and the last 10.5 days (+1.5 H slack) for evaluation, and move older rows to an archive folder that the run
never reads.

### 9. MEDIUM — Shorts verification defaults to `not_short` and caches it permanently — PLAUSIBLE

`youtube.ts:423`: a 3xx whose `Location` is not `/watch` and does not match `/consent|sorry/` returns `'not_short'`.
Any other redirect (a self-redirect adding parameters, a mobile/regional host, a bot wall with a different path — the
QA notes in commit 4a60c98 mention "YouTube's datacenter bot wall") is recorded as `{s: 0}` in
`cache/youtube-shorts.json` (`:447`), never expires, and from then on `applyShortsCache` (`:461-472`) rewrites the
video's URL to `/watch` and sets `shortForm: 'not_short'` → `isShort: false` (`videos.ts:177-181`), which feeds
`shortsShare`, `medianDurationSec`, the Desk feasibility/playbook and the "portrait" embed. The self-test (`:435-439`)
only guards the "200 for everything" case; the "≥20 sub-minute videos and zero Shorts" check (`:453-454`) only
triggers when ≥20 sub-minute ids are in the batch. Also `:441`: ids absent from this run's items get
`durationSec ?? 0`, so long videos are HEAD-checked needlessly (bounded by `max = 150`).

Fix: return `'unknown'` for any redirect target that is not a `/watch` URL; expire `not_short` entries (e.g. 30 days);
skip ids whose duration is unknown.

### 10. LOW — an observation without the metric scores as a miss — CONFIRMED

`predict.ts:139` uses all points, `:147` picks one, `:153` reads `obs.metrics[metric]`; when it is `undefined`
(a tick without `views`), `reachedHit`/`multiplied` are `false`, `breakout:false`, and the row is counted as *evaluated*
(`:241`). `detectCrossings` filters `views != null` (`:199`); `evaluatePredictions` should too.

### 11. LOW — a failing probe has no cooldown — CONFIRMED (path)

`youtube.ts:256` catches errors from `searchOnce`/`detailsFor` and skips `recordYield` (`:254`), so `ledger.probes[label].lastAt`
is never set and `choose()` (`discovery.ts:128`) keeps the probe eligible; as a never-run probe it also carries the
optimistic prior (`:144-145`) or wins "explore" (`:135-139`). The quota is still charged (`spend` runs before the call,
`:200`). A probe that consistently 400s (an invalid region/category/language combination introduced by a config
change) would burn one search per run. Record the failure with `lastAt` and a zero yield, or an error cooldown.

### 12. LOW — hot-channel uploads inflate "per search" yield — CONFIRMED

`youtube.ts:288-290` records uploads via `recordYield` with `searches: 0`; `recordYield` (`discovery.ts:172-173`) adds
their `newIds/newEligible` to `today` totals, and `web/src/components/health.tsx:74` divides `today.newEligible` by
`today.searches`. Keep uploads in their own ledger section or exclude `how === 'rotation'` from the day totals.

### 13. LOW — Actions history covers one schedule of four — CONFIRMED

`collect.yml:64` lists runs for `collect.yml` only; runs triggered by collect-b/c/d appear under their own workflow
names, so `health.last24h.failures` and the dropped-slot picture (`health.ts:24-26`) miss three quarters of the
schedule. List all four workflows (or filter by the `Collect` prefix) and merge.

### 14. LOW — scorecard totals mix two populations — CONFIRMED

`predict.ts:280` (`evaluated`) and `:296` (`unobserved`) count *all* outcomes, while `predictions`/`pending` use the
60-day cut (`run.ts:299`). After day 60, `evaluated + pending + unobserved ≠ 4 × predictions`. Filter outcomes by the
predictions passed in.

### 15. LOW — `observations` is off by one — CONFIRMED

`videos.ts:202`: `group.length + metricHistory.length` counts the direct observation twice (its full record is also in
the history). A video seen once has `observations: 2`, so `confidence` (`:375`) gets 13 instead of 7 points and
"Seen once so far" (`:277`) never appears for direct videos; with a baseline the single-observation case lands in the
"medium" band.

### 16. LOW — dashboard routing/state details — CONFIRMED

- `web/src/pages/Settings.tsx:17-18` reads `?tab=` once in `useState`; `App.tsx:117` renders the same `<Settings/>`
  element for every settings hash, so the instance is reused and the tab does not change when the user is already on
  Settings and clicks "Source coverage"/"Discovery funnel" in the menu or the freshness badge. Subscribe to
  `hashchange` as `Desk.tsx:13-18` does, or key the element by hash.
- `Alerts.tsx:23-35`: `useAlertState` keeps per-instance state; "Mark all as seen" updates the page's instance and
  localStorage but not `App.tsx:100`'s bell, which stays at "N new" until a full reload. Share state (listeners, as in
  `store.ts`) or lift it.
- `App.tsx:105`: `decodeURIComponent` on a malformed hash (`#/trend/100%`) throws during render → blank app. Wrap in
  try/catch and fall back to Discover.
- `Alerts.tsx:51-53, 68-70`: `KIND[a.kind].group` throws for a kind the bundle does not know (a cached old bundle with a
  newer `latest.json`). Use `KIND[a.kind]?.group`.

### 17. LOW — workflow inputs interpolated into shell commands — CONFIRMED (pattern)

`diagnose.yml:53, 59, 69` put `${{ inputs.videos }}`, `${{ inputs.batch }}`, `${{ inputs.benchmark* }}` unquoted into
`run:` lines of steps whose env carries `YOUTUBE_API_KEY`; `qa.yml:36` interpolates `inputs.site` inside quotes. Anyone
who can dispatch the workflow (write access) can run arbitrary shell with the key in the environment. Pass inputs
through `env:` and reference `"$VAR"`.

### 18. LOW — quota ledger durability — CONFIRMED (path)

`youtube.ts:338` saves the ledger once at the end of `collectYouTube`; a crash or job timeout after charts/discovery
loses that spend (the yield ledger is saved earlier, `:261`, so the two drift). `writeJson` (`store.ts:244-248`) is not
atomic; a truncated `cache/youtube-quota.json` makes `loadLedger` (`:84-88`) start the day at 0 units / 0 searches.
Save after each phase and write via temp file + rename.

### 19. LOW — documentation vs code, and process — CONFIRMED

- `predict.ts:50, 58` restrict every strategy to `VIEW_PLATFORMS`, so the Bluesky branches at `:156, :158` are dead;
  `docs/PREDICTIONS.md` ("Bluesky: ≥5,000 likes", "≥1,000 likes") describes behaviour that cannot occur.
- "Append-only" is a convention only: commit dd0c727 rewrote `crossings.ndjson` by hand. A cheap guard in
  `collect.yml` (the new file must start with the previous content) would make the no-hindsight claim checkable.

---

## Checked and found sound

**predict.ts** — predictions freeze inputs at prediction time; `attachHistory` filters `t <= now`; nothing rewrites a
prediction after it is appended; `openKeys` suppresses re-prediction per strategy for 10.5 days (`OPEN_HOURS` matches
`run.ts:107`); `done` prevents re-evaluation; "unobserved" rows are excluded from `evaluated`, `precision`,
calibration and `byKind`; pending is never a success anywhere (`buildScorecard` cells, `recent.status`,
`Scorecard.tsx`, `health.tsx`); precision/recall/calibration are `null` below 10/10/20; prediction ids are unique per
run × strategy × platformId (one `VideoRecord` per platform+id via `exampleKey`); cohort ages are correctly shifted to
prediction time, each cohort video is counted once, the predicted video and other platforms are excluded, ties favour
the prediction; `hitFloorAt` is frozen for `age + H` and used in preference to a recomputation; new predictions
(`predictedAt = now`) can never precede a crossing detected in the same run (`crossed.t < now`).

**run.ts wiring** — observations are appended (step 4) before histories are reloaded and predictions evaluated (8c), so
the current tick is visible; `predictionsAll`/`outcomesAll`/`crossingsAll` default to `[]` when files are absent;
`previous` (latest.json) absent → empty featured/hot/trend terms/alert history, no crash; missing YouTube key →
source "disabled", oEmbed enrichment instead, no channel/quota calls, ledger-dependent stats default to 0; a failing
source serves its cache with `ok:false` and does not write new ticks; fixture mode records no predictions/outcomes but
still builds a scorecard; writes are append-only (`appendNdjson`) and `scorecard.json`/`latest.json` are rebuilt each run.

**discovery.ts / youtube.ts** — `allowance()` clamps to [1, MAX_PER_RUN] with budget-exhausted → 0, first run of the
Pacific day → rate 2 → 2 searches, cadence floored at 1/h and capped at 4/h (covered by `discovery.test.ts`);
`choose()` honours cooldowns, is deterministic per seed, explores the least-run probe, never returns more than `n`
picks, so a run cannot exceed its allowance even when calls fail (`spentThisRun` is only not incremented on a throw,
and `searchOnce` refuses once `searchCalls ≥ SEARCH_BUDGET`); `spend()` is charged *before* each request (failed calls
count); `canSpend` caps units at `UNIT_BUDGET`; `videos.list`/`playlistItems.list`/`channels.list` at 1 unit per call
and baselines at 2 match the documented costs; `measure()` credits a probe only with ids not in the 30-day known set and
not already seen this run (chart results and page-1 results are not re-credited to page 2); `wantsDepth` requires
`pages ≥ 2`, 40 returned and 8 eligible; the quota day is the Pacific date (`quotaDay`, `hoursLeftInQuotaDay` with the
`% 24` guard); every `fetchJson` error inside the collector and `fetchChannelData` is redacted with `split(apiKey)`
before it reaches `errors` → `sources.json`/`latest.json`/the step summary; the Shorts self-test refuses to write the
cache when long videos answer 200 or when ≥20 sub-minute ids yield zero Shorts; hot-channel uploads are rate-limited
to 30 channels per run and 6 h per channel, filtered to ≤72 h-old uploads.

**videos.ts / formats.ts / desk.ts / alerts.ts / health.ts** — `hitFloorViews` is monotonic and log-linear with the
documented anchors (1 M/24 h, 2 M/72 h, 3 M/7 d, 5 M/30 d), unknown age → 5 M; `kind` is assigned exactly once per
record: `verified_hit → established`, `resurging → delayed` (>7 d, ≥5 K/h, ≥3×/5× lifetime), measured/young/outlier →
`early`; every `early_breakout` YouTube record has a finite `ageHours` (all branches require it), so `hitFloorAt` is
never computed from `age 0`; the acceleration guard requires ≥1,000 views (≥20 likes) gained in *both* intervals and a
positive previous rate; `confidenceBandOf` thresholds are as documented; `classifyOpportunity` ordering (news →
calendar → fragment → live → release/entity → title-share → dominance → ≤2 creators → format → broad tag → structured
format → meme) is consistent with `docs`, and `desk.ts` consumes hook keys that `HOOKS` actually produces; Desk
excludes fragments, live-heavy, uncertain, unqualified-generic and >80-creator pools, caps 2 per category / 8 total,
and `skip` never ships; alerts dedupe per `kind:subject` with a 48 h cooldown including within one run, keep 7 days,
cap 150, and crossings alerts only fire for crossings ≤24 h old; `recordHealth` dedupes by `runId`, bounds the log
(300/96), and `startRate` is null under 2 h of coverage; `notify.ts` never prints the webhook URL (URLs stripped from
error messages).

**Workflows** — the YouTube key and webhook URL are only ever passed as step `env` (GitHub masks them in logs) and
nothing writes them to `data/`; `secrets: inherit` on the sibling callers with permissions ≥ the called jobs'; the
freshness gate skips only `schedule` events, leaves `workflow_dispatch` ungated, and its outputs correctly gate
`publish`; the Pages publish has its own job-level `concurrency: pages` (which *does* apply when called); the build
cache key covers every runtime import the web bundle takes from the pipeline (`types.ts` is type-only, `taxonomy.ts`
has no imports, `predict` is imported as a type) plus `web/src/**`, `index.html`, vite/tsconfig/package files and the
lockfile; data files are copied after the cache restore so a cached bundle ships fresh data; `git add data` commits
only public collection output (no secrets, no private browser data — the journal never leaves localStorage).

**Web** — no `dangerouslySetInnerHTML`/`innerHTML`; all `href`s are either app hashes with `encodeURIComponent`,
constructed YouTube URLs from regex-validated ids, or record URLs that the pipeline only accepts through
`isVideoUrl`/`youtubeId` (http(s) hosts) and the critical "evidence links are absolute http(s) URLs" gate; embeds are
built from validated ids (`embedFor`), external links use `rel="noopener noreferrer"`; thumbnails use
`referrerPolicy="no-referrer"`; every page handles a snapshot without `desk`/`alerts`/`health`/`scorecard`/`videos`
(`Desk.tsx:31`, `Scorecard.tsx:28`, `Alerts.tsx:39`, `health.tsx:19-27`, `Discover.tsx:21-37`, Settings coverage/funnel
notices); the hash router strips query strings before matching and `#/desk?o=` re-reads on `hashchange`; `localStorage`
reads/writes are wrapped in try/catch everywhere (`store.ts`, `App.tsx:74,90`, `Alerts.tsx:24-31`); the player modal is
`role="dialog" aria-modal`, takes focus and closes on Escape; nav/menus carry `aria-label`/`aria-expanded`/`role=menu`,
icon buttons have `aria-label`s, tables have header rows, images are decorative (`alt=""`). Minor non-blocking a11y
gaps: the More menu/sheet have no Escape or arrow-key handling, filter segments lack `aria-pressed`, and the Settings
tabs are plain buttons.

---

## Resolution (owner's session, same day)

| # | status | what changed |
|---|---|---|
| 1 | fixed | `pointAt` evaluates only once `elapsed ≥ H`, takes the first observation **with the metric** at or after H (inside 1.5 H); the [0.85 H, H) stand-in is used only after 1.5 H with nothing later. New test: "pending at 20.6 h with a 20.5 h tick; the 24.15 h tick wins over the 20.5 h one; stand-in only after 1.5 H". |
| 2 | fixed | open-prediction ids are added to `knownYt`/`firstSeenById` (so they stay in the tracking set) and the metric history is loaded for the union of the 30-day direct ids and the open predictions' video ids (12-day window). |
| 3 | fixed | a crossing requires the last below-floor observation to be **after** the first prediction; `lastBelowAt` is recorded; lead time is measured to that observation; the eight release-day rows were removed (no `lastBelowAt`), documented in docs/PREDICTIONS.md. |
| 4 | fixed | `concurrency: collect` added to collect-b/c/d.yml. |
| 5 | mitigated | the collector now stops spending for the quota day on the first `quotaExceeded`/403 (`ledger.exhaustedAt`) and reports it; the 1-unit/own-bucket model stays (verified on the project's quota page on 2026-10-28 during 3.0; re-verify after the first full day of 4.0 cadence against the console graph). |
| 6 | fixed | `published` uses the gate's exported `CRITICAL_CHECKS` (plus "some source succeeded"). |
| 7 | fixed | journal import validates every row (`validItem`) in both modes, preferences are whitelisted, `readList`/`read` sanitise what is stored, pills fall back on unknown values. |
| 8 | fixed | rows older than 60 days are moved verbatim to `data/predictions/archive/<month>-*.ndjson`; prediction rows carry ≤6 history points and ≤3 reasons. |
| 9 | fixed | only a redirect to `/watch` means `not_short`; any other redirect is `unknown`; `not_short` verdicts expire after 30 days; ids without a known duration are skipped. |
| 10 | fixed | observations without the metric are ignored when choosing the horizon observation. |
| 11 | fixed | a failing probe records a zero-yield entry with `lastAt`, so its cooldown applies. |
| 12 | fixed | zero-search sources (hot-channel uploads) are recorded under `today.uploads`, outside the per-search figures. |
| 13 | fixed | the Actions history export merges all four collector workflows. |
| 14 | fixed | scorecard outcome counts are filtered to the predictions in the window. |
| 15 | fixed | `observations` = max(history points, 1) + shares. |
| 16 | fixed | Settings is keyed by hash (tab links switch), alert state is shared between the bell and the page, malformed `#/trend/` hashes no longer throw, unknown alert kinds render. |
| 17 | fixed | workflow inputs are passed through `env:` in diagnose.yml and qa.yml. |
| 18 | fixed | the quota ledger is saved after charts, discovery (incl. on probe failure) and tracking; `writeJson` writes to a temp file and renames. |
| 19 | fixed | docs/PREDICTIONS.md no longer describes Bluesky predictions and documents the crossings purge and the archive policy. |
