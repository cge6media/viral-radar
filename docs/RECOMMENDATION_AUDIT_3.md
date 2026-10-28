# Recommendation audit 3 — independent review of the Creator Desk, feeds and microtrend labels

Snapshot audited: `runId 202610281313_036c3ccb99f8`, `generatedAt 2026-10-28T13:13:54.212Z` (`data/latest.json`, `data/qa/briefs.json`, `data/videos.json`).
Machine-readable scores: `data/benchmark/audit-4.0-third.json`.

Owner profile the system targets: AI-generated entertainment, animation, characters, editing and music; English/Spanish; 30 min – 2 h production windows; direct revenue.

## 1. Method and limits

- I did not build this system and I did not run or modify any pipeline code. I read `pipeline/src/intel/desk.ts` and `web/src/lib/playbook.ts` only to understand how the desk gate and the briefs are generated, so that what I saw in the data could be attributed to a rule rather than guessed.
- **No network access to the video platforms.** Every judgement below is made from what the snapshot itself exposes: titles, creator names, subscriber counts, platform categories, durations, view/like/comment counts, publish dates, measured velocities and the system's own reasons. I did not watch a single video. Where a judgement depends on content I could not see (e.g. whether a "rescue" video is staged, whether a channel is a repost channel), I say so and mark it as unverifiable.
- Earlier audits (`docs/RECOMMENDATION_AUDIT.md`, `RECOMMENDATION_AUDIT_2.md`, `data/benchmark/audit-4.0*.json`) were deliberately not read; this review is independent of them.
- Rubric: each sampled item is scored 1–5 on the eight dimensions given in the brief (relevance, classification, specificity, evidence, timing, feasibility, originality, monetization). Originality is `n/a` for monitored items because the app does not write briefs for them; those items are judged on whether "monitor" plus the stated `nextCheck` is the right call.
- Sample: (A) all 5 `desk.opportunities` and the 10 `desk.lane` pools; (B) the top 10 of `videos.viralNow['72h']` and the top 10 of `videos.earlyRadar`; (C) the first 10 trends in file order of each `opportunity.type` among trends with `opportunity` and `kind !== 'topic'` (format 9, meme 2, event 10, uncertain 10 = 31).
- One structural limit of the snapshot that affects every timing judgement: **all 5,113 records in `videos.json` were first seen on 2026-10-28 and every non-topic cluster was first detected between 01:00 and 08:00 UTC the same day** (the YouTube tracking index went live that day, per the README). "Cluster growth not measurable (history 8–12h)" is therefore true of every item, most velocity measurements cover a single ~3 h window, and "emerging" currently means "the radar noticed it today", not "the content is new".

## 2. Part A — the Creator Desk

Five opportunities were shown (of 316 clusters considered; 310 excluded with reasons; 310 + 5 = 315 ≠ 316, so one further cluster passed every gate and was dropped without a logged reason — apparently by the two-per-category cap, the only silent path in `desk.ts`). One item is actionable (halloween → participate); four are monitored.

### 2.1 Scores

| # | Item | Type / action | Relev. | Class. | Specif. | Evid. | Timing | Feasib. | Orig. | Monet. | Mean |
|---|------|---------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | halloween | event / participate | 4 | 5 | 2 | 4 | 4 | 4 | 2 | 3 | 3.50 |
| 2 | Avengers Doomsday | event / monitor | 3 | 4 | 2 | 2 | 3 | 2 | n/a | 2 | 2.57 |
| 3 | 생기는 일 | meme / monitor | 3 | 2 | 2 | 3 | 3 | 3 | n/a | 2 | 2.57 |
| 4 | 아이폰 듀오 | meme / monitor | 4 | 1 | 2 | 3 | 2 | 3 | n/a | 2 | 2.43 |
| 5 | Upin Ipin | event / monitor | 2 | 2 | 1 | 2 | 1 | 1 | n/a | 2 | 1.57 |

**Average desk score over the 36 non-null scores: 2.56 / 5.**

### 2.2 Justifications

**1. halloween** (event 85%, accelerating, participate, score 78)
- Relevance 4 — all five examples are genuinely Halloween shorts (costume ideas, a cat costume in Spanish, party decorating, an SFX-makeup "fail", a costume ranking). They are not one format, but the item claims only the calendar moment.
- Classification 5 — a calendar event, typed as such, with the right countdown (3 days to 2026-10-31) and the right caution ("attention collapses right after the date").
- Specificity 2 — "halloween" is "this holiday exists". The evidence actually contains nameable mechanisms the card never surfaces: costume *ranking* series with "Part N" titles (Ranknosaur Part 2, and Thalynea Part 7 in the wider cluster), pet costumes, SFX fails, costume-idea lists. Worse, the production approach ("original music or an original parody track") is inherited from the cluster's mislabelled `Music` category and matches none of the five videos.
- Evidence 4 — verified statistics, 15–61 h old, five distinct creators, counts match ("5 verified, 5 qualified, 4 others not counted" is exactly what the cluster holds), growth honestly marked provisional. Deductions: radmiru's "+361K/h (1.8× lifetime — accelerating)" is slowing against the previous interval (458K/h → 361K/h), which the card does not show; and three of the five examples are 1.1M–14M-subscriber channels (radmiru 14M, Serena Neel 4.3M, aliya 1.1M), which the card never mentions — reach that comes from channel size says little about a format a solo creator can borrow.
- Timing 4 — "accelerating" is a calendar override while the card itself says 75% of measured examples are past their peak; the explanation is honest and the action (one piece before the date) is right.
- Feasibility 4 — one original AI-character Halloween short in ≤2 h is realistic; brief 3 (1.5–3 h, "High") exceeds the owner's window and says so.
- Originality 2 — see the briefs below: three fixed templates with the name substituted.
- Monetization 3 — YPP and TikTok thresholds are stated correctly and the calendar-collapse risk line is specific and useful. But every brief lists "TikTok Creator Rewards (videos ≥ 1 min)" against its own 21–39 s target; "Facebook/Instagram content monetization" overstates Reels (no general Reels ad-share exists); and nothing says what a three-day spike is worth to a channel that may not yet meet the YPP floor.

*The three briefs (from `briefs.json`).* "Character-led", "Escalating series", "Original track". `playbook.ts` confirms the pattern: brief 1 is always Character-led; brief 2 is Levels if any hook flag among series/escalation/challenge/numbered is set, otherwise Reversal; brief 3 is Song if the `music` hook or the Music category is set, else Explainer or Mashup. Consequences visible in this snapshot: brief 3's premise "Music-led examples" is false (0 of 5 examples are music videos; a single hook hit triggered it); brief 1's hook text says the examples' titles are "mostly episodic ('part N')" when 1 of 5 is; six of the eight production steps are identical across the three briefs, so the song brief tells the owner to "write the script as hook, setup, two escalations, payoff, loop-back line"; the title ideas are "halloween — part 1", "Halloween: level 1 vs level 5", "the halloween song". Nothing in any brief engages with what the examples are (costumes, pets, SFX). The briefs' uncertainty block ("visual style not inspected", "only 5 independent creators so far — promising, not proven" — an odd caveat for Halloween) is honest.

**2. Avengers Doomsday** (event 70%, emerging, monitor, score 65)
- Relevance 3 — all four are about the "Avengers: Doomsday | Special Look" promo. But two of the four "verified examples" are the promo itself, uploaded twice (Hindi and English cuts) by IndiaMarvel — the studio's channel — and the other two are 16-minute reaction/easter-egg videos in German and Indonesian. What creators are doing here is "react to a trailer".
- Classification 4 — "event" is right. −1 because the studio's promo channel is counted as an independent creator, and because the MLB crossover made the trend-level category "Sports".
- Specificity 2 — a topic, not a mechanism; "animated or AI-generated characters and scenes" of Marvel characters is an IP problem the card does not raise.
- Evidence 2 — 0 qualified; two of four examples are one official channel; the timing text says "11 independent creators so far" while the facts say 3; the production text says "short-form examples (median 954s)" (954 s is 16 minutes); the category "Animation & Art" is a lossy mapping of YouTube's "Film & Animation" for a live-action trailer, and that mapping is what gives this item the desk's highest fit (68).
- Timing 3 — "emerging" is defensible (the promo is 3.6 h old) and "monitor" is right. The `nextCheck` asks for "two or more other creators publishing their own version" although two independent reaction videos are already in the evidence.
- Feasibility 2 — technically a 2 h AI short is possible; for "direct revenue" a Marvel-IP derivative is a poor bet (Content ID, trademark), and the card's fit number says the opposite.
- Monetization 2 — generic mechanisms; no IP/derivative-risk line; "suitability 68".

**3. 생기는 일** (meme 70%, accelerating, monitor, score 61)
- Relevance 3 — every title contains the phrase, but "X하면 생기는 일" ("what happens when X") spans a Tokyo liver-dish video, a dating TOP5 and two cat/dog videos; the shared thing is a title template.
- Classification 2 — this is a title fragment, not a meme (no specific moment, sound or joke is being reproduced). The desk has an exclusion rule for exactly this ("title fragment, not a format", 41 clusters) that this cluster slipped past because its `nameShape` is "phrase". Category "Food & Cooking" (cluster basis) fits one of four examples.
- Specificity 2 — a title hook is a weak mechanism and the card does not explain it; the approach is the generic "original short-form skit using AI characters".
- Evidence 3 — honest counts (2 qualified + 2 mid-size; three further videos by one creator excluded), verified statistics; 100% Korean, one creator in 48 h.
- Timing 3 — "accelerating" rests on the two examples with a measured rate (1.04× and 1.68×, the latter a 5-day-old cat video); the rule is applied consistently. "Monitor" with "examples in English or Spanish" as the trigger is the right call.
- Feasibility 3 — a "what happens when…" AI-character skit is cheap to make; it is also a generic skit, not a trend the owner's audience will recognise.
- Monetization 2 — "suitability 82", the highest on the desk, for a Korean-only title trope with fit 35, with no explanation of what the number measures.

**4. 아이폰 듀오** (meme 85%, emerging, monitor, score 58)
- Relevance 4 — a coherent topic: the iPhone Duo breakage/display-defect controversy and Samsung's reply ad.
- Classification 1 — this is product news. The cluster's two uncounted videos are KBS News and MTN (money-TV) clips, yet `isNewsEvent` is false and the type is "meme" at 85% confidence. The desk's "news / person event" rule (28 exclusions) should have caught it.
- Specificity 2 — a news topic; no mechanism; generic skit approach.
- Evidence 3 — verified statistics, 2 qualified, the 56% dominance is honestly flagged; but the timing text says "5 independent creators so far" and the facts say 3, and the category is "Entertainment" rather than Tech.
- Timing 2 — "emerging" while all three videos are 48–68 h old, the largest is at 0.3× its lifetime average and the trend-level coolingShare is 1.0. The label reflects when the radar first saw the cluster (8 h ago).
- Feasibility 3 — a tech-news skit is makeable; it is Korean-only and bound to a news cycle that is already cooling.
- Monetization 2 — boilerplate; Reels overstated; nothing about advertiser sensitivity of product-defect commentary.

**5. Upin Ipin** (event 70%, emerging, monitor, score 55)
- Relevance 2 — two of the three "independent creators" are the brand's own Malay and Indonesian channels ("Upin & Ipin Animation", "Upin & Ipin Indonesia") uploading the same 18-minute episode (Ketam Nipah / Kepiting Nipah, both 1,084 s); the third is a 13 s behind-the-scenes short. This is a studio's upload schedule for a copyrighted children's series.
- Classification 2 — "event (named episode)" is the system's nearest bucket; the right answer is "not a creator opportunity". "3 independent creators" is false in the sense that matters.
- Specificity 1 — nothing to make; the approach is a generic skit about someone else's IP.
- Evidence 2 — "3 qualified" is arithmetically true; independence and language ("latin" for Malay/Indonesian) are wrong; the episodes are 6.4 days old.
- Timing 1 — "emerging" for 6-day-old videos with zero new creators in 48 h.
- Feasibility 1 — the card's own `feasibleIn2h` is false (1.5–4 h) on a desk whose profile is ≤2 h; it should not be on the desk at all.
- Monetization 2 — long-form platforms are right for 18-minute content, but the eligibility lines are Shorts/TikTok boilerplate and there is no IP note.

### 2.3 Cross-cutting observations on the desk

- The desk's action ordering is sensible and nothing is padded: one participate, four monitors, no "create today" invented. The "nextCheck" lines are a good pattern.
- But for this owner the desk is close to empty. Four of five items have zero English/Spanish examples (the `nextCheck` of each says so); three are news, a studio trailer and a children's-TV brand. The only actionable item tells an experienced creator that Halloween is in three days.
- Two of the three "monitor" rationales are "One video carries the attention; watch whether other creators adopt it" — applied to a Marvel promo and a TV episode, where "other creators adopting it" would mean fan derivatives of someone else's IP.
- Fit scores are driven by category mapping, not by what the videos are: a live-action trailer gets fit 68 (via Film & Animation → Animation & Art) while the Korean title trope gets monetization suitability 82.
- Within-card inconsistencies: creator counts differ between `timingWhy` and `facts` (11 vs 3; 5 vs 3); "short-form examples (median 954s)"; channel size is never shown.

### 2.4 The lane ("Your lane this week")

| Pool | Creators / videos / qualified | Examples on-pool? | Sub-formats | Verdict |
|---|---|---|---|---|
| Comedy skits & sketches | 342 / 459 / 308 | Yes, but 3 of 4 are Hindi festival skits; top example is a 3D animation (Tillu ki 3D Pen, 72.9M) | `karwachauth` (7) — a festival, not a structure; `mbappe` (5) and `haaland` (4) — the same real format split in two | counts honest; sub-formats half junk, half gold |
| Animation shorts | 136 / 166 / 95 | Yes | `tf2` (6) — SFM/TF2 meme animations, real; `indian theft` (4) — Hindi GTA roleplay, 10–20 min; `mbappe` (3) | useful |
| Music videos | 111 / 120 / 32 | Official label MVs (LISA, K/DA) and a Shopee commercial ("no na x Shopee", language "es" — it is Indonesian) | `visualizer` (3) — a real format word | off-purpose for a solo creator |
| AI-generated video | 19 / 22 / 14 | 2 of 4 plausibly AI (KaelReelHouse, Little Together); "She made a huge comeback… #victoriasecret" reads as a runway clip; one 18.8K-view rejected video | none | the owner's core pool, and it says only "did not clear the desk gate (see the excluded reasons)" — with no reason attached |
| Storytime & narration | 13 / 15 / 10 | Yes — Nyx and Ollie (27.7M, 14.7M), Lila and Felix (53.8M), Cadel and Mia: the AI couple POV-storytime genre | none, although three share the `#pov #foryou #storytime #fyp` stack (two independent creators, below the ≥3 rule) | the most owner-relevant pool, presented as "no shared structure" |
| Covers & performances | 12 / 26 / 7 | 2 of 4 (a DJ mashup compilation and a game-cover clip are not covers) | none | weak |
| Animal comedy & dubbed animals | 21 / 28 / 6 | Two 4–6 s "Talking Tom" app clips are junk; signature is hashtags (`funnycats`, `catsoftiktok`) | none | weak |
| Short films | 8 / 9 / 5 | Mostly | none | fine |
| Puppet & character videos | 7 / 7 / 3 | A Korean 8.8M-view short of unknown content, a Jeff Dunham clip re-upload; signature is a person's name | none | weak |
| Explainers & edutainment | 5 / 6 / 1 | Yes ("NEW Mounts… Explained" is tagged `pt`; it is English) | none | fine |

Verdict: **useful, with reservations.** Counts are arithmetically honest at pool level. The lane is the only place in the product where opportunities that actually fit this owner appear — and it presents them as bare keywords without an action. The outstanding case: the **3D football-star parody short** (SWIFT X RELOAD 63.0M on a 37.7K-subscriber channel; oddlyokay 15.1M and 9.8M on 35.7K subs; Mischief Time 12.2M; H4X Studio 8.0M; BG5B 4.6M on 8.8K subs; ainimal-rescue-ai 4.1M and 3.2M; all English, 13–31 s, two new ≥3M hits in the last 27 h). It is AI/3D character animation, in the owner's language, in the owner's duration band, and it carries small channels to tens of millions of views — i.e. the format, not the channel, produces the reach. `desk.ts` contains a 4.0.1 rule to promote such a sub-format to a "research" item; it did not fire, and the data shows why: the examples' per-video `velocityRatio` is mostly 0.01–0.6 (each Short cools after two or three days), so the sub-format's timing resolves to "cooling" and is dropped — while fresh hits keep arriving. The system already recognises that "the format itself does not cool" for evergreen pools (line 404) but not for sub-formats. Also: "ZENTRO REACT Diaper Scout…" is a reaction re-upload counted as an independent TF2 adopter.

## 3. Part B — the feeds

### 3.1 Viral Now (72 h), top 10

Order is by `viralScore` (82 → 76), not by views (27.1M, 14.9M, 46.3M, 36.4M, 33.7M …); the section is titled "biggest". No duplicate ids or titles in the 40; no live streams in the top 10, but rank 13 is a 72-minute DAZN "Ballon d'Or Red Carpet Pre Show" (velocityRatio 0) — a broadcast recording in a feed that says streams are excluded. All 40 are `kind: established`, `band: high`, so neither field discriminates anything here.

| # | Entry | OK | Finding |
|---|---|:--:|---|
| 1 | JAI HIND OFFICIAL — Diwali village short, 27.1M, 47 h | yes | Numbers consistent (+2.6M/h = 4.54× lifetime, 257× creator median). 135 comments on 27.1M views (0.05 per 10K) is an anomalous profile; language "en" for a Hindi title. |
| 2 | "Valid crash out 😂", 14.9M, 24 h | yes | Verified, consistent; "Videos that make your day better" is a compilation/repost channel — not creator-original (unverifiable from titles). |
| 3 | India's Got Latent S2 EP8, 46.3M, 72 h, 50 min | yes | Legitimately the biggest video; a 12.1M-subscriber studio show, not organic creator virality. |
| 4 | The Waterfowl Sanctuary — swan, 36.4M | yes | Consistent; 159K-subscriber channel at 37× its median: a real outlier. |
| 5 | 7amoda Gaming (Arabic), 33.7M | yes | 16.2M-subscriber channel; 118 comments on 33.7M views. |
| 6 | Sassy — puppy rescue, 13.1M | yes | Consistent; rescue channels are often staged/repackaged — cannot verify. |
| 7 | Tech Master — iPhone DUO surprise, 6.6M | yes | 35.8M-subscriber channel (0.18× subs): a big-channel upload. Same subject as the desk's 아이폰 듀오 item but clustered as `m_twitter_facebook`. |
| 8 | Wynora — "Ronaldo is COME BACK… REAL GOAT?", 20.8M | **no** | Category "Animals & Pets": the keyword classifier read "GOAT" as an animal. Football fan edit (likely match footage), 1394× creator median. |
| 9 | Lyndice — squishy challenge (Indonesian), 13.5M | yes | Consistent; language "latin". |
| 10 | Nyx and Ollie — "WE PICKED OUR CAR KEYS…", 27.7M, 28 h | yes | Category "Music" is wrong (AI couple POV storytime). 32 comments and 364× the creator median on a 31K channel — comments likely disabled; the most owner-relevant video in the feed, unconnected to any desk item. |

Verdict: numerically trustworthy (floors, percentiles, measured-vs-lifetime all check out); one category error in the top 10; two "biggest" entries are mega-channel uploads and one is a likely repost; no ads or duplicates in the top 10; one broadcast stream further down.

### 3.2 Early Radar, top 10

All 40 entries are `kind: early`, `band: high`. Across the 40: 19 have `velocityRatio < 1`, 7 are older than 72 h, 5 are longer than 10 minutes, and the percentile ranks quoted in the cards' own reasons run from "top 8%" to "top 83%" (median ≈ top 45%).

| # | Entry | OK | Finding |
|---|---|:--:|---|
| 1 | JioHotstar Tamil — "HeartBeat Season 3… Promo 2", 524K, 4 h | **no** | A broadcaster promo from a 2.2M-subscriber corporate channel; not creator virality; category "Animation & Art". |
| 2 | Mlle Fantazia — "#pov : Tu veux te venger… (SPÉCIAL HALLOWEEN)", 898K, 20 h | yes | Below the 1.0M floor, 1.08× lifetime, 5.49× vs previous interval; fair. Language "latin" (French). |
| 3 | NaeroTL — "Comment Les Animaux Voient-Ils Le Monde ?", 593K, 23 h | **no** | 0.7× its lifetime average, "top 41%"; the breakout claim rests on a 2.99× jump against one 3 h interval. Language "en" (French). |
| 4 | Pierre Lefèvre — "Qui dessinera le meilleur visage de tigre", 1.8M, 65 h | yes | 95% of the 1.9M floor, 1.78× lifetime, 3.13× acceleration — consistent; "early" at three days is a stretch. |
| 5 | Alessandra Leaxel — French sketch, 725K, 45 h | **no** | 0.93× lifetime, acceleration 7.13 from a tiny previous interval, "top 53%". |
| 6 | Pappu Raj — comedy short, 1.3M, 70 h | yes | 933-subscriber channel, 1.4× lifetime: a genuine outlier (hashtag-spam title). |
| 7 | Frankys Odyssey — German animation, 557K, 26 h | yes | 1.69× lifetime, 1.73× acceleration, 9× subscribers — the cleanest early call here. |
| 8 | Adele Tsy — "POV : Quand tu te déguisais…", 820K, 42 h | **no** | 0.83× lifetime, acceleration 9.03 from near zero, "top 50%". |
| 9 | Frog McQueen — BeamNG "Lightning McQueen vs TOXIC ALIEN MONSTER TRUCK", 937K, 24 h, 24 min | **no** | Slowing on both measures (0.69× lifetime, 0.57× vs previous) yet "early breakout… still finding its pace"; kids-bait gaming video on a 369-subscriber channel (2539× subs). |
| 10 | Kidz TV Cartoon — 27-min nursery dance compilation, 614K, 54 h | **no** | 0 comments, 0.33% like rate: kids autoplay traffic; "top 59%". |

Verdict: 5 of 10 are not early breakouts by the feed's own numbers. The label is carried by the acceleration-vs-previous-interval ratio, which with ~3 h windows and a day-old index is noise-prone; the hit-floor logic is applied consistently, but "below the floor" plus "top 50% of its age cohort" is not "about to break out". Broadcaster promos and kids compilations are not filtered.

## 4. Part C — microtrend label validation

First 10 trends in file order per `opportunity.type` among trends with `opportunity` and `kind !== 'topic'`. Judged from titles, creators and the system's own features — this is about the opportunity type, not YouTube's uploader categories.

### Format (9 of 9)

| Trend | Label (conf.) | Verdict | Why |
|---|---|:--:|---|
| Black Cat | format (95) | disagree | Signature "black, national" = National Black Cat Day; evidence is a grab-bag (a kids story, a popcorn cat, an elders video, Thai). A calendar moment / uncertain. The same day is labelled "event" at topic level. |
| Animal comedy & dubbed animals | format (90) | unsure | The format is real and evergreen, but this week's cluster has titleShare 0, hashtag signature, coolingShare 1.0 and 2–3 of 6 examples on-format. |
| AI-generated video | format (90) | unsure | A medium, not a structure (the system's own "uncertain" wording); examples are AI-made but share nothing (kids skit, football parody, Diwali kitchen drama, K-pop fan edit). |
| Puppet & character videos | format (90) | disagree | One video holds 77% of views; evidence includes an ABC News clip and a Johnny Carson re-upload; signature is "jeff dunham". |
| Street interviews & vox pops | format (75) | agree | A real repeatable format; 3–4 of 5 examples on-format (one is a "cat interview"). |
| #시니어드라마 | format (80) | agree | Five Korean channels producing AI-virtual-person "senior short dramas" with twist endings — a genuine structure (and, incidentally, closer to this owner's craft than anything on the desk). |
| Cat videos | format (90) | disagree | A subject; isGeneric gates it, but the label is still "format" at 90%. |
| Covers & musical performances | format (90) | disagree | 1 of 4 shipped examples is a cover (the rest: a Tom & Jerry re-upload, a Telugu reaction, a hololive ARK stream). |
| Explainers & edutainment | format (80) | agree | Examples are explainers; evergreen format. |

Format: **3 agree, 4 disagree, 2 unsure** (33% agreement).

### Meme (2 of 2)

| Trend | Label | Verdict | Why |
|---|---|:--:|---|
| 생기는 일 | meme (70) | disagree | A generic title template ("what happens when X") across unrelated subjects; 3 of 7 videos are one creator. Fragment. |
| 아이폰 듀오 | meme (85) | disagree | Product-defect news with KBS and MTN clips in the cluster. Event (news). |

Meme: **0 agree, 2 disagree** (0%).

### Event (10 of 10)

| Trend | Label | Verdict | Why |
|---|---|:--:|---|
| Mass Effect | event (70) | agree | BioWare/EA news cycle. |
| #halloween | event (85) | agree | Calendar. |
| Modern Warfare | event (70) | agree | Call of Duty: Modern Warfare 4 release (trailer, reviews, let's-plays). |
| Free Fire | event (70) | agree | Free Fire India launch plus esports finals. |
| #highlights | event (70) | disagree | Serie A, cricket, a Klopp short, a Craftattack episode and the Free Fire launch are not one event — a broad tag. |
| #action | event (70) | unsure | The dominant content is the Dune: Part Three final trailer (event), but four of the "10 independent creators" are Warner Bros. regional channels and the cluster name is a hashtag. |
| Theft Auto | event (70) | disagree | "Indian Theft Auto Simulator" is a recurring GTA-roleplay comedy format with shared characters (Riya, Franklin, Jack) and a shared title template across 5–6 channels; nothing was released. Format. |
| Minecraft Mod | event (70) | disagree | Perennial game, no release; evidence includes "Birth to Death" videos (a known structure). Uncertain or format. |
| Steal Egg | event (70) | unsure | A Roblox game being covered by six channels; plausibly a launch wave, plausibly just a game topic. |
| Avengers Doomsday | event (70) | agree | Trailer release. (Trend-level category "Sports", via an MLB crossover video.) |

Event: **5 agree, 3 disagree, 2 unsure** (50%).

### Uncertain (10 of 10)

| Trend | Basis given | Verdict |
|---|---|:--:|
| #vtuber | long stream recordings | agree |
| #minivlog | broad tag | agree (a hashtag genre without a shared structure) |
| Subscribe Channel | description boilerplate | agree (junk, correctly not promoted) |
| #kitten | broad tag | agree |
| #food | broad tag | agree |
| #ゲーム実況 | long recordings | agree |
| #humor | broad tag | agree (category "Animals & Pets" is wrong, but the type is right) |
| #lucu | broad tag | agree |
| Funny Moments | title fragment | agree |
| #livestream | streams | agree |

Uncertain: **10 agree** (100%).

### Rates

| Type | Agree | Disagree | Unsure | Agreement |
|---|:--:|:--:|:--:|:--:|
| format | 3 | 4 | 2 | 33% |
| meme | 0 | 2 | 0 | 0% |
| event | 5 | 3 | 2 | 50% |
| uncertain | 10 | 0 | 0 | 100% |
| **overall** | **18** | **9** | **4** | **58.1% (18/31)** |

Excluding the "uncertain" bucket — which is essentially the reject bin and is trivially right — agreement on the three labels that drive the desk is 8/21 (38%).

Clearest misclassifications: 아이폰 듀오 (meme → news event), Black Cat (format at 95% → calendar/uncertain), Puppet & character videos (format at 90% → uncertain, 77% one video), Theft Auto (event → format), Minecraft Mod (event → uncertain/format), 생기는 일 (meme → fragment), #highlights (event → broad tag), Covers (format → uncertain this week), Cat videos (format → subject), Upin Ipin (event → a single IP owner's uploads).

## 5. Strengths

1. **Traceability.** Every desk and feed claim points at verified platform statistics with URLs, ages, the hours a velocity was measured over and the lifetime-vs-measured ratio; headline counts ("5 verified, 5 qualified, 4 others not counted") match the cluster exactly in every case I checked.
2. **Honest hedging.** "Provisional", "history 8h; measurements need 24h", "visual style not inspected", mid-size successes separated from qualified hits, dominance cautions ("56% of views is one video"), "an average, not a measured rate".
3. **A strict funnel that does not pad.** 310 of 316 clusters rejected with stated reasons; the uncertain bucket agrees 10/10; news, streams, fragments and generic tags mostly stay off the desk; five items, one actionable, no invented "create today".
4. **nextCheck on monitored items** — the right decision-support pattern, and each one is specific (more creators, EN/ES examples, 24 h of history).
5. **Calendar handling** — countdown, "attention collapses after the date", "one original piece, not a series": correct and useful.
6. **The lane's sub-format extraction works** where the clustering fails: it found the 3D football parody, TF2 SFM memes and visualizers from titles alone. The Viral Now numbers (floors, percentiles, measured vs lifetime) are internally consistent.

## 6. Weaknesses (blunt)

1. **The desk is empty for this owner.** The only actionable item says Halloween is in three days. The other four are Korean, Malay or Hindi topics with no English/Spanish example, and three of them are news, a studio trailer and a children's-TV brand — not formats anyone can repeat.
2. **The best opportunity in the data is invisible.** 3D football-star parody shorts — six creators, 63M / 15M / 12M / 9.8M / 8M / 4.6M / 4.1M / 3.2M views, English, 13–31 s, three of the six creators on channels under 40K subscribers, two new ≥3M hits in 27 h — exist in the index as `trends: []` and reach the owner only as the lane keywords "mbappe" and "haaland". The promotion rule that exists for this case is defeated by its own timing gate: every individual Short cools, so the format reads as "cooling" while fresh hits keep arriving.
3. **Timing labels are artefacts of the radar's age.** The whole index was first observed today; every cluster is "first seen 1–9h ago"; "emerging" is stamped on 6-day-old episodes and 2–3-day-old news; most real formats have trend-level coolingShare ≥ 0.8, so the "cooling → skip" gate leaves calendar events and freshly detected foreign clusters.
4. **Type classification fails outside the reject bin.** 58% agreement overall; 0/2 memes (a news story and a title fragment); 3/9 formats (a calendar day at 95%, a one-video cluster at 90%, subjects as formats). Brand and studio channels count as independent creators (Marvel India; two Upin & Ipin channels; four Warner Bros. regional channels).
5. **Briefs are templates with the name substituted.** Always Character-led; Levels or Reversal by a hook flag; Song/Explainer/Mashup by another. For Halloween, "Music-led examples" is false (0 of 5) and "mostly episodic" rests on 1 of 5; six of eight steps repeat verbatim; TikTok Creator Rewards (≥1 min) is listed against a 21–39 s target; nothing in any brief reflects what the five examples actually are.
6. **Early Radar is half noise.** 5 of the top 10 are below their own lifetime average with age-percentiles of "top 36–59%", carried by an acceleration ratio computed from ~3 h windows; the list includes a broadcaster promo and two kids-autoplay compilations; 19 of 40 entries have velocityRatio < 1.
7. **Classifier errors visible from titles alone.** "GOAT" → Animals & Pets; an AI POV storytime short → Music; Film & Animation → "Animation & Art" (which makes a live-action Marvel trailer the top "fit"); French → "latin"/"en"; Malay/Indonesian → "latin"; a Hindi title → "en"; #humor → Animals & Pets.
8. **Monetization is boilerplate.** Instagram Reels has no general ad-revenue share; Shorts/TikTok eligibility lines are pasted onto an 18-minute long-form item; no IP/Content-ID risk line for Marvel or Upin & Ipin; "suitability 82" next to "fit 35" is unexplained; "affiliate links" appears on three items and not on two with no stated reason.
9. **Card hygiene.** Creator counts differ inside one card (11 vs 3; 5 vs 3); "short-form examples (median 954s)"; subscriber counts never shown although three of five Halloween examples are 1.1M–14M-subscriber channels; the lane says "see the excluded reasons" but no reason is attached to a pool; 316 considered vs 315 accounted; a 72-minute broadcast stream at rank 13 of a feed that excludes streams.

## 7. The five highest-impact fixes, in order

1. **Let formats reach the desk, and stop measuring a format by its videos' cooling.** Promote lane sub-formats (merge overlapping ones such as mbappe/haaland) to "research" or "create today" when they have ≥4 independent creators, ≥2 qualified hits, short-form and ≥50% EN/ES; define format freshness as the flow of new independent hits (e.g. ≥2 qualified examples younger than 72 h from different channels), not the per-video `velocityRatio`. Today this alone would have put the 3D football parody at the top of the desk.
2. **Fix type, news and independence rules.** Any broadcaster/news channel in the clean set → news event (excluded); channels sharing an owner, brand or studio → one creator, plus an "IP-owned entity: derivative risk" flag that lowers fit (Marvel, Upin & Ipin, Warner Bros.); phrase clusters whose examples span unrelated subjects → fragment (생기는 일); calendar names → event regardless of adoption (Black Cat).
3. **Base timing on content, not on the radar's clock.** "Emerging" only when the clean examples are young and new creators appeared in 48 h; show acceleration vs the previous interval next to the lifetime ratio on every card; for Early Radar require `velocityRatio ≥ 1` or an age-percentile ≤ 25%, and exclude broadcaster promos, kids compilations (>10 min with ~0 comments) and stream recordings from both feeds.
4. **Generate briefs from observed sub-mechanisms.** Derive the three variations from what the clean examples share (for Halloween: costume ranking "Part N", pet costume, SFX fail) instead of fixed character/levels/song templates; claim a hook ("music-led", "mostly episodic") only when ≥50% of clean examples carry it; de-duplicate steps; make the TikTok ≥1 min line conditional on the suggested duration; add an IP line when the entity is a brand.
5. **Clean the cards and the classifiers.** One creator count per card; fix "short-form (median 954s)"; show subscriber count and EN/ES share on every evidence row; attach the per-pool exclusion reason in the lane; log per-category-cap drops in `excluded`; fix the keyword category mapping (GOAT; Film & Animation → Animation & Art) and language detection (fr, ms/id, hi).

---
*Judged from the snapshot's own data (titles, creators, statistics, dates, categories, reasons) without watching any video and without network access to the platforms. No copyrighted content is reproduced; titles are quoted only as identifiers.*
