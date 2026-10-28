/**
 * Category taxonomy + monetization profiles.
 *
 * Classification is keyword/semantic-lite: each category and subcategory has weighted keyword
 * patterns. A trend gets the category with the highest match score; "Other" when nothing matches.
 * Microtrends are discovered dynamically by the clustering step (see cluster.ts) — the taxonomy
 * only supplies the parent category and (when matched) a known subcategory.
 *
 * Monetization profile fields are 0..1 ratings based on publicly discussed creator-economy
 * patterns (advertiser suitability, sponsorship demand, affiliate fit, repeatability, longevity,
 * production cost). They are editorial assumptions, documented in SCORING.md, not measured payouts.
 */

export interface MonetizationProfile {
  advertiser: number;   // ad-friendliness / brand safety
  sponsorship: number;  // brand deal demand for the niche
  affiliate: number;    // product-link fit
  repeatable: number;   // can a creator make this every week?
  longevity: number;    // evergreen vs. one-day news
  cost: number;         // 0 = cheap to make, 1 = expensive
  demand: number;       // baseline audience demand
}

export interface Category {
  name: string;
  keywords: [string, number][]; // pattern, weight
  subcategories: { name: string; keywords: string[] }[];
  profile: MonetizationProfile;
}

const kw = (list: string, w = 1): [string, number][] => list.split(',').map((s) => [s.trim(), w]);

export const CATEGORIES: Category[] = [
  {
    name: 'Entertainment',
    keywords: [...kw('entertainment,celebrity,viral,challenge,prank,reaction,react,trend,meme,tiktok,shorts,reels,fan,fandom,finale,season,episode,trailer,premiere,cosplay,star,actor,actress,pun,puns,rename', 1), ...kw('streamer,streamers,twitch,vtuber,stream schedule', 1.5)],
    subcategories: [
      { name: 'Memes & Challenges', keywords: ['meme', 'challenge', 'trend', 'viral', 'prank', 'pun'] },
      { name: 'Reactions & Commentary', keywords: ['reaction', 'react', 'commentary', 'review', 'rant', 'drama'] },
      { name: 'Streaming & Live', keywords: ['stream', 'streamer', 'twitch', 'live', 'schedule', 'vtuber'] },
      { name: 'Celebrity & Pop Culture', keywords: ['celebrity', 'star', 'actor', 'actress', 'singer', 'rapper', 'fan', 'fandom', 'red carpet'] },
    ],
    profile: { advertiser: 0.7, sponsorship: 0.6, affiliate: 0.4, repeatable: 0.8, longevity: 0.4, cost: 0.3, demand: 0.9 },
  },
  {
    name: 'Comedy',
    keywords: kw('comedy,funny,skit,sketch,parody,satire,joke,humor,humour,hilarious,lol,standup,stand-up,roast,impression,bit', 1.2),
    subcategories: [
      { name: 'Sketch & Skits', keywords: ['skit', 'sketch', 'bit', 'character'] },
      { name: 'Parody & Satire', keywords: ['parody', 'satire', 'spoof'] },
      { name: 'Stand-up & Crowd Work', keywords: ['standup', 'stand-up', 'crowd work', 'comedian'] },
      { name: 'Animated Comedy', keywords: ['animated', 'animation', 'cartoon'] },
    ],
    profile: { advertiser: 0.75, sponsorship: 0.6, affiliate: 0.3, repeatable: 0.9, longevity: 0.6, cost: 0.3, demand: 0.9 },
  },
  {
    name: 'Animation & Art',
    keywords: kw('animation,animated,animator,cartoon,anime,stop-motion,stop motion,claymation,3d,blender,character design,oc,inktober,drawing,illustration,art,artist,sketch,comic,webtoon,manga,pixel art', 1.2),
    subcategories: [
      { name: 'Indie Animation', keywords: ['indie', 'web series', 'animated series', 'pilot', 'short film', 'animation'] },
      { name: 'Anime & Manga', keywords: ['anime', 'manga', 'shonen', 'bleach', 'naruto', 'one piece', 'jujutsu'] },
      { name: 'Stop-Motion & Craft', keywords: ['stop-motion', 'stop motion', 'claymation', 'laika', 'puppet'] },
      { name: 'Process & Speedpaint', keywords: ['speedpaint', 'timelapse', 'process', 'inktober', 'drawing', 'sketch'] },
      { name: 'AI Animation', keywords: ['ai animation', 'ai video', 'generated', 'sora', 'veo', 'runway', 'midjourney'] },
    ],
    profile: { advertiser: 0.8, sponsorship: 0.6, affiliate: 0.5, repeatable: 0.7, longevity: 0.8, cost: 0.7, demand: 0.7 },
  },
  {
    name: 'Music',
    keywords: kw('music,song,album,single,remix,cover,beat,producer,band,rapper,rap,hip hop,pop,rock,metal,jazz,lofi,lo-fi,concert,tour,lyrics,melody,vocal,sing,singer,chorus,playlist,dj,musician,soundtrack,ost,tunetuesday,musicchallenge,emojisounds,robotmusic', 1.2),
    subcategories: [
      { name: 'Covers & Mashups', keywords: ['cover', 'mashup', 'remix', 'acoustic'] },
      { name: 'Original Songs', keywords: ['original song', 'single', 'album', 'release', 'new song'] },
      { name: 'Music Challenges & Prompts', keywords: ['musicchallenge', 'emojisounds', 'tunetuesday', 'daily', 'prompt', 'challenge'] },
      { name: 'Production & Beats', keywords: ['beat', 'producer', 'production', 'synth', 'robotmusic', 'ableton', 'fl studio'] },
      { name: 'Musical Comedy', keywords: ['parody', 'funny', 'comedy', 'rapping', 'singing cat', 'musical animals'] },
    ],
    profile: { advertiser: 0.7, sponsorship: 0.5, affiliate: 0.4, repeatable: 0.8, longevity: 0.7, cost: 0.5, demand: 0.9 },
  },
  {
    name: 'Animals & Pets',
    keywords: kw('cat,cats,kitten,kittens,dog,dogs,puppy,puppies,pet,pets,animal,animals,parrot,hamster,wildlife,zoo,aquarium,raccoon,blackcatday,nationalblackcatday,caturday,dogsofbluesky,pawpdate', 1.3),
    subcategories: [
      { name: 'Cats', keywords: ['cat', 'cats', 'kitten', 'caturday', 'blackcat'] },
      { name: 'Dogs', keywords: ['dog', 'dogs', 'puppy', 'pawpdate'] },
      { name: 'Wildlife & Nature', keywords: ['wildlife', 'nature', 'zoo', 'bird', 'wild'] },
      { name: 'Animal Comedy & AI Animals', keywords: ['funny', 'talking', 'singing', 'rapping', 'ai', 'dubbed', 'voiceover'] },
    ],
    profile: { advertiser: 0.9, sponsorship: 0.6, affiliate: 0.7, repeatable: 0.9, longevity: 0.8, cost: 0.2, demand: 0.95 },
  },
  {
    name: 'Gaming',
    keywords: kw('game,games,gaming,gamer,gameplay,playthrough,speedrun,minecraft,fortnite,roblox,pokemon,pokémon,nintendo,playstation,xbox,steam,esports,phasmophobia,signalis,little nightmares,horror game,horror games,indie game,unite,let\'s play,lets play,rpg,fps,mod,stream schedule,stream schedules', 1.2),
    subcategories: [
      { name: 'Horror Games', keywords: ['horror', 'spooky', 'phasmophobia', 'signalis', 'little nightmares', 'scary'] },
      { name: 'Indie & Cozy Games', keywords: ['indie', 'cozy', 'pixel'] },
      { name: 'Competitive & Esports', keywords: ['esports', 'ranked', 'tournament', 'pro', 'unite', 'fortnite'] },
      { name: 'Sandbox & Creative', keywords: ['minecraft', 'roblox', 'build', 'sandbox', 'mod'] },
    ],
    profile: { advertiser: 0.8, sponsorship: 0.8, affiliate: 0.7, repeatable: 0.9, longevity: 0.6, cost: 0.3, demand: 0.9 },
  },
  {
    name: 'Film & TV',
    keywords: kw('movie,movies,film,films,box office,trailer,cinema,netflix,hbo,disney,marvel,spider-man,tv show,television,documentary,oscar,oscars,streaming hit,cult classic', 1),
    subcategories: [
      { name: 'Reviews & Breakdowns', keywords: ['review', 'breakdown', 'explained', 'ending', 'analysis'] },
      { name: 'Trailers & Releases', keywords: ['trailer', 'release', 'premiere', 'box office'] },
      { name: 'Nostalgia & Rewatch', keywords: ['cult classic', 'nostalgia', 'rewatch', 'retro', 'anniversary'] },
    ],
    profile: { advertiser: 0.8, sponsorship: 0.5, affiliate: 0.5, repeatable: 0.8, longevity: 0.5, cost: 0.3, demand: 0.85 },
  },
  {
    name: 'Tech & AI',
    keywords: kw('ai,artificial intelligence,chatgpt,openai,gpt,llm,robot,robots,deepfake,deep fake,tech,technology,iphone,ipad,ipadmini,apple,android,google,microsoft,software,app,gadget,review,unboxing,coding,programming,retrocomputing,c64,commodore,linux,crypto,bitcoin', 1),
    subcategories: [
      { name: 'AI Video & Generative Media', keywords: ['ai video', 'deepfake', 'deep fake', 'generated', 'sora', 'veo', 'ai animation', 'ai'] },
      { name: 'Gadgets & Unboxing', keywords: ['iphone', 'ipad', 'unboxing', 'gadget', 'review', 'apple', 'android'] },
      { name: 'Retro Computing', keywords: ['retro', 'retrocomputing', 'c64', 'commodore', '8bit', 'vintage'] },
      { name: 'Coding & Dev', keywords: ['coding', 'programming', 'developer', 'open source', 'linux'] },
    ],
    profile: { advertiser: 0.9, sponsorship: 0.9, affiliate: 0.9, repeatable: 0.8, longevity: 0.5, cost: 0.4, demand: 0.8 },
  },
  {
    name: 'Sports',
    keywords: [...kw('sports,sport,football,soccer,nfl,nba,mlb,nhl,baseball,basketball,golf,ufc,boxing,mma,f1,formula 1,playoff,playoffs,match,t20,t20i,test match,ipl,premier league,league cup,carabao,pitcher,bullpen,bowler,wicket,rankings,cup', 1), ...kw('cricket,tennis,wta,atp,world series,super bowl,superbowl,arsenal,brewers,mets', 1.6)],
    subcategories: [
      { name: 'Cricket', keywords: ['cricket', 't20', 't20i', 'ipl', 'wicket', 'bowler', 'test match'] },
      { name: 'Tennis', keywords: ['tennis', 'wta', 'atp', 'open', 'rankings'] },
      { name: 'Baseball', keywords: ['mlb', 'baseball', 'world series', 'pitcher', 'bullpen', 'brewers', 'mets'] },
      { name: 'Football (Soccer)', keywords: ['premier league', 'arsenal', 'league cup', 'carabao', 'soccer', 'fc'] },
      { name: 'American Football', keywords: ['nfl', 'super bowl', 'superbowl', 'quarterback'] },
    ],
    profile: { advertiser: 0.85, sponsorship: 0.7, affiliate: 0.5, repeatable: 0.8, longevity: 0.3, cost: 0.3, demand: 0.9 },
  },
  {
    name: 'News & Politics',
    keywords: kw('election,elections,vote,votes,voter,voters,poll,polls,senate,congress,president,trump,biden,harris,netanyahu,bolsonaro,lula,parliament,minister,government,policy,impeachment,rally,midterm,midterms,candidate,democrat,republican,party,runoff,protest,war,inequality,oxfam,politics,political', 1.1),
    subcategories: [
      { name: 'US Politics', keywords: ['trump', 'harris', 'senate', 'midterm', 'congress', 'democrat', 'republican'] },
      { name: 'World Politics', keywords: ['israel', 'brazil', 'bolsonaro', 'lula', 'netanyahu', 'parliament', 'canada'] },
      { name: 'Breaking News', keywords: ['crash', 'traffic', 'emergency', 'police', 'live updates', 'sell out', 'stockpile'] },
    ],
    profile: { advertiser: 0.3, sponsorship: 0.2, affiliate: 0.1, repeatable: 0.7, longevity: 0.1, cost: 0.2, demand: 0.9 },
  },
  {
    name: 'Seasonal & Holidays',
    keywords: kw('halloween,spooky,spooky month,trick-or-treat,trick or treat,trunk-or-treat,costume,pumpkin,haunted,christmas,thanksgiving,new year,valentine,easter,holiday,holidays,october,inktober,autumn,fall', 1.1),
    subcategories: [
      { name: 'Halloween', keywords: ['halloween', 'spooky', 'trick', 'costume', 'pumpkin', 'haunted', 'horror', 'october'] },
      { name: 'Christmas & Winter', keywords: ['christmas', 'holiday', 'winter', 'santa'] },
    ],
    profile: { advertiser: 0.9, sponsorship: 0.7, affiliate: 0.8, repeatable: 0.6, longevity: 0.4, cost: 0.3, demand: 0.85 },
  },
  {
    name: 'Lifestyle',
    keywords: kw('fashion,beauty,skincare,makeup,outfit,style,prada,campaign,cosmetic,treatment,fitness,workout,gym,diet,health,wellness,travel,vlog,day in the life,routine,morning routine,home,decor,diy,cleaning,organization,parenting,family,relationship,dating,wedding', 1),
    subcategories: [
      { name: 'Fashion & Beauty', keywords: ['fashion', 'beauty', 'skincare', 'makeup', 'outfit', 'prada', 'cosmetic'] },
      { name: 'Fitness & Health', keywords: ['fitness', 'workout', 'gym', 'health', 'wellness'] },
      { name: 'Vlogs & Routines', keywords: ['vlog', 'routine', 'day in the life'] },
      { name: 'Home & DIY', keywords: ['home', 'decor', 'diy', 'cleaning', 'organization'] },
    ],
    profile: { advertiser: 0.9, sponsorship: 0.9, affiliate: 0.95, repeatable: 0.9, longevity: 0.6, cost: 0.4, demand: 0.85 },
  },
  {
    name: 'Food & Cooking',
    keywords: kw('food,cooking,recipe,recipes,bake,baking,chef,kitchen,restaurant,mukbang,taste test,snack,drink,coffee,tea,meal,dinner,lunch,breakfast,dessert,pizza,burger,ramen,beans', 1),
    subcategories: [
      { name: 'Recipes & Tutorials', keywords: ['recipe', 'how to', 'tutorial', 'bake'] },
      { name: 'Taste Tests & Reviews', keywords: ['taste test', 'review', 'rating', 'trying'] },
    ],
    profile: { advertiser: 0.9, sponsorship: 0.8, affiliate: 0.8, repeatable: 0.9, longevity: 0.8, cost: 0.4, demand: 0.85 },
  },
  {
    name: 'Science & Education',
    keywords: kw('science,space,nasa,planet,dwarf planet,astronomy,physics,biology,chemistry,history,explainer,explained,education,learn,facts,math,engineering,experiment,documentary,how it works', 1),
    subcategories: [
      { name: 'Space & Astronomy', keywords: ['space', 'nasa', 'planet', 'astronomy', 'telescope'] },
      { name: 'Explainers', keywords: ['explainer', 'explained', 'how it works', 'facts'] },
      { name: 'History', keywords: ['history', 'historical', 'ancient', '1932', 'war'] },
    ],
    profile: { advertiser: 0.9, sponsorship: 0.7, affiliate: 0.5, repeatable: 0.8, longevity: 0.9, cost: 0.5, demand: 0.7 },
  },
  {
    name: 'Business & Finance',
    keywords: kw('business,finance,money,investing,stocks,stock,market,economy,startup,entrepreneur,side hustle,income,salary,prediction market,odds,bets,betting,prices,cost,costs', 1),
    subcategories: [
      { name: 'Investing & Markets', keywords: ['stocks', 'investing', 'market', 'crypto', 'prediction market'] },
      { name: 'Side Hustles & Income', keywords: ['side hustle', 'income', 'money', 'earn'] },
    ],
    profile: { advertiser: 0.95, sponsorship: 0.9, affiliate: 0.9, repeatable: 0.8, longevity: 0.6, cost: 0.3, demand: 0.7 },
  },
  {
    name: 'Photography & Visual',
    keywords: kw('photo,photography,photographer,monochrome,monochromemonday,texturetuesday,thicktrunktuesday,fineart,fine art,landscape,portrait,macro,blackandwhite,silentsunday,tercinema,cinematic', 1),
    subcategories: [
      { name: 'Daily Photo Prompts', keywords: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'daily'] },
      { name: 'Cinematic & Film Look', keywords: ['cinematic', 'tercinema', 'film look', 'vhs', 'analog'] },
    ],
    profile: { advertiser: 0.8, sponsorship: 0.7, affiliate: 0.8, repeatable: 0.9, longevity: 0.7, cost: 0.3, demand: 0.5 },
  },
];

export const OTHER_PROFILE: MonetizationProfile = { advertiser: 0.6, sponsorship: 0.4, affiliate: 0.3, repeatable: 0.5, longevity: 0.4, cost: 0.4, demand: 0.5 };

export interface Classification {
  category: string;
  subcategory: string;
  score: number;
  /** all category scores, for transparency */
  candidates: { category: string; score: number }[];
}

/** Score text against the taxonomy. Case-insensitive, whole-word patterns. */
export function classify(text: string, tags: string[] = []): Classification {
  const hay = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}#'\-\s]/gu, ' ')} ${tags.map((t) => ` ${t.toLowerCase()} `).join('')} `;
  const candidates = CATEGORIES.map((c) => {
    let score = 0;
    for (const [pat, w] of c.keywords) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(pat)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
      if (re.test(hay)) score += w;
    }
    return { category: c.name, score };
  }).sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score === 0) return { category: 'Other', subcategory: 'Uncategorized', score: 0, candidates };
  const cat = CATEGORIES.find((c) => c.name === best.category)!;
  let sub = 'General';
  let subScore = 0;
  for (const s of cat.subcategories) {
    const sc = s.keywords.filter((k) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(k)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(hay)).length;
    if (sc > subScore) {
      subScore = sc;
      sub = s.name;
    }
  }
  return { category: cat.name, subcategory: sub, score: best.score, candidates };
}

/** YouTube's own category (chosen by the uploader) → our taxonomy, where the mapping is unambiguous */
export const YT_CATEGORY_TO_OURS: Record<string, string> = {
  'Music': 'Music', 'Gaming': 'Gaming', 'Pets & Animals': 'Animals & Pets', 'Comedy': 'Comedy', 'Sports': 'Sports',
  'Science & Technology': 'Tech & AI', 'Education': 'Science & Education', 'News & Politics': 'News & Politics',
  'Film & Animation': 'Animation & Art', 'Howto & Style': 'Food & Cooking', 'Autos & Vehicles': 'Other', 'Travel & Events': 'Lifestyle',
};

/**
 * Classify a video, using the platform's own category as a prior: when our keyword classifier is unsure (score < 3)
 * and the uploader's category maps cleanly, the platform category wins; when the keywords are confident, they win.
 * Howto & Style is only trusted when the text says so (it covers makeup, DIY and cooking alike).
 */
export function classifyVideo(text: string, tags: string[] = [], platformCategory?: string): Classification {
  const kw = classify(text, tags);
  const mapped = platformCategory ? YT_CATEGORY_TO_OURS[platformCategory] : undefined;
  if (!mapped || mapped === 'Other') return kw;
  if (platformCategory === 'Howto & Style' && kw.category !== 'Food & Cooking') return kw.score > 0 ? kw : { ...kw, category: 'Lifestyle', subcategory: 'General' };
  if (kw.score >= 3 && kw.category !== 'Entertainment' && kw.category !== 'Other') return kw;
  if (kw.category === mapped) return kw;
  const cat = CATEGORIES.find((c) => c.name === mapped);
  if (!cat) return kw;
  // keep a keyword subcategory when the mapped category has one that matches, else General
  const hay = ` ${text.toLowerCase()} ${tags.join(' ').toLowerCase()} `;
  let sub = 'General';
  for (const sc of cat.subcategories) if (sc.keywords.some((k) => hay.includes(` ${k.toLowerCase()} `))) { sub = sc.name; break; }
  return { category: mapped, subcategory: sub, score: Math.max(kw.score, 2), candidates: kw.candidates };
}

export function profileFor(category: string): MonetizationProfile {
  return CATEGORIES.find((c) => c.name === category)?.profile || OTHER_PROFILE;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Heuristic: is this trend a one-off news event / named-person story rather than a
 * repeatable content format a creator can "ride"? Used to down-weight creator opportunity.
 */
export function looksLikeNewsEvent(text: string, category: string): boolean {
  if (category === 'News & Politics') return true;
  const t = text.toLowerCase();
  if (/\b(vs\.?|v)\b.*\b(live|score|prediction|odds|t20|match)\b/.test(t)) return true;
  if (/\b(crash|arrested|charged|dies|died|death|obituary|lawsuit|sues|sued|verdict|indicted|shooting|earthquake|hurricane|wildfire|traffic|weather|météo|clima|времето)\b/.test(t)) return true;
  if (/\b(rankings?|box office|poll|runoff|election|rally|senate|sell out|sells out|stockpile|contract|retirement)\b/.test(t)) return true;
  // corporate / industry news: a studio closing, layoffs, acquisitions, bans — a moment, not a format
  if (/\b(shuts? down|shutting down|shut down|closes|closure|lays? off|laid off|layoffs?|acquires?|acquisition|acquired by|merger|bankrupt|bankruptcy|banned|ban on|recall|recalled|resigns?|resignation|fired|steps down|indefinitely|delayed|cancell?ed|announces?|announced|unveils?|launches?|price hike|outage|hacked|data breach|leaked)\b/.test(t)) return true;
  // a specific sports fixture / game moment is an event, not a format
  if (category === 'Sports' && /\b(game \d|world series|playoffs?|finals?|semi-?finals?|match|fixture|kickoff|inning|bullpen|warms? up|faces|vs\.?|derby|grand prix|t20i?)\b/.test(t)) return true;
  // named political figures / institutions make a topic a news story regardless of its subject matter
  if (/\b(trump|biden|harris|obama|vance|netanyahu|bolsonaro|lula|putin|zelensky|zelenskyy|xi jinping|modi|starmer|macron|white house|congress|parliament|supreme court|governor|mayor)\b/.test(t)) return true;
  return false;
}

/**
 * Decide whether a cluster is a news/person event. Looks at the topic itself (seed titles + descriptions, or the
 * cluster name) — never at every attached post, so one political reply cannot flag a whole format cluster.
 * A Google-Trends search spike whose term names no content category is treated as a person/event.
 */
export function decideNewsEvent(members: { kind: string; title: string; text?: string }[], clusterName: string, category: string): boolean {
  const seedLike = members.filter((m) => m.kind === 'search_interest' || m.kind === 'social_topic' || m.kind === 'hashtag');
  const topicText = seedLike.length ? seedLike.map((m) => `${m.title} ${m.text || ''}`).join(' ') : clusterName;
  const searchSeeded = seedLike.length > 0 && seedLike.every((m) => m.kind === 'search_interest');
  const titleCls = classify(seedLike.map((m) => m.title).join(' ') || clusterName);
  return looksLikeNewsEvent(topicText, category) || (searchSeeded && titleCls.category === 'Other');
}
