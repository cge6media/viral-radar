/**
 * Opportunity classification (4.0) — three types of viral opportunity, decided from what can be observed:
 *
 *   event    one video (or one real-world moment / calendar day / news item) carries the attention: the top video
 *            holds most of the cluster's views, or there are ≤2 independent creators, or it is a news/person event.
 *            Interesting to watch; rarely a repeatable creator opportunity.
 *   meme     several independent creators remix or react to the SAME specific moment, sound, phrase or character
 *            inside a short time (new creators in the last 48h, spread ≤ 7 days, a specific — not generic — name).
 *   format   several independent creators (≥4) keep producing successful videos with a recognisable underlying
 *            structure: a shared title signature or a relevance-validated format, no single video dominating,
 *            activity spread over ≥ 2 days, ideally creators who repeat it.
 *   uncertain everything else: broad tags (#humor), title fragments ("from season 5"), too few examples.
 *
 * Structural features come from titles/descriptions only (hooks, series markers, versus, POV, transformation…).
 * Nothing here claims to know what the video looks like.
 */
import type { Observation, OpportunityClass, OpportunityType, Trend, TrendFeatures, VideoRecord } from '../types.js';
import { creatorKey, exampleKey, isBroadTopicTag } from './cluster.js';
import { contentTime } from './score.js';
import { STOPWORDS, hoursBetween, round, tokenize } from '../lib/util.js';
import { isAnyStopword } from './language.js';
import { FORMAT_BY_ID } from './relevance.js';

const CALENDAR = /\b(national|international|world)\b.*\bday\b|\b(halloween|diwali|dussehra|navratri|christmas|xmas|thanksgiving|ramadan|eid|easter|hanukkah|new year|valentine|karwa ?chauth|holi|black friday|cyber monday|mother'?s day|father'?s day|independence day|day of the dead|día de (los )?muertos)\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i;
/** generic descriptor words: a hashtag built only from these names a subject or a medium, never a specific format */
const DESCRIPTOR_WORDS = ['ai', 'animation', 'animated', 'anime', 'art', 'digital', '3d', '2d', 'cgi', 'vfx', 'live', 'stream', 'streaming', 'video', 'videos', 'short', 'shorts', 'funny', 'comedy', 'music', 'song', 'songs', 'dance', 'cat', 'cats', 'dog', 'dogs', 'pet', 'pets', 'kids', 'kid', 'baby', 'horror', 'scary', 'creepy', 'gaming', 'game', 'games', 'gameplay', 'cartoon', 'meme', 'memes', 'viral', 'edit', 'edits', 'status', 'vlog', 'vlogs', 'food', 'cooking', 'recipe', 'recipes', 'asmr', 'satisfying', 'diy', 'craft', 'crafts', 'tutorial', 'fashion', 'beauty', 'makeup', 'fitness', 'gym', 'travel', 'nature', 'love', 'cute', 'motivation', 'motivational', 'facts', 'fact', 'news', 'sports', 'sport', 'football', 'soccer', 'cricket', 'trend', 'trending', 'challenge', 'reels', 'reel', 'tiktok', 'youtube', 'hindi', 'tamil', 'telugu', 'bollywood', 'kpop', 'story', 'stories', 'film', 'films', 'movie', 'movies', 'series', 'fyp', 'explore', 'photography', 'photo', 'design', 'drawing', 'painting', 'paint', 'sketch', 'illustration', 'character', 'characters', 'oc', 'fanart', 'fan', 'animal', 'animals', 'bird', 'birds', 'fish', 'wildlife', 'car', 'cars', 'bike', 'moto', 'tech', 'technology', 'chatgpt', 'sora', 'generated', 'generative', 'stopmotion', 'clay', 'claymation', 'pixel', 'retro', 'lofi', 'remix', 'cover', 'beat', 'beats', 'rap', 'hiphop', 'rock', 'metal', 'guitar', 'piano', 'drum', 'drums', 'vocal', 'vocals', 'singing', 'singer', 'dj', 'edm', 'lyrics', 'relatable', 'moments', 'moment', 'highlights', 'highlight', 'clip', 'clips', 'history', 'science', 'space', 'education', 'learning', 'kitten', 'kittens', 'puppy', 'puppies', 'action', 'adventure', 'fantasy', 'romance', 'drama', 'thriller', 'documentary', 'review', 'reviews', 'unboxing', 'haul', 'prank', 'pranks', 'skit', 'skits', 'sketch', 'parody', 'dub', 'dubbed', 'voice', 'voiceover', 'original', 'official', 'new', 'best', 'top', 'daily', 'mini', 'micro', 'life', 'family', 'mom', 'dad', 'couple', 'school', 'college', 'work', 'office', 'home', 'house', 'room', 'kitchen', 'garden', 'farm', 'village', 'city', 'street', 'world', 'india', 'usa', 'uk', 'japan', 'korea', 'latino', 'latina', 'español', 'espanol', 'mexico', 'brasil', 'brazil', 'humor', 'humour', 'lol', 'fun', 'entertainment', 'shortsfeed', 'shortvideo', 'ytshorts', 'youtubeshorts'];
const DESCRIPTOR = new Set([...DESCRIPTOR_WORDS,
  // other languages: funny / story / facts / music / film / games / pets / sports / news descriptors
  'lucu', 'ngakak', 'kocak', 'komedi', 'comedia', 'cómico', 'comico', 'gracioso', 'risa', 'risas', 'chistes', 'humor', 'curiosidades', 'curiosidad', 'historia', 'historias', 'hechos', 'datos', 'fakta', 'faktaunik', 'unik', 'cerita', 'kisah', 'emotional', 'emotionalstory', 'emosional', 'kahani', 'kahaniya', 'kahaniyan', 'drama', 'cine', 'película', 'pelicula', 'peliculas', 'musica', 'música', 'canción', 'cancion', 'canciones', 'baile', 'animación', 'animacion', 'dibujos', 'juego', 'juegos', 'videojuegos', 'reacción', 'reaccion', 'receta', 'recetas', 'cocina', 'mascotas', 'perro', 'perros', 'gato', 'gatos', 'bebé', 'bebe', 'niños', 'ninos', 'infantil', 'deportes', 'fútbol', 'futbol', 'noticias', 'viralvideo', 'viralvideos', 'shortsvideo', 'trendingshorts', 'funnyvideo', 'funnyvideos', 'comedyvideo', 'funnyshorts', 'statusvideo', 'whatsappstatus', 'おもしろ', 'ショート', 'ショート動画', '映画紹介', 'ゲーム実況', 'あるある', 'アニメ', 'ゲーム', '面白い', '搞笑', '短剧', '短视频', '게임', '웃긴', '개그', '영화', '드라마', '쇼츠', '유머', 'мем', 'юмор', 'приколы', 'смешно']);
/** can the tag be split entirely into descriptor words? (#aianimation → ai + animation) */
export function isDescriptorTag(tag: string): boolean {
  const raw = tag.replace(/^#/, '').toLowerCase().trim();
  if (DESCRIPTOR.has(raw)) return true;
  const t = raw.replace(/[^a-z0-9]/g, '');
  if (!t) return false;
  if (DESCRIPTOR.has(t)) return true;
  const memo = new Map<number, boolean>();
  const can = (i: number): boolean => {
    if (i === t.length) return true;
    if (memo.has(i)) return memo.get(i)!;
    let ok = false;
    for (let j = i + 2; j <= t.length && !ok; j++) if (DESCRIPTOR.has(t.slice(i, j)) && can(j)) ok = true;
    memo.set(i, ok);
    return ok;
  };
  return t.length <= 24 && can(0);
}
const SPORTS_NEWS_RE = /\bballon d'?or\b|\bbal[oó]n de oro\b|\bgoal\b|\bgol\b|\bgoles\b|\bpartido\b|\bchampions\b|\bmundial\b|\bcopa\b|\bderby\b|\bcl[aá]sico\b|\bnba\b|\bnfl\b|\bmlb\b|\bufc\b|\bwwe\b|\bf1\b|\btransfer\b|\bsigns?\b|\bcontract\b|\btrade[ds]?\b|\binjur(y|ed)\b|\bbreaking\b|\bexplosion\b|\battack\b|\bkilled\b|\bdies\b|\bdead\b|\barrested\b|\bpolice\b|\bcourt\b|\bmissile\b|\bearthquake\b|\bcrash\b|\bprotest\b|\bscandal\b|\blawsuit\b|\belection\b|\bresigns?\b|\bfired\b|\bsuspended\b|\bceremony\b|\baward\b|\bwinner\b|\bganador\b|\bworlds\b|\bplayoffs?\b|\bfinals?\b/i;
const LIVE_RE = /\blive\b|live ?stream|\ben vivo\b|\bao vivo\b|🔴|\bstreaming\b|\bpremiere\b/i;
const RELEASE_RE = /\btrailer\b|\btr[aá]iler\b|\bteaser\b|\bbande-annonce\b|予告編|예고편|\bleak(ed|s)?\b|\bofficial\b|\bepisode\b|\bseason\b|\bgameplay\b|\brelease\b|\bpre-?order\b|\bdlc\b|\bpatch\b|\bupdate\b|\bceremony\b|\baward\b|\bfinals?\b|\bmatch\b|\bvs\.?\b|\bmv\b|\bfull album\b|\bout now\b/i;
const SIG_STOP = new Set(['could', 'would', 'should', 'will', 'just', 'only', 'even', 'still', 'really', 'very', 'much', 'many', 'more', 'most', 'also', 'than', 'then', 'them', 'this', 'that', 'what', 'when', 'where', 'which', 'while', 'with', 'without', 'your', 'you', 'our', 'their', 'into', 'onto', 'over', 'under', 'again', 'ever', 'never', 'always', 'something', 'anything', 'everything', 'nothing', 'someone', 'anyone', 'everyone', 'nobody', 'please', 'thanks', 'thank', 'like', 'subscribe', 'share', 'comment', 'follow', 'channel', 'watch', 'full', 'video', 'videos', 'shorts', 'short', 'youtube', 'youtubeshorts', 'ytshorts', 'shortsfeed', 'viral', 'trending', 'status', 'ini', 'itu', 'yang', 'dan', 'untuk', 'dengan', 'para', 'por', 'con', 'una', 'uno', 'los', 'las', 'del', 'que', 'como', 'más', 'pero', 'est', 'sur', 'pour', 'avec', 'dans', 'les', 'des', 'une', 'ben', 'bir', 'uma', 'com', 'não', 'nao', 'são', 'sao', 'mais']);

const GENERIC_NAME = new Set(['humor', 'funny', 'comedy', 'meme', 'memes', 'viral', 'trending', 'shorts', 'fyp', 'love', 'cute', 'fun', 'lol', 'status', 'edit', 'edits', 'vlog', 'minivlog', 'dailyvlog', 'motivation', 'facts', 'art', 'music', 'song', 'dance', 'gaming', 'anime', 'cartoon', 'animation', 'ai', 'news', 'sports', 'football', 'cricket', 'food', 'cooking', 'recipe', 'asmr', 'satisfying', 'cat', 'cats', 'dog', 'dogs', 'pets', 'animals', 'baby', 'kids', 'family', 'life', 'india', 'usa', 'uk']);

export const HOOKS: [string, RegExp][] = [
  ['question', /\?|^(why|how|what|who|when|where|can|does|did|is|are|would|should)\b/i],
  ['pov', /\bpov\b/i],
  ['when', /^when\b|\bwhen (you|your|he|she|they|the|my|we|a)\b/i],
  ['versus', /\bvs\.?\b|\bversus\b/i],
  ['numbered', /\b(top|best|worst)\s+\d+\b|\b\d+\s+(things|ways|reasons|tips|signs|types|levels)\b/i],
  ['series', /\b(part|ep|episode|day|chapter|round|level)\s*\d+\b|#\d+\b|\bpart\s+(one|two|three)\b/i],
  ['challenge', /\bchallenge\b|\bdesaf[ií]o\b|\breto\b/i],
  ['reaction', /\breact(s|ion|ing)?\b|\breacci[oó]n\b/i],
  ['transformation', /\b(before|after|turned into|transform(ation|ed)?|makeover|glow[- ]?up|evolution|restor(e|ation|ing)|upgrade)\b|\bantes y despu[eé]s\b/i],
  ['storytime', /\bstory ?time\b|\bstory\b|\bhistoria\b/i],
  ['tutorial', /\bhow to\b|\btutorial\b|\btips?\b|\bcómo\b|\bcomo hacer\b/i],
  ['sensory', /\basmr\b|\bsatisfying\b|\boddly\b/i],
  ['payoff', /\bwait for (it|the end)\b|\bthe ending\b|\bplot twist\b|\bunexpected\b|\bespera el final\b/i],
  ['animated', /\banimat(ed|ion|e)\b|\bcartoon\b|\b3d\b|\bcgi\b|\bstop[- ]?motion\b|\banima(ci[oó]n|do)\b/i],
  ['ai', /\bai\b|\bsora\b|\bveo\b|\bmidjourney\b|\bgenerated\b|\binteligencia artificial\b/i],
  ['character', /\b(character|personaje|mascot|puppet|muñeco|robot|monster|alien|dinosaur|dino)\b/i],
  ['music', /\bsong\b|\bcover\b|\bremix\b|\bbeat\b|\blyrics?\b|\bcanci[oó]n\b|\bmusic\b/i],
  ['caps', /^[^a-z]*[A-Z]{3,}[^a-z]*$/],
  ['emoji', /\p{Extended_Pictographic}/u],
  ['second_person', /\byou\b|\byour\b|\btú\b|\btu\b/i],
  ['escalation', /\b(every|each) (time|day|level)\b|\bbut (it|he|she|they) (gets|get|keeps|keep)\b|\bharder\b|\buntil\b/i],
];

export function nameShape(name: string, origin?: string): TrendFeatures['nameShape'] {
  const raw = name.trim();
  if (CALENDAR.test(raw)) return 'calendar';
  if (/^#/.test(raw)) return 'hashtag';
  const toks = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return 'fragment';
  const stop = (t: string) => STOPWORDS.has(t) || isAnyStopword(t);
  if (stop(toks[0]) || stop(toks[toks.length - 1]) || toks.every((t) => stop(t) || /^\d+$/.test(t))) return 'fragment';
  if (new Set(toks).size < toks.length) return 'fragment'; // "Kids Kids"
  if (toks.length === 2 && toks.every((t) => DESCRIPTOR.has(t))) return 'fragment'; // "Funny Moments", "Second Channel"-like descriptor pairs
  if (toks.length === 1 && GENERIC_NAME.has(toks[0])) return 'hashtag';
  const words = raw.split(/\s+/);
  if (words.length >= 2 && words.every((w) => /^\p{Lu}/u.test(w)) && origin !== 'hashtag') return 'entity';
  return 'phrase';
}

/** Structural features of a cluster from its evidence (titles/descriptions) and the video records. */
export function trendFeatures(t: Trend, byObs: Map<string, VideoRecord>, now: string): TrendFeatures {
  const videos = t.evidence.filter((e) => e.kind === 'video');
  const seenExample = new Set<string>();
  const uniqVideos: Observation[] = [];
  for (const v of videos) { const k = exampleKey(v); if (!seenExample.has(k)) { seenExample.add(k); uniqVideos.push(v); } }
  const w = t.windows['7d'];
  const recs = uniqVideos.map((v) => byObs.get(v.id)).filter((r): r is VideoRecord => !!r);
  const views = recs.map((r) => r.metrics.views || 0);
  const total = views.reduce((a, b) => a + b, 0);
  const dominance = total > 0 ? round(Math.max(...views) / total, 2) : uniqVideos.length ? round(1 / uniqVideos.length, 2) : 1;
  const byCreator = new Map<string, number>();
  for (const v of uniqVideos) byCreator.set(creatorKey(v), (byCreator.get(creatorKey(v)) || 0) + 1);
  const repeatCreators = Array.from(byCreator.values()).filter((n) => n >= 2).length;
  const times = uniqVideos.map((v) => contentTime(v)).filter((x): x is string => !!x).sort();
  const spreadHours = times.length >= 2 ? round(hoursBetween(times[0], times[times.length - 1]), 1) : 0;
  const shorts = recs.filter((r) => r.isShort).length;
  const durations = recs.map((r) => r.durationSec).filter((d): d is number => d != null && d > 0).sort((a, b) => a - b);
  const languages: Record<string, number> = {};
  for (const r of recs) if (r.language) languages[r.language] = (languages[r.language] || 0) + 1;
  const hooks: Record<string, number> = {};
  for (const v of uniqVideos) for (const [name, re] of HOOKS) if (re.test(v.title)) hooks[name] = (hooks[name] || 0) + 1;
  // signature: tokens shared by the titles of ≥3 independent creators (minus generic words and the platform noise)
  const tokensByCreator = new Map<string, Set<string>>();
  for (const v of uniqVideos) {
    const ck = creatorKey(v);
    const set = tokensByCreator.get(ck) || tokensByCreator.set(ck, new Set()).get(ck)!;
    for (const tok of tokenize(v.title)) if (tok.length >= 3 && !STOPWORDS.has(tok) && !SIG_STOP.has(tok) && !GENERIC_NAME.has(tok) && !DESCRIPTOR.has(tok) && !isBroadTopicTag(tok) && !/^\d+$/.test(tok)) set.add(tok);
  }
  const tokCount = new Map<string, number>();
  for (const set of tokensByCreator.values()) for (const tok of set) tokCount.set(tok, (tokCount.get(tok) || 0) + 1);
  const signature = Array.from(tokCount.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tok]) => tok);
  // does the cluster's name live in the titles, or only in descriptions (boilerplate like "join discord", "use code")?
  const nameToks = tokenize(t.name.replace(/^#/, '')).filter((x) => !STOPWORDS.has(x));
  const tagName = t.name.replace(/^#/, '').toLowerCase();
  const shape = nameShape(t.name, t.kind === 'microtrend' ? (t.name.startsWith('#') ? 'hashtag' : 'phrase') : t.kind);
  const inTitle = nameToks.length ? uniqVideos.filter((v) => { const tt = new Set(tokenize(v.title)); const tags = new Set((v.tags || []).map((x) => x.replace(/^#/, '').toLowerCase())); return (t.name.startsWith('#') ? nameToks.some((x) => tt.has(x)) : nameToks.every((x) => tt.has(x))) || tags.has(tagName) || tt.has(tagName); }).length : 0;
  const titleShare = uniqVideos.length ? round(inTitle / uniqVideos.length, 2) : 0;
  const liveShare = uniqVideos.length ? round(uniqVideos.filter((v) => LIVE_RE.test(v.title)).length / uniqVideos.length, 2) : 0;
  const catVotes = new Map<string, number>();
  for (const r of recs) if (r.platformCategory) catVotes.set(r.platformCategory, (catVotes.get(r.platformCategory) || 0) + 1);
  const platformCategory = Array.from(catVotes.entries()).sort((a, b) => b[1] - a[1]).find(([, n]) => n >= Math.max(2, recs.length / 2))?.[0];
  const descriptor = t.kind === 'microtrend' && (shape === 'hashtag' ? isDescriptorTag(t.name) : nameToks.length > 0 && nameToks.every((x) => DESCRIPTOR.has(x)));
  void now;
  return {
    creators: w.creators, videos: w.videos, directVideos: w.directVideos, dominance, repeatCreators, spreadHours, newCreators48h: w.newCreators,
    platforms: t.platforms, shortsShare: recs.length ? round(shorts / recs.length, 2) : 0, medianDurationSec: durations.length ? durations[Math.floor(durations.length / 2)] : undefined,
    languages, hooks, signature, nameShape: shape, titleShare, liveShare, platformCategory, descriptor,
  };
}

/** Decide the opportunity type from the features. Conservative: a format needs independent, repeated adoption. */
export function classifyOpportunity(t: Trend, f: TrendFeatures): OpportunityClass {
  const basis: string[] = [];
  let type: OpportunityType = 'uncertain';
  let confidence = 30;
  const specific = f.nameShape === 'phrase' || f.nameShape === 'entity' || (f.nameShape === 'hashtag' && !t.isGeneric && !GENERIC_NAME.has(t.name.replace(/^#/, '').toLowerCase()));
  basis.push(`${f.creators} independent creators, ${f.videos} videos (${f.directVideos} with platform statistics)`);
  if (f.dominance >= 0.7 && f.videos >= 2) basis.push(`one video holds ${Math.round(f.dominance * 100)}% of the cluster's views`);
  if (f.repeatCreators) basis.push(`${f.repeatCreators} creator${f.repeatCreators === 1 ? '' : 's'} posted it more than once`);
  if (f.spreadHours) basis.push(`examples spread over ${f.spreadHours < 48 ? `${Math.round(f.spreadHours)}h` : `${round(f.spreadHours / 24, 1)} days`}`);
  if (f.signature.length) basis.push(`shared title words: ${f.signature.slice(0, 5).join(', ')}`);

  const titles = t.evidence.filter((e) => e.kind === 'video').map((e) => e.title);
  const releaseShare = titles.length ? titles.filter((x) => RELEASE_RE.test(x)).length / titles.length : 0;
  const newsShare = titles.length ? titles.filter((x) => SPORTS_NEWS_RE.test(x)).length / titles.length : 0;
  const newsy = f.platformCategory === 'Sports' || f.platformCategory === 'News & Politics' || t.category === 'Sports' || t.category === 'News & Politics' || newsShare >= 0.4 || (f.platformCategory === 'Gaming' && releaseShare >= 0.3);
  // a structure must be visible beyond the cluster's own name: at least one shared title word that is not the name
  const nameWords = new Set(tokenize(t.name.replace(/^#/, '')));
  const extraSignature = f.signature.filter((w) => !nameWords.has(w));
  const strongStructure = f.signature.length >= 2 && extraSignature.length >= 1 && f.titleShare >= 0.5;
  if (t.isNewsEvent) { type = 'event'; confidence = 80; basis.push('flagged as a news/person event'); }
  else if (f.nameShape === 'calendar') { type = 'event'; confidence = 85; basis.push('a calendar moment (one-day attention, not a structure)'); }
  else if (f.nameShape === 'fragment') { type = 'uncertain'; confidence = 75; basis.push('the cluster name is a title fragment, not a recognisable format'); }
  else if (f.liveShare >= 0.5) { type = 'uncertain'; confidence = 80; basis.push('mostly live streams / stream recordings — not a video format'); }
  else if (newsy || releaseShare >= 0.5 || (f.nameShape === 'entity' && (releaseShare >= 0.3 || t.category === 'Gaming' || t.category === 'Film & TV'))) {
    type = 'event'; confidence = 70; basis.push(newsy ? `the examples are ${f.platformCategory || t.category} / news-style content — a news, sports or esports moment` : 'a named title/release (trailer, leak, episode, match) — a topic people cover, not a structure they reuse');
  }
  else if (t.kind === 'microtrend' && (f.nameShape === 'phrase' || f.nameShape === 'entity') && f.titleShare < 0.4 && !strongStructure) { type = 'uncertain'; confidence = 75; basis.push(`the name appears in only ${Math.round(f.titleShare * 100)}% of the titles — description boilerplate or a merged phrase, not a recognisable format`); }
  else if (f.dominance >= 0.75 && f.videos >= 2) { type = 'event'; confidence = 80; basis.push('one video is the whole story; the others are incidental'); }
  else if (f.creators <= 2 || (f.dominance >= 0.6 && f.creators <= 3)) {
    type = f.videos >= 1 && (f.directVideos >= 1) ? 'event' : 'uncertain';
    confidence = f.dominance >= 0.6 ? 75 : 55;
    if (type === 'event') basis.push('attention is concentrated in one or two creators — a single viral event until others adopt it');
  } else if (t.kind === 'format' && f.creators >= 4) {
    type = 'format'; confidence = 70 + Math.min(20, f.creators);
    basis.push(t.isGeneric ? 'an evergreen, relevance-validated format with independent adoption (not a new trend by itself)' : 'a relevance-validated format with independent adoption');
  } else if (t.isGeneric || f.descriptor || (f.nameShape === 'hashtag' && !specific)) {
    type = 'uncertain'; confidence = 70; basis.push('a broad tag describes a subject or a medium, not a format');
  } else if (f.creators >= 4 && f.dominance <= 0.6 && f.spreadHours >= 48 && (strongStructure || f.repeatCreators >= 2)) {
    type = 'format'; confidence = Math.min(95, 55 + 3 * f.creators + (f.repeatCreators ? 10 : 0) + (strongStructure ? 10 : 0));
    basis.push('several independent creators keep producing it with a shared, recognisable structure');
  } else if (f.creators >= 3 && specific && f.dominance < 0.6 && f.titleShare >= 0.4 && (f.newCreators48h >= 2 || f.spreadHours <= 24 * 7) && !(t.category === 'Gaming' && !strongStructure)) {
    type = 'meme'; confidence = Math.min(90, 45 + 5 * f.creators + 5 * Math.min(f.newCreators48h, 4));
    basis.push(`${f.newCreators48h} new creators in 48h around one specific moment/phrase`);
  } else if (f.creators >= 3) {
    type = 'uncertain'; confidence = 50; basis.push('independent creators exist but no shared structure is visible in the titles yet');
  }
  return { type, confidence, basis, features: f };
}

/** does a title itself satisfy a relevance-validated format's own rules? (descriptions can match by accident) */
export function titleMatchesFormat(t: Trend, title: string): boolean {
  const fmt = t.kind === 'format' ? FORMAT_BY_ID.get(t.id.replace(/^f_/, '')) : undefined;
  if (!fmt) return false;
  return fmt.include.some((re) => re.test(title)) && !fmt.exclude.some((re) => re.test(title));
}

/** Attach opportunity classes to every shipped trend (mutates). Returns counts by type. */
export function classifyTrends(trends: Trend[], records: VideoRecord[], now: string): Record<OpportunityType, number> {
  const byObs = new Map(records.map((r) => [r.id, r]));
  const counts: Record<OpportunityType, number> = { event: 0, meme: 0, format: 0, uncertain: 0 };
  for (const t of trends) {
    const f = trendFeatures(t, byObs, now);
    t.opportunity = classifyOpportunity(t, f);
    counts[t.opportunity.type]++;
  }
  return counts;
}
