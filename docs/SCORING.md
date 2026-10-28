# Scoring (Viral Radar 2.0)

Everything is computed in `pipeline/src/intel/score.ts`, **per time window** (24h, 48h, 7d), from evidence whose
*content time* falls inside the window. Content time = the video's publish time (from its platform), a native
post's time, or a signal's observation time. The time a post *shared* an external video is never its publish time.
Nothing is invented: a component is `null` when its measurement does not exist, and growth is marked
*provisional* until two observations ≥2h apart exist.

## Evidence model

| field | meaning |
|---|---|
| `level: direct` | the item was measured on the platform that hosts the video (YouTube Data API record; native Bluesky video with its own engagement) |
| `level: indirect` | a share of an external video (its stats are unknown until verified), a search spike, a hashtag, a post |
| `metrics` | the item's own statistics (empty for an unverified share) |
| `postMetrics` | engagement of the social post that carried an external video |
| `videoPublishedAt / postPublishedAt / firstSeenAt / observedAt / verifiedAt` | kept apart on purpose |

Independent creators are counted by channel/author; the same video shared by many accounts is one example.
Unverified shares count a *sharer*, which is why they cannot raise the evidence grade above *early*.

## Components (0–100; `null` = not measurable)

- **Video performance** — for directly measured videos: views per hour since the video's own publish time,
  `logNorm(rate, 50, 100,000)`; without views, engagement (likes + 2·reposts + comments) per hour,
  `logNorm(rate, 0.5, 300)`. Cluster value = 70 % of the best video + 30 % of the median. Age-normalised, so a
  30-minute-old video is not compared to a 30-day-old one on raw counts.
- **Video momentum** — the same videos re-measured across runs: (views gained per hour over the last ≥1h interval)
  ÷ (lifetime average views per hour). Median ratio → `0.5 + log2(ratio)/4` (1× = 50). Needs ≥2 observations.
- **Category adoption** — `0.75 · logNorm(independent creators, 1, 12) + 0.25 · min(new creators / 4, 1)`. A
  creator is *new* when their first video in the cluster (over the whole cluster, not just the window) is ≤48h old
  (≤24h in the 24h view) — so an old trend does not look "all new" in a short window.
- **Audience interest** — strongest indirect signal (search spike `logNorm(traffic, 100, 1e6)`; hashtag uses
  `logNorm(uses, 10, 5000)`; topic rank; post engagement; share engagement) + 15 % of the second + a small
  breadth term.
- **Confidence** — 25 % `logNorm(videos, 1, 15)` + 25 % `min(direct videos / 4, 1)` + 20 % creators (scaled by the
  verified-creator share) + 15 % independent sources (1 → 0.3, 2 → 0.7, 3+ → 1) + 15 % observation history.
- **Recency** — 50 % half-life 24h on the latest content time + 50 % half-life 48h on the median content time.
- **Cluster growth** — measured from score history ≥2h old, **like for like**: the window's independent-creator
  count now ÷ the same window's count at the earlier run (24h vs 24h, 7d vs 7d; the history stores all three),
  `0.5 + log2(ratio)/4`. Records without creator counts (1.0 history) are skipped, never substituted. A Mastodon
  7-day series supplies *daily hashtag use* growth on first sight (last complete day vs. the prior-day average;
  today only when ≥8h elapsed and stronger pro-rated) and is blended at 40 % afterwards. Otherwise 0.5 and
  *provisional*. The UI labels which metric and comparison each ratio comes from, and switches from a percentage
  to "×N" above 5× (a hashtag going from ~0 to 114 uses/day is "×115", not "+11400 %").

## Composites

- **Momentum** = 30 % adoption + 25 % measured signal (video momentum → video performance → audience interest,
  first available) + 20 % recency + 15 % audience interest + 10 % growth.
- **Monetization suitability** (category profile, editorial) = 30 % advertiser + 20 % sponsorship + 15 % affiliate +
  15 % longevity + 10 % demand + 10 % (1 − cost); ×0.55 for news/person events. Profiles are in `taxonomy.ts`.
- **Creator opportunity** = 35 % momentum + 20 % repeatability + 15 % (1 − saturation) + 15 % (1 − cost) + 15 %
  monetization suitability; ×0.45 news, ×0.8 generic. The dashboard adds +10 (interest), +5 (tools), +6 (appetite).
- **Opportunity** = (40 % momentum + 35 % creator + 25 % monetization) × (0.3 + 0.7 · confidence) × grade factor
  (strong 1.0, developing 0.9, early 0.72, insufficient 0.4).

## Evidence grades

| grade | rule |
|---|---|
| Strong | ≥3 verified creators **and** ≥3 directly measured videos **and** seen across ≥3 collection runs spanning ≥6 hours |
| Developing | ≥3 verified creators and ≥3 verified examples |
| Early | ≥1 video with ≥2 creators or audience interest ≥ 50; or ≥2 signals with interest ≥ 60 and no video |
| Insufficient | anything else — never recommended |

Verified = measured on its platform (`direct`) or confirmed by the YouTube API / oEmbed (`verifiedAt`).

**Shares-only cap.** A cluster whose examples are all social *shares* of videos (no example measured on its
platform and no verified publish date) is capped at *Early*, even when oEmbed has confirmed the channels: people
passing around existing videos is audience interest, not creator adoption, and without the platform's statistics
and publish dates there is no way to tell a new wave from an old video doing the rounds. The note on the trend
says so; the YouTube API key lifts the cap by supplying both.

## Qualification (what can be recommended)

`grade ≠ insufficient` **and** not a news/person event **and** (not a generic evergreen format, or its growth is
measured ≥ 1.5×) **and** (not a bare topic, or it has ≥2 related videos). Rankings are never padded.

## Lifecycle

| stage | rule (evaluated top-down; `decideLifecycle` in score.ts) |
|---|---|
| Insufficient data | grade insufficient |
| Cooling | latest content > 72h old; or velocity ≤ 0.6× with no new creators; or measured growth < ~0.8× |
| Breaking out | momentum ≥ 70, ≥2 sources, and (accelerating or ≥2 new creators) |
| Accelerating | measured: velocity ≥ 1.3× or creator growth ≥ ~1.32× — never without a measurement |
| Peaking (format pools) | an evergreen format pool with ≥3 creators is steady, never "emerging" (fewer → cooling) |
| Emerging | the cluster's first content/detection ≤ 48h ago, or ≥2 new creators within 96h — cluster age, not window age |
| Peaking | performance ≥ 60 or ≥6 creators with flat growth; otherwise peaking unless the latest content is > 36h old (→ cooling) |

## Clustering

1. **Topics** seeded by Google Trends terms, Bluesky trending topics and Mastodon hashtags (merged on token
   overlap); posts/videos attach when they cover ≥ 60 % of the seed's tokens or come from the topic's feed.
2. **Microtrends** (video-first): hashtags and 2–3-word phrases from video-level text (handles, URLs and
   platform boilerplate stripped; a token in > 40 % of a ≥ 20-video corpus is ignored) shared by ≥ 3 independent
   creators; longer phrases win; overlapping clusters (Jaccard ≥ 0.6) merge; matching topic signals are attached
   as corroboration.
3. **Format pools**: relevance-validated videos per predefined format (`relevance.ts`), reported as category
   activity and "proven formats".

## Colours

Score hues (amber `#c4860f`, aqua `#1fa586`, violet `#8c7cf0`) and lifecycle hues were validated for colour-vision
deficiency and contrast on the dark surface; every stage and grade always carries its text label.


---

# Video-native intelligence (3.0)

Computed in `pipeline/src/intel/videos.ts` for every unique video of the last 30 days (full index in
`data/videos.json`; top lists in `latest.json → videos`). Video statistics and share engagement never mix.

## Measurements

| quantity | definition | when it exists |
|---|---|---|
| lifetime rate | views ÷ hours since the platform's publish time | verified publish date |
| velocity | views gained ÷ elapsed hours between two real observations ≥1h apart (up to 6 intervals, latest first) | ≥2 observations ≥1h apart |
| acceleration | latest interval rate ÷ previous interval rate | ≥3 observations |
| gained[1h…7d] | views gained inside a trailing window, only when observations bracket it (±25 %) | enough history |
| age percentile | lifetime rate vs tracked videos of comparable age (<6h, <24h, <72h, <7d, <30d; ≥8 per bucket) | cohort large enough |
| baseline ratio | views ÷ median views of the channel's last 20 uploads | baseline fetched (20 channels/run) |
| subscriber ratio | views ÷ subscribers | channel statistics fetched |
| like rate | likes ÷ views (hidden like counts → no claim) | likes reported |

## Evidence classes (per video)

| class | YouTube rule | Bluesky rule (own scale, never mixed) |
|---|---|---|
| **Verified viral hit** | ≥5M views within 30 days, or ≥1M views with ≥50K views/h (measured or lifetime) | ≥5,000 likes within 30 days |
| **Early breakout** | measured ≥10K/h with ≥50K views; or ≥3K/h accelerating ≥1.5× with ≥20K views; or ≤48h old averaging ≥10K/h with ≥100K views **and** above the creator's normal range (≥2× median upload or ≥0.5× subscribers); or creator outlier ≥20× median with ≥100K views ≤14d; or delayed: >30d old but measured ≥5K/h at ≥5× lifetime with ≥100K views | measured ≥100 likes/h with ≥500 likes; or ≤48h old averaging ≥50 likes/h with ≥500 likes |
| **Unverified signal** | shared by ≥3 accounts or ≥500 post likes, no platform statistics (TikTok/Instagram/Facebook links) | — |
| **Not featured** | below the 10K-view floor; below thresholds for its age; cooling (measured ≤0.3× lifetime over ≥6h); live stream / premiere / recording >3h; duplicate of a larger identical-title upload; paid-reach pattern (≥500K views, <0.05 % likes, ~no comments); >30d without measured resurgence | below 100 likes; below thresholds |

Every record carries plain-language `reasons` (the same facts the UI shows under "Why this video is here") and the
rule that rejected it (`rejectedBy`), which the discovery funnel aggregates.

## Scores (separate on purpose)

- **viral** (established popularity for its age) = 45 % log(views 100K…50M) + 25 % log(lifetime rate 1K…300K/h) +
  15 % velocity factor (0.5 when unmeasured) + 15 % like-rate factor (6 % = full).
- **breakout** (momentum) = 40 % log(growth rate 1K…200K/h; measured velocity, or the lifetime average only for
  videos ≤48h old) + 25 % acceleration/velocity ratio + 20 % outlier term + 15 % youth (≤7d); ×0.8 when the rate is
  provisional; 0 below 20K views.
- **engagement** = 80 % log(like rate 0.5 %…10 %) + 20 % log(comments/view); 0 below 10K views.
- **outlier** = log(baseline ratio 1…200×); 0 without a baseline.
- **confidence** = observations, measured velocity, baseline, cross-platform evidence, verified age.
- Ranked lists cap each creator at 2 entries. Viral Now = verified hits inside the publish window by viral score;
  Early Radar = breakouts by breakout score. Bluesky has its own two lists.

## Category waves (cluster level)

promising wave = ≥3 independent creators, ≥2 new in 48h, no measured decline (generic pools need ≥1.5× measured);
established = ≥6 creators, flat; crowded = ≥30 creators with weak video performance; declining = cooling or
measured <0.8×. Growth baselines only come from earlier runs with the **same active-source signature**, so turning a
source on never reads as growth.

# 4.0 — age-aware hits, breakout kinds, opportunity types, predictions

## Established vs early vs delayed (per video)

The 3.0 hit rule (5M views, or 1M with ≥50K/h) ignored age, so a 17-day-old 4.6M-view video ranked as an "early"
breakout. 4.0 uses an **age-appropriate hit floor** (`hitFloorViews` in `pipeline/src/intel/videos.ts`): 1M views
inside the first 24 h, 2M by 72 h, 3M by 7 days, 5M by 30 days, log-linear in between. Every verified video is
then one of:

| kind | rule | shown as |
|---|---|---|
| **established** | views ≥ floor(age), or ≥1M with a ≥50K/h rate | Viral Now (`verified_hit`) |
| **early** | below the floor, age ≤ 7 d, and a measured abnormal rate (≥10K/h with ≥50K views, or ≥3K/h accelerating ≥1.5× with ≥20K views), or a very young video with an exceptional average (provisional), or a creator outlier (≥20× the channel's median upload, ≤14 d) — all subject to the creator's normal range | Early Radar, "Early breakout" |
| **delayed** | age > 7 d, measured ≥5K/h and ≥3× the lifetime average (≥5× past 30 days), ≥100K views | Early Radar, "Resurfacing" — never ranked as a new upload |

Lifetime average, measured interval rate and acceleration stay separate fields; acceleration is only claimed when
both intervals gained ≥1,000 views (≥20 likes) so counting noise cannot produce a ratio. A single observation is
labelled provisional. `confidenceBand` (high ≥70, medium ≥45, low) is a descriptive band from the number of
observations, measured velocity, baseline availability and share corroboration — it is not a probability.

Shorts are labelled by the strongest evidence available: `verified` (youtube.com/shorts/<id> answers 200 — a HEAD
check with a self-test on long videos, cached in `data/cache/youtube-shorts.json`), `url` (a /shorts/ link was
shared), `duration` (≤180 s only → "short-form candidate" in the UI), `not_short` (the Shorts URL redirects to
/watch), or `none`.

Language is detected from the title and description (script, then stop-word voting; the uploader's declared
language wins when present). It is a filter for the owner's use (English / Spanish / other Latin-script / non-Latin)
and never a ranking factor.

## Opportunity types (per cluster)

`pipeline/src/intel/formats.ts` classifies every microtrend/format cluster from observable facts only — titles,
descriptions, statistics — never from imagined visuals:

- **event** — news/person event, a calendar moment, one video holding ≥75 % of the cluster's views, ≤2 creators,
  or news/sports/esports/release content (trailer, leak, episode, match, award).
- **meme** — ≥3 independent creators on one *specific* phrase/moment (name present in ≥40 % of titles, top video
  <60 % of views) with new creators in 48 h or a spread ≤7 days.
- **format** — a relevance-validated format with ≥4 creators, or a microtrend with ≥4 independent creators, top
  video ≤60 % of views, examples spread ≥48 h, and either a shared title signature (≥2 words used by ≥3 creators
  with the name in ≥50 % of titles) or ≥2 creators who repeat it.
- **uncertain** — broad/descriptor tags (#aianimation, #digitalart, #humor), title fragments ("from season 5",
  "siapa yang"), description boilerplate ("join discord": the phrase appears in <40 % of the titles), live-stream
  clusters, or too few examples.

`TrendFeatures` records the basis: creators, videos, dominance, repeat creators, spread, new creators, platforms,
short-form share, median duration, languages, title hooks (question, POV, when, versus, numbered, series,
challenge, reaction, transformation, storytime, tutorial, sensory, payoff, animated, AI, character, music,
escalation…), the shared signature words and the name shape.

## Creator Desk ranking

`pipeline/src/intel/desk.ts` turns formats and memes (and calendar events as "participate") into opportunities:
`score = 0.4·evidence + 0.3·timing + 0.3·fit`. *Evidence* = confidence, independent creators, direct statistics,
type confidence. *Timing* = emerging 80 · accelerating 90 · established 55–60 · resurfacing 65 · peaking 40 ·
cooling 15 (from the 7-day lifecycle and measured growth). *Fit* = category fit for AI/animation/characters/music
production (0.35) + tool fit from the observed hooks (0.25) + language fit en/es (0.2) + type fit (0.2). Actions:
`create_today` (format/meme, ≥4 creators, timing not peaking/cooling, evidence ≥55, fit ≥55 or an evergreen format
with fit ≥65, and an example ≥100K views), `participate` (calendar events with fit ≥50; crowded peaks),
`research` (strong evidence, moderate fit), `monitor` (<4 creators, early grade, small numbers), `skip` (cooling,
single events). At most two opportunities per category, eight in total; when fewer qualify, fewer are shown.

## Prediction scorecard

See `docs/PREDICTIONS.md`.
