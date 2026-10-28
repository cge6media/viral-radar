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

GitHub Actions "Collect trends" #4 (2.0 pipeline): `collect` ✓ (gate: true), `publish` ✓. The site at
https://cge6media.github.io/viral-radar/ serves snapshot version 2 (verified by fetching `data/latest.json`).

---

## 1.0 results (kept for history)

23/23 tests; two successful live runs (920 and 903 observations); independent review with 10 findings fixed;
desktop + iPhone rendering; Pages deployment verified.
