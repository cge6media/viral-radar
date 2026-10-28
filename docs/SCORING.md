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
- **Category adoption** — `0.75 · logNorm(independent creators, 1, 12) + 0.25 · min(new creators in 48h / 4, 1)`.
- **Audience interest** — strongest indirect signal (search spike `logNorm(traffic, 100, 1e6)`; hashtag uses
  `logNorm(uses, 10, 5000)`; topic rank; post engagement; share engagement) + 15 % of the second + a small
  breadth term.
- **Confidence** — 25 % `logNorm(videos, 1, 15)` + 25 % `min(direct videos / 4, 1)` + 20 % creators (scaled by the
  verified-creator share) + 15 % independent sources (1 → 0.3, 2 → 0.7, 3+ → 1) + 15 % observation history.
- **Recency** — 50 % half-life 24h on the latest content time + 50 % half-life 48h on the median content time.
- **Cluster growth** — measured from score history ≥2h old: independent creators now ÷ then (or the adoption
  signal), `0.5 + log2(ratio)/4`; a Mastodon 7-day series is used on first sight and blended at 40 % afterwards
  (last complete day vs. earlier days; today only when ≥8h elapsed and stronger pro-rated). Otherwise 0.5 and
  *provisional*.

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
| Strong | ≥3 verified creators **and** ≥3 directly measured videos **and** ≥3 collection runs |
| Developing | ≥3 verified creators and ≥3 verified examples |
| Early | ≥1 video with ≥2 creators or audience interest ≥ 50; or ≥2 signals with interest ≥ 60 and no video |
| Insufficient | anything else — never recommended |

Verified = measured on its platform (`direct`) or confirmed by the YouTube API / oEmbed (`verifiedAt`).

## Qualification (what can be recommended)

`grade ≠ insufficient` **and** not a news/person event **and** (not a generic evergreen format, or its growth is
measured ≥ 1.5×) **and** (not a bare topic, or it has ≥2 related videos). Rankings are never padded.

## Lifecycle

| stage | rule (evaluated top-down) |
|---|---|
| Insufficient data | grade insufficient |
| Cooling | latest content > 72h old; or velocity ≤ 0.6× with no new creators; or measured growth < ~0.8× |
| Breaking out | momentum ≥ 70, ≥2 sources, and (accelerating or ≥2 new creators) |
| Accelerating | measured: velocity ≥ 1.3× or creator growth ≥ ~1.32× — never without a measurement |
| Peaking | evergreen format pools (steady); or performance ≥ 60 / ≥ 6 creators with flat growth |
| Emerging | first seen ≤ 48h, or ≥2 new creators within 96h |

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
