/**
 * Automated data-quality checks, run at the end of every pipeline run and written into the snapshot.
 * Each check is a plain boolean with a detail string so failures are explainable in the dashboard and in CI.
 */
import type { Observation, QualitySummary, SourceStatus, Trend } from './types.js';
import { hoursBetween } from './lib/util.js';
import { validateObservation } from './intel/relevance.js';

export function runQualityChecks(input: { trends: Trend[]; observations: Observation[]; sources: SourceStatus[]; now: string }): QualitySummary {
  const { trends, observations, sources, now } = input;
  const checks: QualitySummary['checks'] = [];
  const nowMs = new Date(now).getTime();

  // 1. relevance: every piece of format-cluster evidence must pass the validator for that format
  const formatTrends = trends.filter((t) => t.kind === 'format');
  let sampled = 0, relevant = 0;
  for (const t of formatTrends) {
    const fid = t.id.replace(/^f_/, '');
    for (const e of t.evidence.filter((e) => e.kind === 'video')) {
      sampled++;
      if (validateObservation(e).formats.includes(fid)) relevant++;
    }
  }
  const rate = sampled ? relevant / sampled : 1;
  checks.push({ name: 'format evidence passes relevance validation', ok: rate >= 0.9, detail: `${relevant}/${sampled} (${Math.round(rate * 100)}%)` });

  // 2. no duplicate videos inside a trend's evidence
  let duplicates = 0;
  for (const t of trends) {
    const keys = t.evidence.map((e) => (e.video ? `${e.video.platform}:${e.video.id}` : e.id));
    duplicates += keys.length - new Set(keys).size;
  }
  checks.push({ name: 'no duplicate videos within a trend', ok: duplicates === 0, detail: `${duplicates} duplicates` });

  // 3. publication dates: no external share may carry the share time as the video's publish time; no future dates
  let wrongDates = 0;
  for (const o of observations) {
    // an unverified external video has no trustworthy publish date at all — any value there came from the share
    if (o.kind === 'video' && o.level === 'indirect' && o.publishedAt && !o.videoPublishedAt) wrongDates++;
    for (const t of [o.publishedAt, o.videoPublishedAt, o.postPublishedAt]) if (t && new Date(t).getTime() > nowMs + 3600e3) wrongDates++;
  }
  checks.push({ name: 'publication dates are not share dates and not in the future', ok: wrongDates === 0, detail: `${wrongDates} suspect timestamps` });

  // 4. metric attribution: an unverified external video must not carry platform statistics
  const misattributed = observations.filter((o) => o.kind === 'video' && o.level === 'indirect' && !o.verifiedAt && (o.metrics.views != null || o.metrics.likes != null)).length;
  checks.push({ name: 'no social engagement attributed to an unverified video', ok: misattributed === 0, detail: `${misattributed} items` });

  // 5. links
  const brokenLinks = trends.flatMap((t) => t.evidence).filter((e) => !/^https?:\/\//.test(e.url)).length;
  checks.push({ name: 'evidence links are absolute http(s) URLs', ok: brokenLinks === 0, detail: `${brokenLinks} malformed` });

  // 6. growth validity + lifecycle consistency
  let badGrowth = 0, badLifecycle = 0;
  for (const t of trends) {
    for (const w of Object.values(t.windows)) {
      if (w.growth.basis === 'measured' && !(isFinite(w.growth.ratio ?? NaN) && (w.growth.ratio ?? 0) > 0)) badGrowth++;
      if ((w.grade === 'insufficient') !== (w.lifecycle === 'insufficient_data')) badLifecycle++;
      if (w.lifecycle === 'accelerating' && w.growth.basis !== 'measured' && !w.velocity) badLifecycle++;
    }
  }
  checks.push({ name: 'growth ratios are finite and positive', ok: badGrowth === 0, detail: `${badGrowth} invalid` });
  checks.push({ name: 'lifecycle agrees with evidence grade; no acceleration without measurement', ok: badLifecycle === 0, detail: `${badLifecycle} inconsistent` });

  // 7. stale sources
  const stale = sources.filter((s) => s.mode !== 'disabled' && (!s.fetchedAt || hoursBetween(s.fetchedAt, now) > 3)).map((s) => s.source);
  checks.push({ name: 'live sources refreshed within 3h', ok: stale.length === 0, detail: stale.length ? `stale: ${stale.join(', ')}` : 'all fresh' });

  // 8. recommendations not empty
  const qualified = trends.filter((t) => t.qualified).length;
  checks.push({ name: 'at least one qualified opportunity', ok: qualified > 0, detail: `${qualified} qualified of ${trends.length}` });

  // 9. no news/person events among qualified
  const newsQualified = trends.filter((t) => t.qualified && t.isNewsEvent).length;
  checks.push({ name: 'no news/person events in recommendations', ok: newsQualified === 0, detail: `${newsQualified}` });

  // 10. generic formats only qualify with a measured shift
  const genericQualified = trends.filter((t) => t.qualified && t.isGeneric && !(t.scores.growth.basis === 'measured' && (t.scores.growth.ratio ?? 0) >= 1.5)).length;
  checks.push({ name: 'generic categories qualify only with measured growth', ok: genericQualified === 0, detail: `${genericQualified}` });

  // 11. missing records: qualified trends must carry evidence
  const missing = trends.filter((t) => t.qualified && t.evidence.length === 0).length;
  checks.push({ name: 'qualified trends carry evidence', ok: missing === 0, detail: `${missing} without evidence` });

  return { relevance: { sampled, relevant, rate: Math.round(rate * 1000) / 1000 }, duplicates, wrongDates, brokenLinks, emptyRecommendations: qualified === 0, checks };
}
