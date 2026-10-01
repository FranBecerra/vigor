/// <reference types="node" />
/** Reproducible individual-source ledger, distinct from the whole-catalogue screening. */
import { writeFileSync } from 'node:fs';
import { EXERCISE_CATALOGUE } from '../src/services/training/exerciseCatalogue';
import { guideExerciseId } from '../src/services/training/guideExerciseCatalogue';
import { TRICEPS_SOURCE_REVIEWS, tricepsCriterionBands } from '../src/services/training/tricepsSourceReview';

const output = 'docs/audits/2026-10-01-triceps-source-review.md';
const lines = [
  '# Triceps: individual source-mechanics review', '',
  'Scope: all 35 numbered triceps pages (197-231), full text and rendered figures inspected. '
    + 'This is not completion of the entire catalogue or validation of every legacy numeric rating.', '',
  'The six dimensions remain separate. Bands below are broad expert hypotheses with ties, not confidence '
    + 'intervals, measured growth differences, ranking totals, or production scores. Resistance-profile matching '
    + 'is unresolved: joint torque geometry does not establish matching to an individual force curve. '
    + 'Manual-only imported entries no longer retain generic point scores as if individually verified.', '',
  'Dimension order: lengthened loading / usable ROM / resistance match / stability / load progression / low systemic cost. '
    + 'Higher is more favorable; low systemic cost is not CNS fatigue, elbow irritation or local exhaustion.', '',
  'Band rationale: overhead posture supports greater long-head length but not uniformly high torque; '
    + '90-degree flexion is not identical to overhead. Deep elbow motion suggests substantial usable ROM; '
    + 'machine geometry, forehead clearance and hybrid paths widen uncertainty. Back/arm support and rails '
    + 'reduce balance requirements without proving more growth. Stack/bar increments are usually more reproducible '
    + 'than bodyweight or fixed dumbbell jumps, but actual increments remain equipment-specific. '
    + 'Local extensions generally involve less whole-body work than hybrids; none has measured systemic cost here.', '',
  'Primary intervention evidence: [Maeo et al.](https://pubmed.ncbi.nlm.nih.gov/35819335/) compared overhead '
    + 'and neutral cable extensions, not every variant here. [Brandao et al.](https://pubmed.ncbi.nlm.nih.gov/32149887/) '
    + 'reported different triceps-head adaptations to bench and extensions/combinations; this does not validate '
    + 'Vigor\'s 0.5 indirect credit or a universal press-versus-isolation hierarchy. '
    + 'The guide\'s head-emphasis/comfort/superiority claims are not automatically accepted as longitudinal evidence.', '',
  '## Field-by-field source ledger', '',
  '| Page / stable ID | Implement / shoulder / support | Role / uncertainty bands | Individual setup and caveat |',
  '| --- | --- | --- | --- |',
];
for (const entry of TRICEPS_SOURCE_REVIEWS) {
  const id = guideExerciseId({ page: entry.page, name: '' });
  const exercise = EXERCISE_CATALOGUE.find((e) => e.id === id)!;
  const bands = Object.values(tricepsCriterionBands(entry)).map((band) => band ? `${band[0]}-${band[1]}` : '?').join(' / ');
  lines.push(`| ${entry.page} / ${id} | ${entry.equipment}; ${entry.shoulder}; ${entry.support}${entry.unilateral ? '; unilateral' : ''} | ${entry.hybrid ? 'hybrid accessory' : 'local extension'}; ${bands} | ${entry.setup} ${entry.uncertainty} ${exercise.guidePage ? 'Manual-only; unscored.' : 'Existing alias: numeric ratings retained, not validated by this review.'} |`);
}
lines.push('', '## Identity and rating decisions', '',
  '- Page 212 is no longer silently aliased to the fully-overhead original. Text specifies 90-degree shoulder flexion, '
    + 'while the drawing looks more overhead. The imported disputed setup is preserved as guide-212, manual-only, '
    + 'without changing the existing saved exercise ID. Catalogue count becomes 379, not a duplicate JM/Kaz addition.',
  '- Page 209 requires cables and a bench. Tate press does not become a shoulder press because of its name. '
    + 'Pages 214/215/231 have coupled/hybrid execution; their dominant elbow action remains distinct from basic horizontal-press coverage.',
  '- Page 201 drawing shows a bar despite dumbbell title/instructions. Default follows the instructions, with the discrepancy retained.',
  '- JM/Kaz retain guide-211/guide-210 and their primary triceps hybrid role. No unvalidated chest fraction is added. '
    + 'Source-mechanics review is not automatic eligibility approval.',
  '- Original close-grip bench remains a triceps-primary programming choice for now. Page 43 describes chest-limited '
    + 'execution instead; this is an attribution/execution disagreement, not proof that either muscle always limits. '
    + 'Resolve execution-specific credits separately; do not infer growth or progressability from smaller absolute loads.',
  '- Bench dips are outside these 35 pages. Their isolation profile/vector and front-delt credit still require individual '
    + 'correction/evidence review; fallback status is not a clinical contraindication.',
  '- Original machine extension still has a 5/5 resistance-match point. This review does not validate that point: '
    + 'manufacturer-specific cams, alignment and ROM remain unknown. Automatic score replacement needs its own controlled experiment.',
  '- Required supports, long ropes, independent handles and double cable stations are documented here but are not yet '
    + 'availability filters in the app. Single-implement filtering remains an explicit limitation.', '',
  '## Completion boundary', '',
  'Verified: source identity, default implement, described action, support, laterality, relevant contradictions. '
    + 'Provisional: role interpretation and broad five-dimension bands. Unresolved: individual force-curve match, '
    + 'exact secondary credit, specific-machine fit, legacy point-score revisions and promotion to automatic generation. '
    + 'Remaining muscle families still need individual page/figure review.', '');
writeFileSync(output, lines.join('\n'));
console.log(output);
