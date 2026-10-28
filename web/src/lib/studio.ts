/**
 * Content Studio — "Turn this trend into a video idea". Rule-based and transparent; every concept is derived from
 * the trend's real evidence (format, keywords, example titles, measured facts) and the creator's tools.
 */
import type { Trend, Preferences, SavedConcept, WindowScores } from './types';
import { profileFor } from '../../../pipeline/src/intel/taxonomy';
import { difficultyFor, growthLabel, recommendPlatform, fmtNum } from './data';

export interface Advice {
  what: string;
  why: string[];
  characteristics: string[];
  timing: { label: string; detail: string };
  concepts: SavedConcept[];
  platforms: { platform: string; why: string };
  monetization: string[];
  difficulty: { label: string; why: string };
  cautions: string[];
}

const clean = (s: string) => s.replace(/^#/, '').replace(/ \(format\)$/i, '').trim();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function advise(t: Trend, w: WindowScores, prefs: Preferences): Advice {
  const name = clean(t.name);
  const p = profileFor(t.category);
  const g = growthLabel(w);
  const videos = t.evidence.filter((e) => e.kind === 'video');
  const direct = videos.filter((e) => e.level === 'direct');
  const topViews = Math.max(0, ...direct.map((v) => v.metrics.views || 0));
  const topLikes = Math.max(0, ...direct.map((v) => v.metrics.likes || 0));
  const platforms = Array.from(new Set(t.evidence.map((e) => e.source)));
  const shorts = videos.filter((v) => /shorts\//.test(v.url) || (v.video?.durationSec != null && v.video.durationSec <= 60)).length;

  const what = t.summary;
  const why: string[] = [];
  why.push(g.dir === 'unknown' ? 'First measurements only — growth is marked provisional until the next collection confirms it.' : g.label + '.');
  if (w.creators >= 3) why.push(`${w.creators} independent creators inside this window — a format, not a one-off.`);
  if (w.newCreators) why.push(`${w.newCreators} creator${w.newCreators > 1 ? 's' : ''} joined in the last 48 hours.`);
  if (w.directVideos) why.push(`${w.directVideos} example${w.directVideos > 1 ? 's' : ''} carry platform statistics (views/likes measured at the source).`);
  if (w.audienceInterest >= 50) why.push('Corroborated by search or social interest beyond the videos themselves.');
  if (platforms.length > 1) why.push(`Seen on ${platforms.length} sources (${platforms.join(', ')}).`);

  const characteristics: string[] = [];
  if (shorts) characteristics.push(`${shorts} of the examples are under a minute — the hook has to land in the first second.`);
  if (direct.length && topViews) characteristics.push(`Best measured example: ${fmtNum(topViews)} views; most sit far below that, so the top 10% carry the trend.`);
  else if (topLikes) characteristics.push(`Best measured example: ${fmtNum(topLikes)} likes.`);
  const tags = Array.from(new Set(t.evidence.flatMap((e) => e.tags || []))).filter((x) => x.length > 3).slice(0, 6);
  if (tags.length) characteristics.push(`Shared tags: ${tags.map((x) => '#' + x).join(' ')}.`);
  const titles = videos.slice(0, 3).map((v) => `“${v.title.slice(0, 60)}”`);
  if (titles.length) characteristics.push(`Representative titles: ${titles.join(', ')}.`);
  if (!characteristics.length) characteristics.push('Evidence is topic-level (searches/posts) — open the linked items before committing production time.');

  const timing =
    w.grade === 'insufficient' ? { label: 'Too early to call', detail: 'One signal only. Save it and check again after the next refresh.' }
      : w.lifecycle === 'emerging' ? { label: 'Early', detail: 'Fresh and under-supplied; the fastest mover usually wins — ship a simple version within 24–48 hours.' }
        : w.lifecycle === 'accelerating' ? { label: 'Early-to-mid', detail: 'Measured growth with room to run; a well-produced take fits here.' }
          : w.lifecycle === 'breaking_out' ? { label: 'Mid', detail: 'Cross-platform and loud — differentiate hard; a straight copy will drown.' }
            : w.lifecycle === 'peaking' ? { label: 'Late', detail: 'Attention is high but flat. Only worth it with a sharp original angle or as a series anchor.' }
              : { label: 'Past peak', detail: 'Attention is falling. Skip unless you have an evergreen angle.' };

  const concepts = buildConcepts(t, w, name, prefs);
  const monetization: string[] = [];
  if (p.advertiser >= 0.75) monetization.push('Ad-friendly category: long-form YouTube ads are the direct path; keep titles and thumbnails brand-safe.');
  else if (p.advertiser < 0.5) monetization.push('Weak advertiser suitability: expect limited ad revenue; pursue for audience growth only.');
  if (p.sponsorship >= 0.7) monetization.push('Strong sponsorship demand — package this as a recurring series brands can book.');
  if (p.affiliate >= 0.7) monetization.push('Affiliate fit: link the tools and products that appear on screen.');
  monetization.push(p.longevity >= 0.7 ? 'Evergreen: views keep accruing for months, so long-form RPM compounds.' : 'Short shelf life: treat it as Shorts/TikTok reach, not a long-tail asset.');
  if (t.category === 'Music') monetization.push('Original compositions can be distributed and registered for Content ID; covers need licensing.');
  if (['Animation & Art', 'Animals & Pets', 'Comedy'].includes(t.category)) monetization.push('Character-led formats add merch, memberships and licensing upside beyond ad RPM.');

  const cautions: string[] = [];
  if (t.isNewsEvent) cautions.push('News/person event, not a repeatable format. Do not build a channel around it.');
  if (t.isGeneric) cautions.push('Evergreen category: steady demand, heavy competition. Only a specific angle stands out.');
  if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday|caturday/i.test(t.name)) cautions.push('Recurring weekday prompt — it spikes weekly; treat it as a reliable slot, not a breakout.');
  if (!videos.length) cautions.push('No video examples yet — the trend is visible in searches/posts, not proven as video performance.');
  else if (!direct.length) cautions.push('Examples are social shares without platform statistics; a YouTube API key would verify views and publish dates.');
  if (w.growth.basis === 'provisional') cautions.push('Growth is provisional (first measurement). Re-check after the next refresh before committing a big budget.');
  if (t.evidence.some((e) => /deepfake|deep fake/i.test(e.title))) cautions.push('Deepfake-adjacent: never impersonate real people; keep AI usage disclosed and clearly fictional.');

  return { what, why, characteristics, timing, concepts, platforms: recommendPlatform(t, prefs), monetization, difficulty: difficultyFor(t.category, prefs), cautions };
}

function buildConcepts(t: Trend, w: WindowScores, name: string, prefs: Preferences): SavedConcept[] {
  const kw = t.keywords.filter((k) => k.length > 3 && !/^(format|video|videos)$/.test(k)).slice(0, 3);
  const k1 = kw[0] || name.toLowerCase();
  const hasAnim = prefs.tools.includes('animation');
  const hasAI = prefs.tools.includes('ai-video');
  const hasMusic = prefs.tools.includes('music') || prefs.tools.includes('audio');
  const platform = recommendPlatform(t, prefs).platform;
  const diff = difficultyFor(t.category, prefs);
  const budget = diff.label === 'Low' ? '$0–40 (your time + stock assets)' : diff.label === 'Medium' ? '$40–150 (assets, voice, a day of work)' : '$150–600 (animation / multi-day production)';
  const exampleTitle = t.evidence.find((e) => e.kind === 'video')?.title;
  const grounded = exampleTitle ? ` (cf. “${exampleTitle.slice(0, 50)}”)` : '';
  const out: SavedConcept[] = [];
  const push = (c: Omit<SavedConcept, 'platform' | 'difficulty' | 'budget'> & Partial<SavedConcept>) =>
    out.length < 3 && out.push({ platform, difficulty: `${diff.label} — ${diff.why}`, budget, ...c });

  const animNote = hasAnim ? 'Animated (your pipeline)' : 'Live-action or stock assets';
  const aiNote = hasAI ? ' · AI boards, hand-finished' : '';
  const musicBed = hasMusic ? ' Original music bed keeps it Content-ID safe.' : '';

  switch (t.category) {
    case 'Animals & Pets':
      push({ title: `${cap(k1)}: the interview nobody asked for`, hook: `An animated animal is interviewed about ${name}${grounded} and takes it far too seriously.`, opening: 'Frame 1: the animal mid-answer, already offended.', structure: ['Cold open on the absurd answer', 'Interviewer pushes back', 'Escalation gag', 'Button line + recurring sign-off'], length: '30–45s vertical', approach: `${animNote}${aiNote}; one recurring host character.`, monetization: 'Shorts fund → sponsorship once the character recurs; merch on the character.' });
      push({ title: `What they're really saying`, hook: `Your own pet footage dubbed with an inner monologue about ${name}.`, opening: 'The first line lands before the animal moves.', structure: ['Dub line 1', 'Visual contradiction', 'Dub line 2', 'Punchline on the cut'], length: '20–30s vertical', approach: 'Own footage only; consistent voice per character.', monetization: 'Shorts/TikTok reach; pet-product affiliate links.' });
      push({ title: `${cap(k1)} vs. the Rules`, hook: `A deadpan narrator lists the rules of ${name} while the animal breaks each one.`, opening: 'Rule #1 on screen while it is being broken.', structure: ['Rule 1 / break', 'Rule 2 / break', 'Rule 3 / twist', 'Series card'], length: '45–60s (TikTok Rewards needs >60s — add a 5s outro)', approach: `${animNote}; numbered, collectible series.`, monetization: 'TikTok Creator Rewards at >60s; YouTube Shorts; sponsor slot in rule #2.' });
      break;
    case 'Music':
      push({ title: `One-take ${cap(k1)} challenge`, hook: `An original 20-second hook written for ${name}, performed in one take with a timer.`, opening: 'Timer starts; first bar within 1.5s.', structure: ['Timer + premise', 'Hook performance', 'Reaction beat', 'CTA: next prompt'], length: '45–60s vertical', approach: 'Original composition (rights stay yours); phone + one light.', monetization: 'Distribution + Content ID on originals; Shorts/TikTok reach.' + musicBed });
      push({ title: `${cap(k1)} explained by a cartoon producer`, hook: `An animated producer breaks down why ${name} works (one rhythm or chord trick) then plays an original riff using it.`, opening: 'The counter-intuitive claim first.', structure: ['Claim', 'Demo of the trick', 'Original riff', 'Sign-off'], length: '30–40s', approach: `${animNote}${aiNote}; recurring producer character.`, monetization: 'Sponsorship (plugins, gear); affiliate links to instruments.' });
      push({ title: `Genre flip`, hook: `Rebuild the vibe of ${name} in an unexpected genre with your own melody and lyrics.`, opening: 'Play the expected sound for 1s, then the flip.', structure: ['Expected', 'Flip', 'Full chorus', 'Series tag'], length: '30–40s vertical', approach: 'Parody of a style, never a cover; original composition.', monetization: 'Originals distributed; Shorts reach; weekly series sponsor.' });
      break;
    case 'Comedy':
    case 'Entertainment':
      push({ title: `${cap(k1)} — the corporate training video`, hook: `A faux-serious training module teaches new hires how to do ${name} correctly${grounded}.`, opening: 'Compliance-style title card, serious voice, ridiculous subject.', structure: ['Module title', 'Step 1 (sane)', 'Step 2 (absurd)', 'Assessment gag', 'Next module teaser'], length: '45–75s', approach: `${animNote}; deadpan narrator; stock-footage energy.`, monetization: 'Shorts fund + long-form compilations; sponsor as the “company”.' });
      push({ title: `Animated reaction character`, hook: `An original animated character reacts to ${name} with one strong opinion and a physical gag.`, opening: 'Cold open on the gag.', structure: ['Gag', 'Opinion', 'Twist', 'Catchphrase'], length: '20–30s', approach: `${animNote}${aiNote}; no real people depicted.`, monetization: 'Character merch/memberships; Shorts reach.' });
      push({ title: `Two-shot bit: optimist vs. pessimist on ${cap(k1)}`, hook: `Two recurring characters argue about ${name}; the pessimist is secretly participating.`, opening: 'Argument already in progress.', structure: ['Argument', 'Reveal', 'Escalation', 'Button'], length: '30–45s', approach: 'Two characters, one set; works for any trend.', monetization: 'Series sponsorship; Shorts/TikTok reach.' });
      break;
    case 'Animation & Art':
      push({ title: `${cap(k1)}: 12 seconds, 12 frames`, hook: `A tight original loop on the ${name} theme, then a 10-second time-lapse of how it was made.`, opening: 'Loop plays first, process second.', structure: ['Loop (shareable)', 'Process time-lapse', 'One tip on screen', 'Follow prompt'], length: '15–30s', approach: `Animated (your pipeline)${aiNote}; weekly theme from the radar.`, monetization: 'Commissions/tools affiliate; sponsorship from art-tool brands; long-form process videos.' });
      push({ title: `Character pilot in the ${cap(k1)} style`, hook: `Introduce an original character through one problem related to ${name}${grounded}.`, opening: 'Character in trouble within the first second.', structure: ['Problem', 'Failed fix', 'Worse problem', 'Ending that promises episode 2'], length: '45–60s', approach: 'Original IP only; reusable rig/set.', monetization: 'Series → memberships, merch, licensing; Shorts fund.' });
      push({ title: `AI boards → hand-finished`, hook: `Show rough AI storyboards next to hand-animated key moments on a ${name} premise; disclose the AI step on screen.`, opening: 'Board vs. finished frame side by side.', structure: ['Rough board', 'Finished frame', 'Why it changed', 'Result'], length: '30s', approach: `${hasAI ? 'AI boards' : 'Sketch boards'} + hand animation; process + result.`, monetization: 'Tool sponsorships; long-form tutorials (high RPM).' });
      break;
    case 'Gaming':
      push({ title: `${cap(k1)} in 60 seconds — animated recap`, hook: `A recurring cartoon narrator recaps ${name} with original character art (no copyrighted footage).`, opening: 'Narrator states the stakes in one line.', structure: ['Stakes', 'What happened', 'Why people care', 'Prediction'], length: '60–75s', approach: `${animNote}; weekly slot.`, monetization: 'Gaming sponsorships (peripherals, games); TikTok Rewards at >60s.' });
      push({ title: `The schedule nobody asked for`, hook: `Parody of stream-schedule culture inspired by ${name}: an over-planned week that collapses by Tuesday.`, opening: 'Calendar with absurd entries.', structure: ['Monday plan', 'Tuesday collapse', 'Friday rebrand', 'Sunday excuse'], length: '30s', approach: 'Motion graphics + voice.', monetization: 'Shorts reach; community growth.' });
      push({ title: `Puppet plays a fake horror game`, hook: `A puppet or animated character “plays” a fictional horror game built around ${name}; sound design does the scaring.`, opening: 'Darkness, breathing, one jump.', structure: ['Setup', 'False calm', 'Scare', 'Puppet overreacts'], length: '45–60s', approach: 'Puppet/character + sound design.', monetization: 'Horror-game sponsorships; Halloween seasonal deals.' });
      break;
    case 'Food & Cooking':
      push({ title: `The 45-second ${cap(k1)} that actually works`, hook: `One dish from the ${name} wave, cooked in real time with on-screen timers and one honest failure point.`, opening: 'Finished plate first, then “the 45-second version”.', structure: ['Plate', 'Prep', 'Timer cook', 'Failure point', 'Fix + taste'], length: '45–60s overhead', approach: 'Overhead phone rig; captions carry the steps.', monetization: 'Affiliate (tools, pantry); kitchen-brand sponsorships.' });
      push({ title: `Animated kitchen critic`, hook: `An opinionated animated utensil reviews the ${name} trend and tries it, ending on one practical tip.`, opening: 'The character says the controversial thing in frame one.', structure: ['Hot take', 'Attempt', 'Verdict', 'Tip'], length: '20–30s', approach: `${animNote}; same character, new dish each week.`, monetization: 'Shorts reach; recipe e-book / membership.' });
      push({ title: `Price it out: ${cap(k1)}`, hook: `Cook the trending ${name} dish and show real cost per serving vs. takeout, receipts on screen.`, opening: 'The price comparison number first.', structure: ['Number', 'Shop', 'Cook', 'Verdict'], length: '45–60s', approach: 'Motion-graphic overlays on real cooking.', monetization: 'Strong affiliate fit; grocery/kitchen sponsorships.' });
      break;
    case 'Tech & AI':
      push({ title: `Spot the fake: ${cap(k1)}`, hook: `A visual test on how to recognise what is happening with ${name}, using your own labelled examples.`, opening: 'Two clips, one fake — which?', structure: ['Quiz', 'Reveal', 'Three tells', 'Harder round'], length: '45–60s', approach: `${hasAI ? 'Generated examples, clearly labelled' : 'Sourced public examples with credit'}.`, monetization: 'High-RPM tech category; tool sponsorships.' });
      push({ title: `How ${cap(k1)} actually works`, hook: `A recurring animated host explains the mechanism behind ${name} with one metaphor and one demo.`, opening: 'The metaphor first.', structure: ['Metaphor', 'Demo', 'Limitation', 'What to try'], length: '60–90s', approach: `${animNote}; evergreen explainer.`, monetization: 'Long-form RPM; SaaS sponsorships; affiliate.' });
      push({ title: `Honest 7-day test`, hook: `Use the tool behind ${name} for a week; show results, costs and the one thing nobody mentions.`, opening: 'Day-7 result in the first 5 seconds.', structure: ['Result', 'Day 1', 'Day 4 problem', 'Day 7 verdict'], length: '6–8 min + Shorts cuts', approach: 'Screen capture + camera; honest numbers.', monetization: 'Highest RPM band; affiliate/sponsor fit.' });
      break;
    case 'Seasonal & Holidays':
      push({ title: `${cap(k1)} — the 10-second tradition`, hook: `An original animated family invents a new ${name} tradition each episode; always practical, slightly wrong.`, opening: 'Tradition stated as fact in frame one.', structure: ['Rule', 'Attempt', 'Consequence', 'Next tradition'], length: '20–30s', approach: `${animNote}; seasonal series.`, monetization: 'Seasonal sponsorships (costumes, candy, decor); affiliate.' });
      push({ title: `Costume for a character that doesn't exist`, hook: `Design a costume for your own original character tied to ${name}; the reveal is the payoff.`, opening: 'Blank mannequin to full reveal.', structure: ['Sketch', 'Build montage', 'Reveal', 'Character acts'], length: '30s', approach: 'Process + reveal; original IP.', monetization: 'Craft affiliate; seasonal brand deals.' });
      push({ title: `Trick-or-treat economics`, hook: `A deadpan analyst character runs the numbers on ${name} with charts.`, opening: 'A chart that goes the wrong way.', structure: ['Chart', 'Explanation', 'Absurd conclusion', 'Call to action'], length: '45–60s', approach: 'Motion graphics + voice.', monetization: 'Finance/retail sponsorships; evergreen each season.' });
      break;
    default:
      push({ title: `${cap(k1)} — animated explainer`, hook: `A recurring animated host explains ${name} in plain language with one visual metaphor.`, opening: 'The metaphor in frame one.', structure: ['Metaphor', 'Three facts', 'So what', 'Sign-off'], length: '45–60s', approach: `${animNote}${aiNote}.`, monetization: 'Ad-friendly; sponsorship once recurring.' });
      push({ title: `The ${cap(k1)} sketch`, hook: `Two recurring characters discover ${name}; one over-commits, the other refuses, both end up doing it.`, opening: 'Argument already in progress.', structure: ['Discovery', 'Refusal', 'Secret participation', 'Reveal'], length: '30–45s', approach: 'Two characters, one set.', monetization: 'Shorts/TikTok reach; series sponsor.' });
      push({ title: `${cap(k1)} in numbers`, hook: `Three real numbers from the evidence turned into a punchy motion-graphics short with an opinion at the end.`, opening: 'Biggest number first.', structure: ['Number 1', 'Number 2', 'Number 3', 'Opinion'], length: '30–40s', approach: 'Motion graphics; weekly data short.', monetization: 'Ad-friendly; data-tool sponsorships.' });
  }
  if (hasMusic && t.category !== 'Music' && out[out.length - 1]) out[out.length - 1].approach += musicBed;
  void w;
  return out;
}
