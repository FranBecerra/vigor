/** Paired capacity recommendations and latency; timings are local, not device guarantees. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Equipment, ExperienceLevel, SplitStructure } from '../src/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../src/services/training/exerciseCatalogue';
import { recommendCapacity } from '../src/services/training/capacityRecommendation';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';

const output = process.argv[2];
if (!output) throw new Error('Usage: node --import tsx scripts/benchmark-capacity.ts OUTPUT.json');
const fingerprint = createHash('sha256').update(['mesocyclePlanner', 'capacityRecommendation', 'sessionDistribution']
  .map((name) => readFileSync(`src/services/training/${name}.ts`, 'utf8')).join('\n')).digest('hex');
const cases = [
  ...Object.values(ExperienceLevel).flatMap((level) => [TrainingGoal.HYPERTROPHY, TrainingGoal.STRENGTH]
    .map((goal) => ({ id: `${level}-${goal}-full`, input: { level, goal, catalogue: EXERCISE_CATALOGUE } }))),
  { id: 'intermediate-back-triceps', input: { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
    catalogue: EXERCISE_CATALOGUE, priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS],
    deprioritizedRegions: [VolumeRegion.QUADS] } },
  { id: 'advanced-bodyweight', input: { level: ExperienceLevel.ADVANCED, goal: TrainingGoal.HYPERTROPHY,
    catalogue: filterCatalogue(EXERCISE_CATALOGUE, { availableEquipment: [Equipment.BODYWEIGHT] }) } },
  { id: 'beginner-empty', input: { level: ExperienceLevel.BEGINNER, goal: TrainingGoal.HYPERTROPHY, catalogue: [] } },
  { id: 'intermediate-ppl-biceps', input: { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
    catalogue: EXERCISE_CATALOGUE, split: SplitStructure.PUSH_PULL_LEGS, priorityRegions: [VolumeRegion.BICEPS] } },
];
console.log(JSON.stringify({ loaded: fingerprint, cases: cases.length }));
const reports = cases.map(({ id, input }) => {
  const start = performance.now();
  const recommendation = recommendCapacity(input);
  const report = { id, durationMs: Math.round(performance.now() - start), recommendation };
  console.log(JSON.stringify(report));
  return report;
});
writeFileSync(output, JSON.stringify({ fingerprint, reports }, null, 2));
