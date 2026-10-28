# Recommendation audit 2 — independent review of the Viral Radar desk, feeds and labels

**Snapshot audited:** `runId` `202610281208_30d3b5dad9d5`, `generatedAt` `2026-10-28T12:09:51.882Z` (same run in `data/latest.json` and `data/qa/briefs.json`).
**Audit written:** 2026-10-28. **Machine-readable copy:** `data/benchmark/audit-4.0-second.json`.
**Headline:** average desk score **2.17 / 5** across 8 opportunities × 8 dimensions; microtrend type-label agreement **15 / 40 = 37.5 %**; Viral Now top 10 broadly sound (9/10 acceptable, with hygiene flags); Early Radar top 10 half wrong (5/10 not early or not accelerating).

---

## 1. Method and limits

- **Reviewer stance.** I did not build this system and did not read the earlier audit (`docs/RECOMMENDATION_AUDIT.md`, `data/benchmark/audit-4.0.json`). Judgements are those of a sceptical product reviewer working for the owner: a solo creator making AI-generated entertainment, animation, characters, editing and music in English/Spanish, 30 min–2 h production windows, direct revenue as the goal (`desk.profile` says the same).
- **What I looked at.** Only the data the system itself exposes: `data/latest.json` (`desk`, `videos.viralNow['72h']`, `videos.earlyRadar`, `trends`), `data/qa/briefs.json`, and `data/videos.json` for cross-checks (state, velocity, cooling flags, sources). I also read the evidence-class definitions in `docs/SCORING.md` to judge whether the "early" and "hit" labels mean what they say. No pipeline code was run or modified; no file other than the two deliverables was changed.
- **What I could not do.** No network access to YouTube, Bluesky or Google Trends, so I never watched a video, opened a channel or re-fetched a statistic. Relevance and originality are judged from titles, creator names, categories, durations, languages, dates and the system's own `reasons`. Tags and descriptions are **empty in the index** (`tags: []`, no description), so where a video's link to a trend is only in its description (e.g. a hashtag), I could not confirm or refute it and say so. Organic-vs-paid spread cannot be proven from counts; I flag patterns, I do not assert manipulation.
- **Scoring.** Each sampled desk item is scored 1–5 on the eight rubric dimensions (relevance, classification, specificity, evidence, timing, feasibility, originality, monetization); dimensions 6–8 use the three production briefs in `briefs.json`. Feeds are judged on relevance, evidence quality and timing/consistency only. Label validation uses the rubric's own definitions: *format* = a reusable structure shared by independent creators; *meme* = one specific moment, phrase or sound replicated; *event* = a calendar/news/release moment or one dominant video; *uncertain* = none of the above is supportable.
- **Copyright.** Titles are quoted only as truncated identifiers; no video content or brief is reproduced beyond short phrases needed to show a defect.
- **Minor note.** The task description says `briefs.json` also contains the Markdown export; the file holds `generatedAt`, `runId`, `opportunities` only. Nothing else depends on it.

---

## 2. Part A — desk opportunities (all 8)

### 2.1 Score table (1–5)

| # | Opportunity | Type / action | Relev. | Classif. | Specif. | Evid. | Timing | Feasib. | Origin. | Monet. | **Avg** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Satisfying & ASMR | format / create_today | 2 | 3 | 2 | 2 | 2 | 3 | 2 | 4 | **2.50** |
| 2 | halloween | event / participate | 5 | 5 | 2 | 4 | 3 | 4 | 2 | 4 | **3.63** |
| 3 | Cooking & recipes | format / research | 1 | 2 | 1 | 2 | 2 | 3 | 2 | 3 | **2.00** |
| 4 | aianimation | event / monitor | 2 | 1 | 1 | 1 | 2 | 4 | 1 | 3 | **1.88** |
| 5 | Storytime & narration | format / monitor | 2 | 3 | 2 | 2 | 3 | 4 | 1 | 3 | **2.50** |
| 6 | Puppet & character videos | event / monitor | 1 | 1 | 1 | 1 | 3 | 4 | 1 | 2 | **1.75** |
| 7 | 2026 | event / monitor | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | **1.00** |
| 8 | mbappe | event / monitor | 3 | 4 | 2 | 2 | 1 | 2 | 1 | 2 | **2.13** |
| | **Mean** | | 2.1 | 2.5 | 1.5 | 1.9 | 2.1 | 3.1 | 1.4 | 2.8 | **2.17** |

Dimension means tell the story: *feasibility* (3.1) and *monetization* (2.8) are the system's best, because they depend on the owner profile, not on the data; *originality* (1.4), *specificity* (1.5) and *evidence* (1.9) are the worst, because they depend on the evidence actually supporting the named thing.

### 2.2 Per-item justifications

**1. Satisfying & ASMR — format, create_today, fit 73, score 73**
- Relevance 2: of 6 evidence items, 3 are satisfying/ASMR shorts (an "ASMR Gone Wrong" skit, an action-figure #asmr short, a DIY mini-bridge build); 2 are ended **livestream recordings** of 80–96 min (🔴 Live / #livestream in the title, tagged `m_livestream` in the index, +2/h and +3/h, both flagged "Cooling… past its peak" by the system); 1 is a Hindi Land Rover restoration short matched on "satisfying".
- Classification 3: "format" is acceptable for an evergreen genre, but typeConfidence 90 is not earned by this mix, and the same trend is `isGeneric: true, qualified: false` at trend level.
- Specificity 2: `signature: []`; the "format" is the category. Hooks (sensory 8, emoji 9) are the only signal, and the briefs ignore them.
- Evidence 2: statistics verified and recent (27–117 h), creators independent, growth honestly "provisional" — but "6 clean verified videos" counts the two streams, and the best example's "+94K/h measured" is 0.53× its own lifetime average (decelerating), which the desk does not say.
- Timing 2: "emerging — first seen 11 h ago" is an artefact of the index being 11 h old; the trend window in the same file says `lifecycle: peaking`, `growth.basis: measured`. The caution admits it is evergreen, which contradicts "emerging" and weakens "create_today".
- Feasibility 3: an AI satisfying clip in ≤2 h is realistic; but the briefs push a voiced, catchphrase-driven character comedy (the opposite of the ASMR mechanism) and a 93–173 s target computed from a median polluted by the streams; the actual shorts run 34–98 s.
- Originality 2: Character-led / Escalating series / Cross-genre mashup templates with the name substituted ("An original recurring character takes on a satisfying / ASMR clip"). Nothing uses sound design, the one thing the format is about.
- Monetization 4: platforms, YPP and TikTok Creator Rewards thresholds accurate; "inauthentic content" warning apt. No note that ASMR Shorts RPM and brand-deal potential are low.

**2. halloween — event, participate, fit 63, score 72**
- Relevance 5: all 6 items are Halloween (costume ideas, a pet costume, party décor, SFX makeup, costume ranking "Part 2", a prank); the sixth is `rejected` but on-topic.
- Classification 5: calendar event, confidence 85, `nameShape: calendar` — correct.
- Specificity 2: "halloween" is a date, not a mechanism. The evidence shows at least three reusable sub-formats (pet-costume reveal, ranked costume compilation "Part N", SFX-makeup fail/reveal) and none is named.
- Evidence 4: 9 creators, 4 new in 48 h, corroborated on YouTube + Bluesky + Google Trends, stats verified; the top example is genuinely accelerating (1.79× lifetime). Deductions: "9 clean verified" vs a rejected item shown; 3 of 6 examples already cooling (0.06–0.14×); desk says growth "not measurable" while the trend record says "measured 1.125×".
- Timing 3: the action ("one original piece before the date, not a series") and the collapse-after-the-date caution are right. But the timing label is "emerging / first seen 11 h ago" and nowhere says "Halloween is in 3 days" — the only number that matters for a calendar event.
- Feasibility 4: a Halloween AI/animation short in ≤2 h is realistic. The approach list is "original music or parody track" because the trend's category is **Music / Covers & Mashups** — wrong (evidence categories are People & Blogs, Comedy, Howto & Style, Entertainment). The third brief (original song, 1.5–3 h) exceeds the window.
- Originality 2: templates ("Halloween, levels 1 to 5", "the halloween song"); the character brief claims the examples' titles are "mostly episodic ('part N')" — one of six is.
- Monetization 4: includes the format-specific risk line ("attention collapses after the date"); eligibility accurate; "streams of the original track" is category-driven but harmless.

**3. Cooking & recipes — format, research, fit 52, score 66**
- Relevance 1: AI dogs "cooking dinner" (comedy), a Hindi comedy short tagged #cooking, a Hindi family-drama episode with a kaju-katli segment, a **cat video** matched on the word "cook" (popcorn), another Hindi family-drama #cooking short, and a rejected "blind chef" item. At most one is a recipe.
- Classification 2: a category pool the system itself marks `isGeneric: true, qualified: false`, promoted to the desk as a "format" with confidence 90.
- Specificity 1: the briefs invent "a 60-second recipe" that no evidence shows.
- Evidence 2: stats verified, creators independent; but relevance is poor, 2 of 5 verified examples are cooling, the top one is at 0.52× lifetime, and "mostly English/Spanish" is false — three items are romanised Hindi tagged `latin`, one Hindi short tagged `en`.
- Timing 2: "emerging" artefact on an evergreen pool; "research" is at least cautious.
- Feasibility 3: an AI-character cooking skit is a 2 h job; it just is not what the evidence shows.
- Originality 2: templates (Character-led / Reversal / Cross-genre).
- Monetization 3: generic lines plus affiliate links (plausible for food); `suitability: 82` on an item with `fit: 52` is unexplained.

**4. aianimation — event, monitor, fit 78, score 75**
- Relevance 2: the 88 %-dominant video is a Hindi "junk Thar to Thar ROXX" car-transformation short; nothing in its title or stored fields shows an AI-animation link (titleShare 0.5 means half the cluster does not carry the term in the title; tags are not stored, so the match is unverifiable). The other five are `rejected` (a Hindi ice-cream-seller comedy, an "ai se video kaise banaye" tutorial, a Karwachauth couple short, "Funny 3D Animation", a Tamil AI horror short) — some are AI animation, none is a hit.
- Classification 1: a medium hashtag (`descriptor: true`, `nameShape: hashtag`) labelled **event** with confidence 80.
- Specificity 1: none; the briefs read "Aianimation, but something is wrong".
- Evidence 1: "10 independent creators with 10 clean verified videos" vs 1 verified + 5 rejected on display; `facts.videos: 10` cannot be reconciled with the evidence array.
- Timing 2: "emerging" artefact; the top video's velocity is unmeasured and the rest are cooling. "monitor" is the right verb for the wrong reason.
- Feasibility 4: AI animation is the owner's core skill; anything here is producible in 2 h — but there is nothing specific to produce.
- Originality 1: templates with the hashtag substituted.
- Monetization 3: generic; the "inauthentic content" warning is the one relevant line.

**5. Storytime & narration — format, monitor, fit 83, score 72**
- Relevance 2: two verified couple-POV shorts (one 14.1M in 2 days, tagged #storytime; one "who wants a story time?") and a rejected FIFA Ultimate Team rewards video. The strong example is a POV skit, not narration.
- Classification 3: storytime is a real format; the evidence here is thin and leans POV-skit.
- Specificity 2: signature "storytime" only.
- Evidence 2: 14.1M/2 d and 7.1M/3 d are real and verified; but only 2 relevant creators, 13 cluster videos excluded, and "1 creator repeats the format" is impossible with 3 videos from 3 creators (it comes from the wider 16-creator cluster).
- Timing 3: top example 1.13× (steady), second cooling at 0.18×; "monitor" fits.
- Feasibility 4: an AI character telling a 60 s story is squarely a 2 h job.
- Originality 1: templates, including "A 30-second original song about told story" and "told story — part 1".
- Monetization 3: generic.

**6. Puppet & character videos — event, monitor, fit 69, score 71**
- Relevance 1: the 78 %-dominant video is a Korean short titled about "flying free like a bird" with no puppet signal; one genuine early puppet short (a Radha & Krishna fair puppet dance); a 56-minute horror-game stream; two Jeff Dunham TV-clip reuploads; a Bluesky text post about a hangover-drug advert (0 views). The trend record additionally holds an ABC News sentencing clip.
- Classification 1: "event" is the fallback for "one video is the whole story", applied to something named as a format; the signature (jeff, dunham, puppets, show) describes clip reuploads, not a creator format.
- Specificity 1: "a puppet / character bit (jeff / dunham)"; the briefs tell the owner to hashtag a real comedian's name on an original character video.
- Evidence 1: "6 clean verified" vs 1 verified + 1 early + 4 rejected; a zero-view Bluesky post in the evidence; dominance 78 %.
- Timing 3: "monitor" is right; the label "emerging" is the usual artefact.
- Feasibility 4: recurring original characters are the owner's strength; producible.
- Originality 1: templates ("Puppet, levels 1 to 5", "Puppet — in the wrong world").
- Monetization 2: generic; no Content ID / reuse warning despite the evidence being TV-clip reuploads.

**7. 2026 — event, monitor, fit 63, score 70**
- Relevance 1: a four-digit year that appears in every trailer title; the cluster is Avengers: Doomsday, Dune 3 and Way of the Warrior Kid trailers from trailer channels. Not a trend.
- Classification 1: should have been dropped by the generic-token filter (`desk.excluded` reports 58 "generic tag or category" exclusions; this one got through, `isGeneric: false`). Category "Music / Original Songs".
- Specificity 1: none.
- Evidence 1: 2 verified + 4 rejected; 4 of 6 cooling (0.02–0.57×); "creators" are trailer re-uploaders.
- Timing 1: "emerging" on a dying trailer cycle.
- Feasibility 1: "An original recurring character takes on 2026 (trailer / chris)"; no format to vary in 2 h.
- Originality 1: "the 2026 song", hashtags `#2026 #trailer #chris #pratt`.
- Monetization 1: "streams of the original track" about a year; no copyright note for trailer footage.

**8. mbappe — event, monitor, fit 76, score 66**
- Relevance 3: Ballon d'Or 2026 ceremony (12 min), a "Barcelona steal Kane's Ballon d'Or" reaction, an AI-channel El Clásico short, an Omar Momani cartoon — a coherent football-news moment with a visible AI/cartoon angle.
- Classification 4: event is right. Category **Animation & Art** is wrong: all five evidence items are platform-category Sports.
- Specificity 2: a person's name. The owner-fit mechanism in plain sight — AI 3D football parodies (also in the lane: an ainimal-rescue-ai Mbappé 3D parody at 3.1M) — is never named.
- Evidence 2: `facts.topViews` 2.18M while an evidence item shows 4.17M (dominance 53 % computed on a different set); 2 verified, 2 rejected.
- Timing 1: the best example is cooling at 0.15× lifetime and the ceremony has already happened; "emerging / monitor" is the wrong direction — this is act-now-or-skip.
- Feasibility 2: `feasibleIn2h: false` (1.5–4 h) yet on the desk; the Reversal brief says difficulty "Low" at 1.5–4 h; publishing says "YouTube" long-form but the notes say "post the same cut to Shorts, TikTok and Reels".
- Originality 1: "Mbappe, but it's a nature documentary".
- Monetization 2: watch-page ads plausible; "Facebook in-stream ads" arbitrary; no likeness/footage-rights note for a real athlete and a televised ceremony.

### 2.3 The lane (`desk.lane`)

**Useful: yes, as a watchlist; no, as recommendations. Honest: mostly.**
- Honest: the notes are candid — "109/177/384 creators this week — category-level activity, too broad to be one opportunity", "did not clear the desk gate", "fewer than 3 clean verified examples this week". That is the right tone.
- Not useful enough: 2–4 examples per pool and several are off-pool — a brand's advert music video (SHOPEE Indonesia) and a K-pop news short under *Music videos*; Talking Tom mobile-game streams as the whole *Animal comedy & dubbed animals* pool; a rejected how-to tutorial and a rejected 19K-view AI short as the entire *AI-generated video* pool while the trend list reports 26 creators / 29 videos for the same `f_ai_video`; a 3D-pen craft vlog as the top *Animation shorts* example.
- The biggest miss for this owner: *Animation shorts* (177 creators) is dismissed as too broad instead of being split. Its own examples (an AI 3D Mbappé parody, a 3D explainer, a Sonic cartoon) plus the mbappe evidence (God Ares AI, Omar Momani) show a specific, owner-fit sub-format — short AI 3D parody of football figures — that would have been the best recommendation in this snapshot. The system has the data and never says it.

---

## 3. Part B — feeds

### 3.1 Viral Now (72 h), top 10

| # | Title (truncated) | Views / age | OK | Issue |
|---|---|---|---|---|
| 1 | Diwali Ki Rat Do Logon Ki 3 Parchhaiyan… | 24.9M / 46 h | yes | Numbers consistent (+2.6M/h, 4.85× lifetime). Language "en" for romanised Hindi; 129 comments on 24.9M views (comments likely disabled) — engagement unverifiable. |
| 2 | INDIA'S GOT LATENT S2 EP8 | 46.0M / 71 h | yes | A 50-min flagship episode of a 12.1M-sub channel: a verified hit, not a discoverable format. |
| 3 | I removed this from the swan's throat | 35.7M / 61 h | yes | Consistent; 36.7× creator median; organic. |
| 4 | ازاااي بوبا الاوريو | 32.8M / 69 h | yes | 16.2M-sub channel, 2× subs; 3 comments per 1M views (comments likely off). |
| 5 | Valid crash out | 13.9M / 23 h | yes | Aggregator/repost channel; organic spread, not an original creator format. |
| 6 | #gta #gta6 #shorts | 41.3M / 70 h | **no** | Hashtag-only title; the same channel has ≥3 uploads with this identical title in the #gta6 cluster; velocity "seen once so far" yet ranked #6 on lifetime average alone; likely reposted game footage. |
| 7 | Hero Climbs Down A Bridge To Save A Stranded Puppy | 12.8M / 43 h | yes | Probable repost (compilation-style rescue channel). |
| 8 | iPhone DUO … Surprise! | 5.8M / 22 h | yes | 35.8M-sub channel at 0.16× its subscribers — a baseline upload; the card's own 4th reason undercuts "viral". |
| 9 | WE PICKED OUR CAR KEYS… | 26.3M / 27 h | yes | Category "Music" wrong (POV skit); 29 comments on 26.3M; sister video (near-identical title) at #36; 346× creator median from 31K subs in 27 h — plausible for Shorts, should be flagged for verification. |
| 10 | Ronaldo is COME BACK… REAL GOAT? | 20.6M / 68 h | yes | Category "Animals & Pets" wrong; 1379× creator median; probably AI football animation — verify. |

Feed-level facts: all 40 entries are `kind: established`, 37/40 `band: high`; two creators appear twice (allowed by the documented 2-per-creator cap, but #9/#36 are near-duplicates in title and format). At least four hashtag-only titles sit in the two feeds combined (two in each top 10). Comment counts of 1–11 per million views on four of the top ten are not evidence of manipulation, but the documented paid-reach rule (<0.05 % likes, ~no comments) cannot see "likes fine, comments disabled"; the reasons should say so.

### 3.2 Early Radar, top 10

| # | Title (truncated) | Views / age | Measured ÷ lifetime | OK | Issue |
|---|---|---|---|---|---|
| 1 | Gérard Jugnot souffre pour ne pas rire | 2.1M / 99 h | 0.96× | **no** | 4 days old, just under the 2.3M floor, rate equal to its own average: neither early nor accelerating; a TV-show clip, not creator content; ranked #1. |
| 2 | #lol #funny #meme #viral #fyp … #anime | 460K / 21 h | 4.90× | yes | Rate genuinely abnormal, but a hashtag-spam title and probable anime clip repost. |
| 3 | Radha & Krishna: The Funny Fair Puppet Dance Fight | 289K / 17 h | 2.18× | yes | A real early signal (7.1K-sub channel, 66.9× median). |
| 4 | Quand ta mère debrief… | 698K / 44 h | 0.94× | **no** | "The measured rate is abnormal" printed for a rate below its own average; the trigger is a 7× acceleration over one 3 h interval. |
| 5 | Comment Les Animaux Voient-Ils Le Monde ? | 567K / 22 h | 0.70× | **no** | Decelerating yet labelled abnormal; French tagged "en". |
| 6 | Qui dessinera le meilleur visage de tigre | 1.7M / 64 h | 1.82× | yes | Accelerating, but 3 days old at 1.7M against a 1.9M floor — a hit in all but name. |
| 7 | #pov : Tu veux te venger de ton mec (SPÉCIAL HALLOWEEN) | 824K / 19 h | 1.11× | yes | Young, accelerating 5.5×, owner-relevant (Halloween POV skit); 1.5M-sub channel so not an outlier; French tagged "latin". |
| 8 | #Pappuraj #comedy video#short video… | 1.3M / 69 h | 1.39× | **no** | Hashtag-only title; 933-subscriber channel with 1.3M views (1139× median): reupload or paid-reach pattern must be checked before featuring. |
| 9 | POV : Quand tu te déguisais le mauvais jour… | 791K / 41 h | 0.84× | **no** | Decelerating; a 9× acceleration from one short interval drives the label. |
| 10 | Zuhause läuft das eben anders… | 526K / 25 h | 1.72× | yes | Young, accelerating, Animation & Art — exactly what the feed should show. |

Is "early" really early? Across all 40 Early Radar entries: **14 are older than 72 h, 22 have a measured rate below their own lifetime average, 21 already have ≥1M views.** The documented rule ("measured ≥10K/h with ≥50K views") is an absolute bar, so a 4-day-old video coasting at its average qualifies and the reason text calls that "abnormal". The feed is better described as "verified videos just under the hit floor" than "early breakouts". It is also heavily French (6 of the top 10, 6/40 overall `fr` plus 8 `latin`), which looks like a collection-region artefact rather than a property of what is breaking out.

---

## 4. Part C — microtrend type-label validation

Sample: the first 10 trends per `opportunity.type` among trends with `opportunity` and `kind !== 'topic'`, in file order (315 such trends: uncertain 154, event 122, meme 24, format 15). This judges the system's *opportunity type*, not YouTube's uploader categories.

### 4.1 format (agree 2 · disagree 7 · unsure 1)

| Trend | Verdict | One line |
|---|---|---|
| AI-generated video | disagree | A production medium, not a structure; evidence spans a Hindi skit, a family-drama recipe episode, a K-pop short — should be a category/uncertain. |
| Animal comedy & dubbed animals | disagree | Signature (talking, tom, talkingtom) is Talking Tom mobile-game streams; no dubbing visible; category, not format. |
| Street interviews & vox pops | agree | A real reusable structure; 3 of 5 examples are street interviews (one is a cat listicle). |
| #시니어드라마 | agree | Korean "senior short drama" with a shared revenge-twist structure across 5 independent creators — a genuine format. |
| Cooking & recipes | disagree | System marks it generic/unqualified; evidence is AI dogs, Halloween ideas and a container home. |
| Cat videos | disagree | Subject category (173 creators); the system itself says "not a new trend by itself". |
| Covers & musical performances | disagree | 1 of 4 examples is a cover; the rest are a Tom & Jerry clip, a Telugu news reaction, a hololive ARK stream. |
| Gaming clips & streams | disagree | 391 creators, signature gtav/gta5 livestreams; a category. |
| Dog videos | disagree | Subject category; examples include a towel comparison and "CHECK FOR CONTEXT". |
| Storytime & narration | unsure | Storytime is a format, but 2 of 4 examples are stunts/pranks, 2 are POV couple shorts. |

Note: `kind: format` pools receive `type: format` by construction ("a relevance-validated format with independent adoption"), including five the system flags `isGeneric: true`. The type label does no work on those.

### 4.2 meme (agree 0 · disagree 9 · unsure 1)

| Trend | Verdict | One line |
|---|---|---|
| #acousticcover | disagree | A genre hashtag; 18 videos from 3 creators, mostly one channel's repeated uploads; no shared moment. |
| #furry | disagree | A fandom tag (fursuit fit, OC animation, dragon puppet); community, not meme. |
| 생기는 일 ("what happens when…") | unsure | A long-standing Korean title formula shared by 4 creators — closer to a format than a replicated moment. |
| #gta6 | disagree | Three identical-title uploads from one channel plus an unrelated podcast; a named title → event or uncertain. |
| #切り抜き (clips) | disagree | A medium descriptor (clip channels of HikakinTV and TV shows). |
| #cinema | disagree | Movie-recap channel (4 of 6 from one creator); descriptor. |
| #reaction | disagree | German clip channels; nothing replicated. |
| #spiderman | disagree | A topic/entity across unrelated GTA, Marvel and BeamNG videos. |
| #lustig ("funny") | disagree | Generic descriptor. |
| #laugh | disagree | Generic descriptor (monkeys, a tooth, costumes, a beach). |

The meme classifier fires on "N new creators in 48 h around one specific moment/phrase" where the "phrase" is the hashtag itself. None of the ten shows a shared sound, phrase, template or moment.

### 4.3 event (agree 4 · disagree 6 · unsure 0)

| Trend | Verdict | One line |
|---|---|---|
| Mass Effect | agree | 54 creators in 34 h on BioWare/EA news — a news moment. |
| #halloween | agree | Calendar moment, corroborated on three sources. |
| Abonne Toi ("subscribe") | disagree | French description boilerplate; cluster is Squeezie, Netflix France, a rap clip, Minecraft. Should not exist. |
| Free Fire | agree | "Free Fire India" launch plus an esports final — a named release moment. |
| Puppet & character videos | disagree | "Event" as a fallback for one dominant video; evidence is a Korean short, Jeff Dunham reuploads, a horror stream, a news clip. → uncertain. |
| Get Ready | disagree | Boilerplate phrase; Bigg Boss promo, Honey Singh, Phantom Blade trailer, cricket commentary. Should not exist. |
| #highlights | disagree | A descriptor spanning Serie A, Free Fire, SPORT1, cricket, Craftattack — many events, or a format; not one event. |
| #action | agree | The cluster is the Dune: Part Three final trailer (4 of 6, four WB regional channels) — an event, badly named. |
| Theft Auto | disagree | "Indian Theft Auto Simulator" skits with a repeated structure across Hindi gaming channels — a format. |
| Minecraft Mod | disagree | A game topic (roleplay, "Minecraft but…", "Birth to Death" formats); not an event. |

### 4.4 uncertain (agree 9 · disagree 0 · unsure 1)

| Trend | Verdict | One line |
|---|---|---|
| Black Cat | agree | Signature "black, national" hints at National Black Cat Day (27 Oct), but the shown evidence is not about black cats; uncertain is the honest label for a contaminated cluster. |
| #food | agree | Broad tag. |
| Fair Use | agree | Description boilerplate — label fine, but it should never have become a trend. |
| #vtuber | unsure | A hololive ARK-server collab (16 new creators in 27 h) is a named stream event; "uncertain" is defensible only because streams are excluded. |
| #minivlog | agree | Broad tag. |
| #kitten | agree | Broad tag. |
| Entertainment Purposes | agree | Boilerplate ("for entertainment purposes only") — label fine, should not exist. |
| Auto Generated | agree | YouTube "Topic" auto-channels — label fine, should be filtered at source. |
| #lucu ("funny", Indonesian) | agree | Broad tag. |
| #ゲーム実況 (let's play) | agree | Broad descriptor. |

### 4.5 Rates

| Type | Agree | Disagree | Unsure | Agreement |
|---|---|---|---|---|
| format | 2 | 7 | 1 | 20 % |
| meme | 0 | 9 | 1 | 0 % |
| event | 4 | 6 | 0 | 40 % |
| uncertain | 9 | 0 | 1 | 90 % |
| **overall** | **15** | **22** | **3** | **37.5 %** |

The high "uncertain" agreement is not a compliment: four of its ten are description boilerplate or auto-generated channels that should have been removed before labelling, and "uncertain" covers 154 of the 315 labelled trends — the classifier is mostly declining to classify.

### 4.6 Clearest misclassifications

1. **2026** → event. A year token; the cluster is studio trailers. Should be excluded as generic.
2. **aianimation** → event (80). A medium hashtag with `descriptor: true`; 88 % of views in one unrelated video. Should be uncertain or a format pool.
3. **Puppet & character videos** → event. One dominant, unrelated video plus TV reuploads and a news clip. Should be uncertain.
4. **#gta6** → meme. Identical-title multi-uploads from one channel. Event (named title) or uncertain.
5. **Theft Auto** → event. A repeated skit structure across channels. Format.
6. **#laugh, #lustig, #reaction, #cinema, #切り抜き, #furry, #acousticcover** → meme. Generic descriptors. Uncertain.
7. **Abonne Toi, Get Ready** → event. Description boilerplate. Should not be trends.
8. **Cooking & recipes, Animal comedy & dubbed animals** → format. Category pools whose evidence does not show the named format. Uncertain/category.
9. **#vtuber** → uncertain. A named collab stream event (arguable).

---

## 5. Strengths

1. **Radical transparency of the numbers.** Every card and brief carries plain-language `reasons` with the real figures: views, age, the age-specific hit floor, lifetime average vs measured interval rate, acceleration, creator baseline (×median, ×subscribers). An owner can check every claim the system makes — which is exactly how this audit found the defects.
2. **Honest growth language at the video level.** "An average, not a measured recent rate", "provisional (single observation)", acceleration only claimed when both intervals gained ≥1,000 views, and the desk refusing to claim cluster growth without 24 h of history. The briefs admit "visual style, pacing and audio of the examples were not inspected".
3. **The calendar event is handled well.** `halloween` is typed correctly, corroborated on YouTube + Bluesky + Google Trends, given the right action ("one original piece before the date, not a series") and the collapse-after-the-date risk is carried into the revenue section.
4. **Exclusions are visible.** `desk.excluded` publishes the gate's reasons with counts, and the lane notes are candid about pools being too broad or too thin.
5. **Monetization lines are accurate and relevant.** YPP Shorts and TikTok Creator Rewards thresholds are right; the "inauthentic content" policy warning is precisely the risk an AI-video creator runs.
6. **Sound building blocks.** Age-aware hit floors, creator-baseline outlier ratios, the 2-per-creator cap, the paid-reach pattern rule and the >3 h stream rule are all reasonable; the problems are in application, not in the ideas.

## 6. Weaknesses (specific, blunt)

1. **The desk's headline claims are contradicted by its own evidence.** "N independent creators with N clean verified videos" sits above evidence lists that contain `rejected` items, two ended livestream recordings, a zero-view Bluesky text post, TV-clip reuploads and (in the trend record) a news clip. aianimation says "10 clean verified"; it shows 1 verified and 5 rejected. The owner cannot trust the first line of any card.
2. **Relevance matching is title-keyword only, and it shows.** Tags and descriptions are empty in the index. "cook" pulls a cat video into Cooking; "satisfying" pulls a Land Rover restoration into ASMR; "2026" turns every trailer into a trend; "jeff dunham" clip reuploads define a "puppet format". **Three of eight desk items (2026, aianimation, Puppet & character videos) are not trends.**
3. **Timing is uninformative and sometimes inverted.** All eight opportunities are "emerging" with `timingScore: 50` because the index is 8–11 h old ("first seen 11 h ago" is the pipeline's age, not the trend's). The trend windows in the same file say `peaking` with `growth.basis: measured`. Best examples that the system itself flags "Cooling… past its peak" are presented as "gaining +N/h measured" (mbappe 0.15×, 2026 0.22×, Satisfying 0.53×). The Halloween countdown and the already-held Ballon d'Or ceremony never enter the timing.
4. **Category classification is wrong on 3 of 8 desk items and the error propagates.** halloween → Music / Covers & Mashups, 2026 → Music / Original Songs, mbappe → Animation & Art (all evidence Sports). The category drives the production approach ("original music or parody track") and the monetization text ("streams of the original track"), so one wrong field produces a wrong brief.
5. **The briefs are templates with the name substituted.** Five rotating variations (Character-led, Escalating series, Reversal, Cross-genre mashup, Original track) yield "An original recurring character takes on 2026 (trailer / chris)", "A 30-second original song about told story", "Aianimation, but something is wrong", "Mbappe, but it's a nature documentary". None derives from observed hooks or sub-formats; durations come from contaminated medians (ASMR 133 s includes 80–96 min streams); one desk item is over the 2 h budget and is still briefed with a "Low difficulty / 1.5–4 h" line.
6. **The type classifier is weak outside "uncertain".** 0/10 meme labels agreed (generic hashtags with 3–5 creators), "event" is a fallback for "one video dominates" and for description boilerplate, "format" is applied by construction to category pools the system itself marks generic. Overall agreement 37.5 %.
7. **Early Radar is not early.** 14/40 entries older than 72 h, 22/40 decelerating, 21/40 already ≥1M views; "the measured rate is abnormal" is printed for rates at 0.7–0.96× the video's own average because the rule is an absolute ≥10K/h bar. #1 is a 4-day-old TV clip.
8. **Feed hygiene.** Hashtag-only titles, identical-title multi-uploads from one channel, aggregator reposts, a 50-minute show episode and TV clips reach the top 10s. Language detection labels romanised Hindi and French as "en"/"latin", so the "mostly English/Spanish" fit line is false exactly where it matters (Cooking).
9. **Numeric inconsistencies an owner will notice.** mbappe `topViews` 2.18M with a 4.17M evidence item; "1 creator repeats the format" on a 3-video / 3-creator cluster; `suitability: 82` on a fit-52 item; "YouTube" long-form publishing with "post the same cut to Shorts/TikTok/Reels".
10. **The owner's own lane is the weakest-served.** The "AI-generated video" pool shows one rejected tutorial and one rejected 19K-view short while the trend list reports 26 creators; "Animation shorts" (177 creators) is dismissed as too broad instead of being split into the sub-formats visible in its own examples (AI 3D football parodies, 3D explainers) — the single most owner-fit recommendation in this snapshot, and the system never names it.

## 7. The five highest-impact fixes, in order

1. **Evidence integrity.** Count only what is shown. Remove `rejected`, cooling-to-zero, livestream-recording (🔴/"live"/#livestream, `m_livestream`), Bluesky-text and news items from "clean verified" and from desk evidence. Block generic tokens (four-digit years, "shorts", "viral", "fyp", "trending") and description boilerplate ("Abonne Toi", "Get Ready", "Fair Use", "Entertainment Purposes", "Auto Generated") before clustering. In the feeds, dedupe identical-title uploads per channel and demote hashtag-only titles. This alone removes three of eight desk items and the worst feed entries.
2. **Fix relevance matching and show the match.** Store tags/description hashtags in the index; require the trend keyword or a signature word in title or tags; print the matched term on every evidence card so the owner (and the next audit) can see why a video is there. Add negative rules: a "cook" match needs a food platform-category; "satisfying/ASMR" needs ≤180 s and the tag; the dominant video of any cluster must itself carry the signature or the cluster is dropped.
3. **Redefine Early Radar as early.** Age ≤48 h (or ≤72 h with views below half the floor), measured rate ≥1.5× the lifetime average over ≥2 h, views <1M, "abnormal" only when the ratio is >1; demote TV/show clips and channels with no upload history; report the French/regional skew as a collection property or balance the regions.
4. **Derive category, approach and timing from the evidence, not the taxonomy.** Category = majority platform category of the verified examples. Timing for events = days to the date (and "already happened" for past ceremonies); for formats = publish-date spread, new-creator share and the cooling share / measured÷lifetime ratio of the top examples, never the index's own age. One source of truth for growth: the desk's "not measurable" and the trend window's "measured, peaking" cannot both be shown for the same cluster.
5. **Evidence-grounded briefs with a hard 2 h budget.** Name the sub-format actually visible in the top three verified shorts (pet-costume reveal, ranked costume compilation "Part N", SFX-makeup reveal, AI 3D football parody); derive hook, beat sheet and duration from those shorts only (never from streams or long-form); keep the three variations but tie each to one observed mechanism and one observed hook; forbid grammatical string substitution ("about told story"); drop or flag any brief or item with `feasibleIn2h: false` or hours above 2.

---

## 8. Cross-check appendix (numbers used above)

- `desk.opportunities`: 8 items, all `timing: emerging`, all `timingScore: 50`, all `growthBasis: provisional`; `firstDetected` for every item is 2026-10-28T01:00–03:52Z, i.e. the index build, not the trend.
- Evidence states on the desk (as displayed): Satisfying 6 verified (2 are stream recordings flagged cooling); halloween 5 verified + 1 rejected; Cooking 5 verified + 1 rejected; aianimation 1 verified + 5 rejected; Storytime 2 verified + 1 rejected; Puppets 1 verified + 1 early + 4 rejected; 2026 2 verified + 4 rejected; mbappe 2 verified + 2 rejected.
- Measured ÷ lifetime of each desk item's "best example": Satisfying 0.53, halloween 1.79, Cooking 0.52, aianimation unmeasured, Storytime 1.13, Puppets 0.99, 2026 0.22 (cooling), mbappe 0.15 (cooling).
- Trend-level category vs evidence platform categories: halloween Music vs {People & Blogs 4, Entertainment 2, Comedy 1, Howto & Style 1, Music 1}; 2026 Music vs {Film & Animation 5, Entertainment 4, Music 2, Sports 1}; mbappe Animation & Art vs {Sports 5}.
- Early Radar (40): ages 16–122 h, 14 > 72 h; 22 with measured < lifetime; 21 with ≥1M views; languages fr 6, latin 8, en 9, ko 7, ja 4, de 3, tr 2, id 1.
- Viral Now 72 h (40): all `established`, band high 37 / medium 1 / low 2; repeated creators: 2 (allowed by the 2-per-creator cap).
- Labelled trends (`opportunity` present, `kind !== 'topic'`): 315 — uncertain 154, event 122, meme 24, format 15; 267 `qualified`.
- Sources this run: YouTube live (3,688 items), Bluesky live (709), Google Trends live (40), Mastodon live (20), TikTok disabled.

## 9. Owner's response (4.0.1 — changes made after this audit)

The audit was run on run `202610281208_30d3b5dad9d5`. The following changes were made in the pipeline and the web
app in direct response, then verified by replaying the pipeline offline on that run's stored observations (same
data, new rules) and by the test suite (55 tests). Live numbers come from the next collection.

**Fix 1 — evidence integrity (done).** `isCleanEvidence` now admits only a verified video that is a qualified hit or
breakout, or a *mid-size success* (≥100K views inside ten days, rejected only by the viral floor for its age), and
that is not a live stream (title), not a recording ≥30 minutes, not a news clip (platform category or news words),
not a text post. The desk's facts — creators, repeat creators, dominance, median duration, languages, cooling share —
are recomputed on that evidence, never on the raw cluster. Every evidence card states why it counts ("title carries
'halloween'", "matches the format's own rules", "mid-size: ≥100K views below the viral floor"). The headline sentence
names the mix ("5 verified examples — 5 qualified hits/breakouts", "4 examples — 2 qualified and 2 mid-size"), and
a "Mid-size" / "Smaller" badge replaces "Not featured" on desk and lane cards. Generic tokens: a bare number is a
fragment (already in place before the 12:08 run was audited — "2026" is gone), one-word calendar tags
(`#nationalblackcatday`) are calendar, and description boilerplate (`fair use`, `abonne toi`, `auto generated`,
`all rights reserved`, `join discord`, …) is blocked before phrase clustering; a phrase living in <40% of titles is
classified as boilerplate *before* the news/release rules, so "Get Ready" and "Abonne Toi" can no longer become
"events". Feeds: hashtag-only titles are ranked lower and say so; one channel's identical-title uploads are one entry.

**Fix 2 — relevance matching (partly done; the structural part is a documented limitation).** Tags and descriptions
are still not stored in the index (payload size), so matching stays title-level for microtrends and rule-level for
pools. What changed: the matched term is shown on every evidence card; a single dominant video must itself carry
the cluster's name, otherwise the cluster is "uncertain — keyword coincidence", not an "event" (this removes the
"Puppet & character videos" and "aianimation" cases); a hashtag or entity name is a *meme* only when the titles also
share a word beyond the name (`#laugh`, `#reaction`, `#cinema`, `#furry`, `#acousticcover` → uncertain, "a tag, not a
moment"); ~80 more medium/genre descriptors were added; tutorials about making or spotting AI video are excluded from
the AI-video pool; streams and long recordings no longer vote on a pool's signature ("talking tom" game streams).
Negative rules of the kind "cook needs a food category" were **not** added: a hand-written exception list per pool
would be the same keyword matching with more rules, and the pool gate below removes the symptom.

**Fix 3 — Early Radar (done, with one deliberate difference).** After a video's first 48 hours, a high absolute rate
counts as an early breakout only while the video holds or beats its own lifetime pace (ratio ≥ 1); otherwise it is
rejected as "past its peak: steady or slowing, not breaking out". The acceleration branch (rate rising vs the previous
interval) is unchanged. The "abnormal" sentence now prints the ratio ("+20K/h is 0.97× its lifetime average"). Ranking
multiplies the breakout score by pace (accelerating 1.05 / holding 1 / 0.8–1 → 0.85 / <0.8 → 0.6) and by youth, so a
four-day-old clip at its average pace no longer leads. The deliberate difference: "views < 1M" is not a criterion.
The hit floor is age-normalised (1M at ≤24h, 2M at 72h, 3M at 7d, documented in SCORING.md), so a 1.7M-view video at
65 h is below its floor and still "early" in the sense the product defines — about to cross, not yet a hit.

**Fix 4 — category, approach and timing from the evidence (done).** The desk's category is the majority category of
the clean examples (each video's own classification, falling back to its YouTube category) whenever it contradicts
the cluster label (halloween → Seasonal & Holidays, not Music; "mbappe" → Sports and therefore off the desk; the
reason is printed). A calendar event is timed by the calendar: "3 days to 2026-10-31", "today", or "was 2 days ago —
window closed" (cooling → skipped); the countdown is in the caution too. A young cluster's timing reads its examples'
measured rates: ≥50% past their peak → cooling, ≥50% accelerating → accelerating, and the mix is printed next to the
"cluster growth not measurable" line, so the two statements can no longer contradict each other. "Largest example"
prints the pace ("1.84× its lifetime average — accelerating", "0.3× — past its peak"); `topViews` is the largest
example, computed on the same set as the dominance figure.

**Fix 5 — briefs (done within the deterministic-template design, which the spec requires and the docs state).**
Briefs are produced only for items the desk recommends acting on (create today / participate / research); a
monitored item gets "No playbook yet" with the observation that would change the verdict. Difficulty follows the
hours (≤1.5 h Low, ≤2.5 h Medium, else High) and an over-budget item says so in its uncertainty block; the duration
suggestion comes from the clean examples' median (streams can no longer contaminate it); evidence lines carry the pace
and the mid-size label; third-party-IP risk covers TF2/SFM, FNAF, Poppy Playtime, Upin & Ipin, Talking Tom and other
franchises; pool subjects were reworded ("a recipe video", "a first-person story" — no more "told story").

**Beyond the five fixes — the owner's lane.** The lane now reads the whole relevance pool (every verified, usable
record the pool's rules admitted, up to ten days old), states qualified vs mid-size vs smaller counts, and lists
*sub-formats*: a word or pair of words shared by ≥3 independent creators' titles inside the pool, with examples on
tap ("tf2" — 6 creators in Animation shorts; "indian theft" — 4; "mbappe"/"haaland" — the AI 3D football parodies the
audit pointed at, which the Sports rule keeps off the desk by design). A sub-format with ≥4 creators, at least one
qualified example, short-form, not sports/news and not cooling is promoted to the desk as **research** ("found by
shared title words, not by a validated cluster"), never as create-today.

**Result on the audited run (offline replay, same observations):** the eight desk items became five — halloween
(participate; Seasonal & Holidays; "3 days to the date"), "tf2 · Animation shorts" (research, from the lane), and
three monitors (생기는 일, Upin Ipin, 아이폰 듀오) that state why they are not actionable and what would change it;
"2026", "aianimation", "Puppet & character videos", "Cooking & recipes", "Satisfying & ASMR" (streams in its evidence)
and "mbappe" are no longer on the desk. Label counts moved from event 591 / meme 25 / format 16 / uncertain 213 to
event 544 / meme 1 / format 9 / uncertain 293 — the classifier now says "uncertain" far more often, which is the
honest answer for most hashtag clusters. The replay and the next live run are not a re-audit; the third audit (below,
when present) is.
