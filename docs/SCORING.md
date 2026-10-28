# Scoring

All scores are 0–100 and are computed in `pipeline/src/intel/score.ts`; the dashboard shows every component on a
trend's detail page. Nothing is invented: when a quantity cannot be measured it is neutral and labelled provisional.

## 1. Attention level (signal, 0–1)

Each observation is normalised on a log scale within its own evidence kind so unrelated metrics become comparable:

| kind | formula |
|---|---|
| search spike | `logNorm(approxTraffic, 100, 1,000,000)` |
| hashtag | `max(logNorm(uses/day, 10, 5,000), logNorm(views, 1e5, 1e9))` |
| social topic | `0.35 + 0.45 × (1 − (rank−1)/25)` |
| video with views | `logNorm(views, 10,000, 50,000,000)` |
| video without views | `logNorm(likes + 2×reposts, 20, 5,000)` |
| post | `0.6 × logNorm(likes + 2×reposts, 20, 5,000)` |

Cluster signal = strongest item + 0.25 × `logNorm(items, 1, 40)` + 0.15 × second-strongest, capped at 1.

## 2. Momentum (0–100)

`100 × (0.25 recency + 0.30 growth + 0.10 acceleration + 0.20 breadth + 0.15 level)`

- **recency** — `0.6 × 0.5^(hours since last seen / 24) + 0.4 × 0.5^(hours since latest publish / 48)`
- **growth** — ratio of the cluster signal now vs. the previous scoring run (≥2h apart), mapped with
  `0.5 + log2(ratio)/4` (0.25× → 0, 1× → 0.5, 4× → 1). If the source supplies its own series (Mastodon 7-day history)
  that growth is used on the first run and blended in at 40% afterwards. **No history → 0.5 and `momentumBasis =
  provisional`.**
- **acceleration** — change in growth between the last two intervals (0.5 = steady); needs ≥3 runs.
- **breadth** — `0.5 × sources(1→0.3, 2→0.7, 3+→1) + 0.5 × logNorm(items, 1, 30)`
- **level** — the cluster signal.

Recency + growth + acceleration carry 65% of the weight so emerging trends can outrank established popularity.

## 3. Evidence confidence (0–100)

`100 × (0.30 logNorm(support, 1, 25) + 0.25 sources + 0.25 min(videosWithStats/5, 1) + 0.10 logNorm(creators+1, 1, 15) + 0.10 logNorm(runs + historyPoints, 1, 48))`

`support` = items + up to 6 extra units from hashtag "accounts" (15 accounts ≈ 1 item). A single hashtag or a lone
search spike cannot exceed roughly 30 — that is intended: one signal is "Insufficient data" until corroborated.

## 4. Monetization opportunity (0–100)

From the category's editorial profile (0–1 each; `pipeline/src/intel/taxonomy.ts`):

`100 × (0.30 advertiser + 0.20 sponsorship + 0.15 affiliate + 0.15 longevity + 0.10 demand + 0.10 (1 − cost))`
+5 when YouTube videos are present; ×0.55 for news/person events.

| Category | adv | spons | affil | repeat | longev | cost | demand |
|---|---|---|---|---|---|---|---|
| Entertainment | .70 | .60 | .40 | .80 | .40 | .30 | .90 |
| Comedy | .75 | .60 | .30 | .90 | .60 | .30 | .90 |
| Animation & Art | .80 | .60 | .50 | .70 | .80 | .70 | .70 |
| Music | .70 | .50 | .40 | .80 | .70 | .50 | .90 |
| Animals & Pets | .90 | .60 | .70 | .90 | .80 | .20 | .95 |
| Gaming | .80 | .80 | .70 | .90 | .60 | .30 | .90 |
| Film & TV | .80 | .50 | .50 | .80 | .50 | .30 | .85 |
| Tech & AI | .90 | .90 | .90 | .80 | .50 | .40 | .80 |
| Sports | .85 | .70 | .50 | .80 | .30 | .30 | .90 |
| News & Politics | .30 | .20 | .10 | .70 | .10 | .20 | .90 |
| Seasonal & Holidays | .90 | .70 | .80 | .60 | .40 | .30 | .85 |
| Lifestyle | .90 | .90 | .95 | .90 | .60 | .40 | .85 |
| Food & Cooking | .90 | .80 | .80 | .90 | .80 | .40 | .85 |
| Science & Education | .90 | .70 | .50 | .80 | .90 | .50 | .70 |
| Business & Finance | .95 | .90 | .90 | .80 | .60 | .30 | .70 |
| Photography & Visual | .80 | .70 | .80 | .90 | .70 | .30 | .50 |
| Other | .60 | .40 | .30 | .50 | .40 | .40 | .50 |

These are assumptions informed by public creator-economy reporting (advertiser-friendly guidelines, typical
sponsorship demand per niche, affiliate fit). They are deliberately editable and documented, not measured payouts.

## 5. Creator opportunity (0–100)

Base (pipeline): `100 × (0.35 momentum/100 + 0.20 repeatable + 0.15 (1 − saturation) + 0.15 (1 − cost) + 0.15 monetization/100)`, ×0.45 for news/person events.
`saturation = (signal − 0.75) × 4` when signal ≥ 0.75 and growth ≤ 0.55 (high and flat), else 0.

Personalised (dashboard, from Settings): +10 if the category is one of your interests, +5 if the trend fits your tools
(animation, AI video, music, audio), +6 for lifecycle stages matching your risk appetite.

## 6. Opportunity rank (Top 20 order)

`(0.40 momentum + 0.35 creator + 0.25 monetization) × (0.3 + 0.7 × confidence/100)`

## 7. Lifecycle stage

| stage | rule |
|---|---|
| Insufficient data | confidence < 20 or fewer than 2 items |
| Cooling | last seen > 36h ago, or measured growth ratio < ~0.9× |
| Breaking out | momentum ≥ 70 and ≥ 2 sources (and growth not falling) |
| Accelerating | measured growth ≥ ~1.3× with steady/positive acceleration |
| Peaking | high level (≥ 0.65) with flat growth |
| Emerging | first seen ≤ 48h ago (provisional: momentum ≥ 40) |

## 8. Clustering (how trends and microtrends are formed)

1. Seeds from topic-like evidence (search terms, trending topics, hashtags); identical normalised keys merge across regions/sources.
2. Seeds merge when title tokens overlap (Jaccard ≥ 0.5 or full containment).
3. Posts/videos attach to the seed whose core tokens they cover (≥ 60%), IDF-weighted; topic-feed posts attach to their topic.
4. Remaining posts: a hashtag or title bigram shared by **≥ 3 distinct creators** becomes a new microtrend (e.g. `#emojisounds`).
5. Remaining posts from a creator-format query (e.g. "cat video") form a format-level cluster.

Parent category and subcategory come from weighted keyword matching over the cluster's titles, descriptions and tags
(`taxonomy.ts`); the microtrend is the cluster itself. Search-only spikes that name no content category, and anything
matching news patterns (vs./live/score, election, crash, rankings…), are flagged as news/person events.

## 9. Scoring history

Every run appends one record per trend to `data/history/scores/YYYY-MM-DD.ndjson` (momentum, confidence,
monetization, creator, signal, lifecycle, evidence count). The next run reads it back to compute growth and
acceleration, and the dashboard draws each trend's momentum sparkline from it. Retention: 35 days (`VR_RETENTION_DAYS`).

## Colours (dashboard)

Score hues (amber momentum `#c4860f`, aqua money `#1fa586`, violet creator `#8c7cf0`) and lifecycle hues were validated
for colour-vision deficiency and contrast on the dark surface `#151d2a` (worst CVD ΔE 11.4 all-pairs for the score set;
lifecycle set in the 6–8 warn band, so every stage always carries its text label and glyph).
