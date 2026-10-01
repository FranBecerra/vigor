# Quality contract and reproducible generator battery

## Scope and completed checklist

This iteration implements checklist points 1 and 2. It changes evaluation and audit tooling, not production exercise selection, allocation, intensity, UI or persisted routine schemas. The 605 paired legacy prescriptions are identical before/after. No deployment or catalogue promotion was performed.

- [x] Separate feasibility, programming review and evidence confidence, without a combined score.
- [x] Explain constraints and compromises with session/subject, actual value, limit and provenance.
- [x] Check session content independently of total sets/time; expose original target shortfalls rather than hiding them behind squeezed targets.
- [x] Retain references for both goals, every level/split, three emphasis profiles and three equipment profiles.
- [x] Separate fixed-catalogue policy comparisons, catalogue experiments, changed athlete inputs and added/removed coverage; use distinct acceptance rules.
- [x] Retain full input/catalogue/source/dependency/runtime snapshots and implement integrity-checked replay by case ID.

## Point 1: three independent axes

`generatorQualityContract.ts` defines quality version `2.0.0`:

| Axis | Possible statuses | Meaning |
|---|---|---|
| Feasibility | feasible / infeasible | Product constraints: available exercise IDs, set conservation/dose, session count/index, per-session estimated time and hypertrophy identity/appearance limits. |
| Programming | no-detected-issues / review-required / not-assessable | Distribution, foundational coverage, focus/task contradictions, target deficits, demanding torso-hinge concentration, beginner technique concerns and estimated overlap. Hard infeasibility prevents a whole-plan programming approval. |
| Evidence confidence | heuristic-limited / not-assessable | Selected IDs, absent ratings/tags, unverified resistance profiles, individually source-reviewed mechanics and explicit modelling assumptions. No invented percentage, scientific certification or numerical optimality grade. |

`valid` is retained for compatibility and means feasibility only. Warnings never disappear because a plan fits the clock or has many sets. Empty workouts are hard failures, not double-counted as short sessions. The 12-set threshold applies to nonempty hypertrophy workouts only and is a product review rule, not a physiological minimum. RDL plus supported hip thrust does not trigger the demanding-torso-hinge concentration finding. Strength may repeat main lifts; its configured main-lift share and substitutions are reported separately.

Every explained finding includes magnitude and a product-constraint/programming-heuristic basis. Original and adjusted muscle targets, attributed volume and original shortfall are retained. `limitedBy: recovery` is explicitly described as a population-informed budget, not a measurement of this athlete's recoverability. Fixed secondary credit, time estimates, volume landmarks and rest-template heuristics remain uncertain. Individually reviewed source mechanics do not validate the original numerical ratings.

All 3,542 non-control results require at least one programming review; this is not 3,542 unsafe plans or independent athletes. It shows that passing hard constraints has been an inadequate whole-plan quality label. Many flags are legitimate logistical compromises and require disposition, not automatic exercise bans or filler.

## Point 2: coverage and archives

The default full battery crosses 2 goals × 3 levels × 5 splits × 3 emphasis profiles × 3 equipment profiles = **270 base configurations**, in addition to the **55 legacy/edge configurations**. Each base has **10 seeds plus a +5-minute perturbation**: **3,575 runs**. Emphasis profiles are balanced, back/triceps priority with reduced quads, and glute/hamstring priority with reduced chest. Equipment profiles are full catalogue, barbell/dumbbell/bodyweight, and dumbbell/bodyweight without barbell. Legacy cases additionally cover declared volume, upper-only training, exercise vetoes, short budgets and empty-catalogue controls. These are stress tests, not recommendations to beginners to train five days.

| Goal | Beginner | Intermediate | Advanced | Total |
|---|---:|---:|---:|---:|
| Hypertrophy | 682 | 682 | 682 | 2,046 |
| Strength | 506 | 517 | 506 | 1,529 |

Schema 2 archives retain full exercise objects in deduplicated per-case catalogue snapshots, complete planner settings including seed/policy/previous-session data when supplied, prescriptions, every session/exercise, explanations, compromises, alternatives and policy traces. The manifest captures runtime Node/tsx versions, package/lock/config contents, model/data/training/audit source contents and fingerprints, matrix and quality-contract versions. Canonical object hashing is key-order independent; arrays retain meaningful ordering. Audit timing and generated timestamp are not expected to match across runs.

Archived source is data only: replay never executes it. Exact replay requires matching current source/runtime and verified snapshot hashes. Restore the recorded versions for exact replay; `--allow-version-drift` explicitly permits a current-engine experiment instead. Old schema-1 artifacts are comparison-only because ID lists do not reconstruct prior exercise parameters. Historical comparisons are explicitly marked weaker global-hash/ID evidence and different quality contracts are not silently compared as equivalent measurements.

### Acceptance rules

- Fixed inputs and identical per-case catalogues: report prescription/dose/quality changes; reject new crashes, hard feasibility regression, material volume loss or more short sessions when the quality contract is comparable.
- Catalogue additions/removals/parameter changes: classify as `catalogue-experiment` even if catalogue IDs change. Report deltas but require explicit experiment review; no automatic promotion by the fixed-input gate.
- Changed athlete settings: `different-inputs`, not a paired effect estimate. Removed cases fail coverage; added cases are visible and expand it.
- Empty-catalogue controls must return infeasible zero-set plans, not crash or fabricate exercises.
- Incomplete sensitivity results cannot become zero-delta successes. Invalid seeds, policies, matrices and unknown/incomplete CLI options fail explicitly.
- Exit code 0 means no triggered mechanical gate, **not scientific/programming approval**. Exit 1 means an expectation/regression/sensitivity gate failed. Exit 2 means an unmatched-input/catalogue experiment needs review.

### Retained references

- `2026-10-01-quality-before.json.gz`: 605-run pre-change schema-1 capture; comparison only.
- `2026-10-01-quality-after.json.gz`: schema-2 605-run paired capture, 0 changed prescriptions, 0 new hard failures, 406 short nonempty hypertrophy sessions unchanged.
- `2026-10-01-quality-full.json.gz`: schema-2 full reference, 3,575 runs.
- `2026-10-01-quality-catalogue-experiment.json.gz`: explicit reviewed-description-tag experiment on the legacy battery; not promoted.
- `2026-10-01-quality-replay.json.gz`: exact replay of the advanced PPL back/triceps case; source/runtime and prescription match.
- `2026-10-01-quality-repeat-proof.json`: second full run has identical source and identical normalized outcomes for all 3,575 cases. The large duplicate run is in temporary storage; the retained full reference, command and outcome digest suffice to repeat this check.

Corresponding generated Markdown files list each case. Full named exercises and per-set reps/RIR/rest are in JSON, joined by exercise ID to the named session diagnostics.

## Findings requiring subsequent algorithm work

The full reference has **0 crashes**, **0 unexpected infeasible results**, and **33 expected empty-catalogue controls**. It has **887 short nonempty hypertrophy sessions** (694 beginner / 116 intermediate / 77 advanced). This is a larger sampling frame than the old 406 count, not an allocator regression or a count of users. No strength workout is judged by the hypertrophy 12-set floor.

Selected hypertrophy diagnostic occurrence counts: 161 focus-without-press, 71 focus-without-pull, 31 focus-without-lower-work, 464 beginner-technique-review and 314 repeatable-template overlaps. These count findings across repeated seeds, not unique configurations or injury risks. They must not all be repaired by making splits rigid or prohibiting valid exercises.

The advanced full-equipment, 5×75 PPL, back/triceps priority case ranges from **111 sets at seed 201 to 99 at seed 208**. The 12-set span exceeds the retained 10-set sensitivity threshold; the full audit therefore exits **1**, intentionally. It is deterministic: the second run reproduces every result exactly. Seed 208 uses different compounds/accessories and the policy trace rejects candidate repairs for lower minimum session load, wider spread, reduced performed volume and, for accessory-aware, extra template overlap. This explains rejection, but does not prove the retained 99-set plan is optimal. Next work should examine seed-sensitive provisional credit/time costs and bounded local repairs without weakening the whole-plan guard.

The description-tag catalogue experiment changes **140/605 prescriptions**. Its per-case snapshots correctly identify **572 catalogue-experiment pairs** and **33 fixed empty-catalogue pairs**. Short sessions increase **406→408**; two material volume-loss findings occur at `T-seed-3` (−4 sets, one additional short session) and `Z-time` (−15 sets). It exits **2** for experiment review and remains unpromoted. Better metadata is not automatically a better allocator.

## Reproduction commands

Run from the project root. Use a new output path to preserve dated references.

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --output=/private/tmp/vigor-full.json.gz
node --import tsx scripts/evaluate-generator.ts --matrix=legacy --extended --seeds=10 --baseline=docs/audits/2026-10-01-quality-after.json.gz --output=/private/tmp/vigor-paired.json.gz
node --import tsx scripts/evaluate-generator.ts --matrix=legacy --extended --seeds=10 --metadata=reviewed --baseline=docs/audits/2026-10-01-quality-after.json.gz --output=/private/tmp/vigor-tags-experiment.json.gz
node --import tsx scripts/evaluate-generator.ts --replay=docs/audits/2026-10-01-quality-full.json.gz --case=cross-HYPERTROPHY-ADVANCED-PUSH_PULL_LEGS-back-arms-full --output=/private/tmp/vigor-replay.json.gz
```

## Validation

967 tests / 52 suites pass. TypeScript and the 379-entry catalogue schema validation pass. Focused coverage of the changed evaluator/contract and audit protocol/matrix modules is 100% statements/functions/lines and 98% branches, satisfying existing thresholds. Tests cover quality-axis independence, malformed doses/durations/indices, volume compromise visibility, supported-thrust compatibility, goal-specific constraints, snapshot integrity, legacy replay rejection, catalogue-ID/parameter changes, measurement-version changes, missing coverage, crashes, matrix coverage and seed boundaries. The unchanged sensitivity gate failure and unpromoted catalogue experiment are explicitly retained rather than hidden.

The remaining checklist points, catalogue scientific audit, allocator repairs and app UI presentation of these diagnostics remain separate work. No claim is made that all generated routines have received individual coaching approval.
