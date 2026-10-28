/**
 * "Ride This Trend" advisor — rule-based, transparent, no paid model API.
 * Everything it says is derived from the trend's real evidence + category profile + your preferences.
 */
import type { Trend, Preferences } from './types';
import { profileFor } from '../../../pipeline/src/intel/taxonomy';
import { growthLabel, recommendPlatform, difficultyFor } from './data';

export interface Concept { title: string; format: string; pitch: string; hook: string; repeatable: string }

export interface Advice {
  what: string;
  why: string[];
  characteristics: string[];
  timing: { label: string; detail: string };
  concepts: Concept[];
  platforms: { platform: string; why: string };
  monetization: string[];
  difficulty: { label: string; why: string };
  cautions: string[];
}

const clean = (s: string) => s.replace(/^#/, '').replace(/ \(format\)$/i, '').trim();

export function advise(t: Trend, prefs: Preferences): Advice {
  const name = clean(t.name);
  const p = profileFor(t.category);
  const g = growthLabel(t);
  const videos = t.evidence.filter((e) => e.kind === 'video');
  const creators = new Set(t.evidence.map((e) => e.creator?.name).filter(Boolean)).size;
  const platforms = Array.from(new Set(t.evidence.map((e) => e.source)));
  const kinds = Array.from(new Set(t.evidence.map((e) => e.kind)));
  const yt = videos.filter((v) => /youtu\.?be/.test(v.url)).length;
  const native = videos.filter((v) => /video\.bsky\.app/.test(v.url)).length;
  const maxLikes = Math.max(0, ...videos.map((v) => v.metrics.likes || 0));
  const maxViews = Math.max(0, ...videos.map((v) => v.metrics.views || 0));
  const sat = t.scores.components.saturation ?? 0;

  const what = describeWhat(t, name, kinds);

  const why: string[] = [];
  if (t.scores.momentumBasis === 'observed') why.push(g.label + '.');
  else why.push('First time observed — momentum is provisional until the next collection confirms growth.');
  if (platforms.length > 1) why.push(`Seen on ${platforms.length} independent sources (${platforms.join(', ')}), which is why confidence is ${t.scores.confidence}/100.`);
  else why.push(`So far only one source (${platforms[0]}) — confidence ${t.scores.confidence}/100.`);
  if (t.evidence.some((e) => e.kind === 'search_interest')) why.push('Google search interest is spiking, so people are actively looking for this.');
  if (creators >= 3) why.push(`${creators} different creators are already making it — a sign of a format, not a one-off.`);
  why.push(...t.scores.notes.filter((n) => /growth|history|news/i.test(n)));

  const characteristics: string[] = [];
  if (native) characteristics.push(`${native} native short clips (vertical, under a minute, no title card) — the clip itself is the hook.`);
  if (yt) characteristics.push(`${yt} YouTube links being shared socially — people are passing around specific videos.`);
  if (maxLikes) characteristics.push(`Best-performing example reached ${maxLikes.toLocaleString()} likes; typical posts sit far below that, so the top 10% carry the trend.`);
  if (maxViews) characteristics.push(`Top video has ${maxViews.toLocaleString()} views.`);
  if (t.evidence.some((e) => (e.tags || []).length)) {
    const tags = Array.from(new Set(t.evidence.flatMap((e) => e.tags || []))).slice(0, 6);
    characteristics.push(`Shared tags: ${tags.map((x) => '#' + x).join(' ')}.`);
  }
  if (t.evidence.some((e) => e.kind === 'hashtag' && e.history?.length)) characteristics.push('Hashtag usage history is available — daily posting volume is measured, not estimated.');
  if (!characteristics.length) characteristics.push('Evidence is topic-level (searches/posts) rather than specific videos — look at the linked items before committing production time.');

  const timing =
    t.lifecycle === 'insufficient_data'
      ? { label: 'Too early to call', detail: 'One signal only. Add to your watchlist and check again after the next refresh.' }
      : t.lifecycle === 'emerging'
        ? { label: 'Early', detail: 'Fresh and under-supplied. The fastest mover usually wins here — ship a simple version within 24–48 hours.' }
        : t.lifecycle === 'accelerating'
          ? { label: 'Early-to-mid', detail: 'Measured growth with room to run. Good window for a well-produced take.' }
          : t.lifecycle === 'breaking_out'
            ? { label: 'Mid', detail: 'Cross-platform and loud. Differentiate hard — a straight copy will drown.' }
            : t.lifecycle === 'peaking'
              ? { label: 'Late', detail: `Attention is high but flat${sat > 0.3 ? ' and saturated' : ''}. Only worth it with a sharp original angle or as a series anchor.` }
              : { label: 'Past peak', detail: 'Attention is falling. Skip unless you have an evergreen angle.' };

  const concepts = buildConcepts(t, name, prefs);
  const platformsRec = recommendPlatform(t, prefs);

  const monetization: string[] = [];
  if (p.advertiser >= 0.75) monetization.push('Ad-friendly category: long-form YouTube ads are the direct path; keep titles/thumbnails brand-safe.');
  else if (p.advertiser < 0.5) monetization.push('Weak advertiser suitability: expect limited or no ad revenue; only pursue for audience growth.');
  if (p.sponsorship >= 0.7) monetization.push('Strong sponsorship demand — package this as a recurring series to pitch brands with a predictable slot.');
  if (p.affiliate >= 0.7) monetization.push('Affiliate fit: link the tools/products that appear on screen (gear, apps, supplies).');
  if (p.longevity >= 0.7) monetization.push('Evergreen: views keep accruing for months, so long-form RPM compounds.');
  else monetization.push('Short shelf life: treat as Shorts/TikTok reach, not as a long-tail asset.');
  if (t.category === 'Music') monetization.push('Music: original compositions can be registered for distribution and Content ID; covers need licensing and split revenue.');
  if (t.category === 'Animation & Art' || t.category === 'Animals & Pets' || t.category === 'Comedy') monetization.push('Character-led formats build merch, memberships and licensing upside beyond ad RPM.');

  const cautions: string[] = [];
  if (t.isNewsEvent) cautions.push('This is a news/person event, not a repeatable format. Avoid building a channel around it.');
  if (t.category === 'News & Politics') cautions.push('Political content is routinely limited for ads and sponsorships.');
  if (t.evidence.some((e) => /deepfake|deep fake/i.test(e.title + ' ' + (e.text || '')))) cautions.push('Deepfake-adjacent: never impersonate real people; keep AI usage disclosed and clearly fictional.');
  if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday|caturday/i.test(t.name)) cautions.push('Recurring weekday prompt tag — it spikes every week, so growth versus the previous days is expected rather than a breakout. Treat it as a reliable weekly slot.');
  if (t.evidence.every((e) => e.kind !== 'video')) cautions.push('No actual video examples yet — the trend is visible in searches/posts, not proven as video performance.');
  if (t.scores.momentumBasis === 'provisional') cautions.push('Growth is provisional (first measurement). Check back after the next scheduled refresh before committing big production budgets.');

  return { what, why, characteristics, timing, concepts, platforms: platformsRec, monetization, difficulty: difficultyFor(t.category, prefs), cautions };
}

function describeWhat(t: Trend, name: string, kinds: string[]): string {
  const ev = t.evidence[0];
  const topicDesc = t.evidence.find((e) => e.kind === 'social_topic' && e.text)?.text;
  if (topicDesc) return `${name} — ${topicDesc}`;
  if (kinds.includes('search_interest')) return `"${name}" is a rising Google search in ${Array.from(new Set(t.evidence.filter((e) => e.region).map((e) => e.region))).join('/') || 'tracked regions'}; related headlines: ${t.evidence.flatMap((e) => e.links || []).slice(0, 2).map((l) => `“${l.title}”`).join(' · ') || ev?.title}.`;
  if (kinds.includes('hashtag')) return `#${name.replace(/^#/, '')} is a trending hashtag (${t.category} › ${t.subcategory}) with measured daily usage.`;
  if (t.name.endsWith('(format)')) return `${name} content: a cluster of ${t.videoCount} recent videos from different creators in the "${name}" format on ${t.platforms.join(', ')}.`;
  return `${name}: a cluster of ${t.evidenceCount} related posts/videos (${t.category} › ${t.subcategory}).`;
}

function buildConcepts(t: Trend, name: string, prefs: Preferences): Concept[] {
  const kw = t.keywords.filter((k) => k.length > 3 && !/^(format|video|videos)$/.test(k)).slice(0, 3);
  const k1 = kw[0] ? kw[0] : name.toLowerCase();
  const hasAnim = prefs.tools.includes('animation');
  const hasAI = prefs.tools.includes('ai-video');
  const hasMusic = prefs.tools.includes('music') || prefs.tools.includes('audio');
  const out: Concept[] = [];
  const push = (c: Concept) => out.length < 3 && out.push(c);

  switch (t.category) {
    case 'Animals & Pets':
      push({ title: `Studio Sessions: ${cap(k1)} edition`, format: '30–45s animated short, vertical', pitch: `An original animated animal character runs a tiny recording studio. Each episode it "produces" a track inspired by ${name} — ending with the animal performing it badly, then perfectly.`, hook: 'Open on the animal slamming the mixing desk; cut to title in frame 2.', repeatable: 'New animal + new genre every week; same set, same beats.' });
      push({ title: `What they're really saying`, format: '20–30s dubbed clip, vertical', pitch: `Take your own pet footage (never other people's) and dub an inner monologue that riffs on ${name}. The character voice stays consistent across episodes.`, hook: 'First line of dialogue lands before the animal moves.', repeatable: 'One recurring voice, endless situations.' });
      push({ title: `${cap(k1)} vs. the Rules`, format: '45–60s sketch (eligible for TikTok Rewards at >60s)', pitch: `A deadpan narrator explains "the rules" of ${name} while your animal character breaks every one of them.`, hook: 'Rule #1 on screen while it is being broken.', repeatable: 'Rules series: numbered, collectible.' });
      break;
    case 'Music':
      push({ title: `One-take ${cap(k1)} challenge`, format: '45–60s performance, vertical', pitch: `Join ${name} with an original 20-second hook written for the prompt, performed in one take with an on-screen timer. Original composition keeps the rights yours.`, hook: 'Timer starts; first bar hits within 1.5s.', repeatable: 'Daily/weekly prompt → new hook each time.' });
      push({ title: `${cap(k1)} explained by a cartoon producer`, format: '30s animated explainer', pitch: `An animated producer character breaks down why ${name} works musically (rhythm, chord trick, meme hook), then plays an original riff that uses the trick.`, hook: 'Character says the counter-intuitive thing first.', repeatable: 'Any trending sound → same character, new lesson.' });
      push({ title: `Genre flip`, format: '30–40s, vertical', pitch: `Rebuild the vibe of ${name} in an unexpected genre (lo-fi, bluegrass, chiptune) with your own melody and lyrics — a parody of the style, not a cover.`, hook: 'Play the expected sound for 1s, then the flip.', repeatable: 'Weekly flip of whatever is trending.' });
      break;
    case 'Comedy':
    case 'Entertainment':
      push({ title: `${cap(k1)} — the corporate training video`, format: '45–75s sketch', pitch: `A faux-serious training module teaches new hires how to do ${name} correctly. Deadpan narrator, stock-footage energy, one escalating absurdity per 10 seconds.`, hook: 'Compliance-style title card, serious voice, ridiculous subject.', repeatable: 'Module 1, 2, 3… for every trend.' });
      push({ title: `Animated reaction character`, format: '20–30s animated short', pitch: `An original animated character reacts to the idea of ${name} with one strong opinion and a physical gag. No real people depicted.`, hook: 'Cold open on the gag.', repeatable: 'Same character, new trend each day.' });
      push({ title: `Two-shot bit: ${cap(k1)} optimist vs. pessimist`, format: '30–45s dialogue sketch', pitch: `Two recurring characters argue about ${name}; the pessimist is always secretly participating.`, hook: 'Optimist speaks first, pessimist already mid-trend in background.', repeatable: 'Format works for anything trending.' });
      break;
    case 'Animation & Art':
      push({ title: `${cap(k1)}: 12 seconds, 12 frames`, format: '15–30s animated loop + process', pitch: `A tight original loop on the ${name} theme, then a 10-second time-lapse of how it was made. The loop is the share; the process is the follow.`, hook: 'Loop plays first, process second.', repeatable: 'Weekly loop; themes come from the radar.' });
      push({ title: `Character pilot in the ${cap(k1)} style`, format: '45–60s short', pitch: `Introduce an original character through one problem related to ${name}. Finale-style energy without any existing IP.`, hook: 'Character in trouble within the first second.', repeatable: 'Episode 2 if the pilot lands; otherwise a new pilot.' });
      push({ title: `AI-assisted storyboard → hand-finished`, format: '30s vertical, process+result', pitch: `Use AI tools only for rough boards, then animate the key moments by hand on a ${name} premise. Show the contrast; disclose the AI step on screen.`, hook: 'Rough AI board vs. finished frame side by side.', repeatable: 'Any premise.' });
      break;
    case 'Gaming':
      push({ title: `${cap(k1)} in 60 seconds — animated recap`, format: '60–75s animated recap', pitch: `A recurring cartoon narrator recaps what is happening around ${name} with original character art (no copyrighted game footage needed).`, hook: 'Narrator states the stakes in one line.', repeatable: 'Weekly recap of the trending game/community moment.' });
      push({ title: `The schedule nobody asked for`, format: '30s sketch', pitch: `Parody of stream-schedule culture inspired by ${name}: an over-planned week that collapses by Tuesday.`, hook: 'Calendar with absurd entries.', repeatable: 'Seasonal variants.' });
      push({ title: `Horror-game reactions, but it's a puppet`, format: '45–60s', pitch: `A puppet/animated character "plays" a fictional horror game built around ${name}; sound design does the scaring.`, hook: 'Darkness, breathing, one jump.', repeatable: 'New fake game each episode.' });
      break;
    case 'Seasonal & Holidays':
      push({ title: `${cap(k1)} — the 10-second tradition`, format: '20–30s vertical', pitch: `An original animated family invents a new ${name} tradition every episode; the twist is always practical and slightly wrong.`, hook: 'Tradition stated as fact in the first frame.', repeatable: 'Every holiday has 20 traditions to invent.' });
      push({ title: `Costume for a character that doesn't exist`, format: '30s process + reveal', pitch: `Design a costume for your own original character tied to ${name}; the reveal is the payoff.`, hook: 'Blank mannequin to full reveal.', repeatable: 'Seasonal.' });
      push({ title: `Trick-or-treat economics`, format: '45–60s explainer sketch', pitch: `A deadpan "analyst" character runs the numbers on ${name} with charts — comedic but informative.`, hook: 'A chart that goes the wrong way.', repeatable: 'Every seasonal moment.' });
      break;
    case 'Tech & AI':
      push({ title: `Spot the fake: ${cap(k1)}`, format: '45–60s explainer', pitch: `Short, visual test on how to recognise what is going on with ${name}, using your own generated examples (clearly labelled) — educational angle keeps it ad-friendly.`, hook: 'Two clips, one fake — which?', repeatable: 'New examples weekly as tools change.' });
      push({ title: `Animated explainer: how ${cap(k1)} actually works`, format: '60–90s', pitch: `A recurring animated host explains the mechanism behind ${name} with one metaphor and one demo.`, hook: 'The metaphor first.', repeatable: 'Any tech trend.' });
      push({ title: `Honest 7-day test`, format: 'long-form 6–8 min + Shorts cuts', pitch: `Use the thing behind ${name} for a week; show real results, costs and the one thing nobody mentions. High-RPM territory.`, hook: 'Day 7 result shown in the first 5 seconds.', repeatable: 'Weekly tool tests.' });
      break;
    case 'Film & TV':
      push({ title: `If ${cap(k1)} were a Saturday-morning cartoon`, format: '30–45s animated parody', pitch: `An original animated spoof of the style around ${name} — new characters, new story, recognisable vibe.`, hook: 'Theme-song energy in the first second.', repeatable: 'Every big release or revival.' });
      push({ title: `Review by a character who hasn't seen it`, format: '30s comedic review', pitch: `A recurring critic character reviews ${name} based purely on the poster and vibes.`, hook: 'Confident wrong take.', repeatable: 'Weekly.' });
      push({ title: `Why it's back: ${cap(k1)}`, format: '60–90s video essay (Shorts cut + long-form)', pitch: `Explain the cultural reason behind ${name} with original motion graphics; no clips required.`, hook: 'State the surprising reason first.', repeatable: 'Any nostalgia cycle.' });
      break;
    case 'Food & Cooking':
      push({ title: `The 45-second ${cap(k1)} that actually works`, format: '45–60s vertical, overhead camera', pitch: `One dish from the ${name} wave, cooked in real time with on-screen timers and one honest failure point. No voiceover fluff; captions carry the steps.`, hook: `Finished plate first, then "here's the 45-second version".`, repeatable: 'One dish per week from whatever is trending.' });
      push({ title: `Animated kitchen critic`, format: '20–30s animated short', pitch: `An original animated character (a very opinionated spoon, say) reviews the ${name} trend and tries it — ending on a single practical tip.`, hook: 'The character says the controversial thing in frame one.', repeatable: 'Any food trend; same character, new dish.' });
      push({ title: `Price it out: ${cap(k1)}`, format: '45–60s, motion-graphics overlays', pitch: `Cook the trending ${name} dish and show the real cost per serving vs. takeout, with receipts on screen. Affiliate-friendly (tools, pantry items).`, hook: 'The price comparison number first.', repeatable: 'Weekly "price it out".' });
      break;
    case 'Lifestyle':
      push({ title: `${cap(k1)}: the 7-day test`, format: '60–90s (Shorts cut + long-form)', pitch: `Try the ${name} routine for a week; show day 1 vs day 7 honestly with one measurable result.`, hook: 'Day-7 result in the first 3 seconds.', repeatable: 'New routine every week.' });
      push({ title: `Animated "what they don't tell you"`, format: '30s animated explainer', pitch: `A recurring animated host lists the three things nobody mentions about ${name}, with one visual gag each.`, hook: 'Number three first, out of order.', repeatable: 'Any lifestyle trend.' });
      push({ title: `Budget vs. splurge: ${cap(k1)}`, format: '45s split-screen', pitch: `Recreate the ${name} look/setup two ways with prices on screen; strong affiliate and sponsorship fit.`, hook: 'Total prices side by side.', repeatable: 'Weekly comparison.' });
      break;
    case 'Science & Education':
      push({ title: `${cap(k1)} in one metaphor`, format: '45–60s animated explainer', pitch: `Explain ${name} with a single running metaphor drawn as an original animation; end with the one number people will quote.`, hook: 'The quotable number first.', repeatable: 'Any topic the radar surfaces.' });
      push({ title: `Kitchen-table experiment`, format: '60s, single take', pitch: `A cheap at-home demonstration related to ${name}, filmed in one take with an on-screen prediction before the result.`, hook: 'Ask the viewer to guess.', repeatable: 'Weekly experiment.' });
      push({ title: `Why it's trending: ${cap(k1)}`, format: '60–90s motion graphics', pitch: `Trace the news hook behind ${name} back to the underlying science with original diagrams — evergreen explainer, high-RPM category.`, hook: 'State the misconception, then correct it.', repeatable: 'Weekly.' });
      break;
    case 'Sports':
      push({ title: `${cap(k1)} — the animated recap nobody asked for`, format: '45–60s animated recap', pitch: `Recap the ${name} moment with original cartoon characters (no broadcast footage), narrated like a nature documentary.`, hook: 'Documentary voice over a ridiculous drawing.', repeatable: 'Every big game.' });
      push({ title: `Explain it to a non-fan`, format: '45s sketch', pitch: `Two recurring characters: one explains ${name} to the other, who asks the questions everyone is afraid to ask.`, hook: 'The dumbest question first.', repeatable: 'Any sport, any moment.' });
      push({ title: `The stat that matters`, format: '30s motion graphics', pitch: `One real number behind ${name}, animated, with a sharp opinion at the end.`, hook: 'Number first.', repeatable: 'Daily during playoffs.' });
      break;
    case 'Photography & Visual':
      push({ title: `${cap(k1)} in 10 frames`, format: '20–30s vertical montage + 1 tip', pitch: `Ten of your own shots for the ${name} prompt, cut to a beat, ending with one technical tip on screen.`, hook: 'Best frame first.', repeatable: 'Follows the weekly prompt calendar.' });
      push({ title: `Phone vs. camera: ${cap(k1)}`, format: '45s split-screen', pitch: `Shoot the ${name} prompt on a phone and a camera; reveal which is which at the end. Affiliate fit for gear.`, hook: 'Guess which is the phone.', repeatable: 'Weekly.' });
      push({ title: `Animated how-I-shot-it`, format: '30s animated breakdown', pitch: `Animate the lighting diagram and camera position behind one ${name} image, then show the photo.`, hook: 'Diagram → photo reveal.', repeatable: 'One image per week.' });
      break;
    default:
      push({ title: `${cap(k1)} — animated explainer`, format: '45–60s vertical', pitch: `A recurring animated host explains ${name} in plain language with one visual metaphor.`, hook: 'The metaphor in frame one.', repeatable: 'Any topic the radar surfaces.' });
      push({ title: `The ${cap(k1)} sketch`, format: '30–45s comedy sketch', pitch: `Two recurring characters discover ${name}; one over-commits, the other refuses, both end up doing it.`, hook: 'Argument already in progress.', repeatable: 'Works for any trend.' });
      push({ title: `${cap(k1)} in numbers`, format: '30–40s motion-graphics short', pitch: `Three real numbers about ${name} (from the evidence) turned into a punchy motion-graphics piece with an opinion at the end.`, hook: 'Biggest number first.', repeatable: 'Weekly data short.' });
  }
  // tailor the first concept's format note to the user's tools
  if (!hasAnim) out.forEach((c) => (c.format = c.format.replace('animated', 'live-action or stock-asset')));
  if (hasAI && hasAnim) out[0].format += ' · AI-assisted boards, hand-finished';
  if (hasMusic && t.category !== 'Music') out[out.length - 1].pitch += ' Original music bed keeps it Content-ID safe.';
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
