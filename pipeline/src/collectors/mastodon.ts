/**
 * Mastodon — public, documented trends API (no auth): /api/v1/trends/tags
 * Returns hashtags with a 7-day history (uses + accounts per day), which gives us
 * REAL day-over-day growth from the very first run.
 * Evidence kind: hashtag.
 * Verified live on 2026-10-28 against mastodon.social.
 */
import type { Observation } from '../types.js';
import { fetchJson } from '../lib/http.js';
import { normalizeKey, nowIso } from '../lib/util.js';

export const MASTODON_INSTANCES = (process.env.VR_MASTODON_INSTANCES || 'mastodon.social').split(',').map((s) => s.trim()).filter(Boolean);

export interface MastoTag {
  name: string;
  url: string;
  history?: { day: string; uses: string; accounts: string }[];
}

export function tagToObservation(t: MastoTag, instance: string, rank: number, observedAt = nowIso()): Observation {
  const key = normalizeKey(t.name);
  const hist = (t.history || [])
    .map((h) => ({ t: new Date(Number(h.day) * 1000).toISOString(), value: Number(h.uses) || 0, accounts: Number(h.accounts) || 0 }))
    .sort((a, b) => a.t.localeCompare(b.t));
  const latest = hist[hist.length - 1];
  return {
    id: `mastodon:hashtag:${key}`,
    source: 'mastodon',
    kind: 'hashtag',
    key,
    title: `#${t.name}`,
    url: t.url,
    observedAt,
    metrics: { uses: latest?.value, accounts: latest?.accounts, rank },
    text: t.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
    tags: [t.name.toLowerCase()],
    history: hist.map(({ t, value }) => ({ t, value })),
    query: `trends/tags @${instance}`,
  };
}

export async function collectMastodon(instances = MASTODON_INSTANCES): Promise<{ items: Observation[]; errors: string[] }> {
  const items: Observation[] = [];
  const errors: string[] = [];
  for (const inst of instances) {
    try {
      const tags = await fetchJson<MastoTag[]>(`https://${inst}/api/v1/trends/tags?limit=20`);
      tags.forEach((t, i) => items.push(tagToObservation(t, inst, i + 1)));
    } catch (e) {
      errors.push(`${inst}: ${(e as Error).message}`);
    }
  }
  return { items, errors };
}
