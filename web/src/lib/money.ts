/**
 * Money Engine — platform programs (researched Oct 2026) + earnings calculator.
 * RPM figures are planning ranges from public creator reports and guides, NOT verified payout data.
 * Every preset is editable in the calculator. Sources are listed per platform and in docs/DATA_SOURCES.md.
 */
export interface PlatformProgram {
  id: string;
  name: string;
  program: string;
  model: 'ad_share' | 'creator_pool' | 'qualified_views' | 'none';
  modelNote: string;
  eligibility: string[];
  /** RPM per 1,000 eligible/qualified views, USD — planning ranges */
  rpm: { low: number; base: number; high: number };
  /** typical share of raw views that are "eligible" (monetizable / qualified) — editable assumption */
  eligibleShareDefault: number;
  payoutNote: string;
  sources: { title: string; url: string; date: string }[];
  caveats: string[];
}

export const PROGRAMS: PlatformProgram[] = [
  {
    id: 'youtube_long',
    name: 'YouTube long-form',
    program: 'YouTube Partner Program (watch-page ads)',
    model: 'ad_share',
    modelNote: 'Ads sold against your videos; you receive a revenue share (YouTube has long published 55% to the creator for watch-page ads). RPM varies enormously by niche, viewer country and ad load.',
    eligibility: ['1,000 subscribers', '4,000 qualified public watch hours in the last 12 months (Shorts-feed watch time does not count)', 'Linked AdSense account, no active Community Guidelines strikes', 'Updated YPP terms must be accepted by Jan 31, 2027 (changes start Feb 1, 2027)'],
    rpm: { low: 1, base: 4, high: 12 },
    eligibleShareDefault: 0.85,
    payoutNote: 'Monthly via AdSense once the balance reaches $100.',
    sources: [
      { title: 'YouTube Help — YouTube Partner Program overview & eligibility', url: 'https://support.google.com/youtube/answer/72851', date: 'checked 2026-10-28' },
      { title: 'vidIQ — YouTube Shorts monetization 2026 (long-form RPM $1–$30 comparison)', url: 'https://vidiq.com/blog/post/youtube-shorts-monetization/', date: 'updated 2026-05-28' },
    ],
    caveats: ['Finance/tech/business niches can see $10–$30 RPM; entertainment, music and animal content usually sit at the low end.', 'Only "monetized playbacks" earn — ad-blocked, under-13 and non-ad-eligible views pay nothing.'],
  },
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    program: 'YouTube Partner Program (Shorts ad revenue pool)',
    model: 'creator_pool',
    modelNote: 'Shorts ad revenue is pooled, part is paid to music licensors, then creators receive 45% of the pool allocated by their share of eligible Shorts views.',
    eligibility: ['1,000 subscribers', '10 million qualified public Shorts views in the last 90 days', 'Reported (unofficial) change from Feb 1, 2027: 20M Shorts views / 8,000 watch hours — verify in YouTube Studio'],
    rpm: { low: 0.03, base: 0.06, high: 0.1 },
    eligibleShareDefault: 0.9,
    payoutNote: 'Monthly via AdSense; Shorts and long-form earnings combine toward the $100 threshold.',
    sources: [
      { title: 'YouTube Help — YouTube Partner Program overview & eligibility', url: 'https://support.google.com/youtube/answer/72851', date: 'checked 2026-10-28' },
      { title: 'vidIQ — YouTube Shorts monetization 2026 (RPM $0.03–$0.10)', url: 'https://vidiq.com/blog/post/youtube-shorts-monetization/', date: 'updated 2026-05-28' },
    ],
    caveats: ['Shorts pay roughly 1–3% of long-form RPM per view: 1M Shorts views ≈ $30–$100.', 'Shorts are a discovery engine — the money usually comes from sponsorships, long-form conversions and products, not the Shorts pool.'],
  },
  {
    id: 'tiktok_rewards',
    name: 'TikTok',
    program: 'TikTok Creator Rewards Program',
    model: 'qualified_views',
    modelNote: 'Pays per 1,000 "qualified" For You feed views on original videos longer than one minute, after a 1,000-qualified-view floor per video. RPM is not fixed; it depends on viewer country, engagement and search value.',
    eligibility: ['18+ (19 in South Korea), personal account in good standing', '10,000 followers', '100,000 video views in the last 30 days', 'Original videos longer than 1 minute', 'Supported region (US, UK, DE, FR, BR, JP, KR and others)'],
    rpm: { low: 0.4, base: 0.8, high: 2.0 },
    eligibleShareDefault: 0.6,
    payoutNote: 'Daily estimates in-app; withdrawals after the balance exceeds the program minimum.',
    sources: [
      { title: 'ttcalculator.net — TikTok Creator Rewards Program requirements, RPM & payouts (2026)', url: 'https://ttcalculator.net/learn/creator-rewards-program/', date: 'updated 2026-07-10' },
      { title: 'ShortSync — Facebook/TikTok comparison ($0.40–$1.20 per 1k TikTok views)', url: 'https://www.shortsync.app/resources/facebook-content-monetization-program-2026', date: '2026-08-12' },
    ],
    caveats: ['Videos under 60 seconds earn nothing from Rewards — short clips must be stretched past 1:00 to qualify.', 'Only For You feed views over 5 seconds count; profile and repeat views are excluded (we default eligible share to 60%).'],
  },
  {
    id: 'facebook_cmp',
    name: 'Facebook',
    program: 'Facebook Content Monetization (Reels, videos, photos, text)',
    model: 'ad_share',
    modelNote: 'Performance-based payouts from in-stream and Reels ads (creator share reported around 55%). Meta does not publish RPMs; ranges below are creator-reported estimates.',
    eligibility: ['10,000 Page followers (Page, not personal profile)', '600,000 minutes viewed in the last 60 days and 5+ active video uploads', 'Page and account at least 30 days old, 18+, eligible country', 'Invitation-based onboarding (rolling reviews)'],
    rpm: { low: 0.5, base: 2, high: 6 },
    eligibleShareDefault: 0.8,
    payoutNote: 'Monthly around the 21st; $25 minimum (US), $100 in most other countries.',
    sources: [
      { title: 'ShortSync — Facebook Content Monetization Program: complete 2026 guide', url: 'https://www.shortsync.app/resources/facebook-content-monetization-program-2026', date: '2026-08-12' },
      { title: 'Neal Schaffer — Facebook Content Monetization guide', url: 'https://nealschaffer.com/facebook-content-monetization/', date: '2026' },
    ],
    caveats: ['Entertainment/comedy with mixed geography reports $0.50–$2 RPM; US how-to/lifestyle $2–$6; finance/tech $8–$20+.', 'Third-party guides, not Meta documentation — treat as planning ranges.'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    program: 'No per-view program (brand deals, gifts, invite-only bonuses)',
    model: 'none',
    modelNote: 'Instagram Reels has no public per-view ad-share pool. Income comes from sponsorships, affiliate links, Gifts and occasional invite-only bonuses.',
    eligibility: ['Professional account', 'Brand deals via Creator Marketplace (invite / brand-initiated)', 'Gifts and subscriptions in eligible countries'],
    rpm: { low: 0, base: 0, high: 0 },
    eligibleShareDefault: 1,
    payoutNote: 'Depends on the deal; no platform RPM.',
    sources: [
      { title: 'ShortSync — Instagram: no per-view pool; brand deals and invite-only bonuses', url: 'https://www.shortsync.app/resources/facebook-content-monetization-program-2026', date: '2026-08-12' },
    ],
    caveats: ['Use Instagram for reach and sponsorship leverage; model its revenue through the sponsorship and affiliate inputs.'],
  },
];

export const SPONSORSHIP_NOTE = 'Sponsorship rates are negotiated per video. A common planning rule is a CPM-style rate of $10–$40 per 1,000 expected views for integrations, or a flat fee tied to audience size and niche.';
export const AFFILIATE_NOTE = 'Affiliate income = clicks × conversion × commission. A planning assumption: 1–3% of viewers click, 2–5% of those buy, at a 5–20% commission on the cart value.';

export interface CalcInput {
  platformId: string;
  videosPerMonth: number;
  viewsPerVideo: number;
  eligibleShare: number; // 0..1
  rpm: number;           // base RPM per 1,000 eligible views (USD)
  rpmLowMult: number;    // low scenario = rpm × mult
  rpmHighMult: number;   // high scenario = rpm × mult
  costPerVideo: number;
  fixedMonthly: number;
  eligible: boolean;     // currently meets the program's eligibility?
  sponsorPerVideo: number;      // flat sponsorship revenue per video (0 if none)
  sponsorVideosShare: number;   // share of videos that carry a sponsor (0..1)
  affiliatePerThousandViews: number; // expected affiliate revenue per 1,000 views
}

export interface Scenario { name: 'Low' | 'Base' | 'High'; rpm: number; adRevenue: number; sponsor: number; affiliate: number; revenue: number; net: number; roi: number }
export interface CalcOutput {
  monthlyViews: number;
  eligibleViews: number;
  expenses: number;
  scenarios: Scenario[];
  breakEvenViews: number | null;      // monthly raw views needed at base RPM for revenue == expenses
  breakEvenVideos: number | null;     // videos/month needed at current views/video
  notes: string[];
}

export function calculate(i: CalcInput): CalcOutput {
  const monthlyViews = i.videosPerMonth * i.viewsPerVideo;
  const eligibleViews = monthlyViews * i.eligibleShare;
  const expenses = i.videosPerMonth * i.costPerVideo + i.fixedMonthly;
  const sponsor = i.videosPerMonth * i.sponsorVideosShare * i.sponsorPerVideo;
  const affiliate = (monthlyViews / 1000) * i.affiliatePerThousandViews;
  const notes: string[] = [];
  const programRpm = i.eligible ? i.rpm : 0;
  if (!i.eligible) notes.push('Not yet eligible for the platform program — ad/program revenue counted as $0 until you qualify. Sponsorship and affiliate still apply.');
  const mk = (name: Scenario['name'], mult: number): Scenario => {
    const rpm = programRpm * mult;
    const adRevenue = (eligibleViews / 1000) * rpm;
    const revenue = adRevenue + sponsor + affiliate;
    const net = revenue - expenses;
    return { name, rpm, adRevenue, sponsor, affiliate, revenue, net, roi: expenses > 0 ? net / expenses : 0 };
  };
  const scenarios = [mk('Low', i.rpmLowMult), mk('Base', 1), mk('High', i.rpmHighMult)];
  // break-even at base: revenue(views) = expenses  →  views × perView = expenses
  const perView = (i.eligibleShare * programRpm) / 1000 + i.affiliatePerThousandViews / 1000;
  const fixedRevenue = sponsor; // independent of views
  let breakEvenViews: number | null = null;
  let breakEvenVideos: number | null = null;
  if (perView > 0) {
    breakEvenViews = Math.max(0, (expenses - fixedRevenue) / perView);
    breakEvenVideos = i.viewsPerVideo > 0 ? breakEvenViews / i.viewsPerVideo : null;
  } else if (fixedRevenue >= expenses) {
    breakEvenViews = 0;
    breakEvenVideos = 0;
  }
  return { monthlyViews, eligibleViews, expenses, scenarios, breakEvenViews, breakEvenVideos, notes };
}

export const EXAMPLE_SCENARIOS = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000];

export function defaultsFor(platformId: string): Pick<CalcInput, 'rpm' | 'rpmLowMult' | 'rpmHighMult' | 'eligibleShare'> {
  const p = PROGRAMS.find((x) => x.id === platformId) || PROGRAMS[0];
  return {
    rpm: p.rpm.base,
    rpmLowMult: p.rpm.base > 0 ? p.rpm.low / p.rpm.base : 0,
    rpmHighMult: p.rpm.base > 0 ? p.rpm.high / p.rpm.base : 0,
    eligibleShare: p.eligibleShareDefault,
  };
}
