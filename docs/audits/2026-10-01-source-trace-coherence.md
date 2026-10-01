# Source audit, policy explanations and session-label coherence

## Scope and completion status

1. **Catalogue: partial.** Read all 35 numbered triceps pages (197-231), full extracted descriptions and all rendered figures. Per-entry implement, action, support, laterality, role and contradictions are recorded in `2026-10-01-triceps-source-review.md` and `tricepsSourceReview.ts`. Five existing aliases and 30 manual imports are covered. Broad expert uncertainty bands are not numerical production ratings. Original alias ratings remain unvalidated; close-grip bench and bench dips still require execution-specific attribution work. Biceps, shoulders, back and legs are not individually reviewed by this iteration. The catalogue now has 379 entries, because disputed page 212 is no longer collapsed into the original overhead exercise.
2. **Explanations: policy gate implemented; per-exercise trace open.** Production reports both policy comparisons with named rejection reasons and before/after target-shortfall and ordinal-cost metrics. The same preservation contract is retained. This explains why an entire candidate is rejected, not every weighted selection draw, shortlist or eligibility decision.
3. **Coherence: diagnostic and narrow label correction implemented; broader allocation fix open.** Added review triggers for focus without its requested basic task, beginner coaching needs and multiple unsupported rows. These are product/coaching judgements, not injury predictors or hard bans. Hypertrophy presentation/persistence changes LOWER/LEGS to UPPER when there is upper work but no lower work, and upper-focused labels to LOWER in the converse case. Mixed sessions retain their intended flexible focus; strength and existing saved routines are not rewritten. No exercises or sets are moved.
4. **Comparison and review completed for this bounded batch.** Three archived 605-case matrices isolate source/trace changes from the presentation correction. Five changed base profiles are reviewed below. No claim of optimal programming or completion of the larger plan is made.

## Controlled comparisons

Artifacts:

- `2026-10-01-catalogue-before.json.gz`: original 378-entry catalogue and prior production.
- `2026-10-01-catalogue-after.json.gz`: reviewed manual entries and policy traces. Catalogue differs, so this is explicitly a catalogue experiment, not fixed-catalogue equivalence. All 605 prescriptions are nonetheless exactly unchanged.
- `2026-10-01-coherence-after.json.gz`: identical reviewed catalogue and athlete inputs; all 605 pairs strictly comparable. 47 plans each change one session focus label. All exercise IDs, ordering, sets, rep ranges, RIR, rest and durations are identical after removing only focus from the comparison.

All runs: zero unexpected crashes; 33 expected empty-catalogue infeasibility controls; 406 nonempty hypertrophy sessions below 12 sets (beginner 213, intermediate 116, advanced 77). No new hard failure, large volume loss, existing seed-span gate or +5-minute gate regression. This iteration does not reduce underfilled sessions. The 12-set threshold is a product warning, not a universal physiological minimum.

Reproduction:

```sh
node --import tsx scripts/report-triceps-review.ts
node --import tsx scripts/review-catalogue.ts --output-prefix=docs/audits/2026-10-01-catalogue-review
node --import tsx scripts/evaluate-generator.ts --extended --seeds=10 --output=/private/tmp/vigor-current-audit.json.gz --baseline=docs/audits/2026-10-01-coherence-after.json.gz
npm test -- --runInBand
npx tsc --noEmit
node --import tsx scripts/catalogue-report.ts --validate
git diff --check
```

## What the trace reveals

Across the matrix, accessory-aware rejection reasons include 213 muscle-attribution occurrences, 112 worse-spread occurrences, 67 extra-template-overlap occurrences, 60 lower-minimum-load occurrences, 50 performed-volume losses and 11 direct-accessory-floor occurrences. Counts overlap and muscle-specific reasons can occur several times per plan; they are not independent users or failure rates. The gate also rejects 398 candidates for no objective improvement, including ties and infeasible empty controls.

The real A/seed-12 profile illustrates the distinction: 4x75 minutes, intermediate, back/triceps priority and reduced quads. The accessory candidate retains target shortfall at 2 and lowers ordinal cost 158 to 150, but adds one template-overlap review from zero; it is rejected. These are heuristic constraints and objective units, not experimentally measured fatigue/recovery. Loosening the gate globally just to reduce close-grip-bench frequency would conceal that trade-off. Next fix should search local replacements/reassignments while preserving the contract, rather than simply discarding it.

## Manual review of changed base profiles

| Profile | Actual change and assessment | Unresolved programming concern / next fix |
| --- | --- | --- |
| AA: advanced, PPL 6x45 | Third session LEGS to UPPER. It contains supported dumbbell row, cable fly, crunch and reverse pec deck: the old leg label was objectively misleading. Six loads remain 12/12/13/12/12/12. | Distribution has only one dedicated leg day; leg work also appears on pull/push days. Flexible spillover is valid, but evaluate explicit athlete focus and recovery rather than claiming label repair optimizes placement. |
| BEGINNER-short: 6x30 | Third session LEGS to UPPER for machine lateral raises only. Loads remain 6/7/4/7/6/4. Correct label, still a poor routine request/result. | Push contains a seated row plus leg extension, pull contains RDL plus fly. Time-constrained allocation and task coverage need a real lower-frequency proposal or transparent infeasibility, not renamed filler. |
| BEGINNER-upper-only: 4x65 | Second session LOWER to UPPER for pulldown and overhead extension. No leg work is added against athlete intent. Loads remain 6/6/6/6. | Four days distribute a low starting budget too sparsely. Fewer-day alternative is the relevant intervention; do not increase volume just to consume available time. T-row beginner technique remains a review trigger. |
| INTERMEDIATE-upper-only: 4x65 | Second session LOWER to UPPER for T-row, rope extension and supported shrug. Loads stay 10/10/10/10. | All four are underfilled by the product threshold. Evaluate an accepted fewer-day alternative preserving arm/back targets, not compulsory lower-body work. |
| ADVANCED-upper-only: 4x65 | Second session LOWER to UPPER for high row, overhead extension, preacher curl and pullover. Loads stay 13/14/13/13. Label now matches intent. | Several chest adduction variants and close-grip press still deserve task/complementarity review; no longitudinal benefit inferred from variety alone. |

Additional targeted inspection: F still gives a beginner good mornings and unsupported barbell rowing; G still has a push-labelled day starting with a squat and lacking a press, while a Smith press appears on a pull day. These are now observable diagnostics, not fixed exercise-placement defects. B has two different rows on an upper day; this is not automatically redundant because support and arm path differ.

New diagnostic occurrences: 76 focus-without-press, 46 focus-without-pull, 14 focus-without-lower-work, 104 beginner-technique-review and 2 unsupported-row-concentration. These did not arise as regressions: the new checks expose existing prescriptions. Not every warning is bad programming; review task priorities, execution and athlete capability before changing it.

## Scientific and operational boundaries

The guide is a source for exercise descriptions, not independent confirmation of every claim. Its text/figure discrepancies, shoulder-head emphasis, ideal cable profiles, absence of discomfort and superiority statements remain qualified. A machine cam cannot be assigned an ideal resistance-match score merely from its equipment category. Source review and broad ordinal bands can proceed without a comparative trial for every exercise; unknown matching and secondary credit are not converted into invented neutral points.

The dated whole-catalogue screening ledger was refreshed and renamed to `2026-10-01-catalogue-review.*`; future script defaults use an undated latest prefix to avoid silently replacing dated evidence. The paired generator baselines remain archived. No deployment, infrastructure mutation, commit, saved-user-routine migration or real-device UI validation was performed.
