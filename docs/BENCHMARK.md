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

Results (dev set, 2026-10-28 07:41 UTC, after 17 further collections with the rolling schedule):

| metric | value |
|---|---|
| discovered | **48/98 (49.0 %)** — ChartsList US 38/48, ShortsMonkey 10/50 |
| discovered, videos ≥10M views | 39/49 (80 %) |
| discovered, videos <10M views | 9/49 (18 %) |
| qualified as hit/breakout | 45/98 (3 verified-but-rejected: 1 paid-reach pattern, 2 below age thresholds) |
| in the top-40 lists | 7/98 (38 more are verified hits reachable on the Viral Now page by window) |
| precision@10 / @20 (Viral Now 72h, 7d, Early Radar) | 100 % / 100 % on all three |
| negative controls leaked | 0 of 121 low-engagement Bluesky, 0/10 duplicates, 0/103 streams, 0/177 unverified links, 0/139 sub-10K |
| classification agreement (specific YouTube categories) | 2,057/2,126 = **96.8 %** (36 % before the prior) |
| playback | 100/100 featured videos embeddable, 100/100 thumbnails reachable |

The remaining dev misses are ShortsMonkey's mid-size outliers (median 3.9M views): the top-50-by-views probes, even
day-sliced, are filled by larger videos. Reaching them needs more candidate throughput (pages 2–4 per day/region),
which the 100-searches/day quota does not allow; this is a quota ceiling, reported as such.

## Cycle 3 — unseen holdout (configuration frozen; references never used before)

ChartsList **Worldwide, Mexico and United Kingdom** Shorts charts, 2026-10-28 07:44 UTC: 82 unique videos, all
eligible.

| metric | value |
|---|---|
| discovered | **54/82 (65.9 %)** — Worldwide 25/48, GB 39/48, MX 38/48 (every entry ≥10M views) |
| discovered, published ≤7 days ago | **20/23 (87 %)** |
| discovered, 7–14 days old | 21 of the 28 misses sit here (median 27.8M views): worldwide kids'/international Shorts absent from every *regional* probe (the World #1, 166M views, 8.6 days old, among them) |
| qualified | 53/82 (1 paid-reach pattern rejected) |
| in the top-40 lists | 11/82 (42 more are verified hits reachable by window) |
| precision@10 / @20 | 100 % / 100 % on all three lists |
| negative controls leaked | 0 of 128 low-engagement Bluesky, 0/14 duplicates, 0/103 streams, 0/188 unverified links, 0/135 sub-10K |
| classification agreement | 2,322/2,420 = 96.0 % |
| playback | 100/100 embeddable, 100/100 thumbnails |
| detection delay, videos published after the index started | only 2 such videos discovered in the first 4 hours (1.7h median after publish) — the 24h top-50 is filled by 10–24h-old videos, so brand-new videos are rarely seen in their first hours |

**Measured improvement, baseline → holdout:** discovery of independently listed viral Shorts rose from 4.1 % to
49 % (dev) and 66 % (unseen holdout; 87 % for videos ≤7 days old), with precision and negative controls unchanged
at 100 % / 0 leaks.

**Identified weaknesses and the next practical improvements** (the first two were added to the schedule *after*
the holdout and are not yet benchmarked): global (no-region) 7-day and 21-day probes for worldwide giants; a 6-hour
fresh probe so videos are seen in their first hours; beyond that, candidate throughput is bounded by the
100-searches/day quota (a quota extension request or a second key per the API terms would raise the ceiling);
TikTok/Instagram/Facebook recall cannot be measured until a statistics source exists.

## Honest limits

- Recall is bounded by the 100-searches/day quota: each probe returns 50 ids; ~90 probes/day cover roughly 4,500
  candidate slots across windows/regions/categories. Videos that are big only in a region or language we do not
  probe are structural misses, reported as such.
- Only YouTube supplies direct statistics; the benchmark's positives are therefore YouTube Shorts. TikTok,
  Instagram and Facebook cannot be benchmarked for recall until a data source exists (see docs/DISCOVERY.md §4).
- "In feed" counts the top-40 lists shipped in `latest.json`; the Viral Now page browses the whole index, so a
  "qualified, below the cutoff" video is still reachable by window and sort.
