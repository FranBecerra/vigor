# Joint first-generation dose allocation

## Scope

The generation screen now calls `planDoseFirstMesocycle`. It constructs a seed-independent allocation before requesting dose-preserving exercise variation. Saved prescriptions and manually edited previews are not regenerated. Strength and explicit ranking-policy controls retain their existing planner. No native build, deployment, infrastructure or saved data is changed.

This supersedes the unpromoted prototype described in `2026-10-08-first-generation-dose-experiment.md`. The new work addresses that prototype's concrete placement and capacity defects rather than stopping after its failed promotion.

## Algorithm

1. Build original provisional per-muscle targets from athlete inputs. Available time is a feasibility constraint, not a measurement of recovery or a reason to invent extra targets.
2. Retain a deterministic coupled allocation after residual-dose completion and recovery-aware placement repair.
3. Enumerate a common roster lattice: 17 squeeze levels, three selection policies and both existing appearance-cap modes. Deduplicate identical exercise/dose rosters. These candidates depend on athlete targets and catalogue, not the requested variation seed.
4. Find a canonical placement budget from each roster's mean duration plus six minutes of packing headroom, increasing by three minutes when placement remains unresolved. This headroom is an engineering heuristic, not a physiological threshold. Athlete capacity filters feasibility. Evaluate up to twelve feasible complete candidates.
5. Complete useful residual dose against original targets, jointly testing additions and integer redistribution. A two-set isolation can cover a one-set target residual, but receives utility only for actual missing credit. Do not add filler just to reach the twelve-set review floor.
6. Repair placements through AUTO session permutations, bounded allocation repair and atomic three-day rotations of one or two appearances. Explicit splits retain their declared day order. Actual preceding workouts remain in the guard.
7. Compare complete plans under duration, assigned-work, total dose, direct-work, exposure, anchors, redundancy, concentration, muscle-cap and rest-template checks. Only then vary exercises using the requested seed while preserving exact per-session direct/indirect dose.

The first-allocation objective distinguishes undated ordinal adjacency alerts from rest-template deficits. It may accept higher aggregate ordinal flagged workload when original-target coverage improves by more than half a credited set, performed dose does not fall, rest-template count/cost does not increase, and there is no actual preceding workout. Placement-only repair may make the same ordinal trade-off only when rest-template review count strictly decreases at unchanged dose, without increased template cost or any actual preceding workout. Existing-plan rerolls retain their stricter contract. This is an explicit programming trade-off, not a relaxed physiological safety guarantee.

Invocation-local sequencing memoization preserves the original diagnostic arithmetic. It does not cache athlete plans across calls. Ranked deterministic selector branches remain internal comparison controls; the roster lattice does not require them.

## Validation record

Tests cover thirty level/split/capacity profiles, ninety dose-preserving variations, catalogue enumeration independence, invalid and empty inputs, strength/policy controls, exact placement-dose preservation, hard timing guards, sequencing-cache parity, production/control audit-mode resolution, the three recovery-regression families and actual preceding-workout protection.

Final validation: `npm test -- --runInBand` passes **1,196 tests / 67 suites**; `npx tsc --noEmit` passes. The matrix's strict counter exception is reported separately below; passing unit tests does not turn that gate green.

## Paired matrix and programming review

Same athlete inputs, catalogue and measurement: **3,575 simulations**, including 2,046 hypertrophy cases (2,013 nonempty controls) and 1,529 strength cases. Ten requested seeds plus a five-minute capacity probe per base input. Repeated seeds are not independent athletes.

| Measurement | Previous initial generator | Integrated allocation |
| --- | ---: | ---: |
| Short hypertrophy sessions, excluding expected empty controls | 824 | 748 |
| Valid hypertrophy cases with a short session | 200 | 165 |
| Sufficient-total-dose cases with a short session | 0 | 0 |
| Advanced seed spans above ten sets | 3 | 0 |
| Any nonzero hypertrophy seed-dose span | present | 0 |
| Negative five-minute dose probes | not guaranteed | 0 |
| New crashes / hard / time / protocol-defined volume regressions | — | 0 / 0 / 0 / 0 |
| Paired increases in rest-template review count | — | 0 |
| Expected empty-catalogue controls | 33 | 33 |

Strength prescriptions remain unchanged. Original-target aggregate shortfall improves in 1,014 comparisons, worsens in 594 and is unchanged in 1,967. Those mixed results matter: the new deterministic candidate is not a Pareto improvement over every random former variant. The aggregate shortfall sum decreases from 71,505 to 70,738 across the complete matrix; summing ordinal attributed deficits is a software comparison, not an athlete outcome measure.

| Reviewed input | New prescription | Assessment |
| --- | --- | --- |
| Advanced balanced UL/AUTO, free weights, 4×75 | 88 sets: 22/23/22/21; target shortfall 34.5→28.5 versus the base draw | Stable across all seeds, balanced, no rest-template review. AUTO remains independently distributable. |
| Advanced balanced PPLU, full equipment, 4×75→80 | 90→96 sets: 22/22/23/23→24/24/24/24 | No capacity collapse or rest-template review. At 75 minutes shortfall 27→29 versus the base draw; not uniformly superior. |
| AD: advanced free-weight AUTO, 6×60→65 | 92→92: 16/15/16/15/14/16 | The previously lost three sets are retained; no rest-template review. Original shortfall 26→24.5. |
| Beginner declared BACK 8 / QUADS 4, 4×65 | 48: 12/12/12/12 | Joint addition plus redistribution repairs the prototype's genuine 48→46/47 regression. |
| C: intermediate AUTO, 5×65 | 89: 18/17/17/19/18 | Original shortfall unchanged at 1.5; no rest-template review. |
| V: intermediate AUTO, 5×65 | 78: 16/16/15/16/15 | No rest-template review; better shortfall 10.5→10. |
| K: beginner AUTO, 2×45 | 24: 12/12 | Fits and balances, but shortfall worsens 23→25.5 versus a 26-set former draw. Keep visible; this is not evidence of a better stimulus. |
| Advanced upper-only, 4×65 | 51: 13/13/13/12 | Same original shortfall 0.5 with two fewer performed sets; no rest-template review, without lower-body filler. |
| Advanced PPL, BACK/TRICEPS priority, 5×75 | 110: 23/20/22/23/22 | Same shortfall 10, no rest-template review; formerly 113 sets. |
| Advanced PPL, GLUTES/HAMSTRINGS priority, 5×75→80 | 109→114; 75-minute loads 22/21/22/22/22 | No rest-template review; original shortfall 9.5→8 at 75 minutes. |

### Explicit residual comparison flags

The unchanged strict comparison gate exits **1** because sixteen comparisons increase the number of days below twelve sets. This is not concealed or reclassified as a green gate. All sixteen new prescriptions lack enough total dose for twelve sets on every requested day. The sixteen are eight input families, not sixteen independent users:

- S seed 7: same 50 sets, minimum 7→9 and spread improves by two; original shortfall worsens by half a credited set.
- Intermediate upper-only seeds 7/8: 43→41, minimum at least ten, spread improves by two and rest-template reviews disappear. Original shortfall improves or stays equal.
- Beginner PPL balanced full, base/seeds 3/9/time: 50→49, minimum 8→9 and spread improves by two. Original shortfall stays equal or worsens by half a credited set.
- Beginner PPL balanced free, base/time: same 50 sets, minimum 8→10, spread improves by four and shortfall improves by half a credited set. Five ten-set days are better balanced than 10/10/10/12/8, although the strict short-day counter increases.
- Beginner PPL back-arms full seed 9 and no-barbell seed 5: same 50 sets, better spread and target coverage; no new rest-template review.
- Beginner PPL back-arms free seeds 4/5/9: 50→49. Coverage worsens by 0.5/1 in two comparisons and improves by 2.5 in the third; seed 9's minimum falls 9→8. This remains a genuine schedule/coverage compromise, not a universally better prescription.
- Beginner PPL lower full, base/time: 54→51, unchanged minimum nine, spread three and original shortfall six. Fewer performed sets buy the same attributed target coverage; do not restore arbitrary filler to make the warning disappear.

The strict counter is retained. Integration is a deliberate, documented trade-off: dose is deterministic, overall short sessions and deficits decrease, sufficient-dose placement remains repaired and recovery/capacity regressions are removed, while some former random draws retain better individual target coverage. Point 2 must address the remaining 165 dose-limited schedules through actually evaluated alternatives, including the above exceptions. This is not a global optimization or coaching sign-off.

The final matrix's 183 nonempty hypertrophy base measurements, including quality evaluation and schedule-alternative diagnostics, are 3–1,017 ms, median 92 ms, p95 502 ms on this Mac. Audit-local reuse accelerates subsequent seeds. These are not iPhone latency or rendering measurements.

## Reproduction

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 \
  --baseline=/private/tmp/vigor-reroll-release-generator-20261008.json.gz \
  --output=/private/tmp/vigor-dose-first-release-20261008.json.gz
```

New audits default to production dose-first generation. `--raw-planner` explicitly evaluates the former initial generator; `--stable-dose` retains the rejected seed-zero experiment. Replay preserves its archive's recorded generation mode and rejects conflicting overrides. `--case` scopes the exact case family, its seeds and its capacity probe; it no longer accidentally launches the whole matrix.

## Limits and next work

This is a bounded candidate search, not a globally optimal solver or proof of monotonicity for every possible capacity. Provisional targets, half-set secondary credit, ordinal criteria, overlap diagnostics and the twelve-set floor are programming heuristics, not measured individual MEV/MRV, hypertrophy effect sizes, CNS fatigue or injury risk. Repeated seeds are robustness checks, not independent athletes.

The next approved workstream is dose-limited schedule suitability: evaluate fewer workout days or explain the compromise without filler or silently overriding an explicit session preference. Catalogue provenance, apparatus-aware filtering and native latency/visual QA remain separate work; adaptive volume still requires comparable observed exposures.
