/**
 * Early-warning alerts (4.0). Every alert names what caused it and the threshold it crossed; alerts are deduplicated
 * per subject with a 48-hour cooldown and kept for 7 days. The client decides what is "new since the last visit".
 * Thresholds are deliberately high: minor activity never alerts.
 */
import type { Alert, AlertKind, DeskReport, VideoIntel, VideoRecord } from '../types.js';
import type { CrossingRecord } from './predict.js';
import { hoursBetween } from '../lib/util.js';

const COOLDOWN_HOURS = 48;
const KEEP_HOURS = 24 * 7;
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `${Math.round(n)}`);

export const ALERT_RULES: Record<AlertKind, string> = {
  new_hit: 'a video crossed its age-appropriate hit floor in the last 24h while already being tracked',
  acceleration: 'measured velocity ≥ 20K views/h and ≥ 2.5× the previous interval, with ≥ 50K views gained in it',
  creator_outlier: '≥ 50× the creator\'s median recent upload, ≥ 500K views, ≤ 7 days old',
  format_spreading: 'a repeatable format or meme gained ≥ 3 independent creators in 48h and is actionable',
  category_momentum: 'a category wave with ≥ 3 independent creators measured at ≥ 2× growth',
  resurfacing: 'a video older than a week gaining ≥ 10K views/h measured, ≥ 3× its lifetime average',
};

export function buildAlerts(opts: { records: VideoRecord[]; desk: DeskReport; waves: VideoIntel['waves']; crossings: CrossingRecord[]; history: Alert[]; now: string }): Alert[] {
  const { records, desk, waves, crossings, history, now } = opts;
  const kept = history.filter((a) => hoursBetween(a.at, now) <= KEEP_HOURS);
  const recent = new Map<string, string>();
  for (const a of kept) if (!recent.has(a.id) || recent.get(a.id)! < a.at) recent.set(a.id, a.at);
  const out: Alert[] = [];
  const push = (kind: AlertKind, subjectId: string, a: Omit<Alert, 'id' | 'kind' | 'at'>) => {
    const id = `${kind}:${subjectId}`;
    const last = recent.get(id);
    if (last && hoursBetween(last, now) < COOLDOWN_HOURS) return;
    recent.set(id, now);
    out.push({ id, kind, at: now, ...a });
  };
  const byId = new Map(records.map((r) => [r.id, r]));
  const vid = (r: VideoRecord): Alert['subject'] => ({ type: 'video', id: r.id, title: r.title.slice(0, 100), url: r.url, thumbnail: r.thumbnail, platform: r.platform });

  for (const c of crossings) {
    if (hoursBetween(c.crossedAt, now) > 24) continue;
    const r = byId.get(c.videoId);
    if (!r) continue;
    push('new_hit', r.id, { severity: 'high', category: r.category, subject: vid(r), evidence: `${fmt(c.views)} views at ${hoursBetween(r.publishedAt || c.crossedAt, c.crossedAt) < 48 ? Math.round(hoursBetween(r.publishedAt || c.crossedAt, c.crossedAt)) + 'h' : Math.round(hoursBetween(r.publishedAt || c.crossedAt, c.crossedAt) / 24) + ' days'} old; tracked since ${c.observableSince.slice(0, 16).replace('T', ' ')} UTC${c.predictedAt ? `; predicted ${c.leadHours}h before` : ''}`, threshold: `hit floor ${fmt(c.floor)} views for its age` });
  }
  for (const r of records) {
    if (!r.verified || r.platform === 'bluesky') continue;
    const v = r.velocity?.[0];
    if (r.state === 'early_breakout' && v && r.acceleration != null && r.acceleration >= 2.5 && v.perHour >= 20_000 && v.perHour * v.hours >= 50_000) {
      push('acceleration', r.id, { severity: 'high', category: r.category, subject: vid(r), evidence: `+${fmt(v.perHour)}/h over ${v.hours}h, ${r.acceleration}× the previous interval; ${fmt(r.metrics.views || 0)} views, ${r.ageHours != null ? Math.round(r.ageHours) + 'h' : '?'} old`, threshold: ALERT_RULES.acceleration });
    }
    if (r.state === 'early_breakout' && r.baselineRatio != null && r.baselineRatio >= 50 && (r.metrics.views || 0) >= 500_000 && (r.ageHours ?? Infinity) <= 168) {
      push('creator_outlier', r.id, { severity: 'medium', category: r.category, subject: vid(r), evidence: `${r.baselineRatio}× the channel's median recent upload; ${fmt(r.metrics.views || 0)} views${r.creator?.subscribers ? `, ${fmt(r.creator.subscribers)} subscribers` : ''}`, threshold: ALERT_RULES.creator_outlier });
    }
    if (r.kind === 'delayed' && v && v.perHour >= 10_000) {
      push('resurfacing', r.id, { severity: 'medium', category: r.category, subject: vid(r), evidence: `${Math.round((r.ageHours || 0) / 24)}-day-old video gaining +${fmt(v.perHour)}/h measured (${r.velocityRatio}× lifetime); ${fmt(r.metrics.views || 0)} views`, threshold: ALERT_RULES.resurfacing });
    }
  }
  for (const o of desk.opportunities) {
    if ((o.type === 'format' || o.type === 'meme') && o.facts.newCreators48h >= 3 && (o.action === 'create_today' || o.action === 'participate' || o.action === 'research')) {
      push('format_spreading', o.trendId, { severity: 'high', category: o.category, subject: { type: 'trend', id: o.trendId, title: o.name, thumbnail: o.evidence[0]?.thumbnail }, evidence: `${o.facts.newCreators48h} new independent creators in 48h (${o.facts.creators} total, ${o.facts.videos} videos)${o.facts.growth ? `, measured ${o.facts.growth}×` : ''}; recommended: ${o.action.replace('_', ' ')}`, threshold: ALERT_RULES.format_spreading });
    }
  }
  for (const w of waves) {
    if (w.state === 'promising_wave' && w.growth != null && w.growth >= 2 && w.creators >= 3) {
      push('category_momentum', w.trendId, { severity: 'medium', category: w.category, subject: { type: 'category', id: w.trendId, title: w.name }, evidence: `${w.creators} creators (${w.newCreators48h} new in 48h), measured ${w.growth}× growth`, threshold: ALERT_RULES.category_momentum });
    }
  }
  return [...out, ...kept].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150);
}
