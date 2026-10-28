/**
 * Google Trends — "Trending now" RSS feed.
 * Endpoint: https://trends.google.com/trending/rss?geo=<REGION>
 * Evidence kind: search_interest (NOT video performance).
 *
 * Verified live on 2026-10-28: returns <item> elements with title, ht:approx_traffic,
 * pubDate, ht:picture, ht:picture_source and up to 3 ht:news_item children.
 */
import { XMLParser } from 'fast-xml-parser';
import type { Observation } from '../types.js';
import { fetchText } from '../lib/http.js';
import { normalizeKey, nowIso, parseApproxTraffic } from '../lib/util.js';

export const GOOGLE_TRENDS_REGIONS = (process.env.VR_GT_REGIONS || 'US,GB,CA,AU').split(',').map((s) => s.trim()).filter(Boolean);

export function feedUrl(geo: string): string {
  return `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
}

interface NewsItem {
  'ht:news_item_title'?: string;
  'ht:news_item_url'?: string;
  'ht:news_item_source'?: string;
  'ht:news_item_picture'?: string;
}
interface RssItem {
  title?: string;
  'ht:approx_traffic'?: string;
  pubDate?: string;
  'ht:picture'?: string;
  'ht:picture_source'?: string;
  'ht:news_item'?: NewsItem | NewsItem[];
}

export function parseGoogleTrendsRss(xml: string, geo: string, observedAt = nowIso()): Observation[] {
  const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata', trimValues: true });
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) return [];
  const itemsRaw = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  const out: Observation[] = [];
  itemsRaw.forEach((it: RssItem, idx: number) => {
    const title = str(it.title);
    if (!title) return;
    const newsRaw = it['ht:news_item'] ? (Array.isArray(it['ht:news_item']) ? it['ht:news_item'] : [it['ht:news_item']]) : [];
    const links = newsRaw
      .map((n) => ({ title: str(n['ht:news_item_title']), url: str(n['ht:news_item_url']), source: str(n['ht:news_item_source']) }))
      .filter((l) => l.url);
    const key = normalizeKey(title);
    const pub = it.pubDate ? new Date(it.pubDate) : undefined;
    out.push({
      id: `google_trends:search_interest:${key}`,
      source: 'google_trends',
      kind: 'search_interest',
      key,
      title,
      url: `https://trends.google.com/trending?geo=${encodeURIComponent(geo)}&q=${encodeURIComponent(title)}`,
      observedAt,
      publishedAt: pub && !isNaN(pub.getTime()) ? pub.toISOString() : undefined,
      metrics: { approxTraffic: parseApproxTraffic(str(it['ht:approx_traffic'])), rank: idx + 1 },
      region: geo,
      thumbnail: str(it['ht:picture']) || undefined,
      text: links.map((l) => l.title).join('. '),
      links,
      query: `rss geo=${geo}`,
    });
  });
  return out;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && v && '__cdata' in (v as Record<string, unknown>)) return String((v as Record<string, unknown>).__cdata ?? '');
  return String(v).trim();
}

export async function collectGoogleTrends(regions = GOOGLE_TRENDS_REGIONS): Promise<{ items: Observation[]; errors: string[] }> {
  const items: Observation[] = [];
  const errors: string[] = [];
  for (const geo of regions) {
    try {
      const xml = await fetchText(feedUrl(geo));
      items.push(...parseGoogleTrendsRss(xml, geo));
    } catch (e) {
      errors.push(`${geo}: ${(e as Error).message}`);
    }
  }
  return { items, errors };
}
