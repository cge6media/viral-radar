# Viral prediction scorecard (4.0)

**Purpose.** 3.0 measured discovery against lists of videos that were already popular. 4.0 records what the radar
claims *before* the outcome is known and scores it afterwards, so the product can show whether its early
recommendations are useful — and whether a simple strategy would do as well.

## Records (append-only, in the repository)

- `data/predictions/predictions.ndjson` — one immutable `PredictionRecord` per video × strategy per episode: video,
  creator, prediction time, age, verified views/likes, lifetime rate, measured velocity and interval, acceleration,
  creator baseline ratios, breakout/viral scores, confidence band, kind, the reasons, the observation history known
  at that moment (≤8 points, none after the prediction time), the horizons (24 h / 48 h / 72 h / 7 d) and the
  **age-appropriate hit floor frozen for each horizon** (the floor the video must reach at the age it will have).
  A video with an open prediction (≤10.5 days) is not re-predicted for the same strategy; it stays in the priority
  tracking set so its outcomes get observed.
- Three strategies per run, from the same pool of verified, non-hit videos: **radar** (the Early Radar top-20),
  **views** (the 20 biggest non-hit videos ≤72 h old by raw views) and **velocity** (the 20 fastest by measured
  views/hour). The baselines exist so the radar's skill can be compared with the obvious alternatives.
- `data/predictions/outcomes.ndjson` — one `OutcomeRecord` per prediction × horizon, written by a later run from
  the observation closest to the horizon inside [0.85 H, 1.5 H]. Until it is due: **pending**. If the window passed
  without any observation: **unobserved** (excluded from precision; never a miss, never a success).
- `data/predictions/crossings.ndjson` — videos that crossed their hit floor while they had been in the index for
  ≥6 h (so a prediction was possible), with the first radar prediction before the crossing and the lead time.
- `data/predictions/scorecard.json` — the aggregate (rebuilt each run), summarised in `latest.json.scorecard`.

## Criteria (each reported on its own)

| criterion | definition |
|---|---|
| reachedHit | views at the horizon ≥ the frozen floor (Bluesky: ≥5,000 likes) |
| multiplied | ≥2× the views at prediction **and** ≥100K gained (≥1,000 likes on Bluesky) |
| accelerated | average rate since prediction ≥ the rate known at prediction (velocity, else lifetime average) |
| outperformedCohort | the gain ranks in the top 10 % of tracked videos of comparable age (½×…2×) observed over the same window; null below 20 comparable videos |
| creatorJump | channel subscribers ≥ +5 % between the readings; null without both |
| formatSpread | a trend the video belonged to gained ≥2 independent creators; null without a membership |
| **breakout** (headline) | reachedHit **or** multiplied |

Precision at a horizon is stated only from ≥10 evaluated predictions; recall is stated only from ≥10 observable
crossings; calibration (empirical 48 h breakout rate by breakout-score band) only from ≥20 per band. Before that
the page shows counts and "pending", not percentages. Scores are descriptive, never probabilities.

## No hindsight

A prediction is written in the run that makes it, from that run's data; later runs only *read* it. Evaluation uses
observations at or after the horizon. Nothing is retroactively changed when a video succeeds; a video that was
never predicted and crossed the floor counts as a **missed** crossing. Unit tests
(`pipeline/test/predict.test.ts`) use synthetic histories to check: predictions freeze inputs; nothing is due
before the horizon; the closest observation is used; "unobserved" after 1.5 H; no re-evaluation; precision is null
below ten; lead time and recall from crossings.

## Status at release (2026-10-28)

Recording started at 10:58 UTC on release day. Until the first 24 h have elapsed every horizon is pending; the
first precision figures appear after ≥10 radar predictions have been evaluated at 24 h, the 7-day figures a week
later. The report in `docs/PROGRESS.md` states the live counts at the time it was written.
