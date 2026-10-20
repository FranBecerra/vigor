# Dose-first capacity recommendation

## Decision and scientific boundary

The user approved replacing hypertrophy's calendar-dependent whole-plan search with scheduling a provisional fixed muscle-volume budget. Volume targets, emphasis and declared volume are established before capacity is considered. This does not establish individual optimal volume, MEV/MAV/MRV or injury risk. Higher per-muscle dose motivates a preference for multiple exposures; frequency two is not a universal prerequisite.

The [volume-equated frequency meta-analysis](https://pubmed.ncbi.nlm.nih.gov/30558493/) does not establish a general hypertrophy advantage of greater frequency. The [per-session dose preprint](https://sportrxiv.org/index.php/server/preprint/view/537) suggests diminishing returns but cannot establish a universal physiological cutoff or prove that dividing a given volume prevents injuries. Ten fractional sets is therefore an explicitly revisable scheduling reference, not a scientific safety threshold.

## Implementation

- Build the unsqueezed existing volume plan once, including declared targets and priorities/depriorities.
- Select three deterministic accessory-aware dose samples once. Evaluate their placement, without reselection or volume squeezing, across the 15 existing calendars. No full hypertrophy mesocycle planner is called by the recommendation.
- Require all samples to fit the shared duration model with no empty/unassigned sessions for calendar feasibility. Catalogue/selector target deficits remain separate from calendar feasibility.
- Rank feasible calendars by concentration above ten attributed sets per muscle/session, disproportionately thin sessions, existing session-cap and sequencing diagnostics. Keep calendars within one quality point of the best, then minimize scheduled weekly minutes and days. Fractional volume uses full primary and half secondary credit, without duplicates. Blanket single-frequency warnings do not decide ranking.
- If no calendar fits, select the least problematic estimate and mark targets unverified; do not silently squeeze the budget. All-muscle coverage uses a one-set rounding allowance and the existing total-dose minimum. The legacy `reachesRecoverableVolume` name is retained for compatibility, not as a recovery claim.
- The UI still supports cooperative scheduling/cancellation and shows a limitation notice. These recommendations are estimates, not the final routine. Final generation can select another policy/roster/seed and retains its own feasibility diagnostics.
- Strength retains its validated lift-specific legacy search; a muscle-budget scheduler is not automatically appropriate for lift practice, heavy singles and strength rest intervals. This exception is intentional and not hidden.

## Paired results and actual-plan inspection

Run `node --import tsx scripts/benchmark-capacity.ts OUTPUT.json --verify-plans`. Ten profiles are measured; three actual plans are generated for each (30 total). Local archive: `/private/tmp/vigor-capacity-dose-first-verified-20261007.json`.

| Profile | New estimate | Actual performed sets across seeds 11/22/33 | Local recommendation time |
|---|---|---|---:|
| Beginner hypertrophy, full | 3×60, 49 sets | 47 / 50 / 50 | 50 ms |
| Intermediate hypertrophy, full | 6×60, 89 sets | 89 / 87 / 87 | 38 ms |
| Advanced hypertrophy, full | 6×75, 109 sets | 110 / 110 / 107 | 37 ms |
| Intermediate back/triceps | 4×75, 84 sets | 82 / 85 / 86 | 25 ms |
| Advanced bodyweight | 2×60, 33 sets | 33 / 33 / 33 | 8 ms |
| Beginner empty catalogue | 2×45, zero sets, limitation | 0 / 0 / 0 | 1 ms |
| Intermediate PPL/biceps | 6×60, 89 sets | 89 / 88 / 88 | 29 ms |

All nonempty-catalogue actual plans fit the recommended duration and have no empty/unassigned sessions. The empty-catalogue control correctly remains empty with a limitation. Strength recommendations match the preceding optimization's three reference results exactly (2×75/24, 3×60/32, 5×60/53).

This change intentionally does not preserve the old hypertrophy ranking: balanced intermediate changes 4×75→6×60, advanced 5×75→6×75, and PPL/biceps 4×75→6×60. The fixed-dose distributor conservatively requires every sample to fit and can reject a tighter calendar that the more expensive multi-policy final generator could make work. This is residual scheduling efficiency debt, not evidence that six days is physiologically superior. The next quality improvement is better fixed-roster packing and explicit user day/time preferences, not restoring calendar-dependent volume squeezing. Beginner/advanced full-gym estimates also flag small unresolved muscle-target deficits that the old total-minimum flag concealed; these are selector limitations, not measured recovery limits.

Timings are individual Node/Mac observations, not simulator/iPhone guarantees. The user observed roughly eight seconds on the simulator before this architectural change. Native responsiveness after this change has not been verified. The wizard/optional checkbox remains future work.

## Verification

Tests cover fixed targets/three selections, absence of full-plan calls, declared-volume propagation, manual splits, no mandatory frequency two at low dose, target shortfall, overlong/empty/unassigned cases, cancellation before/between evaluations, sync/async agreement and fractional concentration credit. Real catalogue integration tests generate three full-gym plans at each experience level and require nonempty/time-fitting sessions.

Final validation: **1,099 tests / 63 suites pass** and `npx tsc --noEmit` passes. No native rebuild, signing, deployment, infrastructure mutation or commit is included.
