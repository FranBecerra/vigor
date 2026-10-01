# Targeted accessories after foundational coverage

## Scientific interpretation

The policy is based on muscle-specific task/coverage, not a universal anatomical small-muscle rule.

- [Brandão et al., 2020](https://pubmed.ncbi.nlm.nih.gov/32149887/): 43 young men, bench press versus lying triceps extension and combinations. Triceps heads responded differently: long-head growth favored conditions including extensions; lateral-head growth favored conditions including pressing. Overall triceps cross-sectional-area comparisons did not show between-group differences. This supports complementary work, not claiming every isolation beats every press.
- [Mannarino et al., 2021](https://pubmed.ncbi.nlm.nih.gov/31268995/): ten untrained men, within-person curl versus unilateral dumbbell row for eight weeks. Curls produced greater elbow-flexor thickness growth. Small, exercise-specific result; do not generalize the exact effect to trained athletes or all pulls.
- [Gentil et al., 2015](https://pubmed.ncbi.nlm.nih.gov/26446291/): 29 untrained men, ten weeks of pulldowns versus curls. No between-group difference in elbow-flexor thickness. This limits blanket conclusions.
- [Maeo et al., 2023](https://pubmed.ncbi.nlm.nih.gov/35819335/): cable elbow extension overhead produced greater triceps hypertrophy than neutral-arm extension, especially long head, despite lower loads. Supports considering shoulder position; does not rank JM/Kaz/close-grip bench against all extensions.

These studies do not prescribe Vigor's direct-set floors, 0.5 indirect credit, exact accessory ratios or a measured systemic-fatigue score. Lower whole-body demand of some supported/local tasks is a biomechanical programming inference, not a guarantee of less local fatigue, soreness or joint discomfort. No fatigue rating is changed solely because an exercise is single-joint.

## Implemented policy

The existing volume-first budgets remain unchanged. Foundation selection prefers non-accessory-primary candidates for the five required movement patterns when available; missing-equipment situations can still use alternatives. Remaining biceps, triceps and anterior/lateral/posterior deltoid needs prefer local tasks. An elbow-extension/flexion hybrid can count as local even if its profile is COMPOUND_SECONDARY; this avoids making joint count the sole role classifier. Other muscles retain their existing selection choices.

The preference applies after suitability-tier selection, is goal-specific to hypertrophy, and retains compounds when local candidates are unavailable or exhausted. It removes compound-only eligibility from the tested accessory branch rather than downgrading close-grip bench ratings. Capped useful secondary credit, actual modeled time, direct floors and ordinal systemic cost remain separate. It does not prescribe unnecessary arm work merely because arms are on the role list.

Production first preserves the previous guarded legacy/volume-aware incumbent, then evaluates `accessory-aware`. The same promotion contract prevents worse time, assignment, empty/underfilled counts, minimum session size, spread, basic coverage, rest overlap, total performed sets or protected direct-arm coverage. Target attribution tolerance and cost/shortfall objectives are unchanged. Strength bypasses this candidate search. `coupled-control` is a reproducible audit override for the previous incumbent, not a user-facing split.

## Catalogue corrections and controlled comparison

JM/Kaz were already indexed at guide pages 211/210. Their existing IDs remain unchanged and no entries are duplicated. Full text and rendered figures confirm free-bar versus Smith variants and a local hybrid elbow-extension role. Improved names expose JM/Kaz in search. Their generic numeric rubrics are withdrawn pending individual attribute review; both remain manual-only. See `jm-kaz-catalogue-review.md` for reasoning and uncertainty. The catalogue still has 378 unique entries and the automatically eligible pool is unchanged.

`2026-09-30-accessory-control.json.gz` reruns the old production logic against these corrected manual records. All 605 prescriptions are identical to the previous `coupled-after` artifact: catalogue-only corrections have no automatic-selection effect. `2026-09-30-accessory-after.json.gz` then compares the new default with this exact corrected catalogue/control; all 605 comparisons have identical athlete inputs and catalogue fingerprints.

```sh
node --import tsx scripts/evaluate-generator.ts --extended --seeds=10 --baseline=docs/audits/2026-09-30-accessory-control.json.gz --output=/private/tmp/vigor-accessory-verification.json.gz
```

| Metric | Control | Accessory-aware production |
|---|---:|---:|
| Short hypertrophy sessions | 429 | 406 |
| Beginner short sessions | 235 | 213 |
| Intermediate short sessions | 117 | 116 |
| Advanced short sessions | 77 | 77 |
| Close-grip bench appearances | 418 | 370 |
| Unexpected crashes | 0 | 0 |

99 prescriptions change. No new hard failures, large volume losses, >10-set seed spans or >3-set losses under +5-minute probes were detected. The 33 expected empty-catalogue infeasibilities are unchanged. Remaining close-grip frequency is substantial because the guarded incumbent is retained in rejected candidate cases and compounds remain legitimate options; this is not a completed concentration fix.

## Individual changed base-case review

| Case | Assessment |
|---|---|
| B | 21/18/18/21: more explicit extensions and retained curls; close-grip bench still survives the incumbent. Multiple horizontal rows on one day deserve a mechanical-redundancy review, not automatic claims of useful variation. |
| F | 16/17/17: direct arm coverage and basic patterns survive. Good mornings and unsupported rows remain a questionable beginner default; role selection does not solve technique-demand eligibility. |
| G | 18/17/16/21/20/19: advanced PPL keeps direct arms, lateral raises and both pulls. A push-labelled day starting with squat and lacking a press is a focus/label consistency concern despite flexible distribution and global coverage. Sumos and later RDLs still require individual cost review. |
| H | 20/20/20/20/20: improved workload balance and direct tasks; several knee-flexion variants fit hamstring priority but their local exposure and Nordic tolerance are not established by passing time constraints. |
| O | 12/12/15/12: beginner hamstring-priority request remains nonempty and covered; two knee-flexion variants are plausible but should not displace technique/tolerance review. |
| P | 17/16/17: free-weight-limited input retains available presses/pulls and curls/extensions. Isolation preference does not require nonexistent cable/machine equipment. Bulgarian plus free squat remains a demanding lower-body exposure for a beginner. |
| BEGINNER-short | 6/7/4/7/6/4: still a time-limited 6×30-minute request. One exercise on some days is not fixed by the role policy; no filler is added. |
| BEGINNER-emphasis | 13/12/13/11: direct triceps and back work are retained without compulsory narrow bench, but the 11-set day is still flagged. |
| BEGINNER-declared | 12/11/11/12: declared dose remains modest; two flagged days still need an evaluated lower-frequency option rather than arbitrary volume inflation. |
| BEGINNER-veto | 12/12/13/13: excluded exercises stay excluded, direct arms survive, all days meet the product minimum. Alternative hinge technique remains subject to athlete suitability. |
| INTERMEDIATE-emphasis | 18/17/18/18: back/triceps priority includes direct extensions and curls. Close-grip bench remains; this is a bounded improvement, not proof of a globally best triceps roster. |
| ADVANCED-upper-only | 13/14/13/13: upper-only intent is preserved with complementary presses/pulls and direct arms. Still many chest variants and narrow bench; no leg work is silently injected. |

Only changed base cases receive written judgements here. Seed variants retain automated diagnostics and full prescriptions; this is not 605 independent coaching reviews. Native UI interaction was not tested. Regression tests cover fallback catalogues, unchanged strength specificity, manual addition/search, unscored provenance and previous manually performed work.
