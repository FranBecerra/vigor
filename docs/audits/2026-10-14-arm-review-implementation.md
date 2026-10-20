# Arm source/apparatus review and selection experiments — 2026-10-14

## Integrated scope

This completes a bounded source-mechanics and minimum-apparatus batch, not numeric scientific validation or a new automatic selector. The 380-entry catalogue contains 68 arm identities: 30 biceps and 38 triceps. The source ledger covers all 28 biceps guide pages alongside the existing 35-page triceps review. Newly read remaining biceps descriptions and apparatus-sensitive triceps passages supplement prior reviews; not all 63 pages were newly reviewed this iteration.

- Separate seated bilateral Bayesian `guide-239` from the generic Bayesian ID. Preserve every previously valid ID, including the legacy incline-curl import.
- Reverse-side Scott means bench orientation with a supinated grip, not a pronated reverse curl. Record unsupported standing preacher, behind-body machine, abducted shoulder and variable-shoulder cable setups accurately.
- Withdraw 21 generic imported biceps ratings. All 22 biceps imports remain unscored/manual-only. No new head-specific or elbow-flexor credit fractions are invented.
- Include biceps in the general evidence report. Related variants do not inherit matching-execution status or apparatus-specific criterion bands. Confidence facts distinguish related from matching source mechanics.
- Model minimum support, specialty machines, cable-line count, attachments and alternative implement groups. Validate malformed/duplicate/unknown values and narrow directional capability implications.
- Add optional known-prerequisite filtering without changing default availability. This API inventory is not yet exposed in generation UI. Unknown requirements remain unknown; unreviewed entries are not guaranteed compatible.
- Clarify that ordinal fatigue is not measured CNS fatigue, joint stress, injury risk or recovery time.

The complete inventory and unresolved criteria are in [arm-catalogue.md](2026-10-14-arm-catalogue.md) and its JSON companion. Reproduce with `node --import tsx scripts/audit-arm-catalogue.ts`.

## Evidence boundary

The guide supplies mechanics descriptions, not experimentally established six-number ratings. An elongated muscle position does not prove high external torque there. Original automatic numeric criteria remain provisional programming judgements.

An eight-week randomized trial in 63 young women found regional differences between preacher and incline curls and exercise-specific strength gains, not a universal winner or numerical head-specific credits. [Kassiano et al., 2025](https://pubmed.ncbi.nlm.nih.gov/39809454/).

A cable preacher/Bayesian comparison with matched resistance profiles reported similar adaptations in its tested protocol; shoulder angle alone does not rank every named Bayesian variant. The abstract/source record, not an unrestricted full-text review, was available. [Primary study record](https://pubmed.ncbi.nlm.nih.gov/40082069/).

The tested overhead cable-extension protocol produced more triceps growth than the neutral-arm comparison. This supports a contextual overhead role, not superiority of every overhead implement, exact resistance-profile scores or clinical protection. [Maeo et al.](https://pubmed.ncbi.nlm.nih.gov/35819335/).

## Paired testing

The full matrix contains 325 input families, ten seeds plus a five-minute probe: 3,575 simulations (2,046 hypertrophy, 1,529 strength). Thirty-three empty-catalogue controls are expected infeasible. Archives preserve all inputs, sessions and source snapshots.

| Version | Short sessions | Seed-dose spans | Negative +5-minute probes | Disposition |
|---|---:|---:|---:|---|
| Original production | 748 | 0 | 0 | Reference |
| Geometry-only prototype | 737 | 0 | 1 | Not promoted |
| Canonical-first prototype | 792 | 0 | Recorded in archive | Rejected: worse allocation/volume |
| Geometry/support plus conditional lower-time reference | 737 | 0 | 0 | Not promoted: coverage/schedule tradeoffs |
| Integrated source/apparatus batch | 748 | 0 | 0 | All 3,575 initial prescriptions unchanged |

The integrated batch preserves all 132 exact-dose schedule alternatives and automatic eligibility. No new hard/time/volume failure occurs. Existing historical flags against the older random allocator remain documented separately.

The old/new-catalogue audit correctly exits **2 / review-required**, not 0: 3,542 records are catalogue experiments because an identity/metadata changes, despite identical prescriptions. Thirty-three empty controls are fixed-input comparisons. The separate same-catalogue confirmation exits **0**, with 3,575 fixed-input comparisons and no detected regression. Do not relabel a catalogue experiment as an identical-input green gate.

## Concrete rejected cases

1. Advanced PPL, chest deprioritized, 5×75 versus 5×80: the geometry-only prototype drops 106→101 sets. Concentration/redundancy/exposure also differ; bypassing the complete guard is not an acceptable repair.
2. Advanced balanced PPLU, 4×75: a geometry/reference experiment changes 90→84 sets and deficit against the **same unsqueezed targets** from 29→34.5 fractional sets. Adjusted-target comparison would misleadingly show 5→34.5 because squeeze changes. Original per-muscle coverage must gate promotion.
3. Beginner lower-priority free-weight PPL, 5×75: the same 50 sets change `[7,10,12,9,12]`→`[10,9,12,10,9]`. Minimum load improves but days below twelve increase three→four. Eleven seed/time records carry this strict-count tradeoff. Both have a verified smaller-calendar offer; neither is universally better for the requested calendar.
4. Advanced balanced recommendation: five days still fit the experimental fixed samples in time, but concentration/overlap ranking favors six. Do not reduce dose or change tolerance simply to manufacture the old result. Production retains five days.

No new rest-template review count occurs in the broad geometry/support comparison. Undated adjacent-workout alerts can still change; these are not proof of injury or inadequate actual recovery.

Across base hypertrophy profiles, excluding repeated seed/time records, experimental winners shift: incline curls 445→489 sets; machine preacher 50→227; low-cable curl 271→162; hammer 293→145; generic Bayesian 55→2; overhead dumbbell extension 395→427; French press 307→386; close-grip bench 389→338. These are selector counts, not efficacy measurements. More preacher/French work is not automatically a better bodybuilding routine.

Changing canonical initialization, probing more candidates, using tag-neutral/ranked branches and lower-time references did not establish whole-matrix non-inferiority. None of those allocator changes ships. The observable-geometry transform remains an explicit `--metadata=arm-geometry` control. Legacy resistance tags and numeric criteria remain flagged as unverified; source review does not endorse them.

## Validation and next work

The integrated batch passes **1,268 tests / 68 suites** and TypeScript. Tests cover source entries, eligibility, source relation, apparatus inventory/capabilities/alternatives, malformed input, score withdrawal, saved IDs and experiment isolation. No native simulator/device QA, iPhone build, deployment or infrastructure change is included.

Next, without a new user decision:

1. Add paired promotion review using unsqueezed muscle targets, direct work, duration, rest-template cost, concentration and strict session-floor tradeoffs—not performed volume alone.
2. Repair the concrete advanced PPLU coverage and PPL capacity cases through coupled roster/placement work. Do not relax recovery/exposure guards or silently alter targets.
3. Re-run recommendations as well as generation. Generation-only tests do not prove recommendation quality or physical-device latency.
4. Only then promote geometry descriptors; continue remaining muscle families, apparatus UI and native generation/edit/schedule/save QA. Numeric original arm criteria and individualized response adaptation remain open.

Temporary source-snapshotted artifacts: `/private/tmp/vigor-arms-*-20261014.json.gz`. The OS may remove them; this report, per-entry inventory and implementation/tests are durable repository records.
