# Individual Volume Adaptation: Design and Evidence Review

Date: 2026-10-26. Status: diagnostic review and unapproved design proposal.

## Executive conclusion

Do not activate the proposed MPI-to-deload or next-block volume rules as an individual optimization engine. Existing performance logs support useful observations, but do not identify an athlete's physiological minimum, maximum recoverable volume or growth-maximizing dose. The current rule set mixes different objectives and has unresolved measurement and causal-inference problems.

An appropriate initial product is an explainable, uncertainty-aware volume recommendation system. It should distinguish observed performance from measured hypertrophy, record actual exposure and effort provenance, prefer maintaining a working prescription, and propose small, reversible changes only after reviewing context. No universal optimum, validated confidence percentage or diagnosis should be claimed.

This review changes documentation only. It does not alter athlete data, collections, permissions, runtime behavior, the installed application or its existing prescriptions. PRD remains the architectural source of truth; the older `algoritmo-mesociclo.md` is reviewed as a supporting proposal, not independently promoted into product requirements.

## Evidence and its limits

The following are research publications or an official professional position stand, not coaching summaries. Most claims below are assessed from indexed abstracts or publisher summaries; this is not a systematic review or a claim of having inspected every underlying trial/full text.

| Source | Relevant finding | Limit on product inference |
| --- | --- | --- |
| [Pelland et al., 2026](https://link.springer.com/article/10.1007/s40279-025-02344-w), published online December 2025 | Meta-regressions across 67 studies suggest increasing volume has diminishing-return relationships with size and strength. Fractional indirect-set accounting fit the analyzed data better than the alternatives. | A population association is not an individual optimum; 0.5 is not an exact physiological conversion for every indirect set. The sample was predominantly young and male. Publisher abstract/preview inspected. |
| [ACSM position stand, 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) | Strength and hypertrophy respond differently to prescription variables; effective training and maximizing an outcome are different questions. | This does not validate Vigor's experience multipliers, recovery ceilings, MEAV label or an automatic weekly decision rule. Abstract and accessible excerpts inspected. |
| [Scarpelli et al., 2022](https://pubmed.ncbi.nlm.nih.gov/32108724/) | A small within-person trial compared a standardized leg-training dose with a prescription based on prior volume; the individualized condition produced greater vastus-lateralis growth over eight weeks. | This supports considering prior dose, not automatically adding 20% for everyone. Sixteen subjects, one muscle outcome and a specific protocol cannot establish a universal personalization algorithm. Indexed abstract inspected. |
| [Accuracy in Predicting Repetitions to Task Failure, 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/) | RIR predictions showed substantial heterogeneity; accuracy depended on context, including proximity to failure and repetition range. | A reported integer RIR is not an exact physiological measurement. Do not infer a personal error correction from the pooled average. Indexed abstract inspected. |
| [Robinson et al., 2024](https://pure.solent.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/) | Exploratory meta-regressions suggest different proximity-to-failure relationships for strength and hypertrophy. | Estimated RIR and study-level modeling limit precise causal prescriptions. Do not treat all set counts as equal-dose observations while changing effort. Author-university abstract inspected. |
| [Murphy and Koehler, 2022](https://pubmed.ncbi.nlm.nih.gov/34623696/) | Energy deficit impaired lean-mass gains more consistently than strength gains. | Strength progression cannot certify muscle growth; energy balance is important context. Do not turn a pooled calorie estimate into an individual diagnostic cutoff. Indexed abstract and accessible publisher excerpts inspected. |
| [Coleman et al., 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10809978/) | A trial of a one-week complete training cessation did not improve hypertrophy and favored continuous training for some strength outcomes. | Complete cessation is not the same intervention as a reduced-volume deload. The result neither proves deloads useless nor validates Vigor's fixed duration/reduction recipe. Abstract and methods/discussion excerpts inspected. |
| [Schumann et al., 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8891239/) | Concurrent-training evidence does not support inevitable loss of muscle growth or maximal strength in every combined program. | Log cardio exposure and its context without assuming any running session explains a strength plateau. Accessible methods/discussion excerpts inspected. |
| [Responsiveness review, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11067735/) | Reported response classifications vary considerably with methods and study quality. | A short flat period must not label an athlete a biological non-responder. Indexed abstract inspected; a subsequent full-page request was blocked. |

The conclusions that follow are product/engineering recommendations informed by these sources, not empirically validated Vigor decision thresholds.

## 1. Define the objective before optimizing

The supporting algorithm requests the smallest volume producing adaptation, but proposes increasing volume when progress and recovery are already good. Those are not the same objective.

Distinguish:

- **Minimum effective dose:** some meaningful progress with minimal training cost.
- **Practical efficiency:** worthwhile progress within time, preference and recovery constraints.
- **Maximum progress priority:** willingness to spend additional time for uncertain marginal benefits.

For hypertrophy, a performance trend is a proxy, not the target measurement. For strength, the target should be specific to the desired lifts/tasks. Maintenance during an intentional energy deficit or a busy period may be success. Hybrid priorities add another objective rather than converting cardio minutes into strength sets.

Product choice still needed: whether practical efficiency is the default or an explicitly selected preference. Do not silently define "optimal" as either minimum possible dose or maximum tolerated workload.

## 2. High-priority algorithm problems

### P0 — MPI level is not a stagnation trend

`mpi.ts` computes change relative to a supplied baseline. PRD defines that baseline as an early-block best. Suppose the reference is 100 and later estimates are 110, 110 and 110. MPI remains +10% throughout: the athlete has stopped improving but remains above the initial reference. Conversely, an unusually high initial observation can make subsequent normal performances appear persistently negative.

Keep block-relative change for display, separately from a recent within-exercise trend. Define a meaningful-change band and an indeterminate state before accumulating plateau evidence. A single early maximum must not serve as the only comparator. Neither zero slope nor a negative observation alone establishes inadequate or excessive volume.

### P0 — Missing evidence can look like a plateau

`muscleProgressIndex([])` returns zero. If directly connected to `MPI <= 0`, no observations would become a flat microcycle. The deload evaluator accepts a precomputed flat-count; it does not construct or validate that evidence.

Represent insufficient or incomparable data explicitly. A skipped session, invalid attempt, incompatible recording mode or absent exercise must not increment a stagnation counter. Existing thresholds of two microcycles, recovery below five and fatigue at least seven are product defaults, not established individual boundaries.

### P0 — Effort provenance is currently unknown

`ExercisePage` displays `targetRIR` when `actualRIR` is absent. Its completion callback writes that displayed value into `actualRIR`. Thus a valid numeric actual may come from a carried prescription rather than a deliberately edited effort estimate. `historyReadiness.ts` counts numeric actual RIR as logged effort and cannot distinguish the two.

A completed row is a user confirmation of the displayed row, but it is not proof of an independently estimated RIR. Future observations need an explicit distinction between reported/confirmed effort, inherited prescription and unknown effort. Legacy records must retain unknown provenance; do not retroactively infer it from the numeric value or the existing `isAutoFilled` flag.

### P0 — Performance is not measured growth, and effort changes confound it

More repetitions or load can reflect strength, task familiarity, altered effort, technique or setup. Vigor already reduces prescribed RIR through accumulation; raw Epley estimates therefore change while effort changes. Treating that as proof of a volume response would partly reward the application's own prescription.

Compare sufficiently similar exercises, effort, repetition ranges and setups. Preserve separate raw and context-adjusted observations. Any RIR-based adjustment remains approximate; missing or inherited effort cannot be silently replaced with zero. Optional slow, standardized body-size measurements may add context, but neither body weight nor home circumference measures isolate a particular muscle's growth reliably enough to declare its optimum.

### P0 — Swaps and arbitrary weights can create artificial progress

Renormalizing MPI after removing an exercise prevents a mathematical dilution; it does not make a different exercise roster comparable. Dropping a poorly progressing exercise can raise the group index without any improvement. Profile weights of 0.50/0.35/0.15 also favor compound performance without demonstrating that those changes quantify the target muscle's growth.

Compare each exercise with itself first. Distinguish exercise coverage from performance. Reset or qualify the comparator when apparatus, variant or technique changes. Group aggregation should expose which exercises contributed, coverage loss and discordant trends rather than allowing one compound to decide the whole muscle's dose.

### P0 — Calendar exposure is not microcycle count

`volumePlan.ts` comments apply weekly reference ranges directly to microcycles, although the product permits cycles longer or shorter than seven days. Twenty sets in seven days and twenty sets in fourteen days are not the same dose rate.

Retain workout-based progression, but calculate observed dose from actual dates and completed work. Show both per-cycle totals and a calendar-normalized descriptive rate, alongside inter-exposure spacing. A weekly equivalent is bookkeeping, not evidence that two differently distributed schedules are biologically equivalent. Do not count missed/planned sets as performed exposure.

### P1 — Good recovery does not establish that more volume will help

The supporting proposal's automatic +5–10% rule for athletes already progressing contradicts its minimum-dose objective. The inverse conclusion is also invalid: successful progress at one dose does not prove a lower dose would work equally well.

Default to maintaining a working prescription. A higher-dose trial requires an explicit objective, acceptable burden and sufficient comparable observations; a lower-dose trial requires the athlete's efficiency/maintenance preference, not an automatic assumption that fewer is always better. Neither trial by itself identifies a stable causal optimum.

### P1 — Poor recovery does not identify the cause

A low aggregate recovery score could reflect unusual work stress, illness, poor sleep, energy deficit or a new cardio load. It does not by itself establish excessive strength volume. Local discomfort and systemic fatigue are different signals.

Use repeated context and localized reports. Distinguish changing the next exposure, reducing work for a particular muscle/exercise, reviewing the whole block and stopping/reviewing a painful movement. Do not diagnose overtraining, claim to measure CNS fatigue, or use one EVA score to infer a universal whole-body deload requirement. Safety-significant symptoms must not wait for a plateau counter.

### P1 — Fixed prescriptions are presented too confidently

The source proposal declares static volume and between-block-only changes as consensus and gives expected decision frequencies. The reviewed evidence does not establish those as universal rules. Current projection defaults use six cycles and a final deload, whereas the intended model is response-sensitive. The source deload recipe and the runtime's 0.55 set factor/+2 RIR are also not identical.

Stable volume is a useful observation strategy, not a prohibition on responding to pain, inability to complete work or changing availability mid-block. Suggested percentage changes, minimum sample counts, observation horizons, deload duration and recovery thresholds require explicit product status and later calibration. Do not publish assumed 60–80% maintain rates as measured outcomes.

## 3. Information inventory

| Information | What exists now | Additional observation needed |
| --- | --- | --- |
| Goal and priorities | Goal, experience category, muscle emphasis, available time | Desired trade-off: efficient progress, maximum-progress priority, maintenance; whether body mass is intentionally decreasing |
| Actual exposure | Exercise identities, dates, set types, completion and achieved values | Complete external strength work and reasons for omitted work; actual calendar dose rather than prescribed totals |
| Effort | Prescribed RIR and optional numeric actual RIR | Provenance/explicit confirmation and ability to mark unknown; basic RIR understanding without requiring failure testing |
| Comparability | Exercise snapshots and recording modes | Apparatus/setup changes, relevant technique/ROM changes, actual rest/position context where available; no silent comparisons across machines |
| Local tolerance | Some clinical models and notes | Brief muscle/region-specific recovery and limiting discomfort reports, separate from general effort |
| General context | Check-in/readiness model scaffolding | A functioning optional check-in; unusual sleep/stress/illness flags and external activity changes, with unknown as a valid answer |
| Nutrition/body mass | Separate domain/scaffolding, not an adaptive-volume input | Optional weight trend and gain/maintain/lose intent; broad diet/protein sufficiency context without requiring precise calorie logs |
| Cardio and sport | Cardio/hybrid remains a separate design track | Mode, duration, relative effort and timing, plus demanding sport/manual-work changes; no conversion into strength-set credit |
| Hypertrophy outcomes | No direct muscle-size measurement stream | Optional standardized, sufficiently spaced measurements with measurement-error caveats; not a mandatory medical scan |
| Changing conditions | Occasional notes | Voluntary relevant-context flags; no need for a mandatory sensitive medical, hormonal or medication questionnaire |

The software should collect data it will actually use. Age, sex, years training, photographs, a wearable readiness score or a single body-fat estimate must not become deterministic volume multipliers. Wearables can enrich context with permission, but cannot establish a muscle-specific recovery ceiling. Do not require HRV, continuous heart rate, laboratory testing, photos or DXA to use the first version.

## 4. Minimum-burden user experience proposal

1. **At entry:** ask what the athlete wants to optimize, recent consistent dose if known, recent progress and whether this is a return after a break. Reuse reliable app history rather than asking for it again. Unknown is valid.
2. **While logging:** keep the existing set entry. Offer a clear unknown/confirmed effort distinction; capture only relevant changes in exercise/setup. Never require every field for every set.
3. **At finish, optional:** session effort and a compact exceptional-context check. Ask why an exposure was shortened only when applicable: time, discomfort, fatigue or another reason.
4. **Before the next exposure or at a brief review:** ask local recovery only for flagged/prioritized groups. A global "How recovered do you feel?" cannot identify which muscle needs a different dose.
5. **At block review:** show the observation, uncertainty, alternative explanation and proposed change. Allow maintain, adjust or defer. Keep the athlete in control.

Two or three lightweight questions do not guarantee a ten-second experience for every athlete; measure completion time and abandonment before making that promise.

## 5. Proposed decision framework, not an activated algorithm

| Evidence state | Initial recommendation | Why |
| --- | --- | --- |
| Missing, incomparable or too few observations | Keep the known workable prescription or review a conservative starting plan; collect evidence | Unknown is not stagnation |
| Comparable progress and acceptable local/global tolerance | Maintain by default | Current dose appears useful; its minimum or optimum remains unknown |
| Repeated comparable plateau, good tolerance and adequate adherence | Check load progression, effort, technique, rest, exercise choice and context; then offer a small local dose experiment if aligned with the goal | More sets are one candidate, not the automatic cause/fix |
| Repeated decline with local recovery problems | Review the affected exercise/group and consider reducing its immediate burden | Avoid changing unrelated groups based on one local issue |
| Broad repeated decline with poor general recovery | Context review and a proposed broader reduction/deload, not a diagnosis | Strength dose is only one possible cause |
| New/relevant pain, illness or other safety issue | Separate movement/safety review, not delayed plateau logic | Safety is not inferred from hypertrophy metrics |
| Repeatedly incomplete work due to time | Adapt feasibility/distribution first | Lack of opportunity is not intolerance |

Implementation should separate observation construction, comparability/data quality, trend estimation, context review, recommendation and explicit application. Start with explainable rules; a Bayesian model is not a substitute for missing observations, an undefined objective or unidentifiable causal effects.

Maintain per-muscle/region context and account for shared compound work when changing one target. Preserve unrelated prescriptions and completed history. Use a bounded, reviewable number of actual sets for a proposed experiment rather than mechanically rounding percentages: rounding a 5% change from three sets is not the same intervention as adding one set. No concrete change magnitude or minimum-observation threshold is approved by this review.

Keep a log of the dose actually performed, context, recommendation, acceptance/rejection and later observations. Stable observations at one dose only show what happened at that dose. Sequential comparisons across multiple doses can improve decisions, but changing physiology, carryover, technique and lifestyle prevent promising causal proof or a permanent personal optimum.

## 6. Engineering and validation gates before activation

- Separate unknown from flat; never create plateau evidence from an empty vector.
- Separate initial-reference progress from recent trend, with robust handling of an exceptional baseline.
- Validate numeric check-in ranges, timestamp bounds, owners, duplicates, discards and completion state.
- Do not treat a session-level completion timestamp as proof every set was completed. `e1rmHistory.ts` currently lacks an explicit per-set pending check; it excludes custom exercises and non-total-kg modes. The future trend extractor needs a deliberate, tested eligibility policy rather than reusing that load-suggestion helper unchanged.
- Preserve effort provenance through draft persistence, history editing and legacy reads. User confirmation of inherited values must not be reclassified as a measured independent effort estimate.
- Test declining RIR with unchanged underlying performance, changing repetition ranges and coarse equipment increments.
- Test swaps, roster composition, order/rest/setup changes, custom exercises, assisted/bodyweight/per-hand/level modes and kg/lb boundaries.
- Count advanced-set main work and extensions separately. Preserve partial-repetition and warmup exclusions; do not invent an exact effective-set conversion.
- Test unequal cycle durations, missing exposures, rescheduled dates, skip/discard/correction and external-work reports.
- Test local versus generalized problems, and prohibit automatic escalation from a single subjective score or wearable reading.
- Test coupled indirect volume when changing a compound and when multiple regions compete for a fixed time budget.
- Include an abstain/insufficient-evidence output and transparent reasons, not a mandatory maintain/increase/decrease answer.
- Evaluate in shadow mode first: recommendations and reasons without modifying prescriptions. Measure coverage, false alerts, user corrections, adherence and outcomes, not just passing mathematical tests.
- Do not learn only from accepted recommendations without accounting for selection bias; preserve rejected/deferred recommendations too.
- Prospectively validate thresholds and decision quality before promising optimization. A passing unit-test suite establishes software behavior, not training efficacy or physiological validity.

## Open decisions for the athlete/product owner

1. What should "optimal" prioritize by default: minimum effective work, practical efficiency or maximum-progress priority?
2. Should the first release only suggest reviewed changes, rather than automatically applying them?
3. How much optional local recovery/context reporting is acceptable?
4. Should volume trials normally occur at block reviews, with explicit exceptions for safety, adherence and feasibility?
5. Which longer-term outcome can users realistically provide for hypertrophy, and how should the app disclose its uncertainty when only performance is available?

Until these decisions and observation gates are resolved, retain the current non-adaptive behavior and clearly describe it as such.

## Review verification

The unchanged application passes all 1,990 tests across 167 suites (128.627 seconds). Evidence: `/private/tmp/vigor-oct26-volume-review-tests.log`. This verifies existing software behavior only. No proposed observation fields, eligibility changes, trend model, recommendation rules or physiological efficacy were implemented or validated by this review. No athlete records or physical-device state were modified.
