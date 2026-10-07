# Allocation, seed sensitivity and observed-load update

## Scope and boundaries

The five authorized workstreams are allocation repair, seed sensitivity, individual catalogue review, history-based personalization and native visual QA. This iteration implements bounded repairs and a recency-aware load estimate; it does not complete the full catalogue review, a global allocation solver, adaptive volume or full native visual QA.

SDK 57 documentation was consulted before changes. No dependency patch, native rebuild, signing, deployment, infrastructure mutation or commit was performed. Native testing did not save a routine.

## Allocation and selection

Multi-entry local search preserves every exercise entry and its dose. It tests one/two-entry exchanges, depth three, beam 12, maximum 4,000 candidate visits. Frequency, anchors, redundancy, per-muscle load, estimated time and recovery diagnostics constrain accepted changes. Entry minutes and pairwise risk are cached locally during the immutable search, not across catalogue calls. Insufficient total dose returns unchanged; adding filler is not a solution. The 12-set floor is a product heuristic, not a physiological minimum.

The capacity search additionally probes 15 points across the complete squeeze interval because roster/rounding changes violate bisection's monotonicity assumption. A retained probe must improve performed dose without increasing original-target shortfall or structural defects. New legacy-incumbent probes additionally cannot worsen recovery-template count. Competing policies can still repair placement before their full promotion guard. That guard now evaluates actual allocator dose rather than a mapped first-microcycle ramp. Production time-limited plans test seed minus/plus one through the same policy-promotion guard. Explicit experimental policies and strength prescriptions retain their existing paths.

AUTO candidates rejected solely for template-overlap count may receive a constrained roster-preserving allocation repair and then a complete-session reorder, at most six sessions. Manual split order is preserved. Repaired frequency/time/structure diagnostics are recomputed. The recovery repair preserves at least two primary exposures where originally available; it does not claim that four exposures are always superior to three.

## Reference cases and review dispositions

- Beginner 14/12/11/13: whole-entry exchanges remove the short day without dose changes, time overshoot or new template warnings. Regression test retains exact roster/dose and checks idempotence.
- Intermediate `T-seed-2`, full body 3 × 45, seed 8: 36 sets distributed 12/13/11. Enough aggregate dose, but no accepted repair found within search budget/guards. This is not proof that every feasible partition is impossible. Next experiment: split appearances or jointly replace complementary entries while protecting direct dose and recovery.
- Advanced `AA-seed-4`, PPL 6 × 45, seed 63: 72 sets distributed 12/11/13/12/12/12. Same open allocation issue. Next experiment: dose-preserving set-level redistribution with appearance/anchoring checks, compared against whole-entry search.
- Advanced `Z-seed-9`, AUTO 5 × 65, seed 50, triceps priority/hamstrings maintenance: the intermediate comparison improves 82 to 94 sets, distributed 19/19/18/19/19, within time. The missing mechanism was candidate placement/recovery rejection, not simply an arbitrary minimum total. Its remaining chest overlap across consecutive workout days is explicitly flagged; recovery is not certified.
- `Y-seed`, advanced upper/lower 4 × 75, back priority: an intermediate candidate added sets but introduced a consecutive-day quadriceps warning (0 to 1). A recovery-template filter was added to capacity-search promotion; a regression test checks no such warning.
- Intermediate comparison losses `Q-seed-4` and `X-seed-5`: one performed set fewer. Aggregate series alone cannot establish poorer target coverage, but this is a trade-off, not a claim of strict dose preservation across policy selection. Exact-dose preservation applies to local allocation repairs only.

Automated paired comparisons are not individual coaching reviews. Changed-case prescriptions and explicit soft-metric dispositions must be retained separately. Adjacent-workout sequencing flags ignore inserted rest, whereas template flags use actual proposed rest slots; they must not be silently conflated. Cases worsening a raw adjacent flag but not template flags need further concentration/specificity review, not a physiological recovery guarantee.

## Individual source review

Read complete guide descriptions for pages 235/236/237/240/242; visually inspected page 240. Together with the preceding eight records, 13 biceps guide pages have individual setup/provenance/uncertainty records. Added rotating grip classification, specialty-bar/seat/preacher-support requirements and cable-tension-versus-torque caveats. Guide claims about head-specific superiority are not promoted to validated hypertrophy rankings. Production scores, stimulus tags and generator eligibility are unchanged. All 379 individual exercise reviews remain a larger open workstream.

Source: `/Users/franbecerra/Downloads/Guia_Ejercicios_Hipertrofia-SergioMCoach 6ªEd.pdf`.

## Observed-load personalization

`historyReadiness.ts` now supplies generation with exercise-specific recent e1RM. Completed observations within 42 days are sorted and deduplicated. Invalid/future/old timestamps, incomplete sessions and warm-up-only attempts do not enter estimates. One/two distinct exposures use the latest estimate; three use the median of the latest three session-best estimates. This reduces dependence on an old lifetime maximum and one extreme session. Actual effort availability is reported separately; missing RIR is not failure or stagnation. These observations do not yet qualify volume adaptation or establish equivalent technique, apparatus or effort.

The 42-day window and three-observation median are explicit product defaults, not study-derived readiness thresholds. Same exercise identity is required; no transfer of kg across variants. New tests cover outliers, incomplete/future/stale/duplicate data, serialized timestamps, the inclusive window boundary, missing/non-finite RIR and invalid reference time.

## Native visual QA

Device Hub shows light-mode generation controls with Cancel/See plan above the bottom Liquid Glass capsule, without overlap. Opening the existing preview preserves the 70-set draft and shows Back/Save routine above the capsule, without saving anything. The preview shows its seven-day workout/rest sequence. Automated scroll/drag fails with `noWindowsAvailable`, including a freshly captured coordinate inside the phone viewport. This blocks complete emphasis-thumbnail/volume-map and dark-mode review. The iPhone 13 is unavailable/disconnected in the hub. No full visual sign-off or physical-device verification is claimed. Visible capacity copy still overstates that the app knows what the user's level can recover; this needs neutral estimated-budget wording. Light-mode lime label contrast also needs explicit review.

## Reproduction and validation

Baseline: `/private/tmp/vigor-current-20261006.json.gz` (3,575 fixed inputs, 867 short sessions, four seed spans above ten sets).

Intermediate archives: `/private/tmp/vigor-search-20261007.json.gz` (allocation stage), `/private/tmp/vigor-final-20261007.json.gz` (before the newly added recovery-template filter). The latter has 838 short sessions, 211 changed cases and three residual sensitivity profiles. It is not the final validated build. `/private/tmp/vigor-verified-20261007.json.gz` is a rejected experiment: extending the recovery filter to the existing ordinary-selector competition caused large dose losses and negative time sensitivity. This experiment was not retained. The final design protects only new legacy probes and retains repair-before-promotion for competing policies.

Final comparison command:

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=full --seeds=10 --baseline=/private/tmp/vigor-current-20261006.json.gz --output=/private/tmp/vigor-completed-20261007.json.gz
npm test -- --runInBand
npx tsc --noEmit
node --import tsx scripts/catalogue-report.ts --validate
```

Audit exit 1 for unresolved sensitivity is intentional and must not be presented as a completely green generator-quality gate.

## Latest measured results, before the semantics-preserving local cache

`/private/tmp/vigor-release-candidate-20261007.json.gz` compares all 3,575 identical input snapshots against the October 6 reference: no detected hard, volume or time-sensitivity regression; no crashes/unexpected infeasibility; 33 expected empty-catalogue controls. Short sessions: 867 to 838 (beginner 657, intermediate 112, advanced 69). Affected cases: 238 to 214. Remaining sufficient-dose allocation bottlenecks: 33 to 14 (12 beginner, one intermediate, one advanced); insufficient-total-dose cases: 205 to 200.

There are 210 changed prescriptions and no strength changes. No changed case adds a rest-template warning. Thirty-four changed cases add raw adjacent-workout flags without worsening rest-template count and have explicit open concentration-review dispositions. Two changed cases lose one performed set. The paired ledger does not erase these trade-offs or certify all 210 prescriptions as individually reviewed.

Z sensitivity decreases from a 13-set span to three sets. Three advanced profiles retain 12-set spans: balanced free-equipment upper/lower, balanced full-equipment PPLU, balanced free-equipment AUTO. The sensitivity gate intentionally exits 1 despite a non-regressing paired result. The final local-cache comparison must reproduce these prescriptions exactly.

Under concurrent audit/test load, a full-catalogue intermediate capacity recommendation takes roughly 16–18 seconds on this Mac. This is not an iPhone benchmark or a controlled latency comparison. Local pair-risk/minute caching does not resolve the interaction latency; optimization of the 45-plan recommendation grid and on-device responsiveness remains priority debt. Avoid adding more search breadth before profiling it.

## Final validation

Final archive: `/private/tmp/vigor-completed-20261007.json.gz`. All 3,575 prescriptions are identical to the preceding release-candidate archive after adding local caching; all measurements/counts above are therefore retained. Paired comparison: no detected hard/volume/time regression, zero strength changes, 210 changed hypertrophy prescriptions. Sensitivity still exits 1 for the three named 12-set profiles. This is not a globally optimal or fully reviewed generator.

`npm test -- --runInBand`: **1,038 tests / 60 suites pass**. TypeScript and all 379 catalogue entries validate. The final full suite took 235 seconds on this machine under audit load. New behavior tests cover constrained multi-entry repair, unchanged impossible/strength cases, policy recovery guards, the advanced seed bottleneck, repaired diagnostic consistency, recent e1RM edge cases and source-review provenance.

Permanent compact artifacts: [changed-case ledger](2026-10-07-changed-cases.md), `2026-10-07-changed-cases.json.gz` (complete before/after prescriptions and compact quality findings), and [remaining short-case dispositions](2026-10-07-remaining-defects.md). Reproduce them with:

```sh
node --import tsx scripts/review-generator-changes.ts /private/tmp/vigor-current-20261006.json.gz /private/tmp/vigor-completed-20261007.json.gz docs/audits/2026-10-07-changed-cases
node --import tsx scripts/review-generator-defects.ts /private/tmp/vigor-completed-20261007.json.gz docs/audits/2026-10-07-remaining-defects.md
```

The large complete source/runtime archives remain temporary; the compact repository artifact is not a replacement for retaining those snapshots long-term. Full individual catalogue validation, comparable-effort eligibility, adaptive volume, the remaining allocator/seed defects, runtime latency and complete native visual QA remain open.
