# First-generation dose allocation: implementation and rejected promotion

Historical rejected-prototype record. The later integrated allocator and current validation are documented in `2026-10-08-joint-dose-allocation.md`; the status below applies only to this earlier experiment. Correction to the original twenty-case classification: four declared-volume baseline variants already had 48 sets for four twelve-set days; the prototype reduced them to 46. That was a genuine sufficient-dose regression, repaired in the subsequent work, not merely an inherently dose-limited schedule.

## Scope and status

Point 1 is **in progress, not complete**. A seed-independent allocation prototype and its paired audit mode are implemented. They are not used by the app's initial Generate action. Existing preview rerolls retain their previously validated exact-dose contract. No saved routine, native build, deployment or infrastructure has changed.

This work is based on observed generator defects, not a new physiological volume prescription. Identical inputs produced 12-set seed spans in three advanced 4×75-minute profiles. A previous seed-zero reference experiment regressed ten paired volume comparisons and a time-capacity probe. Deterministic selection must therefore be judged on programming quality as well as repeatability.

## Mechanistic diagnosis

The provisional targets already come from athlete inputs before selection. Random weighted exercise draws change indirect credit and duration. The capacity search then squeezes targets according to those particular rosters. Consequently, seed variation changes actual dose even though the requested targets are unchanged. Another discontinuity is the two-versus-four exercise-per-muscle limit when time-constrained selection activates. Eliminating random draws alone does not solve either joint placement or non-monotonic integer capacity search.

## Implemented prototype

- Optional deterministic selection ranks the existing policy score and resolves ties by exercise ID. Default selection is unchanged.
- Establish a deterministic coupled incumbent; evaluate an accessory-aware marginal candidate under the full final-roster guard rather than blindly replacing the incumbent.
- After placement, reconsider unmet **original, unsqueezed** targets using bounded integer additions: at most 12 iterations and 300 evaluated proposals. Existing appearances stay at at most four sets; new compounds start at three, isolations at two or three when residual dose/time requires it. No fallback, manual-only or strength-variant exercise is newly added here.
- Recompute duration, attribution, sequencing and placement diagnostics. Preserve direct-work, exposure, anchors, redundancy, muscle caps, concentration and modeled-recovery guards. Ignore only the short-session improvement requirement for additions; the volume/cost objective guard remains active. No filler is added solely to reach twelve sets.
- Only after allocation, use the requested seed for the existing dose-preserving variation. Strength and explicit ranking-policy audit controls retain their previous planner.
- `--dose-first` records and replays this experimental generation mode. An audit-local cache reuses identical non-seed inputs and catalogue snapshots; the production allocator has no cross-athlete cache.

These scoring weights, fractional credits, set limits and recovery diagnostics are programming heuristics. Tests establish model consistency, not optimal hypertrophy, individual MEV/MRV, recovery readiness or injury prevention. Completion keeps original targets and squeezed targets distinct; an added set can improve an original-target compromise without claiming the squeezed budget is the ideal dose.

## Paired matrix results

Same inputs/catalogue/quality measurement: **3,575 simulations**, including **2,046 hypertrophy cases (2,013 nonempty controls)** and **1,529 strength cases**. Ten seeds per base case plus a five-minute probe; repeated seeds are not independent athletes.

| Measurement | Validated production | Guarded prototype |
| --- | ---: | ---: |
| Short hypertrophy sessions, excluding expected empty controls | 824 | 770 |
| Valid hypertrophy cases containing a short session | 200 | 176 |
| Sufficient-total-dose cases still containing a short session | 0 | 0 |
| Advanced seed spans above ten sets | 3 | 0 |
| Crashes / new hard failures | 0 / 0 | 0 / 0 |
| Expected empty controls | 33 | 33 |

**Promotion rejected:** 20 paired comparisons increase the number of short sessions; all twenty are aggregate-dose-insufficient cases. In 232 comparisons, modeled recovery-template review count increases. Original-target aggregate shortfall improves in 916 comparisons, worsens in 661 and is unchanged in the remaining 1,998. A six-day advanced AUTO case loses three performed sets with five additional minutes per session. No new hard, session-time or protocol-defined volume regression was reported, but those narrower checks do not override these programming defects. The comparison gate correctly exits 1.

A rejected intermediate variant directly favored accessory-aware selection and removed the time-dependent appearance cap. It produced 791 short sessions, 35 short-count regressions and eleven sufficient-dose underfilled cases. This is why the current experiment keeps a guarded coupled incumbent. Its 228 increased recovery-review comparisons also precluded promotion. An earlier run with an incorrect constant import crashed; it was a coding error, corrected before the valid comparisons, not evidence against the allocation approach.

## Individual programming review

| Case | Observation | Disposition |
| --- | --- | --- |
| Advanced balanced UPPER_LOWER, free weights, 4×75 | 88 sets; 22/23/22/21 for all requested seeds; previous 77–89 span | Repeatability improves; cyclic core recovery review remains. Not a global quality sign-off. |
| Advanced balanced AUTO, free weights, 4×75 | Same 88-set distribution and removed 77–89 span | Same qualification; repeated AUTO/UL output is not two independent successes. |
| Advanced balanced PPLU, full equipment, 4×75 | 89 sets; 22/23/22/22, previously 79–91 | Stable and balanced; do not infer 89 is physiologically better than 79 or 91. |
| Same PPLU, 4×80 | 96 sets; 24/24/24/24 | Avoids the previous canonical-reference collapse to 81. Still one capacity probe, not a monotonicity proof. |
| AD: advanced AUTO 6×60 → 6×65 | 92 → 89 sets; the 60-minute plan has a cyclic triceps review, the 65-minute plan does not | Fewer sets buy a modeled recovery improvement; nevertheless, the allocator should retain feasible alternatives and make this trade-off explicit rather than silently changing dose. Remains a promotion blocker. |
| C: intermediate AUTO 5×65 | 88 → 89; new direct biceps work on adjacent sessions; hamstring review cost also increases | Extra dose and deterministic ranking are not sufficient to accept the new roster. Requires recovery-aware joint selection/placement. |
| K: beginner AUTO 2×45 | 26 → 24, 12/12; RDL/Smith squat/machine row on one day; incline press/pulldown/lateral/rear delt work on the other | Feasible and stable, but chest/quads coverage worsens and arms/core lack direct work. No blanket assertion that the new routine is better. |
| Intermediate upper-only, seed 7 | 43 → 41; 10/10/10/11; target shortfall 1 → 0.5 and biceps adjacency flag removed | Better attribution/recovery can coexist with fewer performed sets and more short days. Respect the upper-only request; do not add lower-body filler. |

The twenty short-count regression comparisons fall into nine input families: S, beginner declared volume, intermediate upper-only, and beginner PPL balanced full/free, back-arms full/free/no-barbell, and lower full. They lack enough total dose to reach twelve sets on every requested day. They require an explicit schedule compromise, not a claim that twelve sets is a physiological minimum. Full prescriptions, inputs and diagnostics remain in the source-snapshotted archives; the table is a focused human review, not a claim that every simulation received an independent coaching assessment.

## Reproduction and artifacts

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --dose-first \
  --baseline=/private/tmp/vigor-reroll-release-generator-20261008.json.gz \
  --output=/private/tmp/vigor-dose-first-guarded-20261008.json.gz
```

- Before: `/private/tmp/vigor-reroll-release-generator-20261008.json.gz`
- Guarded experiment: `/private/tmp/vigor-dose-first-guarded-20261008.json.gz`
- Rejected direct-policy variant: `/private/tmp/vigor-dose-first-stage3-20261008.json.gz`
- Production control: `/private/tmp/vigor-dose-first-production-control-20261008.json.gz`

Archives include source snapshots; replaying under later code requires checking drift. Temporary archives are local investigation artifacts, not permanent fixtures or deployed behavior.

## Validation

`npm test -- --runInBand`: **1,184 tests / 67 suites pass**. `npx tsc --noEmit` passes. New tests cover 30 level/split/capacity profiles, repeated allocation seeds, 90 dose-preserving variations, reversed catalogue enumeration, explicit-policy/strength controls, empty catalogues, zero-capacity unassigned reporting, invalid numeric inputs, no-filler targets and unresolved placement. These contract tests do not certify the experimental programming quality; its matrix gate remains red.

The 3,575-case production control changes **zero prescriptions** against the validated baseline and has no new crash/hard/time/volume regression. Its exit code remains 1 because the original three large seed spans are deliberately still present. Native flows, physical-device latency and global allocation optimality are unverified.

## Next concrete implementation

Stay on point 1. Replace greedy roster-then-squeeze decisions with a bounded **joint dose/placement candidate frontier**, retaining feasible lower-capacity solutions when more time becomes available. Compare whole prescriptions using original-target coverage, direct-work protection, recovery, concentration and balance before selecting a roster. Penalizing recovery only after selection and completing residual sets cannot repair a poorly placed foundational roster. Preserve honest infeasibility rather than removing guards or silently increasing targets. Then replay the matrix and the eight reviewed profiles before connecting initial generation to the new allocator.

After promotion: handle insufficient-dose schedule proposals (point 2), catalogue/native QA, then comparable-exposure personalization. No new user decision is required to continue the approved allocator work.
