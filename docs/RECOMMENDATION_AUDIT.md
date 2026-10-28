# Recommendation Audit — Viral Radar 4.0

**Snapshot audited:** `runId 202610281124_b061055c328d`, `generatedAt 2026-10-28T11:25:19.027Z` (`data/latest.json`); briefs from the same run (`data/qa/briefs.json`).
**Audit date:** 2026-10-28. **Auditor:** independent reviewer who did not build the system. Machine-readable scores: `data/benchmark/audit-4.0.json`.

**Bottom line.** The Creator Desk averages **2.45 / 5** across eight opportunities and eight rubric dimensions. The one calendar event ("halloween") is handled well (3.5); two desk items are not opportunities at all ("spiderman" 1.5, "vtuber" 1.5). Microtrend type labels agree with the evidence in **45 %** of the 40 sampled trends (18 agree, 16 disagree, 6 unsure), and only **30 %** when the "uncertain" bucket, which mostly flags junk correctly, is set aside: 1 of 10 "meme" labels holds. The root causes are upstream of the desk: cluster membership is keyword matching on descriptions, and "measured growth" measures the crawler, not creators.

---

## 1. Method and limits (read first)

**What was examined.** `desk.opportunities` (8 items, dimensions 1–8, with `data/qa/briefs.json` for 6–8); the top 10 of `videos.viralNow['72h']` and of `videos.earlyRadar` (dimensions 1, 4, 5); the first 10 trends per opportunity type (format / meme / event / uncertain) among `trends[]` entries with an `opportunity` and `kind !== 'topic'`, in file order. To check the system's growth and timing claims I also read `data/history/scores/2026-10-28.ndjson` (the run-by-run score history) and, read-only, `docs/SCORING.md` and `pipeline/src/intel/score.ts`. No pipeline code was run or modified; no file other than the two outputs was changed.

**What I could not do.** I had **no network access to any video platform**. Every judgement below is made from what the system itself exposes: titles, creators, platform categories, durations, view/like/comment counts, publish dates, measured velocities, states and the system's own `reasons`/`basis` text. I did not watch a single video. That cuts both ways: a hashtag-stuffed title can hide a genuine example, and a plausible title can hide a repost. Where the call depends on something only the video would show, I say "unsure".

**Scale.** Each dimension is scored 1 (fails) to 5 (excellent). For label validation: *agree* = the label fits both the trend's name and the evidence shown; *unsure* = the name fits but the evidence does not demonstrate it, or the case is genuinely ambiguous; *disagree* = another label clearly fits better. This is about the system's own opportunity types, not YouTube's uploader categories (which are shown as `platformCategory` and are often wrong in their own right, e.g. a Vernix caseosa explainer in "Education" is fine, but "Avengers Doomsday" in Sports/Baseball is not).

**Context that limits every finding.** The snapshot's entire score history spans about ten hours (first run 01:23 UTC, last 11:25 UTC the same day). Every "measured growth over 2.5h" claim rests on that. The prediction scorecard has 73 predictions, **0 evaluated**, and 0 of 12 observed hit-floor crossings predicted in advance. So this audit can say whether recommendations are internally consistent and supported by their evidence; it cannot say whether any of them *worked*. Platform-policy statements are judged against public policy as I know it on the audit date; verify before relying on them.

---

## 2. Creator Desk (A) — per-item scores

Dimensions: 1 relevance of evidence videos · 2 accuracy of type label · 3 specificity · 4 quality of evidence · 5 timing/action consistency · 6 production feasibility (≤ 2 h, AI/animation/editing/music) · 7 originality of the three briefs · 8 monetization realism.

| # | Opportunity | Type (conf.) | Timing → action | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Avg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Covers & musical performances | format (90) | established → create_today | 2 | 3 | 2 | 2 | 3 | 2 | 2 | 2 | **2.25** |
| 2 | Storytime & narration | format (86) | established → create_today | 2 | 3 | 3 | 2 | 3 | 4 | 2 | 3 | **2.75** |
| 3 | spiderman | format (77) | accelerating → create_today | 2 | 1 | 1 | 1 | 1 | 3 | 1 | 2 | **1.50** |
| 4 | halloween | event (85) | peaking → participate | 5 | 5 | 2 | 4 | 3 | 4 | 2 | 3 | **3.50** |
| 5 | Iphone Duo | format (95) | peaking → participate | 5 | 1 | 2 | 3 | 3 | 3 | 2 | 3 | **2.75** |
| 6 | vtuber | meme (90) | emerging → research | 2 | 1 | 1 | 1 | 2 | 2 | 1 | 2 | **1.50** |
| 7 | Cooking & recipes | format (90) | established → research | 2 | 3 | 1 | 2 | 3 | 3 | 2 | 3 | **2.38** |
| 8 | Explainers & edutainment | format (80) | established → research | 4 | 4 | 2 | 2 | 3 | 4 | 2 | 3 | **3.00** |
| | **Dimension average** | | | **3.00** | **2.63** | **1.75** | **2.13** | **2.63** | **3.13** | **1.75** | **2.63** | **2.45** |

### Per-item justifications

**1. Covers & musical performances (2.25).**
- *Relevance 2.* Of six evidence videos, one is a cover ("AURORA – Runaway (Cover Version)"), one is a "female version" of a song, one is an official live music video; the other three are a Tom and Jerry cat clip (in the cluster because its description carries `#dancecover`), a Telugu film-news reaction short and a six-minute TikTok dance mashup whose state is `rejected`.
- *Classification 3.* Covers are a real evergreen format, but the Trends layer marks this cluster `qualified: false, isGeneric: true`; "format (90)" is confidence in a contaminated cluster.
- *Specificity 2.* The only signature word is "version"; the approach is "original music or an original parody track".
- *Evidence 2.* `evidenceScore 96` for an unqualified cluster; "Best example: 2.4M views" while a 9.8M-view video sits in the same evidence list; language counts cover 16 of 44 videos; growth 1.074× is crawl-based (see §3 note on growth).
- *Timing 3.* "Established" is honest for an evergreen; the Trends view calls the same cluster "peaking".
- *Feasibility 2.* `production.feasibleIn2h = false` (1.5–4 h, median example 344 s) yet the action is **create_today** and `actionWhy` says it "fits 1.5–4h" — outside the owner's window. The "Original track" brief says 2.5–5 h.
- *Originality 2.* Three templates with the name substituted; "An original song about a cover performance"; title idea "the a cover performance song"; the beat structure ends at ~20 s against a 241–447 s target.
- *Monetization 2.* The format is covers but the approach says "no copyrighted audio" and nothing mentions mechanical/cover licensing or publisher Content ID claims — the one revenue issue that defines covers. Eligibility boilerplate is accurate.

**2. Storytime & narration (2.75).**
- *Relevance 2.* Two of six from the same creator (Nyx and Ollie: couple "we picked our keys" pranks tagged `#storytime`), a "who wants a story time?" nostalgia clip, a FIFA rewards video (`rejected`), a pennies prank and a sibling-pickup prank. At most one or two are narrated stories; `#storytime` is being used as a reach tag.
- *Classification 3.* Storytime is a genuine format; cluster is hashtag-driven; `qualified: false, isGeneric: true`.
- *Specificity 3.* "A short scripted story with a voiceover" is at least a concrete mechanism.
- *Evidence 2.* "16 independent creators" headline vs. duplicate creator in the evidence; `evidenceScore 95`; growth exactly 1.0 ("measured").
- *Timing 3.* Established/evergreen is defensible; the +1.5M/h measured top example is real.
- *Feasibility 4.* A 30–120 s scripted story with AI visuals and voiceover is realistic in 2 h.
- *Originality 2.* Templates; hook text is broken ("the character mid-action with the a told story with a narrator stated in on-screen text").
- *Monetization 3.* Accurate Shorts/TikTok boilerplate; nothing format-specific.

**3. spiderman (1.50).**
- *Relevance 2.* As a topic, 3 of 4 mention Spider-Man (a GTA 5 "find a spider" challenge, a movie edit, a 75-minute BeamNG ride that is `rejected`); the fourth is a Thor/Mjolnir short. As a *format*, nothing is shared.
- *Classification 1.* An IP hashtag labelled "format (77)". The basis text "several independent creators keep producing it with a shared, recognisable structure" is false; the "signature" is the words *spider* and *man*.
- *Specificity 1.* Names a franchise, not a mechanism.
- *Evidence 1.* 4 videos, 4 creators, 53 % dominance, one rejected; `evidenceScore 70`.
- *Timing 1.* "Accelerating 1.333× over 2.5h" is 3 → 4 creators *discovered* between runs (history: adoption 3 from 07:08 to 10:58, 4 at 11:25). `create_today` on four unrelated videos.
- *Feasibility 3.* An AI skit is producible in 2 h, but there is no format to vary.
- *Originality 1.* "Spiderman, but it's a nature documentary"; caption "#spider #man #spiderman".
- *Monetization 2.* No mention that Spider-Man is Marvel/Sony IP — a direct conflict with the owner's "original, repeatable formats" goal and with YouTube's reuse policy that the same block quotes.

**4. halloween (3.50) — the best item.**
- *Relevance 5.* All six evidence videos are Halloween content (costumes, a cat costume, SFX makeup, party decor, costume rankings, a prank) from six creators; Google Trends corroborates.
- *Classification 5.* Calendar event: correct.
- *Specificity 2.* "Do a Halloween piece" is the whole recommendation. The evidence actually contains nameable sub-formats — "Ranking the best Halloween costume … Part 2/Part 7", pet costumes, SFX fails — none is named.
- *Evidence 4.* Six independent creators, recent, verified; one `rejected`.
- *Timing 3.* "Peaking" on Oct 28 for an Oct 31 event is premature; `caution` is `undefined`, so no deadline is shown. "One original piece on the day, not a series" is good advice.
- *Feasibility 4.* A 30–50 s short is feasible; but the cluster's category is **Music** (no music in the evidence), so the production approach is "original music or an original parody track".
- *Originality 2.* Templates; "Halloween, levels 1 to 5" is at least usable.
- *Monetization 3.* Boilerplate plus "streams of the original track" inherited from the wrong category; nothing about the window closing Nov 1.

**5. Iphone Duo (2.75).**
- *Relevance 5.* All six are about the product.
- *Classification 1.* A product-launch news moment covered by hardware reviewers (durability test, case review, camera comparison, "6 ways Samsung Fold beats…", a sandwich gag) labelled "format" at the desk's highest confidence (95). No shared structure exists.
- *Specificity 2.* Names a product.
- *Evidence 3.* 3 of 6 evidence videos are one creator (CarterPCs); the rest are mega-channels (JerryRigEverything, Mrwhosetheboss) — real hits, not comparable to a solo AI creator.
- *Timing 3.* "Crowded and flat → participate only with a sharp angle" is honest.
- *Feasibility 3.* The evidence is hands-on hardware content an AI creator cannot replicate; only the "Explainer as a skit" variation makes sense.
- *Originality 2.* "Iphone duo — with the opposite ending".
- *Monetization 3.* Affiliate links fit tech; suitability 80 is a category profile, not evidence.

**6. vtuber (1.50).**
- *Relevance 2.* All six evidence videos are 2–5 hour Hololive live-stream recordings of the "ホロ鯖ARK" server event; every one is `state: rejected` (stream > 3 h rule). The Korone "Japanese Ramen Simulator" stream is also listed under *Cooking*.
- *Classification 1.* An organised agency event labelled "meme (90)"; "18 independent creators" are talents of one agency.
- *Specificity 1.* "vtuber" is a medium; the suggested approach ignores it.
- *Evidence 1.* `evidenceScore 96` built entirely on rejected streams; "16 new creators in 48 h" is one crawl step (history: adoption 5 → 18 between the 05:19 and 05:27 runs); `liveShare 0` although every example is a stream.
- *Timing 2.* "Emerging" matches a stream event starting; "memes decay fast" is the wrong frame; the correct call was skip/exclude.
- *Feasibility 2.* Marked not feasible, yet the brief targets a **5818–10804 s** video with a 20-second beat structure.
- *Originality 1.* "Vtuber — in the wrong world" with hashtags `#ホロライフ #ホロ鯖ark` for an English/Spanish creator.
- *Monetization 2.* Watch-page ads on two-hour videos by template; suitability 75; nothing on agency IP. Zero en/es evidence, fit 42 — and it still outranks Cooking and Explainers.

**7. Cooking & recipes (2.38).**
- *Relevance 2.* Two of six are cooking (an AI "dogs cook dinner" story — the single most owner-relevant example in the desk — and a Kaju Katli recipe drama); the rest are `#cooking`-tagged family vlogs, a cat/popcorn clip and the Korone game stream. In the Trends view the same cluster's top evidence includes "Incredible ideas for Halloween!" and a shipping-container home.
- *Classification 3.* Real evergreen format, contaminated cluster, `qualified: false, isGeneric: true`.
- *Specificity 1.* `signature: []` — no mechanism; the approach is the generic "AI character skit".
- *Evidence 2.* "65 independent creators" but 2 of 6 shown are on topic; `evidenceScore 96`; language counts cover 16 of 66.
- *Timing 3.* Evergreen/established is honest.
- *Feasibility 3.* An AI-character recipe skit is feasible; "research" is the right action, for the wrong reasons.
- *Originality 2.* Templates; the brief invents "a 60-second recipe" (the examples' median is 71 s).
- *Monetization 3.* Boilerplate + affiliate; suitability 82 is the desk's highest, on no evidence.

**8. Explainers & edutainment (3.00).**
- *Relevance 4.* Five of six are explainers (Vernix caseosa, WoW mounts, USB-C cable, police ranks, a video essay); one Arabic "did you know" cat clip is borderline.
- *Classification 4.* Explainer is a format with a visible signature ("explained"); `qualified: false, isGeneric: true` though.
- *Specificity 2.* Nothing beyond "explained"; the brief invents "a 45-second explainer" with a 123–229 s duration.
- *Evidence 2.* Four of six evidence videos are `rejected` (below viral thresholds) including the "best example 1.7M views"; `evidenceScore 93`; an English WoW title is tagged language "pt".
- *Timing 3.* Established is honest.
- *Feasibility 4.* One of the most realistic formats for an AI/character creator in ≤ 2 h.
- *Originality 2.* "A 45-second explainer — with the opposite ending" and "— in the wrong world" do not fit an explainer; the explainer-specific template ("Explainer as a skit") is used on iPhone Duo instead of here.
- *Monetization 3.* Boilerplate; the "educational framing widens the advertiser-friendly range" note appears only in the iPhone brief.

### Cross-cutting facts behind the desk scores

- 4 of 8 desk opportunities come from clusters the Trends layer itself marks `qualified: false, isGeneric: true` (covers, storytime, cooking, explainers).
- 15 of 46 desk evidence videos (33 %) are `state: rejected`; 4 are recordings longer than three hours; 15 are longer than 180 s.
- 27 of 46 desk evidence videos are labelled en/es (0 of 6 for vtuber, 2 of 6 for cooking and explainers) for an en/es creator.
- One video (Korone's ramen stream) is evidence for two different opportunities.
- `desk.excluded` is absent from this snapshot (`desk.considered = 307`), so the reasons the other 299 clusters were dropped cannot be audited.
- Desk timing ("established") and Trends lifecycle ("peaking") disagree for the same clusters; in the ten-hour history the lifecycle of single clusters flips between breaking_out / accelerating / peaking / cooling from one run to the next (e.g. Iphone Duo: peaking → cooling → peaking → accelerating → peaking).

**"Measured growth" is crawl growth.** `score.ts` compares the cluster's creator count with the same window at an earlier run (≥ 2 h apart). The history shows what that measures: Black Cat sat at 39–40 creators for six hours (04:59–10:58) and jumped to 61 in the final run (evidence 50 → 76), reported as "1.525× over 2.5h — accelerating"; vtuber went 5 → 18 in one eight-minute step when the ARK streams were discovered, reported as "16 new creators in 48h"; cooking went 12 → 65 across the morning as discovery widened; spiderman went 3 → 4 and became "accelerating". With a ten-hour history, almost every "measured" growth figure in the desk is the crawler finding older videos, not creators adopting anything.

---

## 3. Feeds (B)

### Viral Now — 72 h, top 10

| # | Video (creator) | Age | Views | OK? | Finding |
|---|---|---|---|---|---|
| 1 | "Diwali Ki Rat Do Logon Ki 3 Parchhaiyan…" (JAI HIND OFFICIAL) | 45 h | 23.9M | no | 127 comments on 23.9M views (0.0005 %), engagementScore 8; romanised Hindi labelled "en". Real measured +2.6M/h, but an engagement anomaly the paid-reach rule does not catch (likes 0.67 % pass it). |
| 2 | "INDIA'S GOT LATENT S2 EP8" (Samay Raina) | 70 h | 45.8M | yes | Organic, but a 50-minute episode from a 12.1M-sub channel at 3.8× subs; measured rate 0.42× lifetime (decelerating) while the card says "accelerating vs the previous interval". |
| 3 | "I removed this from the swan's throat" (The Waterfowl Sanctuary) | 60 h | 35.5M | yes | Genuine hit, 36× creator baseline. |
| 4 | "ازاااي بوبا الاوريو" (7amoda Gaming) | 68 h | 32.4M | no | 16.2M-sub channel at 2× subs; 110 comments on 32.4M views (0.0003 %): comment-restricted/anomalous; Arabic. |
| 5 | "Valid crash out" (Videos that make your day better) | 22 h | 13.6M | yes | Organic numbers (3.9 % likes), but the channel name signals a compilation/repost account; no reused-content flag exists. |
| 6 | "#gta #gta6 #shorts" (GTA6-罪恶都市) | 69 h | 41.0M | no | Same channel as #9 with the identical hashtag-only title; **no measured velocity** (band medium, breakoutScore 20) yet in Viral Now; 425 comments. A clip farm, not a trend. |
| 7 | "when your glass breaks but LISA is playing" (vivivibes) | 20 h | 33.7M | yes | Genuine (929× creator baseline), but a K-pop fan edit on copyrighted audio/footage — not a reach model a creator can copy legitimately. |
| 8 | "Hero Climbs Down A Bridge To Save A Stranded Puppy" (Sassy) | 42 h | 12.7M | yes | Organic engagement (22K comments); very likely a reposted news/rescue clip from a 1.7M-sub aggregator. |
| 9 | "#gta #gta6 #shorts" (GTA6-罪恶都市) | 71 h | 45.0M | no | Duplicate creator/title of #6; 72 comments on 45M views (0.0002 %). |
| 10 | "iPhone DUO से पूरी Team को दिया Surprise!" (Tech Master) | 21 h | 5.3M | yes | 35.8M-sub channel at **0.15× its subscribers**: a normal upload for the channel. Fine as "biggest videos", misleading as a trend signal. |

**Findings.** Six of ten pass as organic virality, four do not (two duplicate farm uploads, two engagement anomalies). No ads, live streams or news clips in the top 10 — the stream/duplicate rejection rules work at the video level — but the feed is a list of absolute view counts dominated by mega-channels and non-en/es content (languages across the 40: en 17, "latin" 13, hi 3, zh 2, pt 2, ar/vi/other 3). "Top 1 % of tracked videos of similar age" is relative to the system's own tracked set. The per-card reasons are the best part of the product: measured vs lifetime rates are separated and labelled honestly.

### Early Radar — top 10

| # | Video (creator) | Age | Views / floor | OK? | Finding |
|---|---|---|---|---|---|
| 1 | "#lol #funny #meme #viral #fyp #100kview…" (POMIEE ♡) | 20 h | 394K / 1.0M | no | Hashtag-only title, likes hidden, engagementScore 0, likely a reposted anime clip; the card itself says "top 47 % of similar age" (median). |
| 2 | "後ろにトラック来てる!!" (yoosomchi) | 77 h | 1.3M / 2.1M | yes | Plausible late riser (2.4× lifetime), but "early" at three days is a stretch; no acceleration measured. |
| 3 | "Radha & Krishna: The Funny Fair Puppet Dance Fight" (Prabhu Darshan) | 16 h | 277K / 1.0M | no | 2 comments, 0.52 % likes, engagementScore 1 on a 10-second clip: engagement far below organic. |
| 4 | "#Pappuraj #comedy video#short video…" (Pappu Raj) | 68 h | 1.3M / 1.9M | yes | 933-subscriber channel at 1.3M (1133× baseline): a real creator outlier; romanised Hindi labelled "latin". |
| 5 | "Zuhause läuft das eben anders..." (Frankys Odyssey) | 24 h | 515K / 1.0M | yes | The best early call in the sample: accelerating 1.73×, 8.5× subs, Animation & Art — and the only top-10 entry relevant to an animation creator. |
| 6 | "賢いリスも突破できない「回転装置」の秘密" (となりのママ) | 133 h | 2.6M / 2.7M | no | 5.6 days old, 100K views short of the floor: a near-hit about to cross, not "early". |
| 7 | "Epic Escape Lightning McQueen vs TOXIC ALIEN MONSTER TRUCK in BeamNG" (Frog McQueen) | 23 h | 899K / 1.0M | no | Measured rate 0.67× lifetime and **slowing** (0.57×) while the reason says "the measured rate is abnormal"; a 24-minute kids-bait upload from a 369-sub channel, kept by the creator-outlier rule alone. |
| 8 | "Dudi Dudi Dum Dum Dance… Kids & Babies" (Kidz TV Cartoon) | 52 h | 580K / 1.6M | no | Made-for-kids 27-minute nursery video, 0 comments, 0.35 % likes, engagementScore 0: not organic creator virality and monetised differently. |
| 9 | "MISSION : BHAUCHA DHAKKA — Official Trailer" (Atelier Filmz) | 42 h | 512K / 1.4M | no | An official film trailer is a promotional release, not organic early virality; should be excluded like premieres. |
| 10 | "Wer kann mit 20€ das SCHÖNERE Trikot bauen?" (Romeo439_rssl) | 47 h | 843K / 1.5M | yes | Plausible, but the velocity signals contradict: 0.48× lifetime yet "accelerating 5.26×" from one short interval. |

**Findings.** Four of ten are credible early signals; six are not (hashtag spam, two engagement-dead clips, a kids-content farm, a trailer, a near-hit). "Early" is not reliably early: 15 of the 40 entries are older than 72 h and one ("ADELINE – I Am The Rise (Official Remix)") is **289 h (12 days) old** and still `kind: early`, although `docs/SCORING.md` defines early as age ≤ 7 d. Several entries combine a measured rate below the lifetime average with a large "acceleration" ratio (#34: 0.34× lifetime, 6.1× acceleration) — the acceleration guard (≥ 1,000 views per interval) is too weak against short intervals. Only 3 of the top 10 are en/es; 13 of 40 are "Other" category. The Early Radar is where the product's value should be, and it is the noisier of the two feeds.

---

## 4. Microtrend label validation (C)

First 10 trends per opportunity type among `trends[]` with an `opportunity` and `kind !== 'topic'`, in file order. Judged on the trend's name, `opportunity.basis[]` and the evidence titles/creators. (`shouldBe` is my best alternative; see `data/benchmark/audit-4.0.json → labels.items` for the full reasoning per item.)

### format (agree 3 · disagree 3 · unsure 4)

| Trend | Label | Verdict | Should be | Why |
|---|---|---|---|---|
| Animal comedy & dubbed animals | format (90) | unsure | format (name) / unsupported | Evidence is hashtag spam: a 6.5 h "Talking Tom Cat 2 live" game stream, a bichon haircut, a drawing video tagged #Catsoftiktok. |
| 생기는 일 | format (87) | agree | format | A real Korean title template ("…하면 생기는 일" — "what happens when…") reused by 4 creators (4 of 7 videos are one creator). |
| Iphone Duo | format (95) | disagree | event / topic | Product-launch coverage; no shared structure; the "shared, recognisable structure" basis is false. |
| Street interviews & vox pops | format (75) | agree | format | 3 of 5 are street interviews, but with 1K–11K views and two Bluesky text posts "independent adoption" is not shown. |
| #spiderman | format (77) | disagree | topic / uncertain | IP hashtag: GTA challenge, movie edit, 75-min BeamNG, a Thor short. |
| #시니어드라마 | format (80) | agree | format | Korean AI "senior short drama": 5 creators, shared revenge/twist structure, 60–140 s. |
| Cooking & recipes | format (90) | unsure | format (name) / unsupported | 1 of 4 shown examples is cooking; "Incredible ideas for Halloween!" and a container home are in the list. |
| Covers & musical performances | format (90) | unsure | format (name) / unsupported | 1 of 4 is a cover; a Tom and Jerry clip, a Hololive stream and a Telugu news reaction are members. |
| Gaming clips & streams | format (90) | disagree | uncertain (category) | A category, not a reusable structure; evidence is Roblox, a Sonic animation and two GTA V live streams. |
| Storytime & narration | format (86) | unsure | format (name) / unsupported | Couple pranks tagged #storytime, a pennies prank, a sibling prank. |

### meme (agree 1 · disagree 9 · unsure 0)

| Trend | Label | Verdict | Should be | Why |
|---|---|---|---|---|
| #vtuber | meme (90) | disagree | event / topic | Hololive "ホロ鯖ARK" server-event streams from one agency, 2–5 h each, all rejected as streams. |
| #acousticcover | meme (65) | disagree | format / uncertain | 5 of 7 shown are the same Roohani Dhun upload re-posted under identical titles; a genre tag. |
| #furry | meme (85) | disagree | uncertain / topic | Community hashtag, 3K–11K-view shorts and two Bluesky posts; nothing viral or shared. |
| Chemical Plant | meme (85) | disagree | **event (news)** | Four Bluesky OSINT posts about a strike on a Russian chemical plant; `isNewsEvent: false` is also wrong. |
| #cinema | meme (65) | disagree | format / uncertain | 4 of 6 are one creator's Spanish movie-recap series. |
| #gta6 | meme (70) | disagree | topic | One Chinese channel's "#gta #gta6 #shorts" uploads plus unrelated podcasts. |
| #reaction | meme (65) | disagree | uncertain | German reaction shorts and two 24-minute videos; the tag is the only link. |
| #laugh | meme (65) | disagree | uncertain | Four unrelated funny videos; "0 new creators in 48h" contradicts the meme basis itself. |
| #neon | meme (65) | agree | meme | A K-pop dance challenge ("NEON 챌린지") with choreographer/idol participation. |
| #리트리버 | meme (70) | disagree | uncertain / topic | Dog clips and a kitten video; a subject tag. |

### event (agree 5 · disagree 4 · unsure 1)

| Trend | Label | Verdict | Should be | Why |
|---|---|---|---|---|
| Mass Effect | event (70) | agree | event | BioWare/EA news cycle across 54 creators in 34 h. |
| #halloween | event (85) | agree | event | Calendar moment, corroborated by Google Trends. |
| Free Fire | event (70) | agree | event | Free Fire India relaunch moment (finals, "coming", official "IS HERE"); two examples are multi-hour streams. |
| Get Ready | event (70) | disagree | none (merged phrase) | A Honey Singh song, a Bigg Boss promo, a game trailer, cricket commentary, a Salman Khan clip; `titleShare 0`. |
| Theft Auto | event (70) | disagree | **format** | "Indian Theft Auto Simulator" gameplay skits with a repeated title template across creators — a reused structure, not a release. |
| Minecraft Mod | event (70) | disagree | topic / uncertain | Generic Minecraft content; no release or moment. |
| Join Discord | event (70) | disagree | none (boilerplate) | GTA6, Minecraft, Skibidi, Ludwig, Hermitcraft; the basis is "Gaming = news-style content". |
| Steal Egg | event (70) | unsure | topic (event if just launched) | Roblox "Steal an Egg" videos; launch timing cannot be told from titles; one example is about Roblox Rivals. |
| Avengers Doomsday | event (70) | agree | event | The "Special Look" trailer drop; category "Sports / Baseball" is wrong (an MLB crossover clip). |
| Modern Warfare | event (70) | agree | event | Call of Duty: Modern Warfare 4 launch/reviews inside 14 h. |

### uncertain (agree 9 · disagree 0 · unsure 1)

| Trend | Label | Verdict | Should be | Why |
|---|---|---|---|---|
| Black Cat | uncertain (75) | agree | uncertain (exclude) | Merged "national black cat [day]" phrase from descriptions; videos are unrelated AI animal stories. |
| AI-generated video | uncertain (75) | agree | uncertain — but the most owner-relevant cluster | A medium, not a structure; yet its evidence (AI shorts at 5–35M views, 28 creators) is the closest match to the owner's profile and never reaches the desk. |
| #minivlog | uncertain (70) | unsure | format or uncertain | Mini-vlog is arguably a format; 13 creators of consistent family-vlog shorts. |
| #kitten | uncertain (70) | agree | uncertain | Subject tag; includes non-kitten videos. |
| Fair Use | uncertain (75) | agree | uncertain (exclude) | Description boilerplate; `titleShare 0`. |
| #food | uncertain (70) | agree | uncertain | Subject tag. |
| #lucu | uncertain (70) | agree | uncertain | Generic Indonesian "funny" tag. |
| Auto Generated | uncertain (75) | agree | uncertain (exclude) | "Auto-generated by YouTube" Topic channels — label releases, not creators. |
| Subscribe Channel | uncertain (75) | agree | uncertain (exclude) | Boilerplate: a Marvel trailer, a laughing baby, nursery rhymes, a watch party. |
| Puppet & character videos | uncertain (75) | agree | uncertain | 78 % of views in one video; includes an ABC News clip and a 56-minute playthrough. |

### Rates

| Type | agree | disagree | unsure | agreement |
|---|---|---|---|---|
| format | 3 | 3 | 4 | 30 % |
| meme | 1 | 9 | 0 | 10 % |
| event | 5 | 4 | 1 | 50 % |
| uncertain | 9 | 0 | 1 | 90 % |
| **overall** | **18** | **16** | **6** | **45 %** (18/40) |
| format + meme + event only | 9 | 16 | 5 | **30 %** (9/30) |

The "uncertain" bucket scores well because the system correctly refuses to type description boilerplate and subject tags — but those clusters are still `qualified: true, grade: strong` trends in the list, which is its own problem. The "meme" type is effectively broken: its basis ("N new creators in 48h around one specific moment/phrase") fires on any hashtag. Not in the sample but visible in the same file: "Timelapse & process" (38 creators) is typed `event (80)`.

**Clearest misclassifications:** #vtuber (meme → organised stream event), Chemical Plant (meme → news event), Iphone Duo (format 95 → product launch), #spiderman (format → topic), Get Ready and Join Discord (event → not trends), Theft Auto (event → format), #gta6 (meme → one channel's topic), #cinema (meme → recap format), #acousticcover (meme → duplicate uploads), Gaming clips & streams (format → category), Minecraft Mod (event → topic).

---

## 5. Strengths

1. **Evidence is real and auditable.** Every desk and feed item links to a verifiable video with views, likes, comments, publish date, duration, the measurement interval and the creator baseline. Nothing is invented; "nothing is padded" holds.
2. **Measured vs. average is kept honest.** Lifetime averages are labelled "an average, not a measured recent rate"; measured rates state their interval; acceleration is separate; single observations are "provisional". This is better than most creator tools.
3. **Uncertainty is spoken aloud where it matters.** Every brief opens its uncertainty block with "visual style, pacing and audio of the examples were not inspected"; one-video dominance and "only 4 creators so far" cautions are attached to the right items; "crowded and flat: only with a sharp original angle" is the correct read of Iphone Duo.
4. **The calendar-event path works end to end.** "halloween" is correctly typed and corroborated, and the action ("one original piece on the day, not a series") is the right advice for a solo creator.
5. **Platform eligibility facts are accurate and not oversold.** YPP (1,000 subs + 4,000 watch hours or 10M Shorts views/90 d), the Shorts-RPM warning, TikTok Creator Rewards (10K followers, 100K views/30 d, > 1 min) and the July-2025 "inauthentic content" wording are all right.
6. **The age-aware hit floor and cohort percentile** ("top 1 % of tracked videos of similar age; the hit floor for this age is 1.5M") give the viewer a yardstick on every card, and the stream/duplicate/premiere rejections keep live streams out of Viral Now.
7. **Where the signal is real, the system finds it**: 생기는 일 and #시니어드라마 are genuine reusable formats; Frankys Odyssey is a genuine early animation breakout; the Hololive ARK event, the CoD launch and the Avengers trailer are real moments — they are just labelled or routed wrongly.

## 6. Weaknesses

1. **Cluster membership is keyword matching on descriptions, so the evidence lies about the format.** A Tom and Jerry cat clip is a "cover" because its description says `#dancecover`; a Korone game stream is evidence for both *vtuber* and *Cooking*; couple pranks are "Storytime"; "Incredible ideas for Halloween!" is "Cooking". Across the eight desk items about half of the evidence videos (23 of 46) are genuine examples of the trend *as typed*, and in four items (storytime, cooking, spiderman, vtuber-as-meme) it is two or fewer. Everything downstream (counts, growth, signatures, briefs) inherits this.
2. **"Measured growth" and "new creators in 48h" measure the crawler.** Creator counts are compared between runs of a crawler whose discovery widens each run; with a ten-hour history the jumps (Black Cat 40 → 61 in one run, vtuber 5 → 18 in eight minutes, spiderman 3 → 4) become "accelerating" and "16 new creators". Lifecycle labels flip run to run on the same data.
3. **Type classification is wrong outside calendar events.** 1 of 10 memes holds; a chemical-plant strike is a meme; Hololive streams are a "meme (90)"; a phone launch is a "format (95)"; "spiderman" is a "format (77)" with the basis text asserting a shared structure that does not exist; "Join Discord" and "Get Ready" are "events" by a category heuristic.
4. **The desk gate lets unqualified clusters and rejected videos through.** Half the desk is `qualified: false / isGeneric: true`; a third of its evidence is `state: rejected` (all six vtuber examples), yet `evidenceScore` is 93–96 for six of eight items (88 and 70 for the other two). `desk.excluded` is missing, so the gate cannot be audited.
5. **Action contradicts feasibility and profile.** "Covers" is `create_today` with `feasibleIn2h: false` (1.5–4 h); "spiderman" is `create_today` on four unrelated videos; "vtuber" (fit 42, 0 en/es evidence, 2–5 h streams) ranks above Cooking and Explainers. The owner's 2 h window and en/es languages are inputs the ranking does not respect.
6. **The briefs are mad-libs.** 24 briefs from 6 templates with the name substituted; only 10 distinct step lists; beat structures end at ~20 s regardless of a 241–447 s or **5818–10804 s** target; broken grammar ("the character mid-action with the a told story…", "the a cover performance song"); hashtags "#spider #man #spiderman" and Hololive tags for an en/es creator; the explainer template applied to the phone and not to Explainers; "A 45-second explainer" with a 123–229 s duration. They do not use what the evidence actually shows (e.g. the Halloween costume-ranking "Part N" series).
7. **Category and language errors propagate.** "halloween" is categorised *Music* (so the brief wants an original track), "Avengers Doomsday" is *Sports/Baseball*, an English WoW title is "pt", romanised Hindi is "en"/"latin"/"tr", and language counts cover a third of a cluster's videos — yet language fit is 20 % of the fit score.
8. **The feeds reward absolute views from mega-channels and farms.** Viral Now's top 10 has one channel twice with hashtag-only titles and 72–425 comments on 41–45M views, three entries with comment ratios under 0.001 %, and a 35.8M-sub channel at 0.15× its own reach. Early Radar's top 10 has hashtag spam with hidden likes, two engagement-dead clips, a made-for-kids 27-minute video, a film trailer, a 5.6-day-old near-hit and a video the system's own numbers show slowing; a 12-day-old entry is `kind: early` against the documented 7-day rule.
9. **The owner's lane is invisible.** "AI-generated video" (28 creators, AI shorts at 5–35M views) is "uncertain" and absent from the desk; "Animal comedy & AI animals" (43 creators, format 90, qualified) is absent; "Animation shorts" (176 creators) is absent — while Hololive streams and an iPhone launch are shown to a creator who makes AI animation.
10. **Monetization is one boilerplate block with the format-specific risk missing every time**: cover licensing / publisher Content ID for *Covers* (while telling the creator to use "no copyrighted audio" for a cover), Marvel/Sony IP for *spiderman*, the Oct 31 deadline for *halloween*, agency IP for *vtuber*, kids-content rules for the Early Radar nursery video. Suitability numbers (cooking 82, iPhone Duo 80) are category profiles. "Content ID on re-uses" assumes distributor access a solo creator does not have by default.
11. **No outcome evidence yet.** 73 predictions, 0 evaluated, 0 of 12 observed crossings predicted. Until the scorecard fills, "early" and "create today" are unproven claims.

## 7. The five highest-impact fixes, in order

1. **Fix cluster membership first.** Require the format/meme signature in the *title* (or tags), not the description; drop description-keyword matches (`#dancecover`, "fair use", "join discord", "auto-generated"); never let a `state: rejected` video (streams, below-floor, duplicates) serve as desk evidence; run a per-video relevance check before a video can be shown as an example, and compute `facts` (creators, topViews, growth, signature) from the filtered set only. This single change would have removed the Tom and Jerry cover, the ramen-stream recipe, the vtuber item and most of the contamination in §2.
2. **Stop calling crawl expansion growth.** Compare creator counts between runs only for videos *published* after the previous run (publishedAt cohorts), suppress growth and "accelerating/emerging" claims while `historySpanHours < 24`, and define "new creators in 48h" by first qualifying publish time, not first observation. Show "growth not yet measurable" instead of a number.
3. **Rebuild the type classifier around structure, not counts.** *format* = ≥ 3 creators sharing a title template or hook structure (as 생기는 일 and #시니어드라마 do); *meme* = a participatory signal (challenge/dance/sound/phrase in ≥ 40 % of titles with imitation across unrelated creators); *event* = news, releases, launches — including product launches and organised stream events; route IP/topic hashtags (spiderman, gta6, vtuber) and generic tags to topic/uncertain; drop boilerplate clusters ("Fair Use", "Join Discord", "Auto Generated", "Subscribe Channel", "Get Ready") from the Trends list rather than grading them "strong".
4. **Make the desk gate honest and profile-aware.** Admit only qualified, non-generic clusters (evergreen formats may appear, but labelled "evergreen" and ranked below true trends); require `feasibleIn2h` and fit ≥ 55 for any create/participate action; weight en/es evidence share; cap evidence per creator at one or two; publish `desk.excluded` with reasons; and add a "your lane" section that surfaces AI-generated video, AI animals and animation shorts for this owner.
5. **Derive the briefs from the evidence.** Choose the three variations from observed hooks/sub-formats (e.g. costume ranking "Part N" for Halloween, "what happens when…" for 생기는 일), scale the beat structure to the target duration, fix the template grammar, generate hashtags from real title signatures, and add the one format-specific monetization risk per brief (cover licensing, IP, kids content, calendar deadline). A brief that cannot name the mechanism should say "no reusable mechanism found" instead of substituting the trend name into a skit template.

---

*Limits restated: judged from titles, creators, categories and statistics only; no videos were opened; no pipeline code was run; the snapshot's history is ten hours old and the scorecard has no evaluated predictions. Scores are one reviewer's calibrated judgement and are intended to be re-run against future snapshots using the same rubric (`data/benchmark/audit-4.0.json`).*

---

## Owner's response (same day, after the audit)

The audit was run against run `202610281124`. The following changes were made to the pipeline and the playbook
templates in response (the audit text above is left exactly as written; a second, independent audit on a later
snapshot is reported in `docs/PROGRESS.md`):

1. **Evidence contamination** — desk evidence is now *clean* only: verified, candidate-sized, and not rejected as
   an ad, duplicate, stream, stale or sub-floor video; format pools keep only videos whose *title* satisfies the
   pool's own rules when at least three do; a cluster with fewer than three clean examples is excluded. The desk's
   creator/video/new-creator facts are computed from the clean set, and the "why" line states how many cluster
   videos were excluded.
2. **Crawl-based "growth"** — growth is reported as *measured* only when the cluster has ≥24 h of history; younger
   clusters are "emerging — growth not measurable yet", never "accelerating".
3. **Type classification** — news/sports/esports (incl. strikes, military, verdicts), product launches/reviews/
   unboxings, trailers/leaks and long recordings (median ≥30 min) are events or uncertain; a *format* needs a shared
   title word beyond its own name; a *meme* needs five independent creators before "create today"; curated pool
   names are never judged as fragments (the bug that hid AI-generated video, Cat videos, Animation shorts…).
4. **Desk gate** — "create today" requires an original variation to fit in ≤2 h and ≥30 % of clean examples in
   English/Spanish; "participate" also requires the language share; the "excluded" counts are published; a new
   **"Your lane this week"** section shows the owner's own pools (AI, animation, characters, skits, music, stories,
   explainers) with their clean activity whether or not they are a specific opportunity.
5. **Briefs** — beat timings scale with the examples' median duration (long-form examples get an act structure);
   hashtags are the trend as one tag plus Latin signature words; each brief carries one format-specific monetization
   risk when the facts imply one (cover licensing, third-party IP, calendar deadline, made-for-kids, news footage,
   long recordings, meme audio); grammar of generated titles/hooks fixed.
6. **Feeds** — the creator-outlier rule is limited to 7 days (no 12-day "early"); hits with hidden likes and almost
   no comments on ≥5M views are ranked lower and say so.
