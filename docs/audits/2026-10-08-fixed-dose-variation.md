# Fixed-dose generation and variation

The user approved preserving the per-muscle budget when requesting another combination. This supersedes the pending regeneration-contract decision in the earlier October 8 record.

## Contract and implementation

Initial generation still uses the validated `planMesocycle`. With an existing preview and unchanged settings, the generation screen calls `rerollMesocycle` instead of regenerating and squeezing the budget. A single canonical reference for first generation was separately tested and rejected, as detailed below. Explicit ranking-policy controls and initial planning remain unchanged.

`rerollMesocycle` preserves the incumbent targets, squeeze, performed total, per-session sets and exact primary/secondary attribution. Hypertrophy replaces at most three exercises over 80 candidate evaluations. An alternative must have the same primary muscle, profile, movement vector and one-set attribution. It must be available in the filtered catalogue, absent elsewhere in the plan, eligible for automatic generation and not clearly ordinally dominated by the incumbent. Manual-only and strength-only alternatives cannot enter this draw. A fallback cannot displace a standard incumbent. Existing recorded stimulus dimensions may change values but not lose diversity counts within an axis/muscle. Unrecorded dimensions remain catalogue uncertainty, not inferred evidence of variety.

Every candidate recomputes selection and placement diagnostics and passes the complete final-plan guard, except that a variation need not improve the allocation deficit or optimization objective. Ordinal systemic cost cannot increase. Preserve duration, direct floors, coverage, anchor/redundancy/cap/concentration constraints, primary exposures and adjacent/cyclic/template diagnostics. Strength competes three prescribed candidates and additionally freezes role/set/single distributions and main lift identities. No acceptable candidate means the original object/plan is retained.

The UI distinguishes a new budget (changed settings) from variation (unchanged settings). Manually edited or expanded previews are not discarded by reroll: an inline message directs individual swaps. Failure keeps the plan and reports that no compatible variation was found. No native alert was added. A successful reroll stores its new seed; an unsuccessful one does not. Persisted sessions, not the seed alone, remain the authoritative saved routine.

## Paired variation audit

Thirty profiles: three experience levels × five splits × full/free equipment, with 3/4/6-day schedules at 75 minutes; full-body cases prioritize back/triceps. Each profile has ten successive variation draws: 300 total, including the three formerly seed-sensitive advanced configurations.

Final production results: **300 changed draws, zero dose violations, zero time violations, zero within-profile performed-set span**. Local maximum draw time was approximately 6.0 ms under concurrent Mac tests, not an iPhone measurement or responsiveness guarantee. These are thirty simulated input profiles, not thirty athletes; several AUTO/upper-lower outcomes coincide. Separate unit tests cover no-compatible-option fallback.

The formerly seed-sensitive advanced profiles start at 77 performed sets for free-equipment AUTO/upper-lower (initial seed 209) and 79 for full-equipment PPLU (initial seed 206). All ten successive variations preserve those budgets and exact direct/indirect per-session dose, not merely the performed total. Other fresh initial seeds can still establish different budgets; the correction prevents “Another combination” from changing the established dose. No rejected higher-dose candidate is promoted just to close a seed-span metric.

## Programming review and limits

The thirty initial profiles and their variation outcomes were inspected. Variation is intentionally conservative; it does not rebuild a split or add sets to spend spare time. Examples include compatible chest-press, chest-fly, squat and curl substitutions. Distinct known curl angles remain protected through tag-axis coverage, but incomplete exercise tags still limit this assessment. Variants are programming alternatives, not claims of identical actual hypertrophy stimulus.

Beginner six-day PPL profiles still have insufficient aggregate dose for a twelve-set-per-day floor; freezing variation does not solve an unsuitable session-count request. Previously observed close-grip-bench and focus-label imperfections can remain in the incumbent roster. No global optimality, individual recovery or exhaustive source-review claim is made.

### Rejected additional first-generation experiment

The existing planner was evaluated at a canonical seed zero before varying the roster. This made initial budgets independent of the requested seed but was not a sufficiently robust capacity/dose solver. Thirty-profile testing found zero variation-dose violations (274 changed draws, 26 retained incumbents), but the subsequent 3,575-case matrix rejected it: ten volume comparisons regressed, including K variants, intermediate upper-only seeds 7/8 and advanced balanced PPLU's +5-minute probe. That last probe dropped 96→81 performed sets compared with its previous seed-specific result and established 81 rather than its own 75-minute reference's 90 sets. No new crashes or hard failures occurred; eliminating seed variation alone was not sufficient for promotion.

The app-facing canonical helper and its UI wiring were removed. The full audit's `--stable-dose` flag and `generationMode: stable-budget` archive label retain reproduction of this rejected experiment only. Replays infer the archived mode. Reference-plan caching is audit-local over immutable matching input/catalogue snapshots, not a mutable production cache. The rejected source-matched archive is `/private/tmp/vigor-stable-dose-release-20261008.json.gz`; it is not the release baseline. First-generation invariance requires a proper dose/capacity allocator with monotonicity and quality checks, not choosing one arbitrary seed. No further user decision is needed for that future implementation.

Reproduce the paired variation audit:

```sh
node --import tsx scripts/evaluate-dose-preserving-reroll.ts --output=/private/tmp/vigor-fixed-dose-reroll-release-20261008.json
```

The local artifact contains all thirty initial rosters and all 300 resulting session rosters; it is not a committed dataset. Native tap-flow and iPhone latency have not been verified in this iteration. No commit, deployment, signing or infrastructure change.

## Final release validation

Full suite: **1,146 tests / 66 suites pass**, TypeScript passes. Tests cover deterministic variation, source immutability, exact direct/indirect/session/total dose, constraint and ordinal-cost guards, stimulus-dimension preservation, catalogue eligibility, no-compatible-option fallback, strength main-lift/single/role preservation and stale/edited-preview intent.

Source-matched production matrix `/private/tmp/vigor-reroll-release-generator-20261008.json.gz`: 3,575 inputs, **zero initial-prescription changes**, zero crashes/new hard failures/detected time or volume regressions compared with `/private/tmp/vigor-dose-rebalance-20261008.json.gz`. Thirty-three expected empty-catalogue controls, 824 short sessions and 200 insufficient-total-dose cases remain. Raw initial generation still has three advanced twelve-set seed spans, so this audit exits 1 deliberately; it is not fully green. Those spans must not be confused with the zero span in all 300 incumbent-dependent variation draws.

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --baseline=/private/tmp/vigor-dose-rebalance-20261008.json.gz --output=/private/tmp/vigor-reroll-release-generator-20261008.json.gz
npm test -- --runInBand
npx tsc --noEmit
```
