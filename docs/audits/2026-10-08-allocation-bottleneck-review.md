# Exact remaining allocation sample

## Denominators and interpretation

Reference: `/private/tmp/vigor-packing-safe-generator-20261007.json.gz`.

The complete battery has 3,575 simulations: 2,046 hypertrophy and 1,529 strength. Excluding 33 expected empty-catalogue controls leaves 2,013 evaluable hypertrophy cases. There are no missing quality records. These are input/seed/time probes, not independent athletes or a representative prevalence study.

Of the 214 hypertrophy cases containing short sessions, 200 have insufficient aggregate sets to give every requested day twelve sets; fourteen have enough aggregate sets. The latter are 0.70% of evaluable hypertrophy cases and 6.54% of affected cases. All fourteen contain exactly one eleven-set session. They are not the six-to-nine-set outliers discussed earlier. Across all affected cases there are 838 short sessions.

Twelve is a product review threshold, not a physiological minimum. Insufficient aggregate sets for this threshold does not establish insufficient hypertrophic stimulus. Conversely, enough aggregate sets does not prove that a partition satisfying duration, anchoring, variety, exposure and modeled recovery exists.

## Exact fourteen cases

All use the full catalogue snapshot and the hypertrophy goal. Sets are in session order. `None` means no priority/deprioritization input.

| Case | Level | Split | Days × minutes | Seed | Priority / deprioritized | Sets |
|---|---|---|---|---|---|---|
| T-seed-2 | Intermediate | Full body | 3 × 45 | 8 | None / none | 12/13/11 |
| AA-seed-4 | Advanced | PPL | 6 × 45 | 63 | None / none | 12/11/13/12/12/12 |
| BEGINNER-emphasis | Beginner | AUTO | 4 × 65 | 123 | Back, triceps / quads, chest | 13/12/13/11 |
| BEGINNER-emphasis-seed-3 | Beginner | AUTO | 4 × 65 | 126 | Back, triceps / quads, chest | 13/12/13/11 |
| BEGINNER-emphasis-time | Beginner | AUTO | 4 × 70 | 123 | Back, triceps / quads, chest | 13/12/13/11 |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-balanced-full-seed-4 | Beginner | Upper/lower | 4 × 75 | 205 | None / none | 13/13/12/11 |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-balanced-full-seed-7 | Beginner | Upper/lower | 4 × 75 | 208 | None / none | 12/12/11/13 |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-back-arms-full-seed-3 | Beginner | Upper/lower | 4 × 75 | 204 | Back, triceps / none | 13/12/13/11 |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-back-arms-full-seed-5 | Beginner | Upper/lower | 4 × 75 | 206 | Back, triceps / none | 14/12/13/11 |
| cross-HYPERTROPHY-BEGINNER-PUSH_PULL_LEGS_UPPER-balanced-full-seed-7 | Beginner | PPLU | 4 × 75 | 208 | None / none | 12/12/11/13 |
| cross-HYPERTROPHY-BEGINNER-AUTO-balanced-full-seed-4 | Beginner | AUTO | 4 × 75 | 205 | None / none | 13/13/12/11 |
| cross-HYPERTROPHY-BEGINNER-AUTO-balanced-full-seed-7 | Beginner | AUTO | 4 × 75 | 208 | None / none | 12/12/11/13 |
| cross-HYPERTROPHY-BEGINNER-AUTO-back-arms-full-seed-3 | Beginner | AUTO | 4 × 75 | 204 | Back, triceps / none | 13/12/13/11 |
| cross-HYPERTROPHY-BEGINNER-AUTO-back-arms-full-seed-5 | Beginner | AUTO | 4 × 75 | 206 | Back, triceps / none | 14/12/13/11 |

## Inspection and rejected experiment

The deficits are present in the allocator output, not introduced by first-microcycle mapping. Twelve beginner cases have substantial duration headroom, so adding minutes does not address their binding constraints. Several AUTO/upper-lower cases reproduce the same roster and placements; do not describe them as fourteen distinct programming failures.

A temporary final-output-only repair evaluated atomic three/four-day single-appearance rotations, bounded to 4,000 candidates per invocation, after policy/seed selection. It retained dose/occurrences, per-session floors, anchors, muscle caps, frequency, redundancy, concentration and current aggregate/template/adjacency guards. No affected case improved. This is a bounded negative result, not proof of global infeasibility. The code was removed: no added production latency or search mode shipped.

Separate inspection of deficit-improving single-entry pair exchanges found no admissible swap. Examples:

- Intermediate T has one such swap; it reduces primary exposure frequency and increases adjacent warnings. The short day combines machine press, good morning and lateral raise; merely exchanging a four-set chest appearance onto that day concentrates both chest exercises.
- Advanced AA has one such swap; muscle-cap, redundancy, frequency and aggregate-risk guards block it. The short day contains RDL, reverse pec deck and incline curl.
- Beginner emphasis variants have two such swaps each; both lose an existing compound anchor, introduce redundancy and reduce a primary exposure count. The short day contains cable row, reverse pec deck and overhead triceps extension.
- Balanced beginner seed 205 has two candidates, blocked by either anchor loss plus increased adjacency/risk or redundancy. Seed 208 upper/lower/AUTO has one, blocked by anchor loss, redundancy and frequency loss. The PPLU seed-208 pair is blocked by anchor loss alone.
- Back/triceps-priority seed 204 has two candidates and seed 206 has three; exposure preservation blocks every pair, with anchor/redundancy/risk guards also blocking some.

These guard outcomes are model explanations, not evidence that the rejected workouts cause injury or cannot be recovered from. In particular, preserving every existing primary exposure and aggregate ordinal risk may be conservative. Do not remove them merely to make a twelve-set counter green.

## Promoted bounded complete-roster competition

After the unsuccessful frozen-roster experiment, production hypertrophy generation evaluates up to six complete candidates at input-seed offsets −2/+2/−3/+3/−4/+4 only when the final plan has short days and enough aggregate dose for the product floor. Explicit policy controls, strength, empty catalogues and insufficient-total-dose plans do not enter this pass. It calls the existing planner without recursively applying the final repair and stops at the first accepted candidate. Input seed and catalogue are immutable; candidate seeds and the final-roster-repair stage are recorded in the policy trace.

The provisional uncapped targets remain determined by the same athlete inputs. A replacement roster is not exact exercise-dose conservation: capacity squeezing, exercise identity and individual muscle attribution can differ. The existing promotion contract preserves total performed dose, direct-accessory floors, foundational coverage, duration and muscle attribution within its existing one-set tolerance while requiring target-shortfall/ordinal-cost improvement. This pass additionally requires a strictly smaller floor deficit and protects per-session anchors, redundancy and muscle-cap excess, total concentration above the soft ten-set reference, rest-template warning cost, cyclic/adjacent warning count and summed flagged risk. At least two primary exposures are preserved where previously available; this is a programming guard, not a physiological frequency law. Subthreshold pairwise risk is not a measured recovery quantity and is not promised constant across different rosters.

Two plans improve; the other twelve retain their incumbent. Six-draw limits and conservative complete-plan guards remain reasons this is not a global optimizer.

Three local Node/Mac timings per repaired case under concurrent audit load were approximately 1.1–1.4 seconds for T and 1.6–1.8 seconds for AA; the unchanged beginner emphasis case was approximately 113–115 ms. These are full planner timings, not Decide-for-me timings, and are not physical-device guarantees. The additional work is deliberately rare-case-only, but profiling/reuse of repeated policy evaluations is remaining latency debt; do not present this repair as free or background-thread computation.

### Individual review: T-seed-2

Sets 12/13/11 → 12/12/13; total 36→37. Input seed 8 accepts complete candidate input seed 4. Final durations are approximately 42/44/45 minutes, including the shared overhead model.

- Day 1: Bulgarian split squat 4, dumbbell RDL 4, Smith squat 4.
- Day 2: dumbbell bench 4, seated leg curl 4, machine lateral raise 4.
- Day 3: dumbbell row 3, pulldown 3, pec deck 4, reverse pec deck 3.

Chest remains eight direct sets over two exposures; hamstrings increase seven→eight with two exposures. Lats remain six, biceps three indirect and triceps two indirect. The extra hamstring set serves a pre-existing target, not a newly invented filler target. Lower-back attribution falls. No new modeled overlap/concentration issue is accepted. Critical limitations: quads remain concentrated at eight sets on one day, both a unilateral and a guided squat remain there, and arms still lack direct work under this short budget. Full-body labels are flexible preferences; this is not three evenly identical full-body days. The improved balance does not establish optimal exercise selection or measured real-world duration.

### Individual review: AA-seed-4

Sets 12/11/13/12/12/12 → 12/12/13/12/12/12; total 72→73. Input seed 63 accepts complete candidate input seed 60. Final modeled durations are approximately 42/44/45/42/42/42 minutes.

- Day 1: decline bench 4, overhead dumbbell triceps extension 4, incline lateral raise 4.
- Day 2: stiff-leg deadlift 4, pulldown 4, preacher curl 4.
- Day 3: supported dumbbell row 3, cable fly 4, cable crunch 3, reverse pec deck 3.
- Day 4: Bulgarian split squat 4, close-grip bench 4, machine lateral raise 4.
- Day 5: dumbbell row 3, ab wheel 3, Bayesian curl 3, cable rear-delt fly 3.
- Day 6: hip thrust 4, hack squat 4, seated leg curl 4.

Direct triceps remains eight and direct biceps seven; attributed triceps remains ten, biceps 11→10.5, rear delts 8→7.5 and mid back 10.5→9.5 within the existing tolerance. Core increases four→six, hamstrings eight→ten, and quads remain eight across two exposures. These are explicit trade-offs, not exact per-muscle conservation. No new rest-template/adjacency deterioration is accepted. Critical limitations: the intended first leg slot still contains upper-body work, and considerable uncapped chest/quad/delt target deficits remain under 45-minute sessions. Close-grip bench remains a valid triceps entry; the change does not promote it as a universal preferred chest exercise.

The ordinal workload-cost proxy increases 151→157 while total target shortfall decreases 44.5→43.5. The existing promotion objective permits that trade-off; no claim that systemic fatigue is unchanged or measured is justified. Review found fewer focus/coherence warnings and no flagged adjacent overlap in the final audit, but those diagnostics are not physiological recovery measurements.

## Approved next implementation stages — incomplete

1. Bounded complete-roster competition is implemented, but twelve beginner bottlenecks remain. Local complementary variant replacement and set allocation at fixed targets remain future work; the current pass is not a global coupled solver.
2. Assess complete final prescriptions after any promotion, not only individual exchanges. The new repair includes this guard; extending it to every older policy-promotion path remains future work. The earlier five recovery regressions justify this boundary.
3. Address the three advanced twelve-set seed sensitivities separately; they are not these one-set partition gaps. Wider draw competition requires dose, concentration, recovery and mobile-cost comparisons.
4. Review every changed prescription, run the paired full matrix and tests, and record accepted trade-offs. The 200 dose-limited short-case profiles need evaluated commitment alternatives rather than filler.

Two residual cases are repaired; seed-sensitivity closure and the whole original implementation plan remain incomplete.

The known sensitivity profiles all use four 75-minute sessions: advanced balanced upper/lower with free equipment spans 77–89 sets; AUTO with the same equipment reproduces that span; advanced balanced PPLU with full equipment spans 79–91. The two free-equipment labels are overlapping tests, not two independent user populations. Their days already exceed twelve sets, so the new floor-deficit repair intentionally does not address them. Some low-dose outcomes coexist with almost-zero squeeze, implicating roster selection/coverage rather than uniformly inadequate time; a dose-focused candidate objective with full-plan guards is the next experiment, not a reason to blindly choose the maximum total series.

## Reproduction

`node --import tsx scripts/review-generator-defects.ts /private/tmp/vigor-packing-safe-generator-20261007.json.gz /private/tmp/vigor-short-disposition-20261008.md`

The report now records denominators, missing records, controls and exact input rows before the complete affected-case list. Temporary archives are local artifacts, not committed datasets. Validation results are recorded in the matching PRD entry. The final paired run is `/private/tmp/vigor-final-roster-release-20261008.json.gz`; reproduce with `node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --baseline=/private/tmp/vigor-packing-safe-generator-20261007.json.gz --output=/private/tmp/vigor-final-roster-release-20261008.json.gz`.

Final validation: 1,119 tests across 65 suites pass; TypeScript passes. The source-matched 3,575-case comparison changes exactly T and AA, with +1 performed set each, no strength changes, no crashes or new hard/time/volume regressions. Sufficient-total-dose short cases decrease fourteen→twelve; affected cases 214→212; short sessions 838→836. The 200 insufficient-total-dose cases and 33 expected empty-catalogue controls remain. The three advanced twelve-set seed spans remain, so the sensitivity gate deliberately exits 1. No native rebuild, signing, deployment, infrastructure mutation or commit.
