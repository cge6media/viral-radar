/**
 * Production playbook (4.0) — turns a Creator Desk opportunity into three genuinely different production briefs.
 *
 * Deterministic templates, not a language model: every line is assembled from facts the pipeline observed in the
 * examples' titles and statistics (hooks, shared signature words, durations, languages, creators, growth) plus the
 * creator profile (AI generation, animation, characters, editing, music; 30 min – 2 h). What was NOT observed
 * (how the videos actually look, the audio, the pacing) is listed under "uncertainty" rather than invented.
 * The deployed app has no live AI connection; briefs are generated in the browser from the published data.
 */
import type { DeskOpportunity } from './types';
import { fmtNum } from './data';

export interface Brief {
  variation: string;
  variationWhy: string;
  title: string;
  concept: string;
  hook: string;
  structure: { beat: string; what: string }[];
  duration: string;
  approach: string[];
  steps: string[];
  effort: { hours: string; difficulty: 'Low' | 'Medium' | 'High'; why: string };
  publishing: { platform: string; titleIdea: string; caption: string; notes: string[] };
  revenue: string[];
  uncertainty: string[];
  evidence: string[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dominant = (hooks: Record<string, number>, n: number) => Object.entries(hooks).filter(([k]) => !['emoji', 'caps', 'second_person'].includes(k)).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= Math.max(1, n * 0.15)).map(([k]) => k);

const HOOK_TEXT: Record<string, string> = {
  question: 'opens on a question the viewer wants answered',
  pov: 'frames the viewer inside the scene ("POV: …")',
  when: 'a relatable "when …" setup',
  versus: 'a head-to-head comparison',
  numbered: 'a numbered list promise',
  series: 'episodic ("part N") with a reason to come back',
  challenge: 'a challenge with visible stakes',
  reaction: 'a reaction to something',
  transformation: 'a before → after reveal',
  storytime: 'a told story with a narrator',
  tutorial: 'teaches something quickly',
  sensory: 'sensory / satisfying payoff',
  payoff: 'promises a payoff at the end ("wait for it")',
  animated: 'animated or AI-generated visuals',
  ai: 'explicitly AI-made',
  character: 'a recurring character or creature',
  music: 'music-led',
  escalation: 'escalates level by level',
};

/** the thing the videos are about, phrased so it reads naturally inside a sentence */
const POOL_SUBJECT: Record<string, string> = {
  cooking: 'a 60-second recipe', cats: 'a cat video', dogs: 'a dog video', animal_comedy: 'a dubbed-animal skit', animation: 'an animated short', short_film: 'a micro short film', ai_video: 'an AI-generated short',
  comedy_skit: 'a comedy skit', satisfying: 'a satisfying / ASMR clip', timelapse: 'a process timelapse', storytime: 'a told story', cover_song: 'a cover performance', music_video: 'a music video', gaming_clip: 'a gaming moment',
  puppets: 'a puppet / character bit', street_interview: 'a street interview', explainer: 'a 45-second explainer',
};
const SIG_SKIP = new Set(['version', 'official', 'explained', 'video', 'videos', 'shorts', 'short', 'full', 'new', 'best', 'cover', 'song', 'live', 'part', 'episode']);
function subject(o: DeskOpportunity): string {
  const pool = POOL_SUBJECT[o.trendId.replace(/^f_/, '')];
  const latin = (w: string) => /^[a-z0-9'’-]+$/i.test(w);
  const sig = o.features.signature.filter((w) => w.length > 2 && latin(w) && !SIG_SKIP.has(w.toLowerCase()) && !o.name.toLowerCase().includes(w.toLowerCase())).slice(0, 2);
  if (pool) return sig.length ? `${pool} (${sig.join(' / ')})` : pool;
  const name = o.name.replace(/^#/, '').toLowerCase();
  return sig.length ? `${name} (${sig.join(' / ')})` : name;
}

function durationLine(o: DeskOpportunity): string {
  const d = o.features.medianDurationSec;
  if (d == null) return o.features.shortsShare >= 0.5 ? '20–45 s (the examples are short-form)' : '45–90 s (duration of the examples not available)';
  const lo = Math.max(8, Math.round(d * 0.7)), hi = Math.round(d * 1.3);
  return `${lo}–${hi} s (the examples' median is ${Math.round(d)} s)`;
}

function platformLine(o: DeskOpportunity): string {
  return o.monetization.platforms[0] || 'YouTube Shorts';
}

function baseSteps(o: DeskOpportunity, extra: string[]): string[] {
  const shortForm = o.features.shortsShare >= 0.5 || (o.features.medianDurationSec ?? 61) <= 60;
  return [
    `Watch the top ${Math.min(3, o.evidence.length)} examples once with sound, once muted; write down the exact second the payoff lands.`,
    'Write the script as 6–10 lines: hook (≤2 s), setup, two escalations, payoff, loop-back line.',
    ...extra,
    shortForm ? 'Generate/animate in 9:16; keep every shot under 2.5 s before the payoff.' : 'Generate/animate in 16:9 (or 9:16 if you post to Shorts first); plan one visual change every 3–5 s.',
    'Record or synthesize the voice; add burned-in captions (most viewers watch muted).',
    'Edit to the target length, cut the first second until the hook is the first frame, export, and test the loop point.',
    'Title, caption and 3–5 specific hashtags from the signature words; schedule the post for the audience\'s evening.',
  ];
}

function evidenceLines(o: DeskOpportunity): string[] {
  return o.evidence.slice(0, 4).map((e) => `“${e.title}” — ${e.creator || 'unknown creator'}, ${e.views != null ? fmtNum(e.views) + ' views' : e.likes != null ? fmtNum(e.likes) + ' likes' : 'no statistics'}${e.ageHours != null ? `, ${e.ageHours < 48 ? Math.round(e.ageHours) + 'h' : Math.round(e.ageHours / 24) + 'd'} old` : ''}${e.velocityPerHour ? `, +${fmtNum(e.velocityPerHour)}/h measured` : ''} (${e.url})`);
}

function uncertaintyLines(o: DeskOpportunity): string[] {
  const out = ['Visual style, pacing and audio of the examples were not inspected — only titles, descriptions and statistics; open the evidence before committing a day.'];
  const langs = o.features.languages;
  const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
  const enEs = ((langs.en || 0) + (langs.es || 0)) / total;
  if (enEs < 0.5) out.push(`Most examples are not in English/Spanish (${Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}) — adapt the mechanism, not the words.`);
  if (o.caution) out.push(o.caution);
  if (o.facts.growthBasis !== 'measured') out.push('Growth is provisional (single observation); the next collections will confirm or cancel it.');
  if (o.type === 'meme') out.push('Meme timing: publish within 24–48 h or skip; the window closes quickly.');
  if (o.facts.creators < 6) out.push(`Only ${o.facts.creators} independent creators so far — the format is promising, not proven.`);
  return out;
}

function revenueLines(o: DeskOpportunity): string[] {
  return [...o.monetization.mechanisms.slice(0, 3), ...o.monetization.eligibility.slice(0, 2)];
}

export function buildBriefs(o: DeskOpportunity): Brief[] {
  const f = o.features;
  const n = Math.max(1, f.videos);
  const hooks = dominant(f.hooks, n);
  const subj = subject(o);
  const dur = durationLine(o);
  const platform = platformLine(o);
  const evidence = evidenceLines(o);
  const uncertainty = uncertaintyLines(o);
  const revenue = revenueLines(o);
  const hookStyle = hooks.find((h) => HOOK_TEXT[h] && !['animated', 'ai', 'character', 'music'].includes(h));
  const hookDesc = hookStyle ? HOOK_TEXT[hookStyle] : 'a visual surprise in the first frame';
  const animated = hooks.includes('animated') || hooks.includes('ai') || o.category === 'Animation & Art';
  const shortForm = f.shortsShare >= 0.5 || (f.medianDurationSec ?? 61) <= 60;
  const effortBase = o.production.effortHours;
  const hashtags = Array.from(new Set([...f.signature.slice(0, 3), ...o.name.replace(/^#/, '').toLowerCase().split(/\s+/)])).filter((x) => x.length > 2).slice(0, 5).map((x) => '#' + x.replace(/[^\p{L}\p{N}]/gu, ''));

  const briefs: Brief[] = [];

  // 1 — character-led (always: it is the creator's strongest tool and keeps the work original)
  briefs.push({
    variation: 'Character-led',
    variationWhy: 'An original recurring character makes a borrowed format yours and compounds across videos.',
    title: `An original recurring character takes on ${subj}`,
    concept: `An original ${animated ? 'animated' : 'AI-generated'} character with one strong trait (overconfident, deadpan, tiny-but-furious) is dropped into the ${o.type === 'format' ? 'format' : 'moment'} the examples share (${subj}). The trait, not the format, produces the joke or payoff.`,
    hook: `First frame: the character mid-action with the ${hookStyle ? HOOK_TEXT[hookStyle] : 'situation'} stated in on-screen text in ≤ 6 words — e.g. “${cap(subj)}, but ${['pov', 'when'].includes(hookStyle || '') ? 'it is me' : 'something is wrong'}”.`,
    structure: [
      { beat: 'Open (0–2 s)', what: `Character already inside the situation; text states the premise (${hookDesc}).` },
      { beat: 'Setup (2–8 s)', what: 'One line of dialogue establishes the trait; the format\'s expected course begins.' },
      { beat: 'Escalation (8–20 s)', what: 'Two beats where the trait makes things worse/funnier; each beat a new shot.' },
      { beat: 'Payoff + loop (last 3 s)', what: 'The trait wins or backfires; last line can be the first line again so the video loops.' },
    ],
    duration: dur,
    approach: [animated ? 'Character sheet (3 poses) generated once and reused; scenes via image-to-video' : 'AI video for scenes, one consistent character reference image', 'Synthesized or recorded voice with a signature catchphrase', 'Captions + 1 sound effect per beat; no copyrighted music'],
    steps: baseSteps(o, ['Design the character: one visual trait, one verbal tic, a 2-word name; save the reference image.', 'Generate 4 scenes from the structure; regenerate only the beat that misses the joke.']),
    effort: { hours: `${effortBase[0]}–${effortBase[1]} h`, difficulty: effortBase[1] <= 2 ? 'Low' : 'Medium', why: `${shortForm ? 'Short-form' : 'Longer'} target; one character, four scenes.` },
    publishing: { platform, titleIdea: `${cap(subj)} ${hookStyle === 'pov' ? '(POV)' : ''} — part 1`.replace(/\s+/g, ' ').trim(), caption: `${cap(subj)}, but with ${'an original character'}. ${hashtags.join(' ')}`, notes: ['Post the same cut to Shorts, TikTok and Reels within an hour.', 'Pin a comment asking which situation the character should face next (the series hook).'] },
    revenue, uncertainty, evidence,
  });

  // 2 — escalation / series or reversal, whichever the observed hooks support
  if (hooks.includes('series') || hooks.includes('escalation') || hooks.includes('challenge') || hooks.includes('numbered')) {
    briefs.push({
      variation: 'Escalating series',
      variationWhy: `The examples use ${hooks.includes('series') ? 'episodic "part N" titles' : hooks.includes('escalation') ? 'level-by-level escalation' : 'challenge/number framing'} — a built-in reason to return.`,
      title: `${cap(subj)}, levels 1 to 5`,
      concept: `One video = one ladder. The same ${subj} situation is attempted at five escalating levels (easy → absurd); each level is a 4–6 s scene; the fifth breaks the rules of the format itself.`,
      hook: 'Text in the first frame: “Level 1” over the simplest version; viewers stay to see how far it goes.',
      structure: [
        { beat: 'Level 1 (0–5 s)', what: 'The ordinary version, played straight.' },
        { beat: 'Levels 2–3', what: 'Bigger stakes, same framing, faster cuts.' },
        { beat: 'Level 4', what: 'The version the audience did not expect.' },
        { beat: 'Level 5 + tease', what: 'Break the format; end on “Level 6 next week?”' },
      ],
      duration: dur,
      approach: ['Five generated scenes sharing one background/lighting prompt for continuity', 'A counter graphic (“Level n”) as the only recurring overlay', 'Rising music bed (original or royalty-free) with a hard cut at level 5'],
      steps: baseSteps(o, ['List the five levels first; cut any level that is not visibly different from the previous one.', 'Generate level 5 first — if it does not work, the video has no ending yet.']),
      effort: { hours: `${effortBase[0] + 0.5}–${effortBase[1] + 0.5} h`, difficulty: 'Medium', why: 'Five scenes with continuity.' },
      publishing: { platform, titleIdea: `${cap(subj)}: level 1 vs level 5`, caption: `Which level are you? ${hashtags.join(' ')}`, notes: ['Natural series: publish level 6–10 as the next video if the first clears your baseline.'] },
      revenue, uncertainty, evidence,
    });
  } else {
    briefs.push({
      variation: 'Reversal',
      variationWhy: `The examples promise ${hooks.includes('payoff') ? 'a payoff' : hooks.includes('transformation') ? 'a transformation' : 'an expected outcome'} — subverting it is the cheapest originality.`,
      title: `${cap(subj)} — with the opposite ending`,
      concept: `Set up the exact expectation the examples create (${subj}), then land the opposite outcome in the last two seconds; the reversal is the joke/payoff and makes the video quotable.`,
      hook: 'First frame copies the format\'s familiar setup so the audience recognises it instantly (text: “you know how this goes…”).',
      structure: [
        { beat: 'Recognition (0–3 s)', what: 'The familiar setup, no twist yet.' },
        { beat: 'Commitment (3–12 s)', what: 'Lean into the expected direction; add one detail that will matter.' },
        { beat: 'Turn (last 4 s)', what: 'The detail flips the outcome.' },
        { beat: 'Button (last 1 s)', what: 'A single-word reaction; hard cut to loop.' },
      ],
      duration: dur,
      approach: ['Two generated scenes (expected / reversed) sharing one subject reference image', 'Sound design sells the turn: silence 0.5 s before the flip', 'Captions only on the setup, not on the twist'],
      steps: baseSteps(o, ['Write the expected ending in one sentence, then write its opposite; the second sentence is the video.']),
      effort: { hours: `${effortBase[0]}–${effortBase[1]} h`, difficulty: 'Low', why: 'Two scenes, one turn.' },
      publishing: { platform, titleIdea: `${cap(subj)}… wait for it`, caption: `Not what you expected. ${hashtags.join(' ')}`, notes: ['Reply to the top comment with a second reversal (cheap follow-up).'] },
      revenue, uncertainty, evidence,
    });
  }

  // 3 — mashup / music / explainer depending on what the format rewards
  if (hooks.includes('music') || o.category === 'Music') {
    briefs.push({
      variation: 'Original track',
      variationWhy: 'Music-led examples: an original song or parody adds streaming revenue and Content ID on re-uses.',
      title: `A 30-second original song for ${subj}`,
      concept: `Write a hook-first original song (8 bars, one earworm line) about ${subj}; the video is the character performing it with one visual gag per bar.`,
      hook: 'The chorus line in the first second, sung, with the lyric on screen.',
      structure: [{ beat: 'Chorus (0–6 s)', what: 'The earworm line, straight in.' }, { beat: 'Verse (6–18 s)', what: 'Three specific details from the format, one per bar.' }, { beat: 'Chorus 2 + twist (18–28 s)', what: 'Same line, one word changed.' }, { beat: 'Tag (last 2 s)', what: 'Spoken button; loop to the chorus.' }],
      duration: '25–35 s (one chorus + verse)',
      approach: ['Original lyrics and melody (no sampled or copyrighted audio)', 'AI or DIY instrumental; vocals recorded or synthesized', 'Lyric captions with the animated character lip-syncing the chorus only'],
      steps: baseSteps(o, ['Write the chorus line first; if it is not quotable on its own, rewrite before anything else.', 'Produce the 30 s track; distribute the full version separately for streams.']),
      effort: { hours: `${effortBase[0] + 1}–${effortBase[1] + 1} h`, difficulty: 'Medium', why: 'Writing + producing the track.' },
      publishing: { platform, titleIdea: `the ${subj} song`, caption: `Full song on streaming. ${hashtags.join(' ')}`, notes: ['Release the audio to streaming platforms so re-uses of the sound pay you.'] },
      revenue, uncertainty, evidence,
    });
  } else if (hooks.includes('tutorial') || o.category === 'Education' || o.category === 'Science' || o.category === 'Tech & AI') {
    briefs.push({
      variation: 'Explainer as a skit',
      variationWhy: 'The examples teach or explain — a character explaining it badly, then well, keeps the information and adds comedy.',
      title: `${cap(subj)}, explained by someone who should not be explaining it`,
      concept: `An unqualified original character confidently explains ${subj} wrong; a second character (or on-screen text) corrects it in one line; the correct version is the payoff.`,
      hook: 'The wrong explanation starts mid-sentence in the first frame.',
      structure: [{ beat: 'Wrong (0–8 s)', what: 'Confident, specific, wrong.' }, { beat: 'Doubt (8–12 s)', what: 'One visual cue the audience notices first.' }, { beat: 'Correct (12–25 s)', what: 'The real explanation, fast, with one diagram.' }, { beat: 'Button', what: 'The wrong character takes credit.' }],
      duration: dur,
      approach: ['Two characters from one reference sheet', 'One simple animated diagram for the correct part', 'Captions throughout (informational content is watched muted)'],
      steps: baseSteps(o, ['Verify the correct explanation from a primary source before writing the wrong one.']),
      effort: { hours: `${effortBase[0]}–${effortBase[1]} h`, difficulty: 'Medium', why: 'Accuracy check + two characters.' },
      publishing: { platform, titleIdea: `${cap(subj)}, explained (badly, then properly)`, caption: `Which part did you believe? ${hashtags.join(' ')}`, notes: ['Educational framing widens the advertiser-friendly range.'] },
      revenue, uncertainty, evidence,
    });
  } else {
    briefs.push({
      variation: 'Cross-genre mashup',
      variationWhy: 'Transplanting the mechanism into an unexpected setting is original by construction and cheap to produce with generated scenes.',
      title: `${cap(subj)} — in the wrong world`,
      concept: `Keep the exact mechanism the examples share (${subj}) and move it to a setting where it should not exist (a medieval court, a space station, a nature documentary, a corporate meeting); the mismatch generates the beats.`,
      hook: 'The setting is visible in the first frame; the familiar mechanism starts anyway.',
      structure: [{ beat: 'Setting (0–2 s)', what: 'One establishing shot that says where we are.' }, { beat: 'Mechanism (2–10 s)', what: 'The format plays exactly as the examples do.' }, { beat: 'Collision (10–20 s)', what: 'The setting pushes back; two beats.' }, { beat: 'Payoff', what: 'The mechanism wins in the setting\'s own terms.' }],
      duration: dur,
      approach: ['Generated establishing shot + 3 scenes with one style prompt', 'Narration in the setting\'s register (documentary voice, courtroom voice)', 'Diegetic sound only; no trending audio'],
      steps: baseSteps(o, ['Pick the setting whose rules most contradict the mechanism; write the collision beats from those rules.']),
      effort: { hours: `${effortBase[0]}–${effortBase[1]} h`, difficulty: 'Low', why: 'Four scenes, one style.' },
      publishing: { platform, titleIdea: `${cap(subj)}, but it's a nature documentary`, caption: `Same thing, wrong world. ${hashtags.join(' ')}`, notes: ['If it works, the setting becomes the series (same mechanism, new world each time).'] },
      revenue, uncertainty, evidence,
    });
  }
  return briefs;
}

export function briefsToMarkdown(o: DeskOpportunity, briefs: Brief[], generatedAt: string): string {
  const L: string[] = [];
  L.push(`# ${o.name} — production brief`, '', `Viral Radar Creator Desk · data as of ${generatedAt} · opportunity type: **${o.type}** (${o.typeConfidence}% confidence) · timing: **${o.timing}** · recommended action: **${o.action.replace('_', ' ')}**`, '');
  L.push('## Why this is an opportunity', ...o.why.map((w) => `- ${w}`), '');
  L.push('## Evidence', ...o.evidence.slice(0, 6).map((e) => `- [${e.title}](${e.url}) — ${e.creator || 'unknown'}${e.views != null ? `, ${fmtNum(e.views)} views` : ''}${e.ageHours != null ? `, ${e.ageHours < 48 ? Math.round(e.ageHours) + 'h' : Math.round(e.ageHours / 24) + 'd'} old` : ''}${e.velocityPerHour ? `, +${fmtNum(e.velocityPerHour)}/h measured` : ''}`), '');
  L.push('## Timing', `${o.timingWhy}`, '', '## Production fit', `${o.production.why} Approach: ${o.production.approach.join('; ')}. Effort ${o.production.effortHours[0]}–${o.production.effortHours[1]} h.`, '');
  L.push('## Monetization', ...o.monetization.mechanisms.map((m) => `- ${m}`), '', ...o.monetization.eligibility.map((m) => `- Eligibility: ${m}`), '');
  if (o.caution) L.push(`> Caution: ${o.caution}`, '');
  briefs.forEach((b, i) => {
    L.push(`## Variation ${i + 1}: ${b.variation} — ${b.title}`, '', `_${b.variationWhy}_`, '', `**Concept.** ${b.concept}`, '', `**Opening hook.** ${b.hook}`, '', '**Structure.**', ...b.structure.map((s) => `- ${s.beat}: ${s.what}`), '', `**Suggested duration.** ${b.duration}`, '', '**Production approach.**', ...b.approach.map((a) => `- ${a}`), '', '**Production steps.**', ...b.steps.map((s, j) => `${j + 1}. ${s}`), '', `**Estimated effort.** ${b.effort.hours}, ${b.effort.difficulty} — ${b.effort.why}`, '', `**Publishing.** ${b.publishing.platform}. Title idea: “${b.publishing.titleIdea}”. Caption: ${b.publishing.caption}`, ...b.publishing.notes.map((x) => `- ${x}`), '', '**Revenue model.**', ...b.revenue.map((r) => `- ${r}`), '');
  });
  L.push('## Uncertainty', ...briefs[0].uncertainty.map((u) => `- ${u}`), '', '_Generated from observed titles, statistics and the creator profile by deterministic templates (no live AI). Verify the examples before producing._');
  return L.join('\n');
}

export function downloadText(name: string, text: string): void {
  try {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* ignore */ }
}
