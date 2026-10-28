/**
 * Relevance validation — stage 2 of classification.
 *
 * Stage 1 (taxonomy.ts) is a fast keyword classifier over all text. Stage 2 validates whether a specific
 * observation is genuinely an example of a VIDEO FORMAT:
 *   - only the video-level text counts (the linked video's title, a native clip's post text, a YouTube
 *     title/description) — never the surrounding social chatter;
 *   - the item must actually be a video (a text post that mentions cooking is not a cooking video);
 *   - sense disambiguation rules reject other meanings of the same words ("cooking up an album",
 *     "Cat Stevens", "a satisfying election result");
 *   - a category veto rejects items whose own text classifies elsewhere (a music video is never a cooking tutorial).
 *
 * Formats marked `generic` are evergreen categories: they describe activity, never an emerging trend by themselves.
 */
import type { Observation } from '../types.js';
import { classify } from './taxonomy.js';

export interface FormatDef {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  /** canonical description used by the optional embedding stage */
  description: string;
  include: RegExp[];
  exclude: RegExp[];
  vetoCategories: string[];
  generic: boolean;
  /** Bluesky / YouTube discovery queries that feed this format's pool */
  queries: string[];
}

const MUSIC_RELEASE = /\b(official (?:music |lyric |audio )?video|lyric video|official audio|music video|new single|new album|out now|feat\.|ft\.|remix|tour dates?)\b/i;
const EP_RELEASE = /\bEP\b/; // case-sensitive: "ep 2" of a series is not a record release
const NEWS_WORDS = /\b(trump|biden|election|senate|congress|vote|voters?|poll|republican|democrat|white house|parliament|minister|war|israel|gaza|ukraine)\b/i;

export const FORMATS: FormatDef[] = [
  {
    id: 'cooking', name: 'Cooking & recipes', category: 'Food & Cooking', subcategory: 'Recipes & Tutorials',
    description: 'a video showing someone cooking, baking or preparing a recipe in a kitchen',
    include: [/\b(recipes?|cook(?:ing|ed|s)?|bak(?:e|ing|ed)|kitchen|chef|meal ?prep|(?:dinner|breakfast|lunch|dessert) (?:recipe|idea|prep)s?|ingredients?|air ?fryer|sous[- ]vide|stir[- ]fry|deep[- ]fried|homemade|sourdough|pasta|ramen|casserole|cheese sauce|marinade|slow cooker|one[- ]pan|barbecue|bbq)\b/i, /\b(?:curry|roast|grill)\b(?! [A-Z])/],
    exclude: [/\bcook(?:ing|ed|s)?\s+(?:up|them|him|her|us|you|it|that|this)\b/i, /\bcookin'?\b/i, /\bkeeps? cooking\b/i, /\blet (?:him|her|them) cook\b/i, /\bcooked\b(?= (?:him|her|them|us))/i, MUSIC_RELEASE, EP_RELEASE, /\bdeep clean(?:er|ing)?\b/i, /\bshort film\b/i, /\bsolar|turbines?|squirrels?\b/i],
    vetoCategories: ['Music', 'News & Politics', 'Tech & AI', 'Sports', 'Business & Finance'],
    generic: true, queries: ['cooking video', 'recipe'],
  },
  {
    id: 'cats', name: 'Cat videos', category: 'Animals & Pets', subcategory: 'Cats',
    description: 'a video featuring a real or animated cat or kitten being funny, cute or doing something unusual',
    include: [/\b(cats?|kittens?|kitty|kitties|feline|meow(?:ing)?|purr(?:ing)?|tabby|calico|tuxedo cat|orange cat|void cat)\b/i],
    exclude: [/\bcat (?:stevens|power|deeley|burns)\b/i, /\bstray cats\b/i, /\bcheshire cat\b/i, /\btommy the cat\b/i, /\bcat'?s in the cradle\b/i, /\bchina cat\b/i, /\bcat (?:scan|5|6)\b/i, /\bcaterpillar\b/i, /\bcatalog(?:ue)?\b/i, MUSIC_RELEASE],
    vetoCategories: ['Music', 'News & Politics', 'Sports'],
    generic: true, queries: ['cat video', 'funny cat'],
  },
  {
    id: 'dogs', name: 'Dog videos', category: 'Animals & Pets', subcategory: 'Dogs',
    description: 'a video featuring a dog or puppy',
    include: [/\b(dogs?|puppy|puppies|pupper|doggo|golden retriever|labrador|corgi|husky|dachshund|pit ?bull|beagle|poodle|spaniel|shepherd|terrier|good boy|good girl|walkies)\b/i],
    exclude: [/\bhot ?dogs?\b/i, /\bdog days\b/i, /\bunderdog\b/i, /\bdog whistle\b/i, /\bsnoop dogg\b/i, /\btop dog\b(?! grooming)/i, MUSIC_RELEASE],
    vetoCategories: ['Music', 'News & Politics', 'Sports', 'Business & Finance'],
    generic: true, queries: ['dog video', 'puppy'],
  },
  {
    id: 'animal_comedy', name: 'Animal comedy & dubbed animals', category: 'Animals & Pets', subcategory: 'Animal Comedy & AI Animals',
    description: 'a comedic video where an animal talks, sings, raps, is dubbed with a voice, or acts out a human situation',
    include: [/\b(talking|singing|rapping|dubbed|voice ?over|voiced|interview(?:s|ed|ing)?|courtroom|lawyer|podcast|news anchor|therapist)\b.{0,60}\b(cats?|dogs?|kittens?|puppy|puppies|animals?|hamster|parrot|raccoon|capybara|frog|goat|cow|duck|otter|penguin)\b/i, /\b(cats?|dogs?|kittens?|puppy|animals?|hamster|parrot|raccoon|capybara|frog|goat|cow|duck|otter|penguin)\b.{0,60}\b(talking|singing|raps?|rapping|dubbed|voice ?over|voiced|interview(?:s|ed|ing)?|courtroom|lawyer|podcast|news anchor|therapist|skit)\b/i],
    exclude: [MUSIC_RELEASE, NEWS_WORDS],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: false, queries: ['talking cat', 'animal skit', 'dubbed dog'],
  },
  {
    id: 'animation', name: 'Animation shorts', category: 'Animation & Art', subcategory: 'Indie Animation',
    description: 'a short animated video or animation clip made by an independent animator',
    include: [/\b(animation|animated|animating|animator|animatic|cartoon|stop[- ]motion|claymation|rotoscope|2d|3d|blender|toon ?boom|frame[- ]by[- ]frame|pilot episode|web ?series)\b/i],
    exclude: [/\banimated (?:gif|emoji|sticker)s?\b/i, /\bnetflix\b/i, /\bdisney\+?\b/i, /\bpixar\b/i, /\bcrunchyroll\b/i, /\btrailer\b/i, MUSIC_RELEASE],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['animation', 'animated short', 'indie animation'],
  },
  {
    id: 'short_film', name: 'Short films', category: 'Film & TV', subcategory: 'General',
    description: 'an independent short film or teaser for one',
    include: [/\b(short film|shortfilm|a new short)\b/i],
    exclude: [NEWS_WORDS, MUSIC_RELEASE],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['short film'],
  },
  {
    id: 'ai_video', name: 'AI-generated video', category: 'Tech & AI', subcategory: 'AI Video & Generative Media',
    description: 'a video made with generative AI tools such as Sora, Veo, Runway, Kling, or an AI animation',
    include: [/\b(ai[- ]generated|ai video|ai animation|made with ai|generated with|sora|veo ?3?|runway(?: gen)?|kling|midjourney|stable diffusion|text[- ]to[- ]video|ai film|ai short)\b/i],
    // 4.0.1: videos ABOUT making or spotting AI video (tutorials, "kaise banaye", deepfake explainers) are not AI videos
    exclude: [/\bdeep ?fake\b.{0,40}\b(trump|biden|election|politician|minister)\b/i, NEWS_WORDS, /\bai (?:data ?centers?|chips?|stocks?|bubble|regulation)\b/i, /\bhow to (?:make|create|spot|detect|generate|use)\b|\bkaise banaye\b|\bkaise banaen\b|\btutorial\b|\bstep by step\b|\bprompt(?:s|ing)? (?:guide|tutorial)\b|\bspot a deep ?fake\b/i],
    vetoCategories: ['News & Politics', 'Business & Finance'],
    generic: false, queries: ['ai video', 'ai animation', 'made with sora'],
  },
  {
    id: 'comedy_skit', name: 'Comedy skits & sketches', category: 'Comedy', subcategory: 'Sketch & Skits',
    description: 'a scripted comedy sketch or skit performed by a creator, often with recurring characters',
    include: [/\b(skits?|sketch(?:es)?|sketch comedy|comedy|comedic|parody|spoof|satire|improv|bit|punchline|deadpan|pov:)\b/i],
    exclude: [/\bsketch(?:book|ing|ed)?\b(?! comedy)/i, /\bpencil sketch\b/i, /\bart sketch\b/i, /\bcomedy (?:central|club)\b/i, /\blevel design\b/i, NEWS_WORDS, MUSIC_RELEASE],
    vetoCategories: ['News & Politics', 'Sports', 'Photography & Visual'],
    generic: true, queries: ['comedy skit', 'sketch comedy', 'parody'],
  },
  {
    id: 'satisfying', name: 'Satisfying & ASMR', category: 'Entertainment', subcategory: 'Memes & Challenges',
    description: 'an oddly satisfying or ASMR video: slime, kinetic sand, pressure washing, restoration, crafts, close-up sounds',
    include: [/(?:\boddly satisfying\b|#satisfying\b|\bsatisfying\s*(?:[👀😌✨🤤]|$)|#?asmr\b|\b(?:slime|kinetic sand|hydraulic press|pressure wash(?:ing)?|restor(?:ation|ing)|soap cutting|cake decorating|calligraphy|power ?wash)\b)/iu],
    exclude: [/\bsatisfying (?:to (?:see|watch|hear)|that|result|win|ending|conclusion|verdict|loss|defeat|payoff)\b/i, /\b(?:very|so|deeply|extremely|more|most|quite|immensely) satisfying\b/i, /\b(?:level design|gameplay|election|senate)\b/i, /#(?:daddy|gentledom|femdom|findom|lewd)\b/i, NEWS_WORDS],
    vetoCategories: ['News & Politics', 'Sports', 'Business & Finance'],
    generic: true, queries: ['satisfying', 'asmr'],
  },
  {
    id: 'timelapse', name: 'Timelapse & process', category: 'Animation & Art', subcategory: 'Process & Speedpaint',
    description: 'a timelapse or process video showing something being made or changing over time',
    include: [/\b(time[- ]?lapse|speed ?paint|speedpaint|process video|work in progress|wip|hyperlapse|from start to finish|how i made)\b/i],
    exclude: [NEWS_WORDS, MUSIC_RELEASE],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['timelapse', 'speedpaint'],
  },
  {
    id: 'storytime', name: 'Storytime & narration', category: 'Entertainment', subcategory: 'General',
    description: 'a creator telling a personal story to camera or over footage',
    include: [/\b(story ?time|storytime|the time i|what happened when|i got (?:fired|caught|scammed|lost)|true story|my (?:worst|best|craziest))\b/i],
    exclude: [NEWS_WORDS, /\(\d{4}\)/, /#newalbum\b/i, /\blibrary\b/i],
    vetoCategories: ['News & Politics'],
    generic: true, queries: ['storytime'],
  },
  {
    id: 'cover_song', name: 'Covers & musical performances', category: 'Music', subcategory: 'Covers & Mashups',
    description: 'a creator performing a cover, mashup, acoustic or original song on camera',
    include: [/\b(cover|acoustic|mashup|unplugged|live session|one[- ]take|loop pedal|a ?cappella|vocal cover|guitar cover|piano cover)\b/i],
    exclude: [/\bcover (?:story|letter|art|photo|up|charge|crop)\b/i, /\bbook cover\b/i, /\bmagazine cover\b/i, /\bofficial (?:music )?video\b/i],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['cover song', 'acoustic cover'],
  },
  {
    id: 'music_video', name: 'Music videos', category: 'Music', subcategory: 'Original Songs',
    description: 'an official or independent music video',
    include: [MUSIC_RELEASE, EP_RELEASE, /\b(music video|visualizer|official visuali[sz]er)\b/i],
    exclude: [NEWS_WORDS, /\bindie animation\b/i],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['music video'],
  },
  {
    id: 'gaming_clip', name: 'Gaming clips & streams', category: 'Gaming', subcategory: 'General',
    description: 'gameplay, a stream highlight or a video about a specific video game',
    include: [/\b(gameplay|playthrough|let'?s play|speedrun|stream schedule|twitch stream|minecraft|fortnite|roblox|phasmophobia|elden ring|zelda|pokemon|pokémon|mario|sonic|valorant|overwatch|apex|among us|stardew|balatro|silksong|hollow knight|skyrim|tomodachi ?life|video ?game)\b/i],
    exclude: [/\bgame (?:of thrones|day|7|4|5|6)\b/i, /\bworld series game\b/i, /\bplayoff\b/i, /\bspeedpaint\b/i, NEWS_WORDS],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['minecraft', 'gaming clip'],
  },
  {
    id: 'puppets', name: 'Puppet & character videos', category: 'Comedy', subcategory: 'Animated Comedy',
    description: 'a video starring a puppet, costume character or original mascot character',
    include: [/\b(puppets?|puppetry|muppet|mascot|costume character|felt|hand puppet|sock puppet)\b/i],
    exclude: [NEWS_WORDS, MUSIC_RELEASE],
    vetoCategories: ['News & Politics'],
    generic: false, queries: ['puppet'],
  },
  {
    id: 'street_interview', name: 'Street interviews & vox pops', category: 'Entertainment', subcategory: 'General',
    description: 'a creator interviewing strangers in public with a microphone',
    include: [/\b(street interview|vox ?pop|asked (?:strangers|people|students|new yorkers|londoners)|man on the street|we asked)\b/i],
    exclude: [NEWS_WORDS],
    vetoCategories: ['News & Politics'],
    generic: false, queries: ['street interview'],
  },
  {
    id: 'explainer', name: 'Explainers & edutainment', category: 'Science & Education', subcategory: 'Explainers',
    description: 'a short educational explainer video',
    include: [/\b(explainer|how (?:does|do) [\w' -]{2,30} works?|the science of|facts about|did you know|history of|explained:)/i, /\b[A-Z][\w'&-]+ Explained\b/],
    exclude: [NEWS_WORDS, /\b(opposition|leader|minister|mps?|council|tax(?:es)?|budget|party|campaign|candidate)\b/i, /\bno one ever explained\b/i],
    vetoCategories: ['News & Politics', 'Sports'],
    generic: true, queries: ['explainer', 'explained'],
  },
];

export const FORMAT_BY_ID = new Map(FORMATS.map((f) => [f.id, f]));

/** The text that describes the VIDEO itself (never the surrounding social chatter). */
export function videoText(o: Observation): string {
  if (o.kind !== 'video') return `${o.title} ${o.text || ''}`;
  // YouTube API record: title + description + tags
  if (o.source === 'youtube') return `${o.title} ${o.text || ''} ${(o.tags || []).join(' ')}`;
  // external video link shared socially: the link card title is the video's title
  if (o.video && o.video.platform !== 'bluesky') return o.title;
  // native clip: the post text is the caption
  return `${o.title} ${o.text || ''}`;
}

export interface RelevanceResult {
  formats: string[];
  rejected: { format: string; reason: string }[];
  titleCategory: string;
}

/** Validate one observation against every format. Only videos can be format evidence. */
export function validateObservation(o: Observation): RelevanceResult {
  const text = videoText(o);
  const titleCategory = classify(text).category;
  const formats: string[] = [];
  const rejected: RelevanceResult['rejected'] = [];
  if (o.kind !== 'video') return { formats, rejected, titleCategory };
  for (const f of FORMATS) {
    if (!f.include.some((re) => re.test(text))) continue;
    const ex = f.exclude.find((re) => re.test(text));
    if (ex) {
      rejected.push({ format: f.id, reason: `excluded by /${ex.source.slice(0, 40)}/` });
      continue;
    }
    if (f.vetoCategories.includes(titleCategory) && titleCategory !== f.category) {
      rejected.push({ format: f.id, reason: `text classifies as ${titleCategory}` });
      continue;
    }
    formats.push(f.id);
  }
  return { formats, rejected, titleCategory };
}

/** Does this observation count as an example of the given format? */
export function matchesFormat(o: Observation, formatId: string): boolean {
  return (o.formats || validateObservation(o).formats).includes(formatId);
}

/** Query → format id (for discovery pools). */
export function formatForQuery(query: string): FormatDef | undefined {
  const q = query.toLowerCase().replace(/^search:/, '').replace(/^yt:/, '').trim();
  return FORMATS.find((f) => f.queries.some((x) => x.toLowerCase() === q));
}
