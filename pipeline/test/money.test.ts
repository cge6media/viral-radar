import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, defaultsFor, PROGRAMS, type CalcInput } from '../../web/src/lib/money.js';

const base: CalcInput = {
  platformId: 'youtube_shorts', videosPerMonth: 10, viewsPerVideo: 100_000, eligibleShare: 0.9, rpm: 0.06, rpmLowMult: 0.5, rpmHighMult: 5 / 3,
  costPerVideo: 50, fixedMonthly: 100, eligible: true, sponsorPerVideo: 0, sponsorVideosShare: 0, affiliatePerThousandViews: 0,
};

test('calculator: Shorts — 1M views at $0.06 RPM on 90% eligible views = $54; expenses and net are right', () => {
  const o = calculate(base);
  assert.equal(o.monthlyViews, 1_000_000);
  assert.equal(o.eligibleViews, 900_000);
  assert.equal(o.expenses, 600);
  const [low, mid, high] = o.scenarios;
  assert.equal(Math.round(mid.adRevenue * 100) / 100, 54);
  assert.equal(Math.round(low.adRevenue * 100) / 100, 27);
  assert.equal(Math.round(high.adRevenue), 90);
  assert.equal(Math.round(mid.net), -546);
  assert.equal(Math.round(mid.roi * 100), -91);
  // break-even by views (videos fixed at 10): 600 / (0.9 × 0.06 / 1000) = 11.11M views → 1.11M per video
  assert.equal(Math.round(o.breakEvenViews!), 11_111_111);
  assert.equal(Math.round(o.breakEvenViewsPerVideo!), 1_111_111);
  // break-even by output: each video nets 100K × 0.9 × 0.06/1000 − $50 = −$44.60 → more videos never break even
  assert.equal(Math.round(o.netPerVideo * 100) / 100, -44.6);
  assert.equal(o.breakEvenVideos, null);
});

test('calculator: break-even by output counts per-video cost; no-cost case; negative inputs are clamped', () => {
  // long-form: each video nets 100K × 0.85 × $4/1000 − $50 = $290 → fixed $100 needs 1 video
  const o = calculate({ ...base, platformId: 'youtube_long', rpm: 4, eligibleShare: 0.85 });
  assert.equal(Math.round(o.netPerVideo), 290);
  assert.equal(Math.ceil(o.breakEvenVideos!), 1);
  const free = calculate({ ...base, costPerVideo: 0, fixedMonthly: 0 });
  assert.equal(free.expenses, 0);
  assert.equal(free.breakEvenViews, 0);
  assert.equal(free.breakEvenVideos, 0);
  assert.equal(free.scenarios[1].roi, 0, 'ROI undefined without expenses → 0, not Infinity');
  const neg = calculate({ ...base, viewsPerVideo: -1000, videosPerMonth: -3, costPerVideo: -5 });
  assert.equal(neg.monthlyViews, 0);
  assert.ok(neg.expenses >= 0);
  assert.ok(Number.isFinite(neg.scenarios[2].net));
});

test('calculator: long-form — same views pay ~67× more at a $4 RPM', () => {
  const o = calculate({ ...base, platformId: 'youtube_long', rpm: 4, eligibleShare: 0.85 });
  assert.equal(Math.round(o.scenarios[1].adRevenue), 3400);
  assert.ok(o.scenarios[1].net > 0);
  assert.equal(Math.round(o.breakEvenViews!), 176_471);
});

test('calculator: not eligible → program revenue is zero; sponsorship and affiliate still count; break-even from fixed sponsor income', () => {
  const o = calculate({ ...base, eligible: false, sponsorPerVideo: 200, sponsorVideosShare: 0.5, affiliatePerThousandViews: 0.5 });
  assert.equal(o.scenarios[1].adRevenue, 0);
  assert.equal(o.scenarios[1].sponsor, 1000);
  assert.equal(o.scenarios[1].affiliate, 500);
  assert.equal(o.scenarios[1].revenue, 1500);
  assert.ok(o.notes.some((n) => /Not yet eligible/.test(n)));
  // perView = 0.5/1000 → (600 - 1000)/perView < 0 → clamped to 0
  assert.equal(o.breakEvenViews, 0);
  // each video: 100K × 0.5/1000 + 0.5 × $200 − $50 = $100 → fixed $100 needs 1 video
  assert.equal(o.netPerVideo, 100);
  assert.equal(o.breakEvenVideos, 1);
  const none = calculate({ ...base, eligible: false });
  assert.equal(none.breakEvenViews, null, 'no view-based revenue and no fixed revenue → unreachable');
});

test('calculator: presets load per platform and scale 100K → 100M monotonically', () => {
  for (const p of PROGRAMS) {
    const d = defaultsFor(p.id);
    assert.equal(d.rpm, p.rpm.base);
    let last = -1;
    for (const views of [100_000, 1_000_000, 10_000_000, 100_000_000]) {
      const o = calculate({ ...base, platformId: p.id, ...d, videosPerMonth: 1, viewsPerVideo: views });
      assert.ok(o.scenarios[1].revenue >= last, `${p.id} revenue should not decrease with views`);
      last = o.scenarios[1].revenue;
    }
  }
  const ig = calculate({ ...base, platformId: 'instagram', ...defaultsFor('instagram') });
  assert.equal(ig.scenarios[2].adRevenue, 0, 'Instagram has no per-view program');
});
