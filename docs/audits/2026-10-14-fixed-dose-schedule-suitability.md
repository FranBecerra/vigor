# Fixed-dose schedule suitability — 2026-10-14

## Outcome and scope

Point 2 is integrated: generated previews offer an explicitly chosen, actually evaluated smaller calendar or explain why none was found. They no longer regenerate a different routine to justify fewer workout days. Existing requested plans, manual edits, saved routines, strength prescriptions, native builds and deployments remain untouched.

The full paired matrix contains 3,575 simulations: 2,046 hypertrophy cases (2,013 nonempty controls) and 1,529 strength cases. Ten seeds and a five-minute capacity probe per input family are repeated software scenarios, not independent athletes.

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial prescriptions changed | — | 0 |
| Valid hypertrophy cases with short sessions in the requested plan | 165 | 165 |
| Evaluated fewer-day alternatives | 75 | 132 |
| Former offers retained | — | 75/75 |
| Newly offered alternatives | — | 57 |
| Offered alternatives changing exercise/dose roster | 75 | 0 |
| Offered alternatives changing performed total sets | 22 | 0 |
| Cases without a compatible fixed-dose compression | — | 33 |
| New crash / hard / time / volume regressions | — | 0 / 0 / 0 / 0 |

All 132 accepted alternatives preserve original and adjusted targets, squeeze, exact exercise IDs/set counts and global direct/indirect muscle credits. None exceeds the requested minutes, changes modeled cycle duration or worsens the promotion guards. All have at least twelve performed sets per session. The paired primary-prescription gate exits **0** against the October 14 before archive. This does not erase the sixteen historical short-count comparison flags against the older randomized generator: the original requested prescriptions have not changed.

If every offered alternative were explicitly accepted, short-session cases would decrease 165→33 and short sessions 748→198. This is a conditional software comparison, not a silent production change or an observed user outcome.

## Why the old suggestion was wrong

`findAlternativeSchedule` called the legacy seeded generator again at smaller session counts. All 75 former offers changed the exercise/dose roster; 22 changed performed total sets. Comparable attribution and a nondecreasing total are weaker than preserving the plan the athlete is reviewing.

The new implementation only redistributes the existing immutable selection. It skips arithmetically impossible day counts and rejects calendars whose unchanged exercise duration exceeds the available aggregate work minutes. Those bounds identify candidates, not guarantees that a packing exists. Selection, target calculation and squeezing are not rerun.

The first prototype offered only 47 alternatives. Diagnosis identified a missing `minimumSessionSets` argument: packing was not activating the existing whole-entry floor repair. Passing the explicit product floor increased valid offers to 121. The last eleven no-barbell PPL scenarios packed the dose but put the only horizontal press on a leg day while the push day lacked one. Bounded atomic pair/three-day exchanges repaired this label/task mismatch without removing leg work, changing exercises, introducing a short intermediate final plan or weakening guards. All 132 offers pass the final complete-plan guard.

## Complete affected-family review

Each row represents the base input plus its nine further seeds and time probe: eleven cases. Actual per-seed prescriptions, attempted counts and rejection reasons are in the paired archives.

| Family | Requested sets per session | Evaluated alternative | Review |
| --- | --- | --- | --- |
| S: beginner AUTO, glute priority, 5×50 | 10/10/9/9/12 | 13/12/13/12 | Same 50 sets, max 45 estimated minutes, no rest-template review. |
| Beginner upper-only, 4×65 | 6/6/6/6 | 12/12 | Same 24 sets, max 43.5 minutes; do not add lower-body filler. |
| Intermediate upper-only, 4×65 | 10/10/10/11 | 13/14/14 | Same 41 sets, max 48 minutes; no rest-template review. |
| Beginner PPL balanced, full equipment, 5×75 | 10/10/9/9/11 | 12/13/12/12 | Same 49 sets; whole-entry floor repair is necessary. |
| Beginner PPL balanced, free weights, 5×75 | 10/10/10/10/10 | 13/13/12/12 | Same 50 sets; four days reduce commitment without inventing dose. |
| Beginner PPL balanced, no barbell, 5×75 | 10/10/10/12/8 | 13/12/12/13 | Same 50 sets; atomic structure repair restores the push task. |
| Beginner PPL back/triceps emphasis, full equipment | 10/10/8/12/10 | 13/12/13/12 | Same 50 sets; no concentration/recovery regression. |
| Same emphasis, free weights | 11/11/9/10/8 | 12/12/12/13 | Same 49 sets; no concentration/recovery regression. |
| Same emphasis, no barbell | 10/11/10/11/8 | 13/13/12/12 | Same 50 sets; no concentration/recovery regression. |
| Beginner PPL lower emphasis, full equipment | 12/9/9/12/9 | 12/12/15/12 | Same 51 sets, max 51 minutes; the original above-range volume qualification remains, not fixed with this calendar. |
| Same lower emphasis, free weights | 7/10/12/9/12 | 13/13/12/12 | Same 50 sets; no rest-template review. |
| Same lower emphasis, no barbell | 10/9/9/10/12 | 13/12/12/13 | Same 50 sets; no rest-template review. |
| Beginner / intermediate / advanced, each 6×30 | 43 / 46 / 45 total sets respectively | No offer: 33 cases | Too little dose for four or more twelve-set days, but the fixed roster cannot fit into two or three thirty-minute sessions. This is a real modeled time constraint, not an allocation failure to conceal by cutting dose. |

The twelve accepted families account for 132 cases; the three blocked families account for 33. This review includes all affected input families, not a claim of independent clinical/coaching assessment of 165 athletes. The accepted base alternatives have no rest-template review; all accepted seeds also satisfy the non-regression guard.

## Guard and UI contract

- Preserve exercise identity and sets, targets and exact global direct/indirect credits. Per-session dose intentionally changes; unlike an exercise reroll, that is the purpose of this operation.
- Preserve per-session time limits and modeled cycle duration. Do not compare a shorter microcycle as though weekly dose stayed equal.
- Reject increased concentration above the existing soft reference of ten credited sets, per-muscle cap excess, redundancy, missing anchors or label/torso-demand findings. Preserve at least two existing direct exposures where attributed dose exceeds ten and the original had two or more.
- Reject increased rest-template review count or cost and increased flagged overlap with a real preceding workout. Undated adjacent-workout counts are not directly comparable across different calendars.
- Use the nearest passing smaller count in the supported two-to-six-session range. Atomic structure repair tests at most 600 complete pair/triple exchanges; it is not an exhaustive optimizer.
- Distinguish insufficient aggregate dose from sufficient-dose allocation defects. Do not offer fewer days as a substitute for repairing the latter.
- Preview keeps requested days until the athlete explicitly applies the offered calendar. Stale inputs and manual preview additions/edits suppress the offer. Application does not save automatically. No compatible candidate means retaining the request with an explanation.
- Remove the unchecked arithmetic suggestion from preview copy. Twelve sets is identified as a planning preference, not a minimum required for muscle growth.
- Audit records include suitability status, dose classification, every attempted count/rejection and exact-dose preservation. Existing archive replay and primary quality comparisons retain their contracts.

## Scientific boundary

Volume-equated evidence does not establish one universally superior training frequency or split. The calendar change is an engineering/programming preference for this athlete's dose, available time and distribution constraints, not a promise of more hypertrophy or injury prevention. The twelve-set session floor, ten-set soft concentration reference, fractional secondary credits and overlap model remain transparent heuristics.

Sources checked in this iteration: [Schoenfeld et al., 2019 frequency meta-analysis](https://pubmed.ncbi.nlm.nih.gov/30558493/), [Ramos-Campo et al., 2024 split versus full-body meta-analysis](https://pubmed.ncbi.nlm.nih.gov/38595233/). [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) was checked before implementation; no native dependency or build change was required.

## Validation and reproduction

`npm test -- --runInBand`: **1,242 tests / 67 suites pass**. `npx tsc --noEmit`: passes. Forty-six added tests cover production plans across three levels/five splits/two equipment profiles, immutable dose/targets, no regeneration, whole-entry floor repair, no-barbell atomic structure repair, aggregate time constraints for all three levels, empty/invalid/unresolved inputs, concentration/caps/anchors/redundancy, changed muscle credits, preceding workouts and changed modeled cycle duration. UI display and opt-in interaction still need native verification; Device Hub tools were unavailable in this session.

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 \
  --output=/private/tmp/vigor-schedule-before-20261014.json.gz
# Run before implementation; then compare the completed implementation:
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 \
  --baseline=/private/tmp/vigor-schedule-before-20261014.json.gz \
  --output=/private/tmp/vigor-schedule-release-20261014.json.gz
```

Archives contain source/runtime/catalogue snapshots and full prescriptions. Their temporary paths are local investigation artifacts, not durable deployable fixtures. The before archive must come from before this change; running both commands on current code only establishes repeatability.

## Next work

Proceed to point 3: bounded catalogue provenance/apparatus/credit review, starting with biceps and triceps, followed by native generation, edits, explicit schedule acceptance and save QA. Retain the thirty-minute constraint explanations and historical target-coverage compromises. Do not change volume priors or scores just to remove warnings. Observed-response adaptation still follows comparable-exposure eligibility. No further user decision is required to start this work.
