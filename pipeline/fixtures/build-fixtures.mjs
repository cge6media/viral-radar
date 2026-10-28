// Rebuilds fixture files from REAL responses captured live on 2026-10-28 (UTC) via the build
// session's fetch tool. Values are transcribed verbatim from the live endpoints; nothing invented.
// Usage: node pipeline/fixtures/build-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(dir, { recursive: true });
const manifest = {};
const save = (url, file, body) => {
  writeFileSync(path.join(dir, file), body);
  manifest[url] = file;
};

const OBS = '2026-10-28T00:20:00.000Z';

// ---------------- Google Trends RSS (captured 2026-10-28 00:16 UTC) ----------------
const gtItem = (title, traffic, pub, picSrc, news) => `
<item>
<title>${esc(title)}</title>
<ht:approx_traffic>${traffic}</ht:approx_traffic>
<description/>
<link>https://trends.google.com/trending/rss?geo=US</link>
<pubDate>${pub}</pubDate>
<ht:picture_source>${esc(picSrc)}</ht:picture_source>
${news.map(([t, u, s]) => `<ht:news_item><ht:news_item_title>${esc(t)}</ht:news_item_title><ht:news_item_snippet/><ht:news_item_url>${esc(u)}</ht:news_item_url><ht:news_item_source>${esc(s)}</ht:news_item_source></ht:news_item>`).join('\n')}
</item>`;
const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel><title>Daily Search Trends</title>${items.join('')}</channel></rss>`;

const US = [
  ['nz vs ind', '2000+', 'Mon, 26 Oct 2026 23:50:00 -0700', 'Cricinfo', [
    ['New Zealand hope to salvage series as India brace for Wellington wind', 'https://www.cricinfo.com/series/india-in-new-zealand-2026-27-1539421/new-zealand-vs-india-3rd-t20i-1539434/match-preview', 'Cricinfo'],
    ['New Zealand vs. India live score, win probability, chances of victory for 3rd T20I in Wellington', 'https://sports.yahoo.com/articles/zealand-vs-india-live-score-060002758.html', 'Yahoo Sports'],
    ['NZL vs IND: New Zealand vs India, 2nd T20I, 24 Oct 2026 – Videos | India in New Zealand 2026/27 | Match Centre', 'https://www.bcci.tv/matches/7375b7c1-9f64-4288-8b10-c837481b2744/new-zealand-vs-india/video', 'BCCI']]],
  ['leylah fernandez', '200+', 'Mon, 26 Oct 2026 23:50:00 -0700', 'Yahoo Sports', [
    ['The new WTA rankings confirmed with Iga Swiatek, Leylah Fernandez and Katie Boulter all having new spots', 'https://sports.yahoo.com/articles/wta-rankings-confirmed-iga-swiatek-120000292.html', 'Yahoo Sports'],
    ['Rankings Watch: Rybakina one win from securing year-end World No. 1', 'https://www.wtatennis.com/news/4599060/rankings-watch-rybakina-one-win-from-securing-year-end-world-no-1', 'WTA Tennis']]],
  ['katie volynets', '200+', 'Mon, 26 Oct 2026 23:30:00 -0700', 'Sky Sports', [
    ['WTA Guangzhou Day 2 Predictions Including Dayana Yastremska vs Katie Volynets', 'https://lastwordonsports.com/tennis/2026/10/26/wta-guangzhou-day-2-predictions-yastremska-volynets/', 'Last Word On Sports']]],
  ['sadie sink', '200+', 'Mon, 26 Oct 2026 23:10:00 -0700', 'WWD', [
    ["EXCLUSIVE: Sadie Sink, Maya Hawke Interact With Cartoons in Prada's Fantasy Campaign", 'https://wwd.com/fashion-news/fashion-scoops/prada-sadie-sink-maya-hawke-chen-haoyu-cartoon-holiday-images-1239386060/', 'WWD'],
    ["'Spider-Man: Brand New Day' Star Sadie Sink's Perfect Day Off Is Doing Absolutely Nothing, and Fans Totally Get It", 'https://www.imdb.com/it/news/ni66079994/?ref_=nm_nwr_1', 'IMDb']]],
  ['aliaksandra sasnovich', '200+', 'Mon, 26 Oct 2026 23:00:00 -0700', 'Sky Sports', [
    ['Sasnovich vs. Bartunkova Prediction at the Toray Pan Pacific Open Tennis - Tuesday, October 27', 'https://www.bleachernation.com/picks/2026/10/25/sasnovich-vs-bartunkova-prediction-at-the-toray-pan-pacific-open-tennis-tuesday-october-27/', 'Bleacher Nation']]],
  ['venus williams', '100+', 'Mon, 26 Oct 2026 23:00:00 -0700', 'Last Word On Sports', [
    ['WTA Guangzhou Day 2 Predictions Including Venus Williams vs Lilli Tagger', 'https://lastwordonsports.com/tennis/2026/10/26/wta-guangzhou-day-2-predictions-williams-tagger/', 'Last Word On Sports'],
    ['Venus Williams faces 28-year-younger opponent with 16-match losing streak on the line', 'https://tennisuptodate.com/wta/venus-williams-faces-28-year-younger-opponent-with-16-match-losing-streak-on-the-line', 'Tennisuptodate.com']]],
  ['pokimane', '100+', 'Mon, 26 Oct 2026 23:00:00 -0700', 'AOL.com', [
    ['Pokimane Reveals She Feels Unsafe When Atrioc Appears On Her Screen Years After 2023 Deepfake Controversy', 'https://sports.ndtv.com/us/us-streamers/pokimane-reveals-she-feels-unsafe-when-atrioc-appears-on-her-screen-years-after-2023-deepfake-controversy-12236214', 'NDTV Sports']]],
  ['naomi osaka', '200+', 'Mon, 26 Oct 2026 22:50:00 -0700', 'Yahoo', [
    ["Naomi Osaka's Ex Cordae Makes Emotional Admission About Their Split in New Song", 'https://www.yahoo.com/entertainment/music/articles/naomi-osakas-ex-cordae-makes-190004071.html', 'Yahoo'],
    ['Cordae Addresses Naomi Osaka Split, Reveals He\'s Expecting Second Child on "Helpless"', 'https://www.complex.com/music/a/markelibert/cordae-naomi-osaka-split-helpless-anderson-paak', 'Complex']]],
  ['superbad', '100+', 'Mon, 26 Oct 2026 22:50:00 -0700', 'Collider', [
    ["Emma Stone's R-Rated Cult Classic Officially Returns as a Streaming Hit", 'https://collider.com/emma-stone-superbad-streaming-hit-hbo-max-october-2026/', 'Collider'],
    ["Emma Stone's R-Rated Comedy with 88% RT Is a Global Streaming Hit", 'https://www.cbr.com/superbad-teen-comedy-hbo-success-october-2026/', 'Comic Book Resources']]],
  ['wildwood box office', '100+', 'Mon, 26 Oct 2026 22:50:00 -0700', 'The New York Times', [
    ["'Wildwood' Review: A Magical, Stop-Motion Adventure", 'https://www.nytimes.com/2026/10/22/movies/wildwood-review.html', 'The New York Times'],
    ["In a world of AI, Laika took 16 years to hand-build 'Wildwood,' filming seconds at a time", 'https://www.wusa9.com/article/news/nation-world/wildwood-laika-16-years-stop-motion/507-cfcde5c5-8873-424a-8e15-93d078d38472', 'WUSA9'],
    ["Laika's 'Wildwood' is a box office hit in Portland indie theaters", 'https://www.oregonlive.com/business/2026/10/laikas-wildwood-is-a-box-office-hit-in-portland-indie-theaters.html', 'OregonLive.com']]],
];
const GB = [
  ['cricket', '100+', 'Mon, 26 Oct 2026 23:50:00 -0700', 'BBC', [
    ['James Anderson: Lancashire to look into farewell for legendary bowler amid fan anger', 'https://www.bbc.co.uk/sport/cricket/articles/cme8rw2gkd9go', 'BBC'],
    ['Lancashire decide not to renew James Anderson contract', 'https://www.skysports.com/cricket/news/13602246/james-anderson-nasser-hussain-on-england-legend-not-having-his-lancashire-contract-renewed-and-possible-retirement', 'Sky Sports']]],
  ['m6 traffic', '100+', 'Mon, 26 Oct 2026 23:40:00 -0700', 'Manchester Evening News', [
    ["M6 crash live updates as motorway shut with 'emergency services on scene'", 'https://www.manchestereveningnews.co.uk/news/greater-manchester-news/m6-closed-live-m56-manchester-34821734', 'Manchester Evening News']]],
  ['sally nugent', '1000+', 'Mon, 26 Oct 2026 23:30:00 -0700', 'BBC', [
    ["Knighting Sinfield 'easiest decision anyone's had to make,' says Prince William", 'https://www.bbc.co.uk/news/articles/c65ynjkrjq4wo', 'BBC']]],
  ['barry keoghan', '100+', 'Mon, 26 Oct 2026 23:30:00 -0700', 'The Daily Beast', [
    ["Barry Keoghan Reveals He's Had a Skin-Tightening Treatment: 'I Feel Better About Myself'", 'https://www.imdb.com/it/news/ni66081587/?ref_=nwc_art_perm', 'IMDb'],
    ['Barry Keoghan maintains youthful looks with £4,500 cosmetic procedure', 'https://metro.co.uk/2026/10/26/barry-keoghan-maintains-youthful-looks-4-500-cosmetic-procedure-29741155/', 'Metro.co.uk']]],
  ['fleetwood town', '500+', 'Mon, 26 Oct 2026 23:20:00 -0700', 'BBC', [
    ['Fleetwood Town vs Arsenal: League Cup stats & head-to-head', 'https://www.bbc.co.uk/sport/football/live/cwgkveyrgpndt', 'BBC'],
    ['Arteta on Fleetwood, Gyokeres and basics', 'https://www.arsenal.com/news/arteta-on-fleetwood-gyokeres-and-basics-aIj1u8g1vBum', 'Arsenal.com']]],
  ['nz vs ind', '5000+', 'Mon, 26 Oct 2026 23:10:00 -0700', 'Cricinfo', [
    ['NZ vs Ind Live - India look to make it 3-0 in windy Wellington', 'https://www.cricinfo.com/series/india-in-new-zealand-2026-27-1539421/new-zealand-vs-india-3rd-t20i-1539434/live-match-blog', 'Cricinfo'],
    ['India To Face "Different Beast" In 3rd T20I, Morne Morkel Says "Whole Building Shaking" Due To Wind', 'https://sports.ndtv.com/new-zealand-vs-india-2026-27/india-to-face-different-beast-in-3rd-t20i-morne-morkel-says-whole-building-shaking-due-to-wind-12235729', 'NDTV Sports']]],
  ['beans and water sell out', '1000+', 'Mon, 26 Oct 2026 23:00:00 -0700', 'BBC', [
    ['Rise in sales of radios and tinned foods, say retailers, after call to stock up', 'https://www.bbc.co.uk/news/articles/c5rmy84np001o', 'BBC'],
    ['Water and baked beans sell out after public told to stockpile food', 'https://www.telegraph.co.uk/news/2026/10/26/water-baked-beans-sell-out-after-public-told-to-stockpile/', 'The Telegraph'],
    ["What items are on the 'Be Ready' checklist and how can households get prepared? | ITV News", 'https://www.itv.com/news/2026-10-23/what-items-are-on-the-be-ready-checklist-and-how-can-households-get-prepared', 'ITVX']]],
];
save('https://trends.google.com/trending/rss?geo=US', 'google-trends-US.xml', rss(US.map((i) => gtItem(...i))));
save('https://trends.google.com/trending/rss?geo=GB', 'google-trends-GB.xml', rss(GB.map((i) => gtItem(...i))));

// ---------------- Bluesky trending topics (captured 2026-10-28 00:17 UTC) ----------------
const topics = [
  ['Israel votes in national election', "Israelis vote in a national election, with Benjamin Netanyahu's future at stake.", '455aa61b52a0'],
  ["Trump's 'love the meat' comment", 'Donald Trump shouted it with gestures at a Corpus Christi, Texas rally before the midterms.', 'cdf4b65c1d52'],
  ['Bleach anime series finale', "The last episode of Thousand-Year Blood War airs, adapting the end of Tite Kubo's manga.", '5f60bb45a5d7'],
  ['Spooky month stream schedules', 'Creators share weekly lineups of horror games like Little Nightmares, Phasmophobia and Signalis.', '5417c6b9b399'],
  ['Freddy Peralta faces former team Brewers', 'Ex-Milwaukee pitcher Freddy Peralta takes the mound against his old club as Mets fans weigh in.', 'e3d486f85833'],
  ['Brandon Woodruff warms up in bullpen', 'The Milwaukee Brewers pitcher gets loose during a playoff game, sparking excitement among fans.', '297802f9d921'],
  ["Fox's World Series broadcast", "Viewers criticize Fox's AI videos, pregame segments, camera framing, and Joe Davis's on-air makeup.", '6d14247b3707'],
  ['Halloween trick-or-treating traditions', 'People share memories, events, and opinions on trunk-or-treat and handing out candy to kids.', '3823698e8a14'],
  ['Mystery Skulls Animated finale releases', 'MysteryBen27\'s last episode, "When I\'m With You," ends a web series that began 12 years ago.', 'bf36eb0f6beb'],
  ['Bluesky a band pun game', 'Users rename famous bands with site puns like Skeetwood Mac and AT ProtocolDC.', 'aee5b952c6d1'],
  ['Trump speaks in Corpus Christi', "Donald Trump's Texas rally speech draws attention for a small crowd and slurred delivery.", 'd115e35d88fd'],
  ['Detroit voter backs Abdul El-Sayed', 'A Detroiter shrugs off "too left wing" worries about the Michigan Senate hopeful, citing living costs.', 'c3fe03bc3041'],
  ['Trump weighs in on Canadian politics', 'Donald Trump addresses Parti Québécois and BC Conservatives following recent elections.', '37b7fd3205cb'],
  ['El-Sayed vs. Rogers Senate poll', 'Poll of lean-Democratic and lean-Republican voters in El-Sayed vs. Rogers Michigan Senate race', '8222864f680e'],
  ['Trump on accepting midterm results', "Trump says he will respect next week's election outcomes only if the elections are honest.", '1d2e4f6842d9'],
  ['Kamala Harris opposes Trump impeachment push', "The former vice president said the votes aren't there and urged Democrats to focus on getting things done.", '7222ecc33418'],
  ['Trump on Brazil runoff', "Trump and Flávio Bolsonaro respond to Brazil's presidential runoff against Lula da Silva.", '61e8f2e29dd2'],
  ["El-Sayed's viral town hall response", 'Senate candidate Abdul El-Sayed calmly replies to a question about religion and loyalty.', 'bf8f1620-d6de-43e6-b23f-80bd26c28462'],
  ['Flávio Bolsonaro US travel', "Posts discuss the senator's reported US trip, the runoff vote and a court order on passports.", '8c7b49c8e834'],
  ['Bolsonaro reportedly heads to US', 'Brazilian newspaper Folha, citing allies, reports a Bolsonaro is traveling to the United States.', '035bd2c32628'],
  ["Bolsonaro's US entry without passport", 'Critics say the Trump administration is letting a Bolsonaro in despite a revoked passport.', '7d37f31751af'],
  ["Lessons from Brazil's presidential runoff", "Lula faced Flávio Bolsonaro, and posters push his camp's tactic of ignoring far-right rage bait.", '06e6e1a937f4'],
  ['Trump calls renovation costs "peanuts"', 'Donald Trump dismisses the billion dollars being spent on White House renovations as small change.', 'fdb8667d43a7'],
  ['Heckler shouts at Trump over ballroom', "A protester at Donald Trump's Mississippi rally yelled a crude remark about his ballroom project.", '1c3cbf56edda'],
  ["Trump's 'freaking fortune' gas remark", 'At a Georgia rally, Donald Trump dismissed fuel costs tied to the Iran war as profitable.', '5f19c988d591'],
].map(([topic, description, rkey]) => ({ topic, displayName: topic, description, link: `/profile/did:plc:qrz3lhbyuxbeilrc6nekdqme/feed/${rkey}` }));
save('https://api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=25', 'bsky-trending.json', JSON.stringify({ topics, suggested: [], recIdStr: '8642344067463229010' }, null, 1));

// ---------------- Bluesky posts (searchPosts + a topic feed), captured 2026-10-28 ----------------
// [uri, handle, displayName, createdAt, likes, reposts, replies, quotes, embedType, mediaUrl, titleOrThumb, text]
const V = 'app.bsky.embed.video#view', E = 'app.bsky.embed.external#view', I = 'app.bsky.embed.images#view';
const post = ([uri, handle, displayName, createdAt, likeCount, repostCount, replyCount, quoteCount, embedType, media, titleOrThumb, text]) => {
  const did = uri.split('/')[2];
  const base = { uri, cid: 'bafy' + Math.abs(hash(uri)).toString(36), author: { did, handle, displayName }, record: { $type: 'app.bsky.feed.post', text, createdAt }, replyCount, repostCount, likeCount, quoteCount, indexedAt: createdAt, labels: [] };
  if (embedType === V) base.embed = { $type: V, cid: 'bafk', playlist: media, thumbnail: titleOrThumb, aspectRatio: { width: 16, height: 9 } };
  else if (embedType === E) base.embed = { $type: E, external: { uri: media, title: titleOrThumb, description: '', thumb: '' } };
  else if (embedType === I) base.embed = { $type: I, images: [{ thumb: media, fullsize: media, alt: '' }] };
  return base;
};
const animation = [
  ['at://did:plc:xvlnffot2m6ozyybtf75n5on/app.bsky.feed.post/3myqmlsvrr22a', 'aachernyshov.bsky.social', 'aa.chernyshov', '2026-10-26T01:56:31.371Z', 461, 77, 5, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Axvlnffot2m6ozyybtf75n5on/bafkreiba76f73amls6iknssteyh5nahmphqiscbfysndfckeaqobkoamvy/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Axvlnffot2m6ozyybtf75n5on/bafkreiba76f73amls6iknssteyh5nahmphqiscbfysndfckeaqobkoamvy/thumbnail.jpg', '🫗 #animation #inktober2026'],
  ['at://did:plc:uoigxv25kmsuqxfko5mwi7gi/app.bsky.feed.post/3myurtotdv22o', 'rebeltaxi.bsky.social', 'Pan-Pizza: Watch Loki IRL', '2026-10-27T17:41:03.197Z', 103, 35, 6, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Auoigxv25kmsuqxfko5mwi7gi/bafkreigop2ume2onrcatf4csia3l26jq5htu3xmn2qwv66lz7yobh4zl5q/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Auoigxv25kmsuqxfko5mwi7gi/bafkreigop2ume2onrcatf4csia3l26jq5htu3xmn2qwv66lz7yobh4zl5q/thumbnail.jpg', 'Indie animation about making animation [Loki IRL ep 2 Coming Soon]'],
  ['at://did:plc:v2cazyymqxrpmj5rb3jumqmy/app.bsky.feed.post/3mytf3psark24', 'sifyro.bsky.social', '🎨Sifyro🎨', '2026-10-27T04:20:14.262Z', 756, 173, 5, 1, V, 'https://video.bsky.app/watch/did%3Aplc%3Av2cazyymqxrpmj5rb3jumqmy/bafkreidk5fe5ecraotaygggetchphf32oebafvva7aq5g75sayiqmwxrfq/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Av2cazyymqxrpmj5rb3jumqmy/bafkreidk5fe5ecraotaygggetchphf32oebafvva7aq5g75sayiqmwxrfq/thumbnail.jpg', 'Got this amazing animation from @noarustar.bsky.social :3 My brain when I must s'],
  ['at://did:plc:exxdcplb2ozev5lvw5ohnejq/app.bsky.feed.post/3myql2fyci22u', 'discussingfilm.net', 'DiscussingFilm', '2026-10-26T01:28:53.652Z', 407, 63, 13, 8, V, 'https://video.bsky.app/watch/did%3Aplc%3Aexxdcplb2ozev5lvw5ohnejq/bafkreib5xwzxlssl2mmohbgjx5aldzyszm2b6uuveprwfq5j676qtcl6cy/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Aexxdcplb2ozev5lvw5ohnejq/bafkreib5xwzxlssl2mmohbgjx5aldzyszm2b6uuveprwfq5j676qtcl6cy/thumbnail.jpg', 'Travis Knight says the final battle in ‘WILDWOOD’ is the most difficult sequence'],
  ['at://did:plc:27vw3l4whzivhebdhg2grwqx/app.bsky.feed.post/3myqpz3ux4s2a', 'carloygm.bsky.social', 'Carlo ygm', '2026-10-26T02:57:38.216Z', 290, 68, 2, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3A27vw3l4whzivhebdhg2grwqx/bafkreifkuo7sdo43qk6oryxn7om3ny277ni4ghuk25xytytgoxfqll54q4/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3A27vw3l4whzivhebdhg2grwqx/bafkreifkuo7sdo43qk6oryxn7om3ny277ni4ghuk25xytytgoxfqll54q4/thumbnail.jpg', '"Simple Pleasures" Animation cmm for @joexd.bsky.social'],
  ['at://did:plc:pm4mjkaqalwqd3ri7a3sqkqt/app.bsky.feed.post/3mys7npipn22n', 'sacherbullbear.bsky.social', 'SacherTheBullbear', '2026-10-26T17:10:15.741Z', 272, 62, 2, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Apm4mjkaqalwqd3ri7a3sqkqt/bafkreie5ma5irkfykbpskjjbz6siqeun6345oh4ljqiwnblxuwegwd6ymm/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Apm4mjkaqalwqd3ri7a3sqkqt/bafkreie5ma5irkfykbpskjjbz6siqeun6345oh4ljqiwnblxuwegwd6ymm/thumbnail.jpg', 'Did my second animation ever, gimme bellyrubs 😘'],
  ['at://did:plc:5oarwogxhft4juraq2lsmwft/app.bsky.feed.post/3mypxaomdes2b', 'matchesdraco.bsky.social', 'MatchesYashi', '2026-10-25T19:34:29.191Z', 177, 22, 1, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3A5oarwogxhft4juraq2lsmwft/bafkreiewts64eslflwegc5cbdmnxr42zofyacv3zmiyw4c7ezxaqo5bxla/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3A5oarwogxhft4juraq2lsmwft/bafkreiewts64eslflwegc5cbdmnxr42zofyacv3zmiyw4c7ezxaqo5bxla/thumbnail.jpg', 'small dragonite animation thing'],
  ['at://did:plc:b5i43fzf3byarijipzvjx6se/app.bsky.feed.post/3myolgppg3s2v', 'eblu.space', 'eblu', '2026-10-25T06:30:27.023Z', 260, 60, 10, 3, V, 'https://video.bsky.app/watch/did%3Aplc%3Ab5i43fzf3byarijipzvjx6se/bafkreidliwigfoerpqd23ygff6ylo5zl64h7ltbz2qs4byrzzu2rjauvga/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Ab5i43fzf3byarijipzvjx6se/bafkreidliwigfoerpqd23ygff6ylo5zl64h7ltbz2qs4byrzzu2rjauvga/thumbnail.jpg', 'ANIMATION 👏 IS 👏 CINEMA'],
  ['at://did:plc:gyvtmquqpbopi6cxqahep3xu/app.bsky.feed.post/3mys3swu2222l', 'orbitten.bsky.social', 'Orbitten', '2026-10-26T16:01:36.257Z', 171, 48, 7, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Agyvtmquqpbopi6cxqahep3xu/bafkreibd4fcwj5e2zxpfv5kyc7sidsf3nxocfmfqv4riyo7ikgviiywk4q/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Agyvtmquqpbopi6cxqahep3xu/bafkreibd4fcwj5e2zxpfv5kyc7sidsf3nxocfmfqv4riyo7ikgviiywk4q/thumbnail.jpg', 'Can she handle it? #animation #oc'],
  ['at://did:plc:7ppkxffq6bhfm3725mvpkgza/app.bsky.feed.post/3myneytgmvk25', 'h0rs3-animation.bsky.social', 'H0rs3 Animations', '2026-10-24T19:02:38.982Z', 886, 197, 13, 2, V, 'https://video.bsky.app/watch/did%3Aplc%3A7ppkxffq6bhfm3725mvpkgza/bafkreihco63dtnrodlasdzbljgcf52wdplenbmbesexyhowlekf6isokyi/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3A7ppkxffq6bhfm3725mvpkgza/bafkreihco63dtnrodlasdzbljgcf52wdplenbmbesexyhowlekf6isokyi/thumbnail.jpg', 'New animation !'],
  ['at://did:plc:rcwhyaykjgg7cokghptkei7e/app.bsky.feed.post/3myknpr5d6u24', 'zilluzion.art', 'zillu ☕️🧡', '2026-10-23T17:00:38.308Z', 214, 25, 4, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Arcwhyaykjgg7cokghptkei7e/bafkreia2f4ev6bb5b5vc3yac57whfpghushoepba2murmcuy2mknlqjuga/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Arcwhyaykjgg7cokghptkei7e/bafkreia2f4ev6bb5b5vc3yac57whfpghushoepba2murmcuy2mknlqjuga/thumbnail.jpg', "swingin' 🎪 OC animation practice [ #furry #furryart #animation #sketch #gif ]"],
  ['at://did:plc:yp7b32xldmosebq7fcqanajv/app.bsky.feed.post/3mysq23wftk2h', 'vhsdragoness.bsky.social', '🍂 AUTUMN OF 1997📼📹', '2026-10-26T22:03:31.267Z', 154, 21, 3, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Ayp7b32xldmosebq7fcqanajv/bafkreiai5twkwasa5hikhk6zjcp67yz63faxitw3wynv2wrakn6coohsv4/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Ayp7b32xldmosebq7fcqanajv/bafkreiai5twkwasa5hikhk6zjcp67yz63faxitw3wynv2wrakn6coohsv4/thumbnail.jpg', "Little dance from triqqy's animation from on insta 🫶🏾"],
];
const catVideo = [
  ['at://did:plc:47im5i5ptau2br4rh7lp2ryr/app.bsky.feed.post/3myhoueicy42w', 'rainmaker1973-m.bsky.social', 'Massimo (mirror)', '2026-10-22T12:43:07.992Z', 3077, 374, 75, 20, V, 'https://video.bsky.app/watch/did%3Aplc%3A47im5i5ptau2br4rh7lp2ryr/bafkreibgjcvhu2bldzikyscmumjhez32r267qij3sbczuqxhp36lwqqblq/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3A47im5i5ptau2br4rh7lp2ryr/bafkreibgjcvhu2bldzikyscmumjhez32r267qij3sbczuqxhp36lwqqblq/thumbnail.jpg', 'A video analysis of the difference between dog joining cat and cat joining the dog.'],
  ['at://did:plc:bu3vqeepgs33oh7hcy4b7o62/app.bsky.feed.post/3mypyod2lhs2z', 'heresjohnny.bsky.social', "Here's Johnny", '2026-10-25T20:00:00.577Z', 142, 8, 17, 1, E, 'https://youtu.be/vEtbfzMLVWU?si=r1PMqeR3Fbm7sbX_', 'Stray Cats - Stray Cat Strut (Official Music Video)', '#MusicChallenge #EmojiSounds Day - 26 😿 Stray Cats - "Stray Cat Strut"'],
  ['at://did:plc:jwwv7jft4wunkhz2wmuqdk6w/app.bsky.feed.post/3myqz7o5wts2l', 'gartsideleigh.bsky.social', 'Leigh', '2026-10-26T05:42:22.385Z', 47, 2, 0, 0, E, 'https://youtube.com/watch?v=oOSYB38y2xA', 'The Rolling Stones - Stray Cat Blues (Official Lyric Video)', '#EmojiSounds #MusicChallenge 26 - 😿 Stray Cat Blues The Rolling Stones'],
  ['at://did:plc:54umlevix7s2f3lj4xf74txn/app.bsky.feed.post/3myrp22gew227', 'deeemceeem.bsky.social', 'DeeEm', '2026-10-26T12:12:56.241Z', 37, 1, 1, 0, E, 'https://youtube.com/watch?v=oOSYB38y2xA', 'The Rolling Stones - Stray Cat Blues (Official Lyric Video)', '#EmojiSounds #MusicChallenge 26 - 😿 The Rolling Stones - Stray Cat Blues'],
  ['at://did:plc:w4jll3eacy5hqe4dyxovu7h4/app.bsky.feed.post/3myqcbukazc2w', 'straycat99.bsky.social', 'Stray Cat', '2026-10-25T22:52:00.127Z', 58, 4, 3, 0, E, 'https://www.youtube.com/watch?v=PVZH7IdHP2E&list=RDPVZH7IdHP2E&start_radio=1', 'The Rolling Stones - Stray Cat Blues - Live OFFICIAL', '#EmojiSounds #MusicChallenge 26-😿The Rolling Stones - Stray Cat Blues'],
  ['at://did:plc:dqrhlzwqlf6chnegh7ob77m5/app.bsky.feed.post/3myq4wqlias2c', 'ridebikes.bsky.social', 'Al', '2026-10-25T21:16:18.167Z', 41, 0, 1, 0, E, 'https://youtu.be/5bnwtae95Xg?is=zh2D3_FwyifKAqWJ', 'DIONNE WARWICK: "TRACK OF THE CAT"', '#EmojiSounds #MusicChallenge 😹 Track Of The Cat - Dionne Warwick'],
  ['at://did:plc:3pgxabdljjkaza2w43l6gy4e/app.bsky.feed.post/3myq4j6rlkc2f', 'greggarypeccary.bsky.social', 'Greggery Peccary', '2026-10-25T21:08:43.285Z', 40, 2, 2, 0, E, 'https://www.youtube.com/watch?v=5Gz9d-Pujew&list=RD5Gz9d-Pujew&start_radio=1', 'Yoko Ono Plastic Ono Band - Cheshire Cat Cry', '#EmojiSounds #MusicChallenge 26-😿 Cheshire Cat Cry'],
  ['at://did:plc:nhaxrvzcqzlunrvwyuz3fnbd/app.bsky.feed.post/3myq2e34ic22x', 'dirty-old-goon.bsky.social', 'D.O.G', '2026-10-25T20:30:04.192Z', 40, 6, 2, 0, E, 'https://youtu.be/QxhUk9H_-ys?si=cGczRVwIc_XRRr4K', 'Tron Cat', '#EmojiSounds #MusicChallenge 26-😿'],
  ['at://did:plc:atfvyf7w5fk7e5fw7hd3sdeo/app.bsky.feed.post/3myq3qsi62s25', 'madamwiz.bsky.social', 'Lynn Daniello', '2026-10-25T20:55:05.087Z', 31, 1, 0, 0, E, 'https://youtu.be/Oa_ExklvKH0?is=oHg1t6IiJATobJng', 'Yusuf / Cat Stevens - Sad Lisa (live, Majikat - Earth Tour 1976)', '#MusicChallenge #EmojiSounds Day - 26 😿 Cat Stevens ~ Sad Lisa'],
  ['at://did:plc:izkjugh4boaxdmqic5dweo6l/app.bsky.feed.post/3mysetnmrx22j', 'deep-hurting.bsky.social', 'Deep Hurting', '2026-10-26T18:43:03.812Z', 19, 1, 0, 0, E, 'https://www.youtube.com/watch?v=-NegGNpKJxY', 'Primus - Tommy the Cat (Official Video) (Digitally Remastered) [HD/2160p/60fps]', '#EmojiSounds #MusicChallenge 26. 😿 Primus - Tommy the Cat'],
  ['at://did:plc:pdnrs54nafifbcjlumdac5xo/app.bsky.feed.post/3myr47qn2mc2k', 'gerrard44.bsky.social', 'Gerrard', '2026-10-26T06:36:06.204Z', 21, 1, 0, 0, E, 'https://youtu.be/unk0qDR7MJE?si=wAdGRZ8089ekcplh', 'Catatonia - Lost Cat [HD 1080p Upscale]', '#EmojiSounds #MusicChallenge #MusicSky 😿 Catatonia ~ Lost Cat'],
  ['at://did:plc:zvnzbkhgxrsujwfz46ez42r3/app.bsky.feed.post/3mysqwhxf3c2w', 'writingonmusic.bsky.social', 'writingonmusic', '2026-10-26T22:19:23.433Z', 21, 0, 0, 0, E, 'https://youtu.be/GtNYUZO3kKE?si=EP1yeOcTDIqhU3Pr', 'The Cat Crept In', '#EmojiSounds day 26 😿 #MusicChallenge #MusicSky Mud - The Cat Crept In'],
  ['at://did:plc:rw73xack3o6q63zlcjqhyuuf/app.bsky.feed.post/3myrvxfobzs2w', 'bunsenbernerbmd.bsky.social', 'Bunsen, Beaker, Bernoulli, & Brix', '2026-10-26T14:16:43.558Z', 310, 37, 15, 4, V, 'https://video.bsky.app/watch/did%3Aplc%3Arw73xack3o6q63zlcjqhyuuf/bafkreif7ulkasld6ryhzc3ca5n62jyetuo6gq36jzmcpkffzk2lpfkqww4/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Arw73xack3o6q63zlcjqhyuuf/bafkreif7ulkasld6ryhzc3ca5n62jyetuo6gq36jzmcpkffzk2lpfkqww4/thumbnail.jpg', "It's the Monday Morning Pawpdate! In this video you will find: ✅ Joy in the snow"],
  ['at://did:plc:l365edwvj4vyfngtpk6y27j5/app.bsky.feed.post/3mypw4u7zw22a', 'youngmccaffrey.bsky.social', 'Young McCaffrey', '2026-10-25T19:14:27.117Z', 21, 0, 1, 0, E, 'https://youtu.be/Bhu08gLzGgc?is=JIN_TAHl5n4hpG_z', 'Speak For Me', '#EmojiSounds #MusicChallenge @lagrume.bsky.social Day 26 - 😿 Cat Power - Speak For Me'],
];
const aiVideo = [
  ['at://did:plc:cobndbm4ojsooa5kunr775ok/app.bsky.feed.post/3mymky6kihc2l', 'nish57.bsky.social', 'Spicy Scorpio', '2026-10-24T11:16:59.798Z', 100, 61, 4, 0, E, 'https://youtube.com/shorts/H87gnRNXARI?si=DS4h8NzRCfRIwdAh', 'How to spot a deep fake AI video', 'Thanks Tod. youtube.com/shorts/H87gn...'],
  ['at://did:plc:ezconqince3oolbmsz4wvy2j/app.bsky.feed.post/3mythyojnrk2d', 'candylovely.bsky.social', "it's Candy Love", '2026-10-27T05:12:13.494Z', 21, 4, 1, 0, V, 'https://video.bsky.app/watch/did%3Aplc%3Aezconqince3oolbmsz4wvy2j/bafkreieh3hnnaurngxr3y5g5uoqrrnmpusdqk37fhkdlq5ot57354io2lq/playlist.m3u8', 'https://video.bsky.app/watch/did%3Aplc%3Aezconqince3oolbmsz4wvy2j/bafkreieh3hnnaurngxr3y5g5uoqrrnmpusdqk37fhkdlq5ot57354io2lq/thumbnail.jpg', 'This AI video is very funny.😂😂😂😂 Obama and the felon.)💥'],
  ['at://did:plc:adeighton/app.bsky.feed.post/3myml2gtmxk2u', 'adeighton.bsky.social', 'This Canadian', '2026-10-24T11:18:15.598Z', 29, 21, 2, 2, E, 'https://youtube.com/shorts/H87gnRNXARI?si=ATs96q2L_pSqsza6', 'How to spot a deep fake AI video', 'youtube.com/shorts/H87gn... Share this one. It is brilliant!'],
];
const spookyFeed = [
  ['at://did:plc:dbtsj7ipvyg2da33ysfr4ea3/app.bsky.feed.post/3myvduast3k2n', 'kitkhat.bsky.social', 'TheKitKhat', '2026-10-27T23:03:29.407Z', 4, 2, 0, 0, E, 'https://twitch.tv/thekitkhat', 'TheKitKhat - Live on Twitch', "💙🐱💖 Logging in... 💖🐱💙 🔴【LIVE】🔴 on Twitch with WIPtober! 🎃👻 Tonight, I'm working on a commission of a"],
  ['at://did:plc:dxgifpgzsri7ng6pma7yyq64/app.bsky.feed.post/3myvdy6wtgk2b', 'snakemanvt.northsky.social', 'Snakeman VT', '2026-10-27T23:05:41.657Z', 7, 1, 1, 0, I, 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:dxgifpgzsri7ng6pma7yyq64/bafkreiexample1', '', 'So I mentioned next year being a kind of reset/reboot of my stream in the sense I will get back to sched'],
  ['at://did:plc:hoir23p4wh2hulml4ywjaynr/app.bsky.feed.post/3myv5cf4lyk2w', 'heyimlau.bsky.social', 'Lau', '2026-10-27T21:06:07.489Z', 11, 1, 1, 0, I, 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:hoir23p4wh2hulml4ywjaynr/bafkreiexample2', '', 'Welp Rewriting my stream schedule for next week'],
  ['at://did:plc:iln2jznbnu2wpkvdnkifzxol/app.bsky.feed.post/3myvepod4gc2n', 'asaistrouble.bsky.social', 'AsaIsTrouble', '2026-10-27T23:18:49.542Z', 2, 1, 0, 0, E, 'https://www.twitch.tv/asaistrouble', 'AsaIsTrouble - Live on Twitch', "hi i'm going to stream a spooky thing for spooky month i swear there will probably be more dead students"],
  ['at://did:plc:2czwcui46c5hnlj4cjfxgi4p/app.bsky.feed.post/3myv6r6ngs227', 'radiaactive.bsky.social', 'Radiaactive', '2026-10-27T21:32:17.758Z', 12, 2, 0, 0, I, 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:2czwcui46c5hnlj4cjfxgi4p/bafkreiexample3', '', 'Schedule Oct 26 - Nov 01👻 Collabs with MoreParz this week, Arma with the Badger crew, and a BIG Halloween'],
  ['at://did:plc:k3ui4wzrbuwrt2qniszv7gkj/app.bsky.feed.post/3myvawq4crc2v', 'platinumrhythm.bsky.social', 'PlatinumRhythm', '2026-10-27T22:11:11.329Z', 4, 1, 0, 0, E, 'https://static.klipy.com/ii/4e7bea9f7a3371424e6c16ebc93252fe/56/37/nM8L4fNUCyFbmfMF.gif', 'Megaman Battle Network Rockman Exe: Lan Hikari Sleeping', "I might play the streams for this week by ear, for now. I don't really have any spooky-related ideas for streams,"],
];
const search = (q) => `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&limit=25`;
save(search('animation'), 'bsky-search-animation.json', JSON.stringify({ posts: animation.map(post) }, null, 1));
save(search('cat video'), 'bsky-search-cat-video.json', JSON.stringify({ posts: catVideo.map(post) }, null, 1));
save(search('ai video'), 'bsky-search-ai-video.json', JSON.stringify({ posts: aiVideo.map(post) }, null, 1));
save('https://api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=' + encodeURIComponent('at://did:plc:qrz3lhbyuxbeilrc6nekdqme/app.bsky.feed.generator/5417c6b9b399') + '&limit=15', 'bsky-feed-spooky.json', JSON.stringify({ feed: spookyFeed.map((p) => ({ post: post(p) })), cursor: '' }, null, 1));

// ---------------- Mastodon trending tags (captured 2026-10-28 00:18 UTC) ----------------
const tagLine = (name, url, hist) => ({ name, url, history: hist.split(',').map((h) => { const [day, uses, accounts] = h.split(':'); return { day, uses, accounts }; }) });
const tags = [
  ['TuneTuesday', 'https://mastodon.social/tags/tunetuesday', '1793059200:109:81,1792972800:1:1,1792886400:0:0,1792800000:0:0,1792713600:1:1,1792627200:1:1,1792540800:6:6'],
  ['CauseOfAggravation', 'https://mastodon.social/tags/causeofaggravation', '1793059200:229:73,1792972800:0:0,1792886400:0:0,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:0:0'],
  ['robotmusic', 'https://mastodon.social/tags/robotmusic', '1793059200:98:72,1792972800:0:0,1792886400:0:0,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:0:0'],
  ['TextureTuesday', 'https://mastodon.social/tags/texturetuesday', '1793059200:81:76,1792972800:2:2,1792886400:2:2,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:10:9'],
  ['ThickTrunkTuesday', 'https://mastodon.social/tags/thicktrunktuesday', '1793059200:59:54,1792972800:4:4,1792886400:1:1,1792800000:0:0,1792713600:0:0,1792627200:1:1,1792540800:1:1'],
  ['atommull', 'https://mastodon.social/tags/atommull', '1793059200:31:24,1792972800:1:1,1792886400:2:2,1792800000:0:0,1792713600:9:8,1792627200:1:1,1792540800:11:5'],
  ['WalterKoenig', 'https://mastodon.social/tags/WalterKoenig', '1793059200:37:34,1792972800:114:106,1792886400:0:0,1792800000:0:0,1792713600:0:0,1792627200:1:1,1792540800:0:0'],
  ['PokemonUnite', 'https://mastodon.social/tags/PokemonUnite', '1793059200:20:19,1792972800:0:0,1792886400:0:0,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:0:0'],
  ['nationalblackcatday', 'https://mastodon.social/tags/nationalblackcatday', '1793059200:17:17,1792972800:0:0,1792886400:0:0,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:0:0'],
  ['tercinema', 'https://mastodon.social/tags/tercinema', '1793059200:38:24,1792972800:2:2,1792886400:2:2,1792800000:3:2,1792713600:1:1,1792627200:0:0,1792540800:5:5'],
  ['superbowl', 'https://mastodon.social/tags/superbowl', '1793059200:32:28,1792972800:5:3,1792886400:3:1,1792800000:4:2,1792713600:4:2,1792627200:6:4,1792540800:5:3'],
  ['FineArtAPlaceOrDestination', 'https://mastodon.social/tags/fineartaplaceordestination', '1793059200:2:2,1792972800:245:62,1792886400:0:0,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:0:0'],
  ['oxfam', 'https://mastodon.social/tags/oxfam', '1793059200:19:13,1792972800:0:0,1792886400:0:0,1792800000:3:3,1792713600:0:0,1792627200:2:2,1792540800:3:3'],
  ['MonochromeMonday', 'https://mastodon.social/tags/monochromemonday', '1793059200:5:5,1792972800:119:101,1792886400:3:3,1792800000:1:1,1792713600:0:0,1792627200:1:1,1792540800:1:1'],
  ['inequality', 'https://mastodon.social/tags/inequality', '1793059200:14:13,1792972800:1:1,1792886400:18:13,1792800000:9:8,1792713600:5:5,1792627200:6:6,1792540800:6:5'],
  ['ipadmini', 'https://mastodon.social/tags/ipadmini', '1793059200:18:16,1792972800:75:49,1792886400:1:1,1792800000:2:2,1792713600:5:4,1792627200:2:2,1792540800:4:4'],
  ['maozedong', 'https://mastodon.social/tags/maozedong', '1793059200:15:13,1792972800:0:0,1792886400:1:1,1792800000:0:0,1792713600:0:0,1792627200:0:0,1792540800:0:0'],
].map(([n, u, h]) => tagLine(n, u, h));
save('https://mastodon.social/api/v1/trends/tags?limit=20', 'mastodon-tags.json', JSON.stringify(tags, null, 1));

// ---------------- YouTube oEmbed (captured 2026-10-28) ----------------
save('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=dQw4w9WgXcQ') + '&format=json', 'yt-oembed-dQw4w9WgXcQ.json',
  JSON.stringify({ title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)', author_name: 'Rick Astley', author_url: 'https://www.youtube.com/@RickAstleyYT', type: 'video', height: 113, width: 200, version: '1.0', provider_name: 'YouTube', provider_url: 'https://www.youtube.com/', thumbnail_height: 360, thumbnail_width: 480, thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', html: '<iframe></iframe>' }, null, 1));

writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`wrote ${Object.keys(manifest).length} fixtures + manifest.json`);

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
