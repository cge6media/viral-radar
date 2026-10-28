/**
 * Diagnostic: fetch the verified record of one or more YouTube videos (and their channel baseline) through the
 * Data API, and write it to data/diagnostics/<id>.json. Nothing here enters the observation store or the rankings —
 * it is for investigating cases ("why was this video missed?") and for the discovery benchmark.
 *
 * Usage (in GitHub Actions, where the key lives):  tsx src/tools/inspect.ts <videoIdOrUrl> [...]
 * Cost: videos.list 1 unit + channels.list 1 unit + playlistItems.list 1 unit + videos.list 1 unit per video.
 */
import { fetchJson } from '../lib/http.js';
import { writeJson } from '../lib/store.js';
import { nowIso, youtubeId } from '../lib/util.js';
import { isoDurationSeconds, type YtVideo } from '../collectors/youtube.js';

const API = 'https://www.googleapis.com/youtube/v3';

export interface VideoDiagnostic {
  id: string;
  fetchedAt: string;
  title: string;
  channel: { id: string; title: string; subscribers?: number; videos?: number; views?: number };
  publishedAt: string;
  ageHours: number;
  durationSec: number;
  isShort: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  viewsPerHourLifetime?: number;
  likeRate?: number;
  categoryId?: string;
  tags: string[];
  /** the channel's 20 most recent uploads (excluding this video): median views = creator baseline */
  channelBaseline?: { sampled: number; medianViews: number; maxViews: number; ratioToBaseline?: number; recent: { id: string; title: string; publishedAt: string; views?: number; durationSec: number }[] };
}

const num = (s?: string) => (s == null ? undefined : Number(s));

export async function inspectVideo(idOrUrl: string, apiKey: string): Promise<VideoDiagnostic> {
  const id = youtubeId(idOrUrl) || idOrUrl.trim();
  const v = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=snippet,statistics,contentDetails&id=${id}&key=${apiKey}`, { retries: 0 });
  const item = v.items?.[0];
  if (!item) throw new Error(`video ${id} not found (private, removed, or wrong id)`);
  const durationSec = isoDurationSeconds(item.contentDetails?.duration || 'PT0S');
  const fetchedAt = nowIso();
  const ageHours = (new Date(fetchedAt).getTime() - new Date(item.snippet.publishedAt).getTime()) / 36e5;
  const views = num(item.statistics?.viewCount);
  const likes = num(item.statistics?.likeCount);
  const out: VideoDiagnostic = {
    id, fetchedAt, title: item.snippet.title,
    channel: { id: item.snippet.channelId, title: item.snippet.channelTitle },
    publishedAt: item.snippet.publishedAt, ageHours: Math.round(ageHours * 10) / 10, durationSec, isShort: durationSec > 0 && durationSec <= 180,
    views, likes, comments: num(item.statistics?.commentCount),
    viewsPerHourLifetime: views != null && ageHours > 0 ? Math.round(views / ageHours) : undefined,
    likeRate: views && likes != null ? Math.round((likes / views) * 10000) / 10000 : undefined,
    categoryId: item.snippet.categoryId, tags: (item.snippet.tags || []).slice(0, 20),
  };
  // channel + baseline
  try {
    const ch = await fetchJson<{ items: { statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>(
      `${API}/channels?part=statistics,contentDetails&id=${item.snippet.channelId}&key=${apiKey}`, { retries: 0 });
    const c = ch.items?.[0];
    if (c) {
      out.channel.subscribers = num(c.statistics?.subscriberCount);
      out.channel.videos = num(c.statistics?.videoCount);
      out.channel.views = num(c.statistics?.viewCount);
      const uploads = c.contentDetails?.relatedPlaylists?.uploads;
      if (uploads) {
        const pl = await fetchJson<{ items: { contentDetails: { videoId: string } }[] }>(`${API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=25&key=${apiKey}`, { retries: 0 });
        const ids = (pl.items || []).map((p) => p.contentDetails.videoId).filter((x) => x && x !== id).slice(0, 20);
        if (ids.length) {
          const vs = await fetchJson<{ items: YtVideo[] }>(`${API}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`, { retries: 0 });
          const recent = (vs.items || []).map((x) => ({ id: x.id, title: x.snippet.title, publishedAt: x.snippet.publishedAt, views: num(x.statistics?.viewCount), durationSec: isoDurationSeconds(x.contentDetails?.duration || 'PT0S') }));
          const viewsList = recent.map((r) => r.views).filter((x): x is number => x != null).sort((a, b) => a - b);
          const median = viewsList.length ? viewsList[Math.floor(viewsList.length / 2)] : 0;
          out.channelBaseline = { sampled: recent.length, medianViews: median, maxViews: viewsList[viewsList.length - 1] || 0, ratioToBaseline: views != null && median > 0 ? Math.round((views / median) * 10) / 10 : undefined, recent };
        }
      }
    }
  } catch (e) {
    out.channelBaseline = undefined;
    console.error('  channel baseline unavailable:', (e as Error).message.split(apiKey).join('***'));
  }
  return out;
}

/** Batch verification (1 unit per 50 ids): which ids exist, with title/channel/date/stats. Used for the Hall of Fame and benchmarks. */
export async function batchVerify(ids: string[], apiKey: string): Promise<Record<string, { found: boolean; title?: string; channel?: string; channelId?: string; publishedAt?: string; views?: number; likes?: number; comments?: number; durationSec?: number; embeddable?: boolean }>> {
  const out: Record<string, { found: boolean; title?: string; channel?: string; channelId?: string; publishedAt?: string; views?: number; likes?: number; comments?: number; durationSec?: number; embeddable?: boolean }> = {};
  const clean = Array.from(new Set(ids.map((x) => youtubeId(x) || x.trim()).filter((x) => /^[A-Za-z0-9_-]{6,}$/.test(x))));
  for (const id of clean) out[id] = { found: false };
  for (let i = 0; i < clean.length; i += 50) {
    const chunk = clean.slice(i, i + 50);
    const v = await fetchJson<{ items: (YtVideo & { status?: { embeddable?: boolean } })[] }>(`${API}/videos?part=snippet,statistics,contentDetails,status&id=${chunk.join(',')}&key=${apiKey}`, { retries: 0 });
    for (const it of v.items || []) {
      out[it.id] = { found: true, title: it.snippet.title, channel: it.snippet.channelTitle, channelId: it.snippet.channelId, publishedAt: it.snippet.publishedAt, views: num(it.statistics?.viewCount), likes: num(it.statistics?.likeCount), comments: num(it.statistics?.commentCount), durationSec: isoDurationSeconds(it.contentDetails?.duration || 'PT0S'), embeddable: it.status?.embeddable };
    }
  }
  return out;
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is not set — run this inside the GitHub Actions diagnostic workflow.');
    process.exit(2);
  }
  const argv = process.argv.slice(2);
  if (argv[0] === '--batch') {
    const name = argv[1];
    const ids = argv.slice(2).flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
    const res = await batchVerify(ids, apiKey);
    await writeJson(`diagnostics/batch-${name}.json`, { fetchedAt: nowIso(), results: res });
    for (const [id, r] of Object.entries(res)) console.log(`${id}: ${r.found ? `${r.views?.toLocaleString()} views · ${r.publishedAt?.slice(0, 10)} · ${r.channel} · ${r.title}` : 'NOT FOUND'}`);
    return;
  }
  const args = argv.flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
  if (!args.length) {
    console.error('usage: tsx src/tools/inspect.ts <videoIdOrUrl> [...]');
    process.exit(2);
  }
  for (const a of args) {
    try {
      const d = await inspectVideo(a, apiKey);
      await writeJson(`diagnostics/${d.id}.json`, d);
      const { channelBaseline, ...rest } = d;
      console.log(JSON.stringify({ ...rest, channelBaseline: channelBaseline ? { sampled: channelBaseline.sampled, medianViews: channelBaseline.medianViews, maxViews: channelBaseline.maxViews, ratioToBaseline: channelBaseline.ratioToBaseline } : undefined }, null, 2));
    } catch (e) {
      console.error(`${a}: ${(e as Error).message.split(apiKey).join('***')}`);
    }
  }
}

const invokedDirectly = process.argv[1] && /inspect\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) main();
