# Resume guide — how to continue in a new session

Everything needed to continue lives in this repository (code, data, docs, fixtures). No state is kept on any personal
computer. A new cloud session should:

## 1. Get the repository

```bash
git clone https://github.com/<owner>/viral-radar
cd viral-radar
npm install
npm test                    # expect 29/29
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
