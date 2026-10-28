import { createHash } from 'node:crypto';

export const nowIso = () => new Date().toISOString();

export function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex').slice(0, 12);
}

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeKey(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const STOPWORDS = new Set(
  `a an the and or of to in on for with at by from as is are was were be been being it its this that these those vs v
   i you he she we they me him her us them my your his our their what which who whom when where why how all any both
   each few more most other some such no nor not only own same so than too very s t can will just don should now
   up down out over under again further then once here there about after before during into through between
   live new day today tonight week 2024 2025 2026 official video videos watch latest news full episode ep part
   de la le les el los las en un une des du et y o da di il lo al del ft feat vs`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokenize(s: string): string[] {
  return normalizeKey(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function round(n: number, d = 1): number {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

/** Parse "2,000+" / "2000+" / "1K+" → 2000 */
export function parseApproxTraffic(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([kKmM]?)/);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  if (/k/i.test(m[2])) n *= 1_000;
  if (/m/i.test(m[2])) n *= 1_000_000;
  return Math.round(n);
}

export function extractHashtags(text: string): string[] {
  const out: string[] = [];
  const re = /#([\p{L}\p{N}_]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1].toLowerCase());
  return uniq(out);
}

export function hoursBetween(aIso: string, bIso: string): number {
  return Math.abs(new Date(aIso).getTime() - new Date(bIso).getTime()) / 36e5;
}

/** Detect YouTube video id from any youtube URL shape. */
export function youtubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || undefined;
    if (host === 'youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v') || undefined;
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function isVideoUrl(url: string): boolean {
  return (
    !!youtubeId(url) ||
    /tiktok\.com\/.+\/video\/\d+/.test(url) ||
    /tiktok\.com\/t\//.test(url) ||
    /instagram\.com\/(reel|reels|p)\//.test(url) ||
    /video\.bsky\.app\//.test(url)
  );
}

/** Adult / unsafe markers we refuse to surface as creator opportunities. */
const UNSAFE_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'gore', 'sexual-figurative']);
export function isUnsafeLabel(val: string): boolean {
  return UNSAFE_LABELS.has(val);
}
export function hasUnsafeMarkers(text: string): boolean {
  return /🔞|\bnsfw\b|\bporn\b|\bhentai\b|\bonlyfans\b/i.test(text);
}

export function logNorm(value: number, lo: number, hi: number): number {
  // maps value on a log scale between lo..hi to 0..1
  if (value <= lo) return 0;
  if (value >= hi) return 1;
  return (Math.log(value) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
}
