# Bounded fixed-dose calendar packing

## Scope

Improve calendar efficiency without changing the fixed muscle targets or introducing filler. The bounded repair is enabled only for fixed-dose recommendation distributions. Final hypertrophy generation retains the validated default and is separately used to verify the improved calendars. Strength prescriptions are excluded. The sequential wizard remains future work.

## Implementation and guards

`packSessionCapacity` operates on complete exercise appearances, single exchanges, two-appearance bundles, and set transfers between existing occurrences of the same exercise. It never selects another exercise, clones an occurrence, reduces weekly exercise dose, changes rest prescriptions, or creates a new one-set compound anchor. It preserves pre-existing muscle exposure counts and compound anchors. Time totals are recomputed with the shared duration model.

Search is capped at 1,000 evaluated candidates and six accepted iterations. Once a donor fits, accept the repair and use the remaining budget on other donors instead of exhausting it on equivalent alternatives. Calendars already fitting, invalid/noninteger doses, invalid budgets and strength work exit early. Current aggregate duration above total capacity is a conservative early exit; it is not a proof of optimality when existing repeated appearances could change their setup allowance through redistribution.

Acceptance must strictly reduce overflow without creating empty sessions, new exercise-family redundancy, greater per-session muscle-cap excess, greater aggregate fractional concentration above the ten-set soft reference, or worse modeled recovery (template warning count/cost, raw sequencing warning count and aggregate risk including cycle wrap and supplied previous session). Each session retains at least its original below-twelve load, or twelve sets if it was already above that product-quality floor. A roster with sufficient total dose but existing thin sessions is delegated to joint underfill repair rather than being legitimized by a time-only fit. These are programming safeguards, not clinical safety guarantees.

The distributor refreshes ordering, per-muscle frequency, times and structural/sequencing diagnostics after opt-in packing. The recommender enables it by default; `capacityPacking: false` disables it for paired diagnostics. Ordinary final-generator calls do not opt in. Neither control is exposed as a user setting.

## Rejected experiments

- Creating a new isolation appearance enabled an intermediate 6×60→4×75 result, but violated the existing no-repeat contract and produced new hard failures in the full audit. Removed rather than weakening the tests or claiming that result shipped.
- A global minimum-load guard could allow a previously twelve-set day to become short when another day was already short. Replaced with per-session floors and a joint-underfill eligibility guard. Beginner PPL 4×45, biceps priority, seed 68 has a regression test.
- A bounded no-cloning pass initially exhausted its budget on the first donor while another still overflowed. Early acceptance of a fitted donor preserves budget for later repairs.
- Enabling the repair globally changed 36 final prescriptions. Although no hard/time/volume regression was detected and the short-session count stayed 838, five cases increased recovery-template warning counts and ten increased raw adjacent-workout flags. Two prescriptions lost one performed set through policy/rounding effects. These side effects arise because improved feasibility changes full-search roster/policy decisions; intra-roster packing guards alone do not prevent them. Global enablement was rejected. The rejected archive is `/private/tmp/vigor-packing-release-generator-20261007.json.gz`; final unchanged-engine verification uses a separate safe archive.

## Paired recommendation and actual-plan review

Command: `node --import tsx scripts/benchmark-capacity.ts OUTPUT.json --extended --paired-packing --verify-plans`.

The 55 test configurations span all three experience levels, five structures and balanced/biceps/glute priorities, plus strength, limited-equipment and empty controls. They include implicit/explicit AUTO reproducibility repeats. Three actual generated plans per configuration produce 165 inspections; the paired recommendation control disables only packing, preserving targets, seeds and selection policy.

Six configurations improve their recommendation (including implicit/explicit AUTO repeats): advanced balanced AUTO/upper-lower and advanced PPL/PPLU biceps change six 75-minute sessions to five, keeping approximately 109 estimated performed sets. Intermediate full-body with glute priority uses four 75-minute sessions rather than five 60-minute sessions, with the same estimated 85 sets and scheduled total time. The original balanced intermediate and PPL/biceps six-day cases are not claimed fixed: one seed remains too tight under the current no-repeat/recovery guards. Reducing all six-day recommendations is not the acceptance criterion.

The final paired archive is `/private/tmp/vigor-packing-final-extended-20261007.json`. All 162 nonempty-catalogue actual plans fit their proposed duration and have no empty/unassigned sessions; the three empty-catalogue controls remain explicitly limited. Nonempty hypertrophy recommendation times are 6–131 ms locally (median 57 ms). These are individual Node/Mac observations under concurrent audit load, not repeated timing distributions or mobile guarantees.

The advanced balanced calendar estimate remains 109 sets. Its three verified actual plans use 110/110/107 performed sets, loads of roughly 20–23 sets and modeled duration at most 75 minutes. Final policy selection and first-microcycle mapping can differ. It is incorrect to claim exact full-generator dose conservation between revisions merely because packing itself conserves exercise dose. Global enablement was specifically rejected for such indirect effects.

## Remaining work

Neutral multi-step rotations, tighter fixed-roster packing, and user day/time preferences remain open. The search is local and bounded, not globally optimal. Catalogue/selector target shortfalls and the three known advanced seed sensitivities are separate debt. Physical simulator/iPhone responsiveness after packing is unverified; local Node observations are not device guarantees.

Validation: 1,108 tests across 64 suites pass; TypeScript passes. The final 3,575-case paired matrix reports no detected regression, zero prescription changes, no crashes and no new hard/time/volume failures. The 33 empty-catalogue controls remain expected infeasibility. The 838 short sessions and three existing advanced twelve-set seed spans remain unchanged; the sensitivity gate therefore deliberately exits 1, not green. Final matrix archive: `/private/tmp/vigor-packing-safe-generator-20261007.json.gz`.

Matrix reproduction: `node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --baseline=/private/tmp/vigor-capacity-generator-20261007.json.gz --output=/private/tmp/vigor-packing-safe-generator-20261007.json.gz`.

No native rebuild, signing, deployment, infrastructure mutation or commit is included.
