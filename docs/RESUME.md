# Resume guide — how to continue in a new session

Everything needed to continue lives in this repository (code, data, docs, fixtures). No state is kept on any personal
computer. A new cloud session should:

## 1. Get the repository

```bash
git clone https://github.com/<owner>/viral-radar
cd viral-radar
npm install
npm test                    # expect 41/41
npm run collect:fixtures    # offline smoke run → data/latest.json
npm run build               # web/dist
```

If the repository is not on GitHub yet, the complete project is in the cloud workspace at `/home/claude/viral-radar`
(git history: CP1–CP8 commits). Pushing it is the single pending step:

```bash
git remote add origin https://github.com/<owner>/viral-radar.git
git push -u origin main
```

## 2. Enable the cloud operation (one-time)

1. GitHub → repo **Settings → Pages → Source: GitHub Actions**.
2. **Actions → Collect trends → Run workflow**. Watch the run: `collect` job logs each source as `ok/ERR`, then
   `publish` deploys Pages and prints the URL (`https://<owner>.github.io/viral-radar/`).
3. Optional secret `YOUTUBE_API_KEY`; optional variables `VR_*` (see README).

## 2b. 3.0 operations

- The YouTube key is the repository secret `YOUTUBE_API_KEY` (Google Cloud project *Viral Radar*, account DNA
  Collision). Quota ledger: `data/cache/youtube-quota.json` (Pacific day; 10,000 units, 90 of 100 searches).
- Manual diagnostics: Actions → **Diagnose** → inspect video ids (`videos`), batch-verify ids (`batch`), probe
  TikTok (`probe_tiktok`), or run the discovery benchmark (`benchmark: dev|holdout`, `benchmark_label`). Results
  are committed under `data/diagnostics/` and `data/benchmark/` — never into the observation store.
- `data/diagnostics/watch.json` lists video ids re-measured every run for diagnostics only (`track.ndjson`).
- `data/videos.json` is the full 30-day video index shipped with the site; `latest.json → videos` holds the top lists,
  funnel and coverage.

## 2c. 4.0 operations

- **Schedules.** `collect.yml` (3,33) plus `collect-b/c/d.yml` (18,48 · 11,41 · 26,56) call the same workflow;
  GitHub tends to honour about one scheduled run per workflow per hour, so four workflows give ~4 attempts an hour
  and the freshness gate (skip when `data/latest.json` is <22 min old) keeps the effective cadence near 30 min.
  Manual runs are never skipped. Collection health and the Actions run history are in `data/health.json` and
  `data/health/actions.json`; the app shows them under Diagnostics → Radar health (freshness is a state: fresh
  <45 min, delayed <2 h, stale).
- **Adaptive discovery.** `data/cache/youtube-yield.json` is the per-probe yield ledger (summarised in
  `data/diagnostics/discovery-yield.json`). `VR_YT_MAX_SEARCHES_PER_RUN` caps a run (default 4); the allowance is
  derived from the budget left and the measured cadence. Do not add keys or projects to raise the ceiling.
- **Predictions.** `data/predictions/{predictions,outcomes,crossings}.ndjson` are append-only; never rewrite them
  (a backtest would be a different, clearly labelled file). `scorecard.json` is rebuilt each run.
- **Shorts verification cache:** `data/cache/youtube-shorts.json` (no quota). **Channel uploads cursor:**
  `uploadsAt` in `data/cache/youtube-channels.json`.
- **Alerts** are in `latest.json.alerts` (7-day log). Optional external delivery: secret `ALERT_WEBHOOK_URL` +
  variable `VR_ALERT_WEBHOOK=1` (docs/ALERTS.md). Nothing is enabled by default.
- **Browser QA:** Actions → **Browser QA** → screenshots + playback report committed to `data/qa/` (the runner's
  datacenter IP hits YouTube's "confirm you're not a bot" wall for most embeds; that is not an app defect).
- **Briefs export for audits:** `node qa/briefs.mjs` → `data/qa/briefs.json` (same templates the app uses).
- **Private data** (journal, preferences, alert bookkeeping) lives only in the browser's localStorage; the Journal
  page exports/imports a JSON backup. Nothing private is ever committed.
- **Recovery checkpoints:** branches `v1-stable`, `v2-stable`, `v3-stable` (3.0 as deployed before 4.0).

## 3. Where things are

| path | purpose |
|---|---|
| `pipeline/src/run.ts` | pipeline entry: collect → verify (YouTube) → relevance → persist → cluster → score per window → quality → `data/latest.json` |
| `pipeline/src/intel/relevance.ts` | format catalogue + stage-2 relevance validator (video-level text, sense disambiguation, category veto) |
| `pipeline/src/quality.ts`, `pipeline/src/gate.ts` | runtime quality checks and the release gate |
| `pipeline/src/collectors/*.ts` | one file per source; each exports `collectX()` and pure parse functions |
| `pipeline/src/intel/taxonomy.ts` | categories, keywords, monetization profiles, news-event heuristics |
| `pipeline/src/intel/cluster.ts` | seeds, merging, attachment, dynamic microtrends |
| `pipeline/src/intel/score.ts` | signal, momentum, confidence, monetization, creator, lifecycle |
| `pipeline/src/intel/videos.ts` | 3.0 video records: velocity, acceleration, age percentile, creator outliers, evidence classes, scores, lists |
| `pipeline/src/intel/funnel.ts` | discovery funnel, platform coverage, category waves |
| `pipeline/src/tools/` | `inspect.ts` (video diagnostics, batch verify), `benchmark.ts` (discovery benchmark), `probe-tiktok.ts` |
| `web/src/lib/videos.ts`, `web/src/components/video.tsx` | filters/sorts/embeds; cards, grid, rail, modal player |
| `web/src/data/hallOfFame.ts` | the Hall of Fame entries (verified ids + context) |
| `pipeline/src/lib/store.ts` | NDJSON history, score history, cache, retention |
| `pipeline/fixtures/` | real captured responses + `build-fixtures.mjs` (regenerates them) |
| `web/src/lib/data.ts` | filters, personalisation, ranking, rollups |
| `web/src/lib/money.ts` | platform programs + calculator |
| `web/src/lib/studio.ts` | Content Studio advice + concept generation |
| `web/src/pages/*` | Discover, Compass, Money, Studio, Watchlist, Settings, TrendDetail |
| `data/` | the database (committed by the collector) |
| `.github/workflows/` | `collect.yml` (cron + publish), `deploy.yml` (on code push) |

## 4. Typical next tasks

- **Add a source**: write `pipeline/src/collectors/<name>.ts` returning `Observation[]`, register it in `run.ts`
  (`runSource`), add its label, capture a real response as a fixture, add a parser test, document it in DATA_SOURCES.md.
- **Change scoring**: edit `score.ts`, update SCORING.md and the explainer in `web/src/pages/Settings.tsx`.
- **Change the taxonomy**: edit `taxonomy.ts` (keywords + profile); tests in `test/intel.test.ts`.
- **Change refresh cadence**: edit the cron in `collect.yml` (GitHub minimum is 5 minutes; 15–30 is sensible).

## 5. Guard-rails to keep

- Never fabricate metrics or videos. Provisional vs. measured growth must stay visible.
- Keep everything cloud-only: no local servers, no local models, no local machine access.
- Do not touch any other repository.
