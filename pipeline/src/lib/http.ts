/**
 * Minimal fetch wrapper with timeout, retries, UA and a fixture mode.
 *
 * In fixture mode (VR_FIXTURES=1 / --fixtures) every request is answered from
 * pipeline/fixtures/<sha1(url)>.{json,xml,txt} if present; otherwise it throws.
 * This lets tests and offline builds run against real captured responses.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha1 } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = path.resolve(__dirname, '../../fixtures');

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  /** record live responses into fixtures (VR_RECORD=1) */
  record?: boolean;
}

export const USER_AGENT =
  'ViralRadar/0.1 (+https://github.com/viral-radar; trend research bot; contact via repo issues)';

export function fixtureMode(): boolean {
  return process.env.VR_FIXTURES === '1';
}

async function readFixture(url: string): Promise<string | undefined> {
  const base = path.join(FIXTURE_DIR, sha1(url));
  for (const ext of ['json', 'xml', 'txt']) {
    try {
      return await readFile(`${base}.${ext}`, 'utf8');
    } catch {
      /* try next */
    }
  }
  // Also allow named fixtures via a manifest: fixtures/manifest.json {url: file}
  try {
    const manifest = JSON.parse(await readFile(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8')) as Record<string, string>;
    if (manifest[url]) return await readFile(path.join(FIXTURE_DIR, manifest[url]), 'utf8');
  } catch {
    /* no manifest */
  }
  return undefined;
}

export async function fetchText(url: string, opts: HttpOptions = {}): Promise<string> {
  if (fixtureMode()) {
    const fx = await readFixture(url);
    if (fx === undefined) throw new Error(`No fixture for ${url} (sha1 ${sha1(url)})`);
    return fx;
  }
  const { timeoutMs = 20_000, retries = 2, headers = {} } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'application/json, application/xml, text/xml, text/*;q=0.8', ...headers },
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const text = await res.text();
      if (process.env.VR_RECORD === '1' || opts.record) {
        await mkdir(FIXTURE_DIR, { recursive: true });
        const ext = /^\s*[{[]/.test(text) ? 'json' : /^\s*</.test(text) ? 'xml' : 'txt';
        await writeFile(path.join(FIXTURE_DIR, `${sha1(url)}.${ext}`), text, 'utf8');
      }
      return text;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const text = await fetchText(url, opts);
  return JSON.parse(text) as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
