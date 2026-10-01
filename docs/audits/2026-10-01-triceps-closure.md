# Triceps closure: original ratings, attribution, eligibility, and the time-squeeze defect

Checklist point 5.1. Three isolated experiments on the 605-case legacy battery (`--matrix=legacy --extended --seeds=10`), each compared with the previous stage. Large archives are not committed. Re-run the commands below to reproduce them.

## E1: original-entry corrections (catalogue experiment, accepted)

Evidence was verified against the PubMed abstracts. Maeo et al. 2023 (PMID 35819335) is a cable trial: the overhead arm grew more than the neutral arm, both over a 90-0° elbow range. It does not test range of motion, resistance profiles or joint stress. Brandao et al. 2020 (PMID 32149887) compared barbell bench press and lying barbell triceps press. Bench press alone did not significantly increase triceps cross-sectional area, and long-head growth was greater with the triceps press. Three citations did not support their claims and were removed: PMID 32922646 (incline versus flat bench, pectoralis only) and PMIDs 21858666 and 23657165 (regional activation along the triceps, with no tested position or ROM claim).

| Entry | Change | Reason |
|---|---|---|
| extension-sobre-cabeza-polea | resistance match 5→4 | No trial compares its profile; ROM, profile and fatigue were mislabelled direct evidence |
| extension-triceps-maquina | resistance match 5→4 | Cam geometry is manufacturer-specific; "exact match" is unsupported |
| pushdown-cuerda | progression 3→4 | Same cable stack as the bar pushdown |
| pushdown-barra | ROM 3→4 | Same elbow excursion as the rope; the bar meets the thighs at lockout |
| fondos-banco | stretch 4→2; ISOLATION→COMPOUND_SECONDARY | Shoulder extension shortens the long head; shoulder and elbow both move |
| press-banca-cerrado | stretch 4→2 | Extended shoulder at the bottom; Brandao bench arm (indirect, normal grip) |
| extension-sobre-cabeza-mancuerna, press-frances | evidence relabelled only | Maeo is indirect for dumbbells; Brandao replaces the Wakahara citations |

Ablation, one change at a time against the control: overhead resistance match 278 changed prescriptions, close-grip stretch 240, bar ROM 48, bench dip 22, rope 4, machine 3. A 0.15 change in stimulus score reshuffles seeded draws widely, so a changed-prescription count does not measure the size of the effect. Combined: 320 changed, short sessions 406→401, close-grip appearances 370→331, no unexpected infeasibility. All new triceps shortfalls are 0.5 set. Four volume losses came from the close-grip change, through policy fallbacks.

## E2: promoting guide-199 (catalogue experiment, rejected)

The supine dumbbell extension received individual scores (4/4/3/3/3/4) and replaced bench dips in limited-equipment plans (46→5 appearances). Seven dumbbell-only intermediate plans lost 3-5 sets and 2.5-4 chest sets. Cause: a 1.2·10⁻⁴ time squeeze switched the selector into time-efficiency mode, which dropped a whole fly and left a session 14 minutes under budget. The scores are kept and the entry stays `MANUAL_ONLY`. Retry after E3 by setting its tier to STANDARD.

## E3: time-squeeze defect (fixed-input, accepted)

The defect predates this work. In the control, 54 cases ended time-limited with a squeeze below 0.01, and 20 of them had a session more than 12 minutes under budget. One session overshooting by a few minutes sent the planner into the time-efficiency selector, which then discarded far more than the overshoot. The pinned 5×65 intermediate test caught it once E1 reshuffled seeds 1 and 18 (90→75 sets). The planner now also searches the ordinary selector under a minimal target squeeze. It keeps that plan only if the plan leaves less unmet target volume against the unsqueezed plan, with no more structural defects.

Against E1: 74 changed, 68 closer to targets, 2 further (T-seed-8/9: 4→6 against squeezed targets, closer against unsqueezed ones), 4 equal. Short sessions 401→392. Low-squeeze cases with more than 12 spare minutes: 20→0. No regression gate triggered. A narrower guard (only when total time fits) kept 11 of the 74 changes and raised a sensitivity alarm on case Z, so it was rejected. Cost: one recommendation for an intermediate athlete takes 1.8→3.7 s on the development Mac, not measured on a phone.

## Cumulative result (control → E1+E3)

356/605 prescriptions changed. Short sessions 406→392. Close-grip appearances 370→306. Unmet target volume across the battery 9121.5→8194 sets. Three cases lose total sets: INTERMEDIATE-emphasis-seed-3 74→71 (shortfall 4.5→3.5), ADVANCED-veto 76→73 (21→19), and ADVANCED-short-seed-5 47→41 (11.5→16). The last one is a real loss, accepted and still open: a 6×30 advanced plan loses its rear-delt and trap work.

## Eligibility

`TRICEPS_ELIGIBILITY` records one decision per triceps-primary entry (38), and a test keeps the catalogue tier in sync. Automatic: the 7 originals, with bench dips as FALLBACK. Manual-only: all 30 imports. The reasons cover duplicate roles, unilateral time cost, unmodelled apparatus (dual stations, long ropes, benches at cables), hybrid technique demand (JM/Kaz, PJR, V2/V3), disputed identity (page 212) and one rejected experiment (199).

## Still open

Close-grip bench counts as direct triceps work because `direct` keys on the primary muscle (allocator point 6). The machine `RESISTANCE:EVEN` tag and other machines' 5/5 resistance match belong to their own families. Support and apparatus are still not availability filters. The 0.5 secondary credit is unchanged.

## Reproduction

```sh
node --import tsx scripts/evaluate-generator.ts --matrix=legacy --extended --seeds=10 --baseline=docs/audits/2026-10-01-quality-after.json.gz --output=<dir>/triceps-closure.json.gz
```

Expected: 356 prescriptions changed against `quality-after`, comparison classified as a catalogue experiment (exit 2), 392 short sessions. E2 and the E1 ablations need the single-field edits listed above.
