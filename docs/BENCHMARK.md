# Discovery accuracy benchmark (Viral Radar 3.0)

Tool: `pipeline/src/tools/benchmark.ts`, run on the GitHub runner (Actions → Diagnose → `benchmark: dev|holdout`).
Raw results: `data/benchmark/<timestamp>-<label>.json`, summaries `data/benchmark/<label>.md`.

## Method

**Positives — independent references.** Videos listed by public rankings that Viral Radar does not use for
collection, re-verified through the YouTube Data API at benchmark time:

- *dev set*: [ChartsList US Shorts chart](https://chartslist.com/youtube/shorts/us/) (most-viewed Shorts of the past
  14 days popular in the US, built from YouTube API data, updated daily, 48 ids on page 1) and
  [ShortsMonkey "Hot today"](https://www.shortsmonkey.com/en/hot-today) (Shorts that crossed ≥2M views — ≥1M for
  identified non-English languages — within 93 days, graded B/A/S, refreshed several times a day, 50 ids on page 1).
- *holdout set* (never used during optimisation): ChartsList Worldwide, Mexico and United Kingdom Shorts charts.

Both sites are current (updated 2026-10-27), expose the YouTube id of every entry (link/thumbnail), show views and
channel, cover regions (ChartsList, 24 countries) and languages (ShortsMonkey), and state their method. Neither
offers an API; their robots.txt allow the pages read here (ChartsList asks for a 5-second crawl delay, which the
tool respects, reading 2–3 pages per run). They are used only as an evaluation reference, never copied into the
product.

**Eligibility.** A referenced video counts as a positive when the API confirms it, it was published within the last
30 days (the index window) and has ≥500K verified views. Everything else is reported as ineligible, not as a miss.

**What is measured.** Recall (discovered by any collector; verified; qualified as hit/breakout; in the top-40 feed
lists), outcome per video with the exact failure reason (never discovered / discovered but unverified / verified
but rejected by rule X / qualified but below the cutoff), detection delay (publish → first observation), source
coverage of the discovered positives, precision@10/@20 of Viral Now 72h/7d and Early Radar against the stated
criteria (verified YouTube statistics, ≥1M views for hits / ≥50K for breakouts, inside the window), classification
agreement with the uploader's *specific* YouTube category, playback (embeddable flag + thumbnail reachability of
the featured videos), and **negative controls** drawn from our own store: Bluesky videos with <50 likes, videos
older than 30 days recently shared, duplicate re-uploads, live streams/recordings, unverified TikTok/Instagram
links, YouTube videos below the 10K-view floor, and the relevance validator's keyword-mismatch rate.

**Rules.** The benchmark only reads the store and the published lists; no benchmark id is added to any collector,
query or watch list, and the discovery schedule is not tuned to individual examples.

## Cycle 1 — baseline and the collection fix (2026-10-28)

| run | discovered | verified | qualified | in feed (top 40) | P@10 / P@20 Viral Now 72h | Early Radar P@10 | negatives leaked |
|---|---|---|---|---|---|---|---|
| **baseline** 04:51 UTC (charts + keyword probes only) | **4/98 (4.1 %)** | 4 | 4 | 1 | 100 % / 100 % | 100 % | 0 of 437 |
| after one round of query-less top-by-views probes, 04:56 | **40/98 (40.8 %)** | 40 | 40 | 7 | 100 % / 100 % | 100 % | 0 of 482 |
| after page-2 / 21-day / regional probes, 05:03 | **48/98 (49.0 %)** | 48 | 47 | 7 | 100 % / 100 % | 100 % | 0 |

Root cause confirmed: YouTube's `chart=mostPopular` is the Trending list, not a Shorts leaderboard, and keyword
probes only find what we already know how to name. 36 of the 40 newly discovered positives came from the new
`top:` probes. The 50 videos still missed at 05:03 were mid-size (median 3.9M views) and international Shorts 1–7
days old that do not reach page 1–2 of a 50-result probe, plus a 14.6-day-old #1 just outside the 14-day window →
rolling schedule (every region/category/window probed continuously), 21-day window, page 3 on 7d.

Detection delay for the discovered positives is dominated by the index's own age: the YouTube key went live at
03:52 UTC on the benchmark day, so a 10-day-old video necessarily shows ~240h of "delay". The meaningful number is
the delay for videos published *after* the index started, which the later cycles report.

Precision of the lists against the stated criteria was 100 % at @10 and @20 in every run — the rule judge is strict
but the lists are built by those rules; the manual audit of the top-20 titles (owner-facing) is in the cycle notes
below.

## Cycle 2 — engineering (classification, dedup, momentum, ranking)

Changes: rolling 2-searches-per-run discovery schedule (49 slots); platform category as a classification prior
(agreement on specific categories 36 % → 72 % offline); paid-reach pattern excluded (≥500K views with <0.05 %
likes, e.g. an 11M-view TV ad with 16 likes); growth baselines restricted to runs with the same active-source
signature (switching YouTube on had read as ×51 "growth"); ≤2 videos per creator in ranked lists; stream
recordings excluded.

Results: see the table appended below after the cycle-2 run.

## Cycle 3 — unseen holdout

Configuration frozen before the run; references never used before (Worldwide, Mexico, United Kingdom charts).
Results appended below.

## Honest limits

- Recall is bounded by the 100-searches/day quota: each probe returns 50 ids; ~90 probes/day cover roughly 4,500
  candidate slots across windows/regions/categories. Videos that are big only in a region or language we do not
  probe are structural misses, reported as such.
- Only YouTube supplies direct statistics; the benchmark's positives are therefore YouTube Shorts. TikTok,
  Instagram and Facebook cannot be benchmarked for recall until a data source exists (see docs/DISCOVERY.md §4).
- "In feed" counts the top-40 lists shipped in `latest.json`; the Viral Now page browses the whole index, so a
  "qualified, below the cutoff" video is still reachable by window and sort.
