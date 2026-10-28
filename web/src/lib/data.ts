import type { Observation, Snapshot, Trend, Window, WindowScores, Preferences, CategoryActivity } from './types';
import { profileFor } from '../../../pipeline/src/intel/taxonomy';

export const DATA_URL = `${import.meta.env.BASE_URL}data/latest.json`;

export async function loadSnapshot(): Promise<Snapshot> {
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);
  return (await res.json()) as Snapshot;
}

export const hoursAgo = (iso: string, now = Date.now()) => (now - new Date(iso).getTime()) / 36e5;

export function fmtAgo(iso?: string, now = Date.now()): string {
  if (!iso) return '—';
  const h = hoursAgo(iso, now);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function fmtNum(n?: number | null): string {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
export function fmtMoney(n: number, digits = 0): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

/** A trend as seen through one time window: scores swapped, evidence filtered by content time. */
export interface ViewTrend extends Trend { w: WindowScores; window: Window }

export function contentTime(o: Observation): string | undefined {
  return o.publishedAt || o.postPublishedAt || (o.kind !== 'video' ? o.observedAt : undefined);
}

export function viewFor(t: Trend, window: Window, now: number): ViewTrend {
  const hours = { '24h': 24, '48h': 48, '7d': 168 }[window];
  const evidence = t.evidence.filter((e) => hoursAgo(contentTime(e) || e.firstSeenAt || e.observedAt, now) <= hours);
  return { ...t, evidence, w: t.windows[window] || t.scores, window };
}

/** Preference-adjusted creator opportunity and ranking score (applied once, client side). */
export function personalize(v: ViewTrend, p: Preferences): ViewTrend {
  let creator = v.w.creatorOpportunity;
  const notes: string[] = [];
  if (p.interests.includes(v.category)) { creator += 10; notes.push(`+10 creator fit: ${v.category} is one of your interests.`); }
  const text = `${v.name} ${v.subcategory} ${v.keywords.join(' ')}`.toLowerCase();
  const hits: string[] = [];
  if (p.tools.includes('animation') && /anim|cartoon|character|stop.?motion|puppet/.test(text)) hits.push('animation');
  if (p.tools.includes('ai-video') && /\bai\b|generated|sora|veo/.test(text)) hits.push('AI video');
  if (p.tools.includes('music') && /music|song|cover|remix|beat|sing|rap/.test(text)) hits.push('music');
  if (hits.length) { creator += 5; notes.push(`+5 creator fit: fits your tools (${hits.join(', ')}).`); }
  if (p.appetite === 'early' && ['emerging', 'accelerating'].includes(v.w.lifecycle)) { creator += 6; notes.push('+6: you prefer early trends.'); }
  if (p.appetite === 'proven' && ['breaking_out', 'peaking'].includes(v.w.lifecycle)) { creator += 6; notes.push('+6: you prefer proven trends.'); }
  creator = Math.max(0, Math.min(100, Math.round(creator)));
  const gradeFactor = { strong: 1, developing: 0.9, early: 0.72, insufficient: 0.4 }[v.w.grade];
  const opportunity = Math.round((0.4 * v.w.momentum + 0.35 * creator + 0.25 * v.monetizationSuitability) * (0.3 + 0.7 * (v.w.confidence / 100)) * gradeFactor);
  return { ...v, w: { ...v.w, creatorOpportunity: creator, opportunity, notes: [...v.w.notes, ...notes] } };
}

export function isQualified(v: ViewTrend, p: Preferences): boolean {
  if (v.w.grade === 'insufficient') return false;
  if (v.isNewsEvent) return false; // news/person events are never recommendations (the Compass can still show them)
  if (v.kind === 'topic' && v.w.videos < 2) return false;
  if (v.isGeneric) return p.showGeneric || (v.w.growth.basis === 'measured' && (v.w.growth.ratio ?? 0) >= 1.5);
  return true;
}

export function rankView(trends: Trend[], window: Window, p: Preferences, now: number): ViewTrend[] {
  return trends
    .map((t) => personalize(viewFor(t, window, now), p))
    .filter((v) => v.w.items > 0)
    .sort((a, b) => Number(isQualified(b, p)) - Number(isQualified(a, p)) || b.w.opportunity - a.w.opportunity || b.w.momentum - a.w.momentum);
}

export function diversify<T extends { category: string }>(list: T[], n: number, perCategory = 2): T[] {
  const out: T[] = [];
  const count = new Map<string, number>();
  for (const t of list) {
    const c = count.get(t.category) || 0;
    if (c >= perCategory) continue;
    count.set(t.category, c + 1);
    out.push(t);
    if (out.length >= n) break;
  }
  if (out.length < n) for (const t of list) if (!out.includes(t) && out.length < n) out.push(t);
  return out;
}

export function bestThumb(t: Trend): { src?: string; portrait?: boolean } {
  const v = t.evidence.find((e) => e.kind === 'video' && e.thumbnail);
  if (v?.thumbnail) return { src: v.thumbnail, portrait: /video\.bsky\.app/.test(v.thumbnail) };
  const any = t.evidence.find((e) => e.thumbnail);
  return { src: any?.thumbnail };
}

export function coverHue(name: string): [string, string] {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return [`hsl(${h} 40% 30%)`, `hsl(${(h + 40) % 360} 35% 16%)`];
}

export function growthLabel(w: WindowScores): { label: string; dir: 'up' | 'flat' | 'down' | 'unknown' } {
  if (w.velocity?.videosMeasured) {
    const r = w.videoMomentum ?? 50;
    if (r >= 60) return { label: `Videos accelerating (${w.velocity.viewsPerHour != null ? `${fmtNum(w.velocity.viewsPerHour)} views/h` : `${w.velocity.likesPerHour} likes/h`})`, dir: 'up' };
    if (r <= 40) return { label: 'Video velocity slowing', dir: 'down' };
    return { label: 'Video velocity steady', dir: 'flat' };
  }
  if (w.growth.basis === 'measured' && w.growth.ratio != null) {
    const r = w.growth.ratio;
    const basis = growthBasisLabel(w);
    if (r >= 1.15) return { label: `${w.growth.metric}: ${fmtRatio(r)} ${basis}`, dir: 'up' };
    if (r <= 0.85) return { label: `${w.growth.metric}: ${fmtRatio(r)} ${basis}`, dir: 'down' };
    return { label: `${w.growth.metric}: flat ${basis}`, dir: 'flat' };
  }
  return { label: 'Growth not yet measured', dir: 'unknown' };
}

/** "+35%" for ordinary ratios, "×12" once a percentage would stop meaning anything (e.g. a hashtag going from ~0 to 114/day). */
export function fmtRatio(r: number): string {
  if (r >= 5) return `×${r >= 20 ? Math.round(r) : r.toFixed(1)}`;
  const pct = Math.round((r - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/** What the growth ratio compares, in words that match how it was computed. */
export function growthBasisLabel(w: WindowScores): string {
  if (w.growth.metric === 'daily hashtag use') return 'last full day vs. the prior-day average';
  if (w.growth.metric === 'independent creators') return `vs. ${Math.round(w.growth.windowHours ?? 0)}h earlier (same window)`;
  return `over ${Math.round(w.growth.windowHours ?? 0)}h`;
}

export function growthMetricLabel(w: WindowScores): string {
  return `${w.growth.metric ?? 'growth'} · ${growthBasisLabel(w)}`;
}

export function difficultyFor(category: string, prefs: Preferences): { label: 'Low' | 'Medium' | 'High'; why: string } {
  const p = profileFor(category);
  let cost = p.cost;
  const text = category.toLowerCase();
  if (prefs.tools.includes('animation') && /anim/.test(text)) cost -= 0.25;
  if (prefs.tools.includes('ai-video')) cost -= 0.05;
  if (prefs.tools.includes('music') && /music/.test(text)) cost -= 0.15;
  if (cost <= 0.3) return { label: 'Low', why: 'short, repeatable; mostly editing time' };
  if (cost <= 0.55) return { label: 'Medium', why: 'a concept, some production, a day or two' };
  return { label: 'High', why: 'animation or multi-day production' };
}

export function recommendPlatform(t: Trend, prefs: Preferences): { platform: string; why: string } {
  const hasYouTube = t.evidence.some((e) => e.video?.platform === 'youtube');
  const hasShorts = t.evidence.some((e) => /shorts\//.test(e.url) || (e.video?.durationSec != null && e.video.durationSec <= 60));
  const p = profileFor(t.category);
  if (hasShorts) return { platform: 'YouTube Shorts', why: 'the examples are short-form; the format is proven there' };
  if (hasYouTube && p.longevity >= 0.6) return { platform: 'YouTube (long-form + Shorts cut)', why: 'YouTube examples and an evergreen category; long-form RPM is far higher' };
  if (['Music', 'Comedy', 'Animals & Pets'].includes(t.category)) return { platform: 'YouTube Shorts + TikTok', why: 'sound-led short formats travel across both' };
  if (t.category === 'Animation & Art') return { platform: 'YouTube Shorts (then Bluesky/TikTok)', why: 'animation clips do well as Shorts; Bluesky has an active animation community' };
  if (['Tech & AI', 'Business & Finance', 'Science & Education'].includes(t.category)) return { platform: 'YouTube (long-form)', why: 'high-RPM categories; watch time pays' };
  if (prefs.platforms.includes('youtube_shorts')) return { platform: 'YouTube Shorts', why: 'your default short-form platform' };
  return { platform: 'YouTube Shorts + TikTok', why: 'default short-form distribution' };
}

export function categoryLabelDelta(c: CategoryActivity): { label: string; dir: 'up' | 'down' | 'flat' | 'na' } {
  if (c.change24h == null) return { label: 'not enough volume to compare', dir: 'na' };
  const pct = Math.round((c.change24h - 1) * 100);
  if (c.change24h >= 1.15) return { label: `+${pct}% vs prior 24h`, dir: 'up' };
  if (c.change24h <= 0.85) return { label: `${pct}% vs prior 24h`, dir: 'down' };
  return { label: 'flat vs prior 24h', dir: 'flat' };
}

export function exampleLine(e: Observation): string {
  const m = e.metrics;
  const parts: string[] = [];
  if (m.views != null) parts.push(`${fmtNum(m.views)} views`);
  if (m.likes != null) parts.push(`${fmtNum(m.likes)} likes`);
  if (m.reposts) parts.push(`${fmtNum(m.reposts)} reposts`);
  if (m.comments) parts.push(`${fmtNum(m.comments)} comments`);
  if (m.approxTraffic != null) parts.push(`${fmtNum(m.approxTraffic)}+ searches`);
  if (m.uses != null) parts.push(`${fmtNum(m.uses)} posts/day`);
  if (!parts.length && e.postMetrics) parts.push(`shared · ${fmtNum(e.postMetrics.likes)} likes on the post${(e.postMetrics.accounts || 1) > 1 ? ` · ${e.postMetrics.accounts} sharers` : ''}`);
  if (!parts.length && m.rank) parts.push(`#${m.rank} on list`);
  return parts.join(' · ');
}
