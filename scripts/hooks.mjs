// Title-hook and length analysis of the verified index (docs/MECHANISMS.md). Usage: node scripts/hooks.mjs [data/videos.json]
import { readFileSync } from 'node:fs';
const HOOKS = {
  question: /\?|^(why|how|what|who|when|where|can|does|did|is|are|would|should)\b/i, pov: /\bpov\b/i, when: /^when\b|\bwhen (you|your|he|she|they|the|my|we|a)\b/i, versus: /\bvs\.?\b|\bversus\b/i,
  numbered: /\b(top|best|worst)\s+\d+\b|\b\d+\s+(things|ways|reasons|tips|signs|types|levels)\b/i, series: /\b(part|ep|episode|day|chapter|round|level)\s*\d+\b|#\d+\b/i, challenge: /\bchallenge\b/i, reaction: /\breact(s|ion|ing)?\b/i,
  transformation: /\b(before|after|turned into|transform(ation|ed)?|makeover|glow[- ]?up|evolution|restor(e|ation|ing)|upgrade)\b/i, storytime: /\bstory ?time\b|\bstory\b/i, tutorial: /\bhow to\b|\btutorial\b|\btips?\b/i, sensory: /\basmr\b|\bsatisfying\b/i,
  payoff: /\bwait for (it|the end)\b|\bthe ending\b|\bplot twist\b|\bunexpected\b/i, animated: /\banimat(ed|ion|e)\b|\bcartoon\b|\b3d\b/i, ai: /\bai\b|\bsora\b|\bveo\b/i, character: /\b(character|mascot|puppet|robot|monster|alien|dinosaur)\b/i, music: /\bsong\b|\bcover\b|\bremix\b|\blyrics?\b|\bmusic\b/i,
  caps: /^[^a-z]*[A-Z]{3,}[^a-z]*$/, emoji: /\p{Extended_Pictographic}/u, second_person: /\byou\b|\byour\b/i, hashtagsOnly: /^(#\w+\s*)+$/,
};
const v = JSON.parse(readFileSync(process.argv[2] || 'data/videos.json', 'utf8')).records.filter((r) => r.platform === 'youtube' && r.verified && (r.metrics.views || 0) >= 10_000 && r.language === 'en');
const groups = { hit: v.filter((r) => r.state === 'verified_hit'), early: v.filter((r) => r.state === 'early_breakout'), rest: v.filter((r) => r.state === 'rejected') };
const med = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
console.log('English verified ≥10K views:', Object.entries(groups).map(([k, g]) => `${k} ${g.length}`).join(', '));
const rows = [];
for (const [h, re] of Object.entries(HOOKS)) {
  const r = {}; for (const [k, g] of Object.entries(groups)) r[k] = g.length ? Math.round(1000 * g.filter((x) => re.test(x.title)).length / g.length) / 10 : null;
  rows.push([h, r.hit, r.early, r.rest, r.hit != null && r.rest ? Math.round(100 * r.hit / r.rest) / 100 : null]);
}
rows.sort((a, b) => (b[4] || 0) - (a[4] || 0));
console.log('hook | hits% | early% | rejected% | hit/rejected');
for (const r of rows) console.log(r.join(' | '));
for (const [k, g] of Object.entries(groups)) console.log(k, 'median duration', med(g.map((x) => x.durationSec)), 'shorts share', Math.round(100 * g.filter((x) => x.isShort).length / g.length) + '%', 'median title length', med(g.map((x) => x.title.length)), 'median likeRate', med(g.map((x) => x.likeRate)));
const byDur = (g) => { const b = { '≤30s': 0, '31–60s': 0, '61–180s': 0, '3–10min': 0, '>10min': 0 }; for (const x of g) { const d = x.durationSec || 0; b[d <= 30 ? '≤30s' : d <= 60 ? '31–60s' : d <= 180 ? '61–180s' : d <= 600 ? '3–10min' : '>10min']++; } return Object.entries(b).map(([k, n]) => `${k} ${Math.round(100 * n / g.length)}%`).join(', '); };
for (const [k, g] of Object.entries(groups)) console.log(k, 'durations:', byDur(g));
