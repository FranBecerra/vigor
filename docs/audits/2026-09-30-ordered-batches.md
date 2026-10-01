# Ordered generator batches: implementation and paired review

## Scope and reproducibility

This advances batches 1–4 of the approved debt plan. It does not close the individual scientific review of all 378 exercises, observed-response personalization, or the entire 15-point plan. Deployment and offline-build work remain deferred.

Artifacts: `2026-09-30-coupled-before.json.gz` and `2026-09-30-coupled-after.json.gz`. Each contains complete inputs, prescriptions and engine/catalogue fingerprints. The latter adds evaluated alternatives. There are 605 paired cases: 55 configurations, ten seeds each and one +5-minute perturbation per configuration. All 605 have identical athlete inputs and catalogue fingerprints; ranking policy is the experimental intervention, not an athlete input.

Reproduce:

```sh
node --import tsx scripts/evaluate-generator.ts --extended --seeds=10 --baseline=docs/audits/2026-09-30-coupled-before.json.gz --output=/private/tmp/vigor-coupled-verification.json.gz
```

## Batch 1: mechanical families, not blanket hip-extension bans

The checked family map distinguishes torso hinges, floor pulls, supported thrusts and supported extensions. RDL plus hip thrust is permitted; RDL plus dumbbell RDL remains a near-duplicate. Unknown hip mechanics remain explicitly unverified. Late repair counts demanding torso hinges rather than all hip-dominant work. This is a programming heuristic, not a universal prohibition or measured fatigue score. Non-hip compound checks are still broad: the complete mechanical taxonomy remains open.

The six previously source-confirmed guide classification corrections remain in place. None of the 257 manual-only imports is promoted automatically. Screening 378 entries is not equivalent to verifying every exercise's figures, citations, muscle credit and six ratings.

## Batch 2: undated rest structure

The saved mesocycle has optional `scheduleTemplate: { days, slots }`. Slots are workouts referencing session indexes or rest. Defaults use seven days; valid explicit cycle lengths are 1–28 days with enough slots for all sessions. Workout order is invariant. Rest is dispersed before stacking multiple days in a gap; among equally filled gaps, direct-muscle overlap has priority. This is an explainable layout preference, not proof of recovery.

The preview shows the proposed template. The expanded routine calendar card supports moving rest earlier/later and changing cycle length. Optional dates are generated from this exact template. Changing a template never shifts previously dated entries or advances workout progression. Transactional saves validate the latest persisted session indexes. Recovery checks include the last-to-first boundary, exclude warmups and label unresolved adjacency as guidance, not a physiological diagnosis. Seven-day volume equivalents use the selected cycle length without increasing the prescribed dose.

## Batch 3: volume-first coupled candidate with a baseline guard

`buildVolumePlan` remains first. Candidate selection credits only outstanding direct/indirect muscle targets; surplus cross-muscle credit has no marginal utility. Direct arm-work requirements are preserved. Utility is considered with actual modeled minutes and the ordinal systemic-cost criterion, not claimed neural fatigue. The coefficient 0.1, secondary credit 0.5 and comparison tolerances are programming choices, not measured effect sizes.

An unconditional `volume-aware` experiment increased short sessions from 435 to 443 and was rejected. Production compares the legacy candidate against the coupled candidate. Promotion requires no time overflow, empty or unassigned sessions; no reduction in total sets; no worsening of minimum-session size, set spread, underfilled-day count, foundational-pattern deficit count or rest-template overlap warnings; protected direct-arm coverage and bounded attributed-muscle differences. Among passing candidates, lower target shortfall or tied shortfall with lower ordinal systemic cost wins. Strength prescriptions remain unchanged. This is bounded candidate search, not a globally optimal allocator.

Final results:

| Metric | Before | After |
|---|---:|---:|
| Underfilled sessions, beginner | 241 | 235 |
| Underfilled sessions, intermediate | 117 | 117 |
| Underfilled sessions, advanced | 77 | 77 |
| Total underfilled sessions | 435 | 429 |
| Unexpected crashes | 0 | 0 |
| Empty-catalogue expected infeasible cases | 33 | 33 |
| Close-grip bench appearances | 431 | 418 |

104 of 605 prescriptions change. No new hard failures, large total-volume regressions, >10-set seed spans or >3-set losses under the +5-minute perturbation were detected. The small reduction in short days is not a sufficient solution to session imbalance. Close-grip bench is still disproportionately common. The final count supersedes the interim 428 result: the minimum-size/spread guard rejects an advanced candidate that achieved a superficially better count by worsening distribution.

## Individual review of changed base configurations

These are written programming judgements of base configurations, not 605 independent coaching reviews. Seed variants retain their exercises and automated findings in the paired artifacts.

| Case | Review and remaining concern |
|---|---|
| A | 18/17/21/21 sets, back/triceps priority. Horizontal/vertical pulls, direct overhead extensions, direct curls and seated knee flexion provide coverage. Flexible upper work on a lower day is intentional. Close-grip bench and multiple lateral-raise exposures deserve continued concentration review. |
| L | 11/11/12 sets. Still below the product minimum on two days; changing a hinge does not fix the time/dose feasibility problem. Free squat plus RDL is technically demanding for a beginner. Do not describe this as an optimized beginner routine. |
| U | 18/18/21/17, limited change from 18/17/21/18. Direct arm work and both pull orientations remain. Conventional deadlift plus good morning on different days may be excessive systemic cost for hypertrophy; calendar spacing alone does not establish tolerance. |
| X | 17/17/16. Balanced performed dose and coverage with supported hip thrust and separate RDL. Front squat, lunges and unsupported row impose greater skill/stabilization demands; they are defensible options for an advanced athlete, not universally preferred choices. |
| AB | 24/22/27/27. RDL plus hip thrust is complementary under the revised policy, but adding Bulgarian squat and leg press on that day makes a large lower-body exposure. Passing a time model cannot establish individual recovery. Retain a concentration-review warning/debt. |
| AC | 21/18/21/18/23. Supported thrust plus good morning is now allowed, not banned simply for sharing hip extension. Multiple chest/lateral-delt variants provide variety but could be streamlined; declared priorities and per-muscle residuals must justify them. |
| INTERMEDIATE-declared | 19/15/18/16 instead of 19/15/15/19. Same total, improved spread. RDL plus hip thrust no longer requires artificial separation. Direct biceps work survives allocation. Declared volume remains a user input, not an inferred tolerance measurement. |
| ADVANCED-emphasis | 19/19/19/18 instead of 19/18/18/18, two more performed sets. Back/triceps coverage and direct curls remain. This small accepted increase is within modeled capacity; it does not justify increasing all profiles' volume. |
| ADVANCED-veto | 19/19/19/19 instead of 19/19/16/19. Excluded exercises remain excluded; alternative hinge and machine/cable choices preserve coverage. Conventional deadlift still deserves goal-specific cost review. |

## Batch 4: actual fewer-day alternatives

52 audited scenarios have a qualifying alternative. This is an optional proposal, not an automatic replacement and not a claim that all 429 short sessions are solved. Candidate plans retain the same seed, minutes per session, equipment, priorities and targets. Acceptance requires no reduction in performed volume, comparable attributed-muscle coverage, preserved direct-arm floors, valid hard constraints, every training day at least 12 sets and no additional undated overlap warnings. The closest lower frequency is tested first; impossible proposals return no alternative rather than filler.

Case S is now explicitly regression-tested: five days at 10/12/9/10/9 become four at 13/12/13/12, preserving 50 sets. The other base offers are BEGINNER-emphasis (14/17/17), BEGINNER-declared (13/14/16), BEGINNER-upper-only (12/12), BEGINNER-veto (16/14/17), and INTERMEDIATE-upper-only (13/14/13). Upper-only requests remain intentional, not silently expanded to legs.

The generation preview offers an explicit button to inspect the alternative. Stale plans and plans with manual edits do not offer replacement, protecting the athlete's changes. Accepting updates both the displayed plan and saved frequency input.

## Remaining execution gates

Finish the 378-entry source review and non-hip families; diagnose close-grip-bench concentration and goal-specific hinge cost; implement observed-response recommendations only with comparable completed-dose/performance/recovery data; expand sensitivity beyond seeds and +5 minutes. Do not infer measured personal MEV/MRV from generator outputs or missing history.

Validation includes business-logic, calendar conversion, transaction isolation, alternative feasibility and case-S regression tests. TypeScript and the 378-entry schema validation pass. Native layout/gesture behavior and device persistence still require an on-device check; no deployment was performed.
