/// <reference types="node" />
/** Reproducible setup/eligibility inventory. Not a numeric efficacy validation. */
import { writeFileSync } from 'node:fs';
import { MuscleGroup } from '../src/models';
import { EXERCISE_CATALOGUE } from '../src/services/training/exerciseCatalogue';
import { reviewCatalogueExercise, type EvidenceLedger } from '../src/services/training/catalogueReview';
import evidence from '../src/data/exercise-evidence.json';

const prefix = process.argv.find((arg) => arg.startsWith('--output-prefix='))?.slice('--output-prefix='.length)
  ?? 'docs/audits/2026-10-14-arm-catalogue';
const reviews = EXERCISE_CATALOGUE.filter((exercise) =>
  [MuscleGroup.BICEPS, MuscleGroup.TRICEPS].includes(exercise.primaryMuscle))
  .map((exercise) => ({ ...reviewCatalogueExercise(exercise, evidence.evidence as EvidenceLedger),
    stimulusTags: exercise.stimulusTags ?? [] }));
const rows = reviews.map((entry) => {
  const source = entry.bicepsSource ?? entry.individualSource;
  return { id: entry.id, muscle: entry.primaryMuscle, movement: entry.movement, profile: entry.profile,
    equipment: entry.equipment, stimulusTags: entry.stimulusTags, requiredApparatus: entry.requiredApparatus,
    apparatusOptions: entry.apparatusOptions, apparatusStatus: entry.apparatusStatus,
    sourcePages: entry.sourcePages, relatedSourcePages: entry.relatedSourcePages ?? [],
    sourceRelation: entry.sourceRelation, sourceMechanics: source ?? null,
    eligibility: entry.eligibility, eligibilityDecision: entry.eligibilityDecision,
    criteria: entry.criteria, issues: entry.issues, status: entry.status };
});
writeFileSync(`${prefix}.json`, JSON.stringify({ totalCatalogue: EXERCISE_CATALOGUE.length,
  armEntries: rows.length, scope: 'Source mechanics, minimum indexed apparatus and eligibility; no verified numeric growth hierarchy.', rows }, null, 2));
const table = rows.map((entry) => `| ${entry.id} | ${entry.muscle} | ${entry.sourcePages.join(', ') || '—'} | ${entry.sourceRelation} | ${entry.sourceMechanics?.shoulder ?? '?'} / ${entry.sourceMechanics?.support ?? '?'} | ${entry.requiredApparatus === null ? 'unknown' : entry.requiredApparatus.join(', ') || 'none additional'}${entry.apparatusOptions.length ? `; AND ${entry.apparatusOptions.map((group) => `(${group.join(' OR ')})`).join(' AND ')}` : ''} | ${entry.eligibility} | ${entry.criteria.every((criterion) => criterion.value === null) ? 'unscored' : 'provisional'} |`);
writeFileSync(`${prefix}.md`, ['# Arm catalogue inventory — 2026-10-14', '',
  `${rows.length} arm entries in a ${EXERCISE_CATALOGUE.length}-entry catalogue. The linked JSON preserves per-criterion provenance, eligibility reasons and unresolved setup details. This is not a completed numeric scientific ranking.`, '',
  'Source mechanics cover 28 biceps and 35 triceps guide pages. A related guide execution is not an identical generic catalogue exercise. Minimum apparatus refers to the indexed execution, not every possible adaptation. Unknown is not none. Option groups require one implement each. Existing IDs remain valid.', '',
  'Optional apparatus filtering is implemented in the catalogue API, not exposed in the generation UI. Omitted inventory preserves unknown availability. An explicit inventory filters known prerequisites; unreviewed entries are not guaranteed compatible. Generic MACHINE/CABLE availability does not establish specialty machinery, two cables, attachments or bench support.', '',
  'All imported biceps variants remain manual-only and unscored. Original automatic entries retain provisional criteria; none of the six numeric criteria is validated by a guide description or by a citation label. The BICEPS bucket includes elbow flexors; no new head-specific or brachialis/brachioradialis fractional credits are invented.', '',
  '| ID | Muscle | Guide pages | Source relation | Shoulder / support | Additional apparatus | Eligibility | Ratings |',
  '|---|---|---|---|---|---|---|---|', ...table, '',
  'See the accompanying arm-review implementation report for the paired generator experiments and remaining debt.',
].join('\n'));
console.log(JSON.stringify({ catalogue: EXERCISE_CATALOGUE.length, arms: rows.length,
  biceps: rows.filter((entry) => entry.muscle === MuscleGroup.BICEPS).length,
  triceps: rows.filter((entry) => entry.muscle === MuscleGroup.TRICEPS).length }));
