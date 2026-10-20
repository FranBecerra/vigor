# Final dose repair and seed contract review

This record supersedes the twelve open beginner allocation cases in the earlier October 8 audit. It does not close catalogue validation, native QA, observed-response personalization or seed-dose invariance.

## Implementation and validation

After the existing six full-roster probes, production hypertrophy generation tests bounded one-set redistribution between existing exercises, then twelve inexpensive policy/seed probes if necessary. The set transfer keeps total performed dose and the roster, donor minimums of two isolation/three compound sets and recipient maximum four. It refreshes attribution, duration, order and sequence/frequency diagnostics and uses complete-plan promotion guards. Strength, explicit policy controls and insufficient-total-dose plans are unchanged.

Allocation improvement may be accepted with neutral dose/cost objectives. An exact-total, same-roster set transfer may increase aggregate uncapped target shortfall by at most 0.5 only with strictly lower ordinal cost. This is an explicit programming tradeoff at fractional-credit resolution, not scientific evidence of better growth. Per-muscle dose is not frozen. Existing attribution tolerance remains; no recovery guard was removed.

Source-matched paired full matrix: 3,575 inputs, 2,046 hypertrophy (2,013 excluding 33 expected empty-catalogue controls), 1,529 strength. Exactly twelve prescriptions change, all beginner hypertrophy. Zero crashes, new hard failures or detected time/volume regressions; strength unchanged. Sufficient-total-dose underfilled cases: 12→0. Insufficient-total-dose cases: 200 unchanged. Affected cases: 212→200; short sessions: 836→824. The twelve-set floor is a product review threshold, not a physiological minimum.

Validation: 1,132 tests across 65 suites pass; TypeScript passes. The matrix exits 1 because three advanced seed spans remain. Do not describe that audit as fully green.

Archives: `/private/tmp/vigor-final-roster-release-20261008.json.gz` before, `/private/tmp/vigor-dose-rebalance-20261008.json.gz` after. These are local artifacts, not committed datasets.

Reproduce:

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --baseline=/private/tmp/vigor-final-roster-release-20261008.json.gz --output=/private/tmp/vigor-dose-rebalance-20261008.json.gz
npm test
npx tsc --noEmit
```

## Individual review of all twelve changes

All sessions fit the current estimated time model, not a timed real workout. No new issue signatures occur in the eleven set-transfer cases.

| Case ID | Before → after session sets | Total | Individual disposition |
|---|---|---|---|
| BEGINNER-emphasis | 13/12/13/11 → 12/12/13/12 | 49 unchanged | French press 3→2; overhead dumbbell extension 3→4. Weekly triceps dose preserved; a concentrated day donates to the thin day. |
| BEGINNER-emphasis-seed-3 | 13/12/13/11 → 12/12/13/12 | 49 unchanged | French press 3→2; overhead cable extension 3→4. Same-muscle transfer; ordinal cost decreases. |
| BEGINNER-emphasis-time | 13/12/13/11 → 12/12/13/12 | 49 unchanged | Same transfer as the first case at 70 rather than 65 minutes; no filler added to use spare time. |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-balanced-full-seed-4 | 13/13/12/11 → 13/12/12/12 | 49 unchanged | Front squat 4→3; good morning 3→4. Quad dose −1, hamstring dose +1; aggregate shortfall 2→2.5, ordinal cost 101→100. Acceptable bounded distribution tradeoff, not evidence that four good-morning sets are physiologically superior. |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-balanced-full-seed-7 | 12/12/11/13 → 12/12/12/12 | 48 unchanged | Overhead cable extension 3→4; bar pushdown 3→2. Exact weekly triceps dose preserved. |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-back-arms-full-seed-3 | 13/12/13/11 → 12/12/13/12 | 49 unchanged | French press 3→2; overhead dumbbell extension 3→4. Maintains priorities and roster; no modeled recovery deterioration. |
| cross-HYPERTROPHY-BEGINNER-UPPER_LOWER-back-arms-full-seed-5 | 14/12/13/11 → 13/12/13/12 | 50 unchanged | French press 3→2; overhead cable extension 3→4. Lower ordinal cost; no forced additional exercise. |
| cross-HYPERTROPHY-BEGINNER-PUSH_PULL_LEGS_UPPER-balanced-full-seed-7 | 12/12/11/13 → 12/13/12/13 | 48→50 | Full-roster replacement, candidate seed 203, legacy policy. Target shortfall 3→1 and ordinal cost 103→94. See the qualified review below; not unconditionally better in every dimension. |
| cross-HYPERTROPHY-BEGINNER-AUTO-balanced-full-seed-4 | 13/13/12/11 → 13/12/12/12 | 49 unchanged | Same front-squat/good-morning tradeoff as upper/lower seed-4; AUTO duplicate, not independent athlete evidence. |
| cross-HYPERTROPHY-BEGINNER-AUTO-balanced-full-seed-7 | 12/12/11/13 → 12/12/12/12 | 48 unchanged | Same overhead/pushdown transfer as upper/lower seed-7. |
| cross-HYPERTROPHY-BEGINNER-AUTO-back-arms-full-seed-3 | 13/12/13/11 → 12/12/13/12 | 49 unchanged | Same French-press/overhead-dumbbell transfer as upper/lower seed-3. |
| cross-HYPERTROPHY-BEGINNER-AUTO-back-arms-full-seed-5 | 14/12/13/11 → 13/12/13/12 | 50 unchanged | Same French-press/overhead-cable transfer as upper/lower seed-5. |

### PPLU qualification

New sessions: Push = step-ups, abdominal wheel, low cable fly, French press (3 each); Pull = pulldown 3, chest-supported row 3, face pull 4, incline curl 3; Legs = dumbbell RDL 4, leg press 4, machine lateral raise 4; Upper = machine chest press 4, overhead dumbbell extension 3, inclined lateral raise 3, preacher curl 3. Estimates: 42/45/42/45 minutes.

The pull day now has recognizable vertical/horizontal pulling and supported work; leg work has distinct knee/hip patterns, without duplicate RDL variants. Biceps has two complementary curl angles; triceps has two extensions. The Push label still lacks a press (also true before), so label/anchor coherence remains debt rather than a new violation. Back/rear-delt exposure is concentrated on Pull. New issue signatures are lateral-delt sequence overlap and single-frequency rear delts; the complete guard protects aggregate count/risk, not identical warning subjects. The proposed rest template puts a rest slot between Legs and Upper; its lateral-delt cost is below the existing review threshold, which is not a recovery guarantee. Hamstrings remain one attributed set below target. This is an accepted allocation/objective improvement with explicit qualifications, not a perfect routine or proof of optimality.

## Three remaining seed-dose sensitivities

Advanced balanced four-day 75-minute upper/lower with free equipment and its AUTO duplicate span 77–89 performed sets. Advanced balanced PPLU with full equipment spans 79–91. These are not thin-day allocation defects. Seed-dependent selection and capacity squeezing change final muscle dose even though provisional targets are fixed.

Bounded attempts to promote high-dose alternatives fail existing guards. One 77→89 alternative increases template warning cost 0→6, adjacent/cyclic count 2→4 and summed flagged risk 26.8125→76.4375; quad attribution falls 9.5→8. A 79→91 PPLU alternative drops core attribution 8→4 and glutes 11→9.5, loses exposures and adds redundant pairs. These are examples of rejected candidates, not proof that no feasible alternative exists.

The unresolved UX contract is whether “Another combination” must freeze the existing per-muscle budget and change exercises only, rejecting combinations that cannot accommodate that dose, or may make small disclosed dose changes for variety. Fixed budgets are recommended. The question was presented to the user; no new seed-invariance contract is implemented in this iteration. Solving it requires separating seed-independent capacity/dose determination from roster variation, with failure/fallback behavior and deterministic tests; widening seed searches or suppressing warnings is not a substitute.

No commit, native build, signing, installation, deployment or infrastructure change.
