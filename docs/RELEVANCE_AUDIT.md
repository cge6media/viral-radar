# Relevance audit — first live 2.0 run

Snapshot: run `202610280220_7f353411b42e` (2026-10-28T02:21:02.284Z). Sample: every format pool and microtrend, up to 5 video evidence items each
(95 trend–evidence pairs). Each pair was read and labelled by hand ("is this video really an example of the trend it is
attached to?"). The "after" column re-runs the tightened validator (commit after the audit) on the same records.

| metric | value |
|---|---|
| pairs audited | 95 |
| relevant by hand (1.0-style matching + first 2.0 rules) | 77 / 95 = **81%** |
| relevant among pairs the tightened validator keeps | 75 / 77 = **97%** (target ≥ 90%) |
| wrongly dropped (relevant but now rejected) | 2 |

Rule changes made from this audit: bare *fry/roast/meal/dinner* no longer count as cooking (and "Curry Barker" is not a
curry); *satisfying* must be the subject (oddly satisfying / #satisfying), not an adjective about level design; *explained*
needs a subject ("Polyamory Explained") and political words veto explainers; `EP` is case-sensitive so "ep 2" is not a
record release; *clip/stream* no longer mean gaming; *short film* is its own format instead of leaking into animation;
archival "(1968)" and album hashtags are not storytime; adult-marker posts (#gentledom …) are dropped at collection.

| # | trend | level | creator / sharer | title | hand label | after |
|---|---|---|---|---|---|---|
| 1 | #vtuber | direct | Obsidian | Schedule for this week! Simple, Season 2 of The Walking Dead! On the w | relevant | kept |
| 2 | #vtuber | direct | αlpha βetta (alpha)🐟🌙【 | Being Old is OP #japan #vtuber #fyp #storytime | relevant | kept |
| 3 | #vtuber | direct | Winston Webster Ch. EN | Unlootable Loot! - Part 2 | relevant | kept |
| 4 | #vtuber | indirect | shared by Sod's Passion  | Terrible New DC Jinx Design #Vtuber #Shorts #AHatinTime #Furry | relevant | kept |
| 5 | #vtuber | direct | αlpha βetta (alpha)🐟🌙【 | INFINITE HONEYMOON PHASE #japan #vtuber #fyp #storytime | relevant | kept |
| 6 | #musicchallenge | indirect | StrayCatsVEVO | Stray Cats - Stray Cat Strut (Official Music Video) | relevant | kept |
| 7 | #musicchallenge | indirect | ABKCOVEVO | The Rolling Stones - Stray Cat Blues (Official Lyric Video) | relevant | kept |
| 8 | #musicchallenge | indirect | shared by Deb Walters | INXS - Baby Don't Cry (Official Music Video) | relevant | kept |
| 9 | #musicchallenge | indirect | shared by Lady Iris | SLY AND THE FAMILY STONE Dance To The Music  HQ | relevant | kept |
| 10 | #musicchallenge | indirect | The Rolling Stones | The Rolling Stones - Stray Cat Blues - Live OFFICIAL | relevant | kept |
| 11 | #digitalart | direct | Sarah McKenzie | Timelapse for the iguana speedpaint. | relevant | kept |
| 12 | #digitalart | direct | ☘️Indu☘️ commissions OPE | Painting timelapse of a humanoid dragon lady in soft pink and yellow l | relevant | kept |
| 13 | #digitalart | direct | KAITO | Speedpaint of a cursed werewolf..  | relevant | kept |
| 14 | #digitalart | indirect | shared by Cassiopeia Fan | "Stalker Witch Shrinks You Down into Her New Doll" ASMR Giantess Art T | relevant | kept |
| 15 | AI-generated video | direct | it's Candy Love | This AI video is very funny.😂😂😂😂 Obama and the felon.)💥 | relevant | kept |
| 16 | AI-generated video | indirect | Tod Maffin | How to spot a deep fake AI video ￼ | relevant | kept |
| 17 | #musicsky | indirect | shared by Stig | "Shattered" (The Rolling Stones Cover) - Eddie Vedder & Jeanne Tripple | relevant | kept |
| 18 | #musicsky | indirect | shared by bradlwoods.bsk | "Lady Madonna" acoustic Beatles cover by Brad Woods | relevant | kept |
| 19 | #musicsky | indirect | shared by Mo in Columbus | Last Night I Had The Strangest Dream - (1950) - Ed McCurdy Cover - Aco | relevant | kept |
| 20 | Street interviews & vox pops | direct | Lumpia Nyong'o | I try to stay far away from street interview content but this has had  | relevant | kept |
| 21 | Street interviews & vox pops | indirect | shared by debaser99 |  This Street Interview on Irish Unity Took a Strange Turn!  | relevant | kept |
| 22 | Animation shorts | direct | 🎨Sifyro🎨 | Got this amazing animation from  | relevant | kept |
| 23 | Animation shorts | direct | Bloody Disgusting | MAMA BEAR. | **not relevant** | dropped |
| 24 | Animation shorts | direct | World Of IO/IOverse | New D&D Animated Short! Give it the Business 💼🗡️ #ttrpg #dnd #dnd5e | relevant | kept |
| 25 | Animation shorts | direct | H0rs3 Animations | New animation ! | relevant | kept |
| 26 | Animation shorts | direct | Rosie M 💫 / Comm opened | My first Poppy animation!! 💜 ✨ | relevant | kept |
| 27 | Satisfying & ASMR | direct | Luca | Satisfying 👀 | relevant | kept |
| 28 | Satisfying & ASMR | direct | Digital Brain | Watching a blade peel off a clean sheet of wood or two joints lock tog | relevant | dropped |
| 29 | Satisfying & ASMR | direct | Alex Kanaris-Sotiriou | A bit in awe of level design orchestrating this kind of immensely sati | **not relevant** | dropped |
| 30 | Satisfying & ASMR | direct | Pleasure Forge -Next Dro | If you can dream it, you can do it. | **not relevant** | kept |
| 31 | Satisfying & ASMR | direct | Devilish Daddy | Your mom's boyfriend is so hungry 😈 | **not relevant** | dropped |
| 32 | Music videos | direct | robdog 👾 | Nila but she's in a Mariah Carey music video | relevant | kept |
| 33 | Music videos | direct | Breana Navickas | Hello new people here. My name is Bre, i'm a mom, I work in animation  | **not relevant** | dropped |
| 34 | Music videos | direct | Pan-Pizza: Watch Loki IR | Indie animation about making animation | **not relevant** | dropped |
| 35 | Music videos | direct | KrisPLettuce | Check out this Junkyard Dog music video set to George Clinton's 'Atomi | relevant | kept |
| 36 | Music videos | indirect | StrayCatsVEVO | Stray Cats - Stray Cat Strut (Official Music Video) | relevant | kept |
| 37 | Cat videos | direct | 🎃All the cats🎃 | Ugh! Black cats. How on earth can anyone think this precious baby is b | relevant | kept |
| 38 | Cat videos | direct | Michelle says: Be kind.  | Cat is completely unbothered by the dog: #AGoodPlace | relevant | kept |
| 39 | Cat videos | direct | Massimo (mirror) | A video analysis of the difference between dog joining cat and cat joi | relevant | kept |
| 40 | Cat videos | direct | Bunsen, Beaker, Bernoull | It’s the Monday Morning Pawpdate! | relevant | kept |
| 41 | Cat videos | direct | JoyousJoyfulJoyness | ✨ A Sprinkle of JoyousJoyness ✨  | relevant | kept |
| 42 | Dog videos | direct | Democrat Cats | Morning Sea Puppy | relevant | kept |
| 43 | Dog videos | direct | Subby | Poopy puppy. 🥴 | relevant | kept |
| 44 | Dog videos | direct | Michelle says: Be kind.  | Cat is completely unbothered by the dog: #AGoodPlace | relevant | kept |
| 45 | Dog videos | direct | Massimo (mirror) | A video analysis of the difference between dog joining cat and cat joi | relevant | kept |
| 46 | Dog videos | direct | Bee is sleepy | transgender puppy video game....?! | **not relevant** | kept |
| 47 | Timelapse & process | direct | Sarah McKenzie | Timelapse for the iguana speedpaint. | relevant | kept |
| 48 | Timelapse & process | direct | justGruff ➡️PAWAI 2026 | hand timelapse~ | relevant | kept |
| 49 | Timelapse & process | direct | krystal!💥♥️ | Here’s the speed pain(t) timelapse! 🙂‍↕️🙏 | relevant | kept |
| 50 | Timelapse & process | direct | Cole | Froot lapse  | relevant | kept |
| 51 | Timelapse & process | direct | Uobih | Full speedpaint Available on my YT ! If you like what i do , don't for | relevant | kept |
| 52 | Cooking & recipes | direct | Bloody Disgusting | MAMA BEAR. | **not relevant** | dropped |
| 53 | Cooking & recipes | direct | Jim 🤘 | Wind turbines get the birds, solar panels fry the squirrels—we’re just | **not relevant** | dropped |
| 54 | Cooking & recipes | direct | Every Film Now | First teaser for ‘MAMA BEAR’, a new short film directed by Curry Barke | **not relevant** | dropped |
| 55 | Cooking & recipes | indirect | Townsends | The Last Meal of Ichabod Crane - Sleepy Hollow Cooking | relevant | kept |
| 56 | Cooking & recipes | indirect | Recipe Rouviews | Cursed Recipe box: Lemon almond amaretto cake. | relevant | kept |
| 57 | Explainers & edutainment | direct | Cheryl in Nova Scotia 🇨 | NDP Opposition leader Claudia Chender for Nova Scotia spitting facts a | **not relevant** | dropped |
| 58 | Explainers & edutainment | direct | Bradford District Green  | The budget is just a few days away. | **not relevant** | dropped |
| 59 | Explainers & edutainment | direct | Bearly Gays Podcast | Polyamory Explained: More Than Just Sex #Polyamory #ModernRelationship | relevant | kept |
| 60 | Explainers & edutainment | direct | moosh 🧜🏼‍♂️ | no one ever explained why he dressed Like That | **not relevant** | dropped |
| 61 | Explainers & edutainment | direct | Amber 🌸 | a friend mentioned spiking neural networks so here is the five-minute  | relevant | kept |
| 62 | Gaming clips & streams | direct | Uobih | Full speedpaint Available on my YT ! If you like what i do , don't for | **not relevant** | dropped |
| 63 | Gaming clips & streams | direct | Corrine Conorino | Aqua and Ai perform a mother son duet together! #tomodachilife #oshino | relevant | kept |
| 64 | Gaming clips & streams | direct | Tulip 🦊🏳️‍⚧️Θ∆ | working on a minecraft mod that adds a tf2-style killfeed | relevant | kept |
| 65 | Gaming clips & streams | direct | Obsidian | Schedule for this week! Simple, Season 2 of The Walking Dead! On the w | relevant | dropped |
| 66 | Gaming clips & streams | direct | Old British Telly | [2005] Monkey Dust - British adult animated satirical sketch comedy se | **not relevant** | dropped |
| 67 | Covers & musical performances | direct | 【Unofficial】BanG Dream!  | 🎵 "BanG Dream! Our Notes" Cover Song Preview | relevant | kept |
| 68 | Covers & musical performances | direct | BanG Dream! Our Notes {b | 🎵 "BanG Dream! Our Notes" Cover Song Preview — “KAIBUTSU” | relevant | kept |
| 69 | Covers & musical performances | direct | Tiffany - The Benevolent | Another day, another song for the final week until Halloween! Check  m | relevant | kept |
| 70 | Covers & musical performances | direct | Brandon Sheffield | Good luck figuring out what song this is based on the cover! | relevant | kept |
| 71 | Covers & musical performances | direct | Amy LD | I didn't have anything spooky related planned for this year >> | relevant | kept |
| 72 | Comedy skits & sketches | direct | Alex Kanaris-Sotiriou | A bit in awe of level design orchestrating this kind of immensely sati | **not relevant** | dropped |
| 73 | Comedy skits & sketches | direct | Underscore Comedy | Skyrim citizens after the Dark Brotherhood questline is finished #skyr | relevant | kept |
| 74 | Comedy skits & sketches | direct | Dook of Url | Straight off the conveyer belt, like some kind of I Love Lucy style co | relevant | kept |
| 75 | Comedy skits & sketches | direct | Jay Luke (Nerdy Jay) | This is definitely not in reference to two particular recent examples  | relevant | kept |
| 76 | Comedy skits & sketches | direct | Old British Telly | [2005] Monkey Dust - British adult animated satirical sketch comedy se | relevant | kept |
| 77 | Storytime & narration | direct | αlpha βetta (alpha)🐟🌙【 | Being Old is OP #japan #vtuber #fyp #storytime | relevant | kept |
| 78 | Storytime & narration | direct | Jude the GAWSIE TOMEWARD | SCARY STORYTIME | relevant | kept |
| 79 | Storytime & narration | direct | Fable Mono | Inde Navarrette on Switching Schools 11 Times 💔 #indenavarrette #stor | relevant | kept |
| 80 | Storytime & narration | direct | Qurio | 6 Days  | **not relevant** | dropped |
| 81 | Storytime & narration | indirect | shared by Ron Evans 🇨🇦 | Terry Gilliam - Storytime (1968) | **not relevant** | dropped |
| 82 | Data Centers | direct | Aaron Rupar | Trump on data centers: "Let them pay the people. I don't care. And onc | relevant | kept |
| 83 | Data Centers | direct | Mike Nellis | Republican Senate candidate John Sununu runs away from a reporter aski | relevant | kept |
| 84 | Data Centers | direct | Center for Biological Di | More of this > more data centers. | relevant | kept |
| 85 | Data Centers | direct | Tina Kotek | I signed the POWER Act to make data centers pay their fair share of en | relevant | kept |
| 86 | Data Centers | direct | Headquarters | Trump on data centers: | relevant | kept |
| 87 | David Hamilton | direct | MLB | RT @MLBONFOX: David Hamilton's game-tying home run brought everyone at | relevant | kept |
| 88 | David Hamilton | direct | Inside Edge MLB | David Hamilton delivers a home run to tie the game! | relevant | kept |
| 89 | David Hamilton | direct | Brent Maguire | David Hamilton immediately makes up for his error with a game-tying ho | relevant | kept |
| 90 | David Hamilton | direct | MLB | DAVID HAMILTON! | relevant | kept |
| 91 | World Series | direct | Casey Drottar | You can very clearly hear "Yeli, Yeli" chants for Christian Yelich at  | relevant | kept |
| 92 | World Series | direct | TMJ4 News | More than 30,000 Brewers fans have packed American Family Field for th | relevant | kept |
| 93 | World Series | indirect | Rates & Barrels | Brewers Explode for 8 Runs in World Series Game 3 +Game 4 Preview | relevant | kept |
| 94 | Puppet & character videos | direct | eblu | an ad for some extremely sketchy hangover drug called "Thor RX" with e | relevant | kept |
| 95 | Animal comedy & dubbed animals | direct | Catslife | Talking to the cat 🫣😅 | relevant | kept |
