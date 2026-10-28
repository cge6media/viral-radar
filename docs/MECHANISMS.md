# Repeatable mechanisms — what the verified index says (4.0, 2026-10-28)

The 4.0 spec asks what makes content spread *repeatably* rather than which single videos went viral. This note is
the measured answer from the system's own index on the first 4.0 day; it is a **title-and-metadata** analysis of
verified YouTube videos and says nothing about visuals, pacing or audio (never inspected). It is refreshed by
re-running `node scripts/hooks.mjs` against `data/videos.json`; the Hall of
Fame page carries the per-video creative lessons, and the Creator Desk uses the same hook detectors (`HOOKS` in
`pipeline/src/intel/formats.ts`).

Sample: English-language, verified YouTube videos with ≥10K views in the 30-day index on run `202610281313`
(845 verified hits, 73 early breakouts, 651 rejected = verified but below the thresholds for their age).

## 1. Length: hits are Shorts

| group | median length | Shorts share | ≤30 s | 31–60 s | 61–180 s | 3–10 min | >10 min |
|---|---|---|---|---|---|---|---|
| verified hits (845) | **45 s** | **90 %** | 38 % | 22 % | 30 % | 3 % | 6 % |
| early breakouts (73) | 94 s | 58 % | 27 % | 15 % | 18 % | 16 % | 23 % |
| rejected (651) | 215 s | 45 % | 15 % | 9 % | 21 % | 17 % | 37 % |

Reading: among videos that clear the age-normalised hit floor, nine in ten are Shorts and six in ten are under a
minute; long-form reaches the floor far less often *in this index* (which is Shorts-leaning by construction:
the discovery probes and the chart categories favour short-form). The owner's 30 min – 2 h window fits the
dominant length.

## 2. Title hooks: which ones over-index in hits (hits % ÷ rejected %)

| hook (title pattern) | hits | early | rejected | ratio |
|---|---|---|---|---|
| POV | 0.9 % | 0 | 0.2 % | **4.5×** (rare, but when present it over-indexes) |
| "challenge" | 1.1 % | 0 | 0.3 % | 3.7× |
| numbered ("top 5", "3 ways") | 0.5 % | 0 | 0.2 % | 2.5× |
| **question** (? / why / how / what / can…) | **18.9 %** | 9.6 % | 8.0 % | **2.4×** (the most common strong hook) |
| reaction | 1.8 % | 0 | 0.8 % | 2.3× |
| **emoji in the title** | **55.3 %** | 42.5 % | 25.3 % | **2.2×** |
| "when…" setups | 2.4 % | 1.4 % | 1.2 % | 2.0× |
| tutorial / how to / tips | 2.2 % | 0 | 1.1 % | 2.0× |
| sensory (ASMR / satisfying) | 1.2 % | 0 | 0.6 % | 2.0× |
| second person (you / your) | 8.6 % | 4.1 % | 5.5 % | 1.6× |
| character words (robot, monster, puppet…) | 0.7 % | 4.1 % | 0.5 % | 1.4× (over-indexes in *early breakouts*) |
| versus | 2.2 % | 8.2 % | 3.5 % | 0.6× (but 8 % of early breakouts) |
| series markers (part N, ep N) | 2.4 % | 2.7 % | 4.8 % | 0.5× |
| music words (song, cover, remix) | 2.4 % | 5.5 % | 4.8 % | 0.5× |
| ALL-CAPS titles | 2.4 % | 6.8 % | 5.4 % | 0.4× |
| transformation (before/after, restoration) | 0.7 % | 1.4 % | 1.8 % | 0.4× |
| "AI" in the title | 0.2 % | 0 | 1.4 % | **0.14×** |

Readings (correlations in one day's index, not causes):

- **A question or an emoji in the title is the most reliable repeatable hook** in this sample: questions appear
  in 19 % of hits vs 8 % of rejected videos; emojis in 55 % vs 25 %. Both are cheap to apply and consistent with
  the "curiosity gap" and "scannable in a feed" explanations.
- **POV / "when…" / challenge / numbered framings are rare but over-index** when present — they are *formats*
  (a promise about the structure), which is why the Desk's briefs are built around a character in a POV/"when"
  setup, a ladder of levels, or a reversal.
- **Saying "AI" in the title under-indexes 7×.** The AI-video pool's hits do not announce themselves; the
  successful ones are titled by their premise, not their tool. For the owner this is the single most actionable
  line: never title a video by the tool.
- **ALL-CAPS, "part N" series markers and music words under-index among hits** but over-index among *early
  breakouts* (caps 6.8 %, series 2.7 %, music 5.5 %, versus 8.2 %, character 4.1 %): the Early Radar surfaces a
  different population — younger, mid-size, more gaming/music/character-led — than the established-hit lists.
- Median like rate is flat across groups (1.7–2.1 %): engagement rate does not separate hits from the rest in this
  index; reach does.

## 3. Which of this is repeatable (the §7 question)

Repeatable = a structure independent creators keep reproducing with success. From the index: (1) the short-form
length band (≤60 s) and a first-frame hook; (2) question / emoji / POV / "when" / challenge framings; (3) formats
the lane keeps finding as sub-formats across ≥3 creators (this week: TF2/SFM animation gags, "Indian Theft Auto"
skits, AI 3D football parodies, Karwa Chauth and Halloween skits — the first three are repeatable structures, the
last two calendar moments). Not repeatable: one-off rescues, news clips, show episodes, trailers — the Desk now
labels those as events or releases and keeps them off the recommendations.

## 4. Limits

Title-level only; English only; one day of index; Shorts-leaning discovery; no causal claim. The numbers will drift
as the index grows; the table is meant to be re-measured, not memorised.
