/**
 * Browser QA (4.0) — runs in GitHub Actions (open internet, real Chromium), never on a personal machine.
 *   node qa/playwright-qa.mjs https://cge6media.github.io/viral-radar/ data/qa
 * Produces screenshots at 1440 / 768 / 390 px for the main pages, measures load time, and performs REAL playback
 * checks: opens video cards, waits for the official embed iframe and watches the network for media delivery
 * (googlevideo.com / tiktokcdn / instagram / fbcdn) — an "embeddable" API flag is not enough.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const site = process.argv[2] || 'https://cge6media.github.io/viral-radar/';
const out = process.argv[3] || 'data/qa';
await mkdir(out, { recursive: true });
const widths = [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'mobile']];
const pages = [['#/', 'discover'], ['#/viral', 'viral'], ['#/radar', 'radar'], ['#/desk', 'desk'], ['#/trends', 'trends'], ['#/scorecard', 'scorecard'], ['#/alerts', 'alerts'], ['#/watchlist', 'journal'], ['#/money', 'money'], ['#/hall-of-fame', 'hof'], ['#/settings?tab=health', 'health']];
const report = { site, at: new Date().toISOString(), load: [], screenshots: [], playback: [], console: [], navigation: [] };

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
for (const [w, h, name] of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, userAgent: name === 'mobile' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.console.push({ width: w, text: m.text().slice(0, 200) }); });
  page.on('pageerror', (e) => report.console.push({ width: w, text: `pageerror: ${String(e).slice(0, 200)}` }));
  for (const [hash, label] of pages) {
    const t0 = Date.now();
    await page.goto(`${site}${hash}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined);
    // wait for data to render (first h1 after the snapshot loads)
    await page.waitForSelector('main h1, main .notice, main .empty', { timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    const ms = Date.now() - t0;
    const h1 = await page.locator('main h1').first().textContent().catch(() => '');
    const thumbs = await page.evaluate(() => Array.from(document.querySelectorAll('img.fg, .vthumb img.fg')).slice(0, 40).map((i) => ({ ok: i.complete && i.naturalWidth > 0 })));
    const loaded = thumbs.filter((t) => t.ok).length;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    const overflowers = overflow ? await page.evaluate(() => { const vw = document.documentElement.clientWidth; return Array.from(document.querySelectorAll('body *')).filter((e) => e.getBoundingClientRect().right > vw + 1 && e.getBoundingClientRect().width > 0).slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')}@${Math.round(e.getBoundingClientRect().right)}`); }) : [];
    const file = path.join(out, `${label}-${name}.png`);
    await page.screenshot({ path: file, fullPage: label === 'discover' || label === 'desk' ? false : false });
    report.screenshots.push({ page: label, width: w, file: path.basename(file), h1: (h1 || '').trim().slice(0, 80), thumbsLoaded: `${loaded}/${thumbs.length}`, horizontalOverflow: overflow, overflowers, loadMs: ms });
    if (label === 'discover') report.load.push({ width: w, ms });
  }
  // navigation flow on this width: open a trend from Discover; open the desk playbook
  try {
    await page.goto(`${site}#/desk`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('main h1', { timeout: 30000 });
    const btn = page.locator('button:has-text("Open the playbook")').first();
    if (await btn.count()) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ force: true, timeout: 10000 });
      await page.waitForSelector('text=Production playbook', { timeout: 15000 });
      await page.screenshot({ path: path.join(out, `playbook-${name}.png`) });
      const exportBtn = page.locator('button:has-text("Export brief")').first();
      report.navigation.push({ width: w, flow: 'desk → playbook', ok: true, exportButton: await exportBtn.count() > 0 });
    } else {
      report.navigation.push({ width: w, flow: 'desk → playbook', ok: false, note: 'no actionable opportunity on the desk (honest empty state)' });
    }
  } catch (e) { report.navigation.push({ width: w, flow: 'desk → playbook', ok: false, note: String(e).slice(0, 160) }); }
  await ctx.close();
}

// Real playback checks (desktop width): open the first N cards on Viral Now and Early Radar and watch for media.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const media = new Set();
page.on('request', (r) => { const u = r.url(); if (/googlevideo\.com\/videoplayback|\.tiktokcdn|cdninstagram|fbcdn\.net\/.*\.mp4|video\.bsky\.app\/.*\.m3u8|video\.bsky\.app\/.*\.ts/.test(u)) media.add(u.slice(0, 80)); });
for (const [hash, label] of [['#/viral', 'viral'], ['#/radar', 'radar'], ['#/hall-of-fame', 'hof']]) {
  await page.goto(`${site}${hash}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined);
  await page.waitForSelector('.vcard .media, .hof .media', { timeout: 30000 }).catch(() => undefined);
  const cards = page.locator('.vcard .media, .hof .media');
  const n = Math.min(await cards.count(), label === 'hof' ? 3 : 6);
  for (let i = 0; i < n; i++) {
    const before = media.size;
    const title = await cards.nth(i).getAttribute('aria-label').catch(() => '');
    await cards.nth(i).click().catch(() => undefined);
    const frame = page.locator('.modal-media iframe').first();
    const hasIframe = await frame.waitFor({ state: 'attached', timeout: 8000 }).then(() => true).catch(() => false);
    let frameSrc = hasIframe ? await frame.getAttribute('src').catch(() => '') : '';
    // give the player time to start (autoplay=1 in the embed URL)
    await page.waitForTimeout(5000);
    let playing = media.size > before;
    let clickedPlay = false;
    let botWall = false;
    // a real click on the player's own play button inside the (cross-origin) embed — the media request is the proof
    if (!playing && hasIframe) {
      try {
        const fl = page.frameLocator('.modal-media iframe').first();
        // YouTube serves a "Sign in to confirm you're not a bot" wall to datacenter IPs (the runner) — not an app defect
        botWall = (await fl.locator('text=/confirm you.re not a bot/i').count().catch(() => 0)) > 0;
        const playBtn = fl.locator('.ytp-large-play-button, button[aria-label*="Play"], [class*="play"]').first();
        if (await playBtn.count()) { await playBtn.click({ timeout: 4000 }); clickedPlay = true; }
        else { const box = await frame.boundingBox(); if (box) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); clickedPlay = true; } }
      } catch { /* ignore */ }
      await page.waitForTimeout(6000);
      playing = media.size > before;
    }
    const fallback = await page.locator('.modal-media .noembed a').count();
    if (i === 0) await page.screenshot({ path: path.join(out, `player-${label}.png`) });
    report.playback.push({ page: label, index: i + 1, title: (title || '').replace(/^Play: /, '').slice(0, 70), embed: hasIframe, clickedPlay, botWall, provider: /youtube/.test(frameSrc) ? 'youtube' : /tiktok/.test(frameSrc) ? 'tiktok' : /instagram/.test(frameSrc) ? 'instagram' : /facebook/.test(frameSrc) ? 'facebook' : /bsky/.test(frameSrc) ? 'bluesky' : hasIframe ? 'other' : 'none', mediaDelivered: playing, fallbackLink: fallback > 0 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
await browser.close();
const played = report.playback.filter((p) => p.mediaDelivered).length;
report.summary = { playbackChecked: report.playback.length, mediaDelivered: played, botWall: report.playback.filter((p) => p.botWall).length, embeds: report.playback.filter((p) => p.embed).length, consoleErrors: report.console.length, overflowPages: report.screenshots.filter((s) => s.horizontalOverflow).map((s) => `${s.page}@${s.width}`), loadMsDiscover: report.load };
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.summary, null, 1));
