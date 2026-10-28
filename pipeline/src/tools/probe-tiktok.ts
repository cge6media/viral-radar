/**
 * Probe which TikTok public/undocumented endpoints answer from the GitHub runner, and what they return.
 * Writes data/diagnostics/tiktok-probe.json (status + payload shape + first items). Nothing enters the store.
 *   tsx src/tools/probe-tiktok.ts
 */
import { writeJson } from '../lib/store.js';
import { nowIso } from '../lib/util.js';

const CC_REFERER = 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const probes: { name: string; url: string; headers?: Record<string, string> }[] = [
  { name: 'cc_hashtags_7d_US', url: 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?page=1&limit=20&period=7&country_code=US&sort_by=popular', headers: { referer: CC_REFERER } },
  { name: 'cc_hashtags_7d_US_new', url: 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?page=1&limit=20&period=7&country_code=US&sort_by=new_on_board', headers: { referer: CC_REFERER } },
  { name: 'cc_videos_list', url: 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/list?page=1&limit=20&period=7&country_code=US&order_by=vv', headers: { referer: CC_REFERER } },
  { name: 'cc_sounds_rank', url: 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/sound/rank_list?page=1&limit=20&period=7&country_code=US&rank_type=popular', headers: { referer: CC_REFERER } },
  { name: 'cc_creators_list', url: 'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/creator/list?page=1&limit=20&period=7&country_code=US&sort_by=follower', headers: { referer: CC_REFERER } },
  { name: 'oembed_known_video', url: 'https://www.tiktok.com/oembed?url=https://www.tiktok.com/@tiktok/video/7106594312292453675' },
  { name: 'tiktok_explore_html', url: 'https://www.tiktok.com/explore' },
  { name: 'tiktok_tag_html', url: 'https://www.tiktok.com/tag/fyp' },
];

async function probe(p: (typeof probes)[number]) {
  const t0 = Date.now();
  try {
    const res = await fetch(p.url, { headers: { 'user-agent': UA, accept: 'application/json,text/html;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9', ...(p.headers || {}) }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    let shape: unknown = undefined;
    let sample: unknown = undefined;
    if (/json/.test(ct) || text.trim().startsWith('{')) {
      try {
        const j = JSON.parse(text);
        shape = describe(j, 0);
        const list = j?.data?.list || j?.data?.videos || j?.data?.sound_list || j?.data?.creators || (Array.isArray(j?.data) ? j.data : undefined);
        sample = Array.isArray(list) ? list.slice(0, 3) : (j && typeof j === 'object' ? Object.fromEntries(Object.entries(j).slice(0, 8)) : j);
      } catch { shape = 'invalid json'; }
    } else {
      const m = text.match(/<title>([^<]*)<\/title>/i);
      const sigi = /SIGI_STATE|__UNIVERSAL_DATA_FOR_REHYDRATION__/.test(text);
      shape = { html: true, title: m?.[1]?.slice(0, 120), length: text.length, hasRehydrationState: sigi, snippet: text.slice(0, 300) };
    }
    return { name: p.name, url: p.url, status: res.status, contentType: ct, ms: Date.now() - t0, shape, sample };
  } catch (e) {
    return { name: p.name, url: p.url, error: (e as Error).message, ms: Date.now() - t0 };
  }
}

function describe(v: unknown, depth: number): unknown {
  if (depth > 3) return typeof v;
  if (Array.isArray(v)) return [`array(${v.length})`, v.length ? describe(v[0], depth + 1) : undefined];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).slice(0, 25).map(([k, x]) => [k, describe(x, depth + 1)]));
  return typeof v;
}

async function main() {
  const results = [];
  for (const p of probes) {
    const r = await probe(p);
    results.push(r);
    console.log(`${r.name}: ${'status' in r ? r.status + ' ' + (r as { contentType?: string }).contentType : 'ERR ' + (r as { error?: string }).error} (${r.ms}ms)`);
  }
  await writeJson('diagnostics/tiktok-probe.json', { probedAt: nowIso(), results });
}
main();
