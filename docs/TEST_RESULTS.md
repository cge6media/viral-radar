# Test results

Environment: Anthropic cloud workspace (Ubuntu 24.04, Node 22.23, hostname `vm`, sandboxed; no access to any
personal machine, GPU or local service). Date: 2026-10-28 (UTC).

## Automated tests — `npm test` — 23/23 pass

| file | what it verifies |
|---|---|
| `pipeline/test/collectors.test.ts` | Google Trends RSS parser on the real US/GB feeds (titles, traffic "2000+" → 2000, pubDate → ISO, 3 news links, rank, region, shared key across regions); Bluesky trending topic → observation + feed URI; native video post (likes 3,077 / reposts 374, thumbnail) and external YouTube link keyed by video id (`yt:vEtbfzMLVWU`) with hashtags; adult-labelled / 🔞 posts dropped; Mastodon tag with sorted 7-day history (109 uses, 81 accounts); YouTube Data API item → Shorts URL + numeric stats; ISO-8601 duration parsing |
| `pipeline/test/intel.test.ts` | util normalisation / YouTube-id / hashtag extraction / tokeniser; taxonomy classification (Animals & Pets, Sports for "Fox World Series", Gaming › Horror Games, Music, Other) and news-event flagging; clustering (topic-feed posts attach to their topic, US+GB search spikes merge into one trend, format clusters, hashtag microtrend from ≥3 creators, no duplicate tag cluster); scoring (provisional on first sight with **no growth value**, observed growth with history, momentum rises when growing, cooling when falling, news penalties, monotonic bounded signal, lifecycle rules) |
| `pipeline/test/store.test.ts` | append-only NDJSON history with hour+metrics dedup, reload across runs, score history, source cache fallback |
| `pipeline/test/money.test.ts` | calculator maths: 1M Shorts views × 90% eligible × $0.06 = $54; expenses; net; ROI; break-even by views (11.1M/month ≈ 1.11M per video) and by output (each Short nets −$44.60 after its own cost → "more videos never break even"); long-form $4 RPM → $3,400 and 1 video covers fixed costs; not-eligible → $0 program revenue while sponsorship/affiliate count; no-cost case; negative inputs clamped; presets per platform; revenue monotonic from 100K to 100M views; Instagram has no per-view revenue |

## Independent review (separate agent, same session)

A reviewer that had not seen the code audited `money.ts`, `Money.tsx`, `score.ts`, `data.ts` against SCORING.md and
reported 10 findings; all were fixed and covered by tests: break-even "videos" ignored per-video cost (now a separate
by-output model), zero-cost wording, negative inputs, Mastodon partial-day bucket producing false "declining" growth,
undocumented ratio smoothing, blended ratio not surfaced, lifecycle fallthroughs mislabelling stale/weak trends,
doc/threshold drift, unclamped rank level and source mapping, narrow time windows keeping 7-day counts.

## Pipeline end-to-end (offline, real captured responses)

`npm run collect:fixtures` → 94 observations (17 Google Trends, 60 Bluesky, 17 Mastodon), 60 trends, including
`#musicchallenge` (11 YouTube links shared by 11 creators — the Bluesky #EmojiSounds daily music prompt),
`Animation (format)` (12 native Bluesky videos from 12 creators), `Spooky month stream schedules` (topic + 6 feed posts).
Source statuses, run id, generatedAt, retention and evidence links written to `data/latest.json`.

## Historical persistence & growth

Ran the pipeline twice (second run after shifting the first run's history 3h into the past): 94 observations loaded
from history, all 60 trends switched from `provisional` to `observed` growth with a 3h window and 2-point momentum
series; `data/history/observations/2026-10-28.ndjson` = 188 lines, `scores` = 120 lines. Exact duplicates within the
same hour were not re-appended.

## Web build & UI

- `tsc --noEmit` clean; `vite build` → 251 kB JS (80 kB gzip), 14 kB CSS.
- Rendered with headless Chromium at 1366×900 and 390×844 (iPhone): all seven sections + trend detail; **no
  horizontal overflow on any page** after fixes (`.app > * { min-width: 0 }`, wrapped error strings, nav scroll).
- Hash routing works for every section and for `#/trend/<id>` deep links.
- Browser console: no JavaScript errors (only blocked external image/font loads inside the sandbox).

## Live source verification (from the build session, 2026-10-28 00:15–00:25 UTC)

| source | result |
|---|---|
| Google Trends RSS (US, GB) | 200, 10 items each, parsed |
| Bluesky trending topics | 25 topics with feed links |
| Bluesky topic feed (Spooky month stream schedules) | 15 posts with engagement + embeds |
| Bluesky searchPosts (animation / cat video / ai video) | 25 posts each, 16 / 22 / 3 videos |
| Mastodon trends/tags | 20 tags with 7-day history |
| YouTube oEmbed | 200, title/author/thumbnail |
| YouTube Data API | not tested (no key) — documented schema only |
| TikTok Creative Center | page is a JS shell; JSON endpoint undocumented → opt-in, unverified |
| Reddit | blocked from this environment → not used |

## First live cloud run (GitHub Actions, 2026-10-28 01:05 UTC, run `202610280105_c0dfe3bdbe4f`)

Repository `cge6media/viral-radar`, workflow "Collect trends" #1, job `collect` → **success**, data committed by
`viral-radar-bot` (`data: collection 2026-10-28T01:05Z`).

| source | mode | items |
|---|---|---|
| Google Trends (US, GB, CA, AU) | live | 40 |
| Bluesky (25 topics, topic feeds, 20 format searches) | live | 861 |
| Mastodon (mastodon.social) | live | 20 |
| YouTube Data API | disabled (no key yet) | 0 |
| TikTok Creative Center | disabled (opt-in) | 0 |

920 observations this run → 140 trends, 47 with video evidence, 218 real videos linked. Findings fed back into the
pipeline the same session: stale "top" posts older than 14 days are now skipped, image-only posts dropped, bigrams that
restate a format query merge into the format cluster, news detection looks only at the topic text, provisional
lifecycle never claims "accelerating", history is stored as compact ticks (≥3h or ≥15% metric change).

`publish` job: failed at "Configure Pages" because GitHub Pages cannot be created on a private repository from the
workflow token (owner chose to make the repository public; publish re-run pending that change).

## Public deployment

Repository made public by the owner; "Deploy dashboard" #5 succeeded (GitHub Pages, environment `github-pages`).
`https://cge6media.github.io/viral-radar/` serves the dashboard and `…/data/latest.json` returns the live snapshot
(generatedAt 2026-10-28T01:05:29Z, sources google_trends/bluesky/mastodon = live). Verified by fetching both URLs
from the build session.

## Not yet verified

- YouTube Data API collection with a real key.

See RESUME.md for the exact steps.
