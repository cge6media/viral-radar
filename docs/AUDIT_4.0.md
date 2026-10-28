# Viral Radar 4.0 — Stage 1 audit (2026-10-28, 10:20 UTC)

Measured against the deployed 3.0 release (`v3-stable` = `1ce4452`, live run `202610280952`). Numbers come from the
repository, the GitHub Actions API and the published data files, not from the 3.0 completion report.

## State verified

| item | measured |
|---|---|
| live site | https://cge6media.github.io/viral-radar/ serving run `202610280952_666ab1f609f9` (09:53 UTC) |
| 30-day index | 4,943 unique videos; 1,673 verified hits, 655 early breakouts, 2,614 rejected, 1 unverified signal |
| quota (Pacific day) | 1,442 / 9,000 units, 20 / 90 searches at 09:53 UTC |
| tests | 42/42 (`npm test`) |
| payload | `latest.json` 7.2 MB raw / 0.96 MB gzip (trends = 5.0 MB of it: evidence 2.5 MB, series 0.9 MB, windows 0.9 MB); `videos.json` 9.0 MB / 1.16 MB gzip |

## Collection health (GitHub Actions `collect.yml`, cron `7,37 * * * *`)

| metric | value |
|---|---|
| scheduled slots since the schedule went live (01:37 → 10:20 UTC) | 17 |
| scheduled runs that started | 9 (**53 %**) — exactly one per hour; the `:07` slot never fired |
| start delay of the runs that did fire | 8–23 min after the slot (mean 15) |
| success when started | 38/41 runs overall (3 failures were manual runs during the key setup); 9/9 scheduled |
| job duration | 0.8–2.5 min (collect) + ~1.5 min (publish) |
| unattended data age | collections at 08:01, 08:55, 09:53 → gaps of 54 and 59 min; the UI only flags "stale" after 2 h |

Conclusion: the collector is reliable when it runs, but GitHub drops about half of the 30-minute slots, so the
effective cadence is hourly and the "Updated 55 min ago" badge reads as fresh. Freshness has to be measured and
displayed as a state, and the schedule needs more chances to fire (§14 of the brief).

## The three questions

**A. Discovery — are we finding popular videos or only the giants?** Mostly the giants. Cycle-2 dev benchmark: 80 %
of the ≥10M-view references discovered, 18 % of the <10M ones. The schedule is a fixed 58-slot rotation that spends
the same two searches per run regardless of what each probe has been returning; nothing measures yield per probe.

**B. Early detection — before or after the breakout?** Mostly after. The Early Radar top-12 at 09:53 UTC were
2–17-day-old videos with 0.9–4.6M views gaining ~25–50K views/h: established hits that fall under the 5M-view hit
threshold, not videos at the start of an abnormal rise. Acceleration was undefined for 10 of 12 (tracking cadence),
and a 17-day-old 4.6M-view video ranked #2 — a resurgence, mislabelled as "early". Hit thresholds are not age-aware
(5M, or 1M with ≥50K/h) and there is no separation of *established / early / delayed* kinds.

**C. Creator value — repeatable formats or "a popular video exists"?** The top qualified trends were
`nationalblackcatday` / `National Black Cat Day` (a calendar day), `Mass Effect` (a game title), `from season 5`
(a phrase fragment), `#vtuber`, `#humor` (113 creators — a generic tag), `Fair Use`. Three of the top twelve are
usable creator formats (AI-generated video, puppet & character videos, animal comedy). Nothing separates a one-off
event from a meme from a repeatable format, and the Studio advice is built from whichever cluster ranks first.

## Highest-impact problems (in order)

1. No forward-looking measurement: nothing records what the radar predicted, so nothing can say whether it works.
2. Early Radar conflates established hits, young breakouts and resurgences; thresholds ignore age.
3. Trend recommendations surface tags/fragments/calendar days as "opportunities"; no event/meme/format distinction.
4. Discovery spends its 90 searches blindly; mid-size and regional breakouts are structural misses.
5. Half of the scheduled collections never start; the UI does not show it.
6. 7 MB payload: 5 MB of it is trend evidence the home page never shows.
7. Shorts are identified by duration ≤ 180 s alone.
