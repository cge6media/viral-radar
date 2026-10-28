# Discovery & viral-growth intelligence (Viral Radar 3.0)

## 1. Why 2.0 missed the videos people were actually watching

The 2.0 audit (docs/AUDIT.md) fixed relevance, timestamps and scoring — but a scoring system cannot rank a video
its collectors never saw. Until 3.0 the only video statistics came from Bluesky (native videos with a few dozen
likes) and the only YouTube evidence was links people happened to share there. The result the owner described —
2-like videos next to missing 100M-view Shorts — was a **discovery-coverage failure, not a ranking failure**.

The first independent benchmark (docs/BENCHMARK.md, cycle 1 baseline, 2026-10-28 04:51 UTC) measured it: of 98
Shorts independently listed by ChartsList (US) and ShortsMonkey (hot today), the pipeline had discovered **4 (4.1 %)**.

Root causes, in order of weight:

| # | cause | fix |
|---|---|---|
| 1 | no YouTube Data API access | key activated (Phase 1); 10,000 units + 100 searches/day ledgered in Pacific time |
| 2 | `chart=mostPopular` is YouTube's *Trending* list, not a Shorts leaderboard; 50 per region/category, dominated by music videos and large channels | **query-less `search.list` probes**: `order=viewCount&publishedAfter=…&videoDuration=short&regionCode=…` (no `q`) return the most-viewed videos published in a window — exactly how public Shorts charts are built. After one round, recall 4 % → 41 %; after page 2 / 21-day / regional probes, 49 %; the rolling schedule keeps widening it |
| 3 | keyword probes only found what we already knew how to name | keyword probes are now a minority of the budget (2 broad + 2 topics + 2 momentum microtrends + 4 rotating formats per 49-slot cycle) |
| 4 | one burst of searches every 6 hours | a rolling schedule of 2 searches per 30-minute run: the fresh 24h US Shorts probe recurs every ~2h, windows (72h/7d/21d, 2–3 pages), 10 category leaderboards, 12 regions |
| 5 | Bluesky's small-scale native videos were treated as "direct evidence" on equal footing with YouTube | Bluesky is ranked on its own like-based scale and never mixed into view-count rankings; its new role is cross-platform link discovery (domain-filtered searches for YouTube/TikTok/Instagram/Facebook links) |

### Exploration vs exploitation

- **Exploration** (no vocabulary): top-by-views probes by window, duration, region and category; secondary chart
  regions (3 per run, 12 in rotation); domain link discovery on Bluesky. A format nobody has named yet shows up here.
- **Exploitation**: the run's Bluesky topics and last run's qualified microtrends become probes; every video seen in
  the last 7 days is re-measured every run (velocity); channels of outlier candidates get an uploads baseline.
- **Creator outliers**: channel statistics for every channel in the index (50 per unit) give views ÷ subscribers;
  the 20 strongest candidates per run get a median-of-last-20-uploads baseline (2 units each).

## 2. What real growth looks like (research notes, 2026-10-28)

The detection rules are informed by observable behaviour, not by a single assumed curve:

- **YouTube Shorts recommendation** seeks a "seed audience" for every Short and then "may get a lot more traffic or
  it may taper off"; a view only counts after a meaningful watch threshold; posting time does not matter
  ([TechCrunch, YouTube's Todd Sherman, 2023](https://techcrunch.com/2023/08/25/youtube-demystifies-the-shorts-algorithm-views-and-answers-other-creator-questions/)).
- **Delayed breakouts are normal on Shorts.** Socialinsider's 2025 brand-account study reports that the largest
  single growth window is **25–30 days after upload** (3,310 views vs 833 in days 1–5) and that "some Shorts get
  their biggest spike nearly a month after they go live"
  ([Socialinsider](https://www.socialinsider.io/blog/how-long-does-it-take-for-yt-shorts-to-get-views/); the
  study's sample statements are inconsistent, so the shape, not the exact numbers, is what we use).
- **TikTok front-loads.** Shortimize's summary of large-scale data: roughly **72 % of a TikTok's lifetime views
  arrive on day one**, days 2–5 are often the highest-growth window, and the average video needs ~35 days to reach
  95 % of its views; "second waves" exist but are undocumented quantitatively
  ([Shortimize](https://www.shortimize.com/blog/tiktok-video-performance-over-time)).
- **Our own data** (first YouTube day, 906 verified videos): Shorts that reach the charts in the 24–72h age band run
  at a median 32K views/hour (p90 154K); at 72–168h the median *rises* to 70K/hour because only the biggest survive
  — i.e. at the top end, videos keep accelerating for days. Lifetime average ≠ current velocity.

Consequences in the code (`pipeline/src/intel/videos.ts`):

- **Measurement windows.** Velocity is computed only between two real observations ≥1h apart; gains are reported
  for 1h/3h/6h/12h/24h/48h/72h/7d only where observations bracket the window (±25 %). Acceleration needs three
  points. A single observation yields a lifetime average, labelled as such and never presented as velocity.
- **Age-adjusted performance.** Lifetime rate is ranked against the videos we track of comparable age (buckets
  <6h, <24h, <72h, <7d, <30d; ≥8 videos per bucket or no percentile claim).
- **Creator outperformance.** Views ÷ channel median of recent uploads (when fetched) or ÷ subscribers.
- **Delayed virality.** Age alone never disqualifies: a video older than 30 days stays a breakout when its measured
  rate is ≥5K views/hour and ≥5× its lifetime average. Publish time, first-discovery time and the time acceleration
  was first measured are kept apart.
- **Tiny samples.** Platform floors (10K views / 100 Bluesky likes) and absolute velocity floors prevent "4 → 8
  likes" spikes; paid-reach patterns (millions of views with <0.05 % likes) are excluded.

## 3. Cross-platform relationships (what is detectable today)

| type | meaning | detection | confidence |
|---|---|---|---|
| A — identical video | the same video shared on another network | canonical video id in a Bluesky link (YouTube/TikTok/Instagram/Facebook) | 1.0 |
| B — modified repost | a copy under another account or on another platform | identical normalised title (≥4 tokens) by a different creator / platform within 30 days; the smaller copy is marked a duplicate | 0.6–0.8 |
| C — derivative | someone recreates the concept | shared distinctive phrase / hashtag across ≥3 independent creators (microtrend clustering) | cluster-level |
| D — related trend | independent creators using the same emerging format | membership in the same microtrend/format cluster | cluster-level |

Semantic, visual or audio similarity is not attempted (no authorised media access). The cross-platform map
(Trends → map) shows, per wave, the earliest verified content time per platform; where only a share time exists
it is labelled as such; unknown order is never invented. With direct statistics available only from YouTube and
Bluesky today, most waves are single-platform — that is reported, not papered over.

## 4. Platform coverage, honestly

| platform | status | what we can measure | why not more |
|---|---|---|---|
| YouTube (Shorts + long-form) | **direct** | views, likes, comments, publish date, duration, channel size, velocity | — |
| Bluesky | direct (own scale) | likes/reposts of native videos; shares of other platforms' videos | no view counts |
| TikTok | indirect | titles/authors/thumbnails via oEmbed; embeds; share engagement on Bluesky | Creative Center answers `40101 no permission` without a session; no public statistics API; scraping the web app would breach its terms |
| Instagram / Facebook | indirect | share evidence only | no public read API; oEmbed needs an approved Meta app token |
| Google Trends / Mastodon | indirect | search spikes, hashtag series | corroboration only |

The diagnostics page (Settings → Source coverage / Discovery funnel) shows these numbers live every run.
