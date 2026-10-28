/**
 * Optional external alert delivery (4.0). Free, secret-based, off by default.
 *   ALERT_WEBHOOK_URL  a Discord webhook URL, or a Telegram Bot API sendMessage URL including chat_id
 *                      (https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>)
 *   VR_ALERT_WEBHOOK=1 enables posting
 * Posts only this run's NEW high-severity alerts (≤10). The URL is never logged.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../lib/store.js';
import type { Snapshot } from '../types.js';

async function main() {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || process.env.VR_ALERT_WEBHOOK !== '1') { console.log('external alerts disabled'); return; }
  const snap = JSON.parse(await readFile(path.join(DATA_DIR, 'latest.json'), 'utf8')) as Snapshot;
  const fresh = (snap.alerts || []).filter((a) => a.at === snap.generatedAt && a.severity === 'high').slice(0, 10);
  if (!fresh.length) { console.log('no new high-severity alerts'); return; }
  const site = process.env.VR_SITE_URL || 'https://cge6media.github.io/viral-radar/';
  const text = [`Viral Radar — ${fresh.length} new alert${fresh.length === 1 ? '' : 's'} (${snap.generatedAt.slice(0, 16).replace('T', ' ')} UTC)`, ...fresh.map((a) => `• [${a.kind.replace('_', ' ')}] ${a.subject.title.slice(0, 80)} — ${a.evidence.slice(0, 140)}${a.subject.url ? ` ${a.subject.url}` : ''}`), `${site}#/alerts`].join('\n');
  const isTelegram = /api\.telegram\.org/.test(url);
  const body = isTelegram ? { text, disable_web_page_preview: true } : { content: text.slice(0, 1900) };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  console.log(`posted ${fresh.length} alerts: HTTP ${res.status}`);
  if (!res.ok) process.exitCode = 0; // never fail the collection because a notification failed
}
main().catch((e) => { console.error('notify failed:', (e as Error).message.replace(/https?:\/\/\S+/g, '<url>')); });
