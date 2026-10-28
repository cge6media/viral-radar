import type { Observation, Snapshot, Trend, TimeWindow, Preferences } from './types';
import { TIME_WINDOWS } from './types';
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

export function fmtNum(n?: number): string {
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

/** Primary evidence line for an observation. */
export function metricLine(o: Observation): string {
  const m = o.metrics;
  const parts: string[] = [];
  if (m.views != null) parts.push(`${fmtNum(m.views)} views`);
  if (m.likes != null) parts.push(`${fmtNum(m.likes)} likes`);
  if (m.reposts) parts.push(`${fmtNum(m.reposts)} reposts`);
  if (m.comments) parts.push(`${fmtNum(m.comments)} comments`);
  if (m.approxTraffic != null) parts.push(`${fmtNum(m.approxTraffic)}+ searches`);
  if (m.uses != null) parts.push(`${fmtNum(m.uses)} posts/day`);
  if (m.accounts != null) parts.push(`${fmtNum(m.accounts)} accounts`);
  if (!parts.length && m.rank) parts.push(`#${m.rank} on list`);
  return parts.join(' · ');
}

export interface Filters {
  window: TimeWindow;
  platforms: string[]; // empty = all
  category?: string;
}

/** Apply time + platform filters. Trends keep evidence inside the window; empty trends are dropped. */
export function filterTrends(trends: Trend[], f: Filters, now = Date.now()): Trend[] {
  const hours = TIME_WINDOWS.find((w) => w.id === f.window)?.hours ?? 24 * 7;
  return trends
    .map((t) => {
      const ev = t.evidence.filter(
        (e) => hoursAgo(e.observedAt, now) <= hours && (f.platforms.length === 0 || f.platforms.includes(e.source)),
      );
      if (!ev.length) return undefined;
      if (f.category && t.category !== f.category) return undefined;
      if (ev.length === t.evidence.length) return t;
      // narrower window: recount from the evidence that is actually inside it (scores stay as computed by the pipeline over 7 days)
      const platforms = Array.from(new Set(ev.map((e) => e.source)));
      return {
        ...t,
        evidence: ev,
        evidenceCount: Math.min(t.evidenceCount, ev.length),
        videoCount: ev.filter((e) => e.kind === 'video').length,
        sourceCount: platforms.length,
        platforms,
        evidenceKinds: Array.from(new Set(ev.map((e) => e.kind))),
      } as Trend;
    })
    .filter((t): t is Trend => !!t);
}

/** Preference-adjusted creator score and opportunity rank. */
export function personalize(t: Trend, p: Preferences): Trend {
  let creator = t.scores.creator;
  const notes: string[] = [];
  if (p.interests.includes(t.category)) {
    creator += 10;
    notes.push(`+10 creator: ${t.category} is one of your interests.`);
  }
  const text = `${t.name} ${t.subcategory} ${t.keywords.join(' ')}`.toLowerCase();
  const toolHits: string[] = [];
  if (p.tools.includes('animation') && /anim|cartoon|character|stop.?motion|puppet/.test(text)) toolHits.push('animation');
  if (p.tools.includes('ai-video') && /\bai\b|generated|deepfake/.test(text)) toolHits.push('AI video');
  if (p.tools.includes('music') && /music|song|cover|remix|beat|sing|rap/.test(text)) toolHits.push('music');
  if (p.tools.includes('audio') && /asmr|podcast|voice|sound/.test(text)) toolHits.push('audio');
  if (toolHits.length) {
    creator += 5;
    notes.push(`+5 creator: fits your tools (${toolHits.join(', ')}).`);
  }
  if (p.appetite === 'early' && (t.lifecycle === 'emerging' || t.lifecycle === 'accelerating')) {
    creator += 6;
    notes.push('+6 creator: you prefer early trends.');
  }
  if (p.appetite === 'proven' && (t.lifecycle === 'breaking_out' || t.lifecycle === 'peaking')) {
    creator += 6;
    notes.push('+6 creator: you prefer proven trends.');
  }
  creator = Math.max(0, Math.min(100, Math.round(creator)));
  const opportunity = Math.round(
    (0.4 * t.scores.momentum + 0.35 * creator + 0.25 * t.scores.monetization) * (0.3 + 0.7 * (t.scores.confidence / 100)),
  );
  return { ...t, scores: { ...t.scores, creator, opportunity, notes: [...t.scores.notes, ...notes] } };
}

export function rankTrends(trends: Trend[], p: Preferences): Trend[] {
  return trends
    .map((t) => personalize(t, p))
    .filter((t) => !(p.hideNews && t.isNewsEvent))
    .sort((a, b) => b.scores.opportunity - a.scores.opportunity || b.scores.momentum - a.scores.momentum);
}

/** Top-N supported by evidence: non-news first, prefers multi-evidence, keeps category diversity. */
export function topOpportunities(ranked: Trend[], n = 20): Trend[] {
  const strong = ranked.filter((t) => t.lifecycle !== 'insufficient_data');
  const weak = ranked.filter((t) => t.lifecycle === 'insufficient_data');
  return [...strong, ...weak].slice(0, n);
}

export function diversify(ranked: Trend[], n: number, perCategory = 2): Trend[] {
  const out: Trend[] = [];
  const count = new Map<string, number>();
  for (const t of ranked) {
    const c = count.get(t.category) || 0;
    if (c >= perCategory) continue;
    count.set(t.category, c + 1);
    out.push(t);
    if (out.length >= n) break;
  }
  if (out.length < n) for (const t of ranked) if (!out.includes(t) && out.length < n) out.push(t);
  return out;
}

export interface CategoryRollup {
  category: string;
  trends: number;
  evidence: number;
  videos: number;
  momentum: number; // mean of top-3
  monetization: number;
  creator: number;
  topTrend?: Trend;
  stages: Record<string, number>;
}

export function rollupCategories(trends: Trend[]): CategoryRollup[] {
  const m = new Map<string, Trend[]>();
  for (const t of trends) {
    if (!m.has(t.category)) m.set(t.category, []);
    m.get(t.category)!.push(t);
  }
  return Array.from(m.entries())
    .map(([category, ts]) => {
      const top = [...ts].sort((a, b) => b.scores.momentum - a.scores.momentum).slice(0, 3);
      const mean = (f: (t: Trend) => number) => Math.round(top.reduce((s, t) => s + f(t), 0) / top.length);
      const stages: Record<string, number> = {};
      ts.forEach((t) => (stages[t.lifecycle] = (stages[t.lifecycle] || 0) + 1));
      return {
        category,
        trends: ts.length,
        evidence: ts.reduce((s, t) => s + t.evidenceCount, 0),
        videos: ts.reduce((s, t) => s + t.videoCount, 0),
        momentum: mean((t) => t.scores.momentum),
        monetization: Math.round(profileScore(category)),
        creator: mean((t) => t.scores.creator),
        topTrend: top[0],
        stages,
      };
    })
    .sort((a, b) => b.momentum - a.momentum);
}

export function profileScore(category: string): number {
  const p = profileFor(category);
  return 100 * (0.3 * p.advertiser + 0.2 * p.sponsorship + 0.15 * p.affiliate + 0.15 * p.longevity + 0.1 * p.demand + 0.1 * (1 - p.cost));
}

export function difficultyFor(category: string, prefs: Preferences): { label: 'Low' | 'Medium' | 'High'; why: string } {
  const p = profileFor(category);
  let cost = p.cost;
  const text = category.toLowerCase();
  if (prefs.tools.includes('animation') && /anim/.test(text)) cost -= 0.25;
  if (prefs.tools.includes('ai-video')) cost -= 0.05;
  if (prefs.tools.includes('music') && /music/.test(text)) cost -= 0.15;
  if (cost <= 0.3) return { label: 'Low', why: 'Short, repeatable formats; mostly editing time.' };
  if (cost <= 0.55) return { label: 'Medium', why: 'Needs a concept, some production and a day or two of work.' };
  return { label: 'High', why: 'Animation / multi-day production; lean on your existing pipeline and templates.' };
}

/** Which platforms the evidence actually came from, plus a recommended publishing platform. */
export function recommendPlatform(t: Trend, prefs: Preferences): { platform: string; why: string } {
  const hasYouTube = t.evidence.some((e) => e.source === 'youtube' || /youtu\.?be/.test(e.url));
  const hasShortsSignal = t.evidence.some((e) => /shorts\//.test(e.url));
  const p = profileFor(t.category);
  if (hasShortsSignal) return { platform: 'YouTube Shorts', why: 'Evidence includes Shorts links; the format is proven short-form.' };
  if (hasYouTube && p.longevity >= 0.6) return { platform: 'YouTube (long-form + Shorts cutdown)', why: 'YouTube evidence and an evergreen category; long-form RPM is far higher than Shorts.' };
  if (t.category === 'Music' || t.category === 'Comedy' || t.category === 'Animals & Pets') return { platform: 'YouTube Shorts + TikTok', why: 'Short, sound-led formats travel across Shorts and TikTok; post to both.' };
  if (t.category === 'Animation & Art') return { platform: 'YouTube Shorts (then Bluesky/TikTok)', why: 'Animation clips do well as Shorts; Bluesky has an active animation community right now.' };
  if (t.category === 'Tech & AI' || t.category === 'Business & Finance' || t.category === 'Science & Education') return { platform: 'YouTube (long-form)', why: 'High-RPM categories; long-form watch time pays best.' };
  if (prefs.platforms.includes('youtube_shorts')) return { platform: 'YouTube Shorts', why: 'Your default short-form platform.' };
  return { platform: 'YouTube Shorts + TikTok', why: 'Default short-form distribution.' };
}

export function growthLabel(t: Trend): { label: string; dir: 'up' | 'flat' | 'down' | 'unknown' } {
  const g = t.scores.growth;
  if (t.scores.momentumBasis !== 'observed' || g == null) return { label: 'Growth not yet measured (first observation)', dir: 'unknown' };
  const pct = Math.round((g - 1) * 100);
  const win = t.scores.growthWindowHours ? ` over ${Math.round(t.scores.growthWindowHours)}h` : '';
  if (g >= 1.15) return { label: `Growing: +${pct}%${win}`, dir: 'up' };
  if (g <= 0.85) return { label: `Declining: ${pct}%${win}`, dir: 'down' };
  return { label: `Flat: ${pct >= 0 ? '+' : ''}${pct}%${win}`, dir: 'flat' };
}
