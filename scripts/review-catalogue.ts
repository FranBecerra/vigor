/// <reference types="node" />
/** Reproducible per-exercise screening, not a completed scientific evidence audit. */
import { mkdirSync, writeFileSync } from 'node:fs';
import evidence from '../src/data/exercise-evidence.json';
import { EXERCISE_CATALOGUE } from '../src/services/training/exerciseCatalogue';
import { reviewCatalogueExercise, type EvidenceLedger } from '../src/services/training/catalogueReview';

const folder = 'docs/audits';
const prefix = process.argv.find((arg) => arg.startsWith('--output-prefix='))?.slice('--output-prefix='.length)
  ?? `${folder}/catalogue-review-latest`;
const reviews = EXERCISE_CATALOGUE.map((exercise) => reviewCatalogueExercise(exercise, evidence.evidence as EvidenceLedger));
const counts: Record<string, number> = {};
reviews.forEach((review) => review.issues.forEach((issue) => { counts[issue] = (counts[issue] ?? 0) + 1; }));
mkdirSync(folder, { recursive: true });
writeFileSync(`${prefix}.json`, JSON.stringify({
  scope: 'All catalogue entries screened. Citation support and individual execution remain to be verified.',
  total: reviews.length, issueCounts: counts, reviews,
}, null, 2));
const rows = reviews.map((r) => `| ${r.id} | ${r.name.replace(/\|/g, '/')} | ${r.primaryMuscle} | ${r.movement} | ${r.equipment} | ${r.criteria.map((c) => c.value ?? '?').join('/')} | ${r.sourcePages.join(', ') || 'Original catalogue'} | ${r.sourceFindings.map((f) => `${f.corrected ? 'CORRECTED' : 'OPEN'} ${f.code}: ${f.fix}`).concat(r.issues).join('; ')} |`);
writeFileSync(`${prefix}.md`, [
  '# All-exercise catalogue screening', '',
  `All ${reviews.length} entries are screened; this is not ${reviews.length} completed individual scientific reviews. Existing scores are recorded, not endorsed or changed. The JSON records biomechanical checks and provenance per criterion. Individual source-mechanics batches have separate completion status.`, '',
  'Scores: lengthened loading / ROM / resistance-profile match / stability / load progressability / low systemic cost. A default 3 is not an experimentally established average.', '',
  '| ID | Exercise | Primary | Movement | Equipment | Existing scores | Source pages | Findings / proposed fix |',
  '|---|---|---|---|---|---|---|---|', ...rows,
].join('\n'));
console.log(JSON.stringify({ total: reviews.length, issueCounts: counts,
  sourceFindings: reviews.flatMap((r) => r.sourceFindings.map((f) => ({ id: r.id, ...f }))) }, null, 2));
