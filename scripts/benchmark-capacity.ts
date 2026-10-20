/** Paired capacity recommendations and latency; timings are local, not device guarantees. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Equipment, ExperienceLevel, SplitStructure } from '../src/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../src/services/training/exerciseCatalogue';
import { recommendCapacity } from '../src/services/training/capacityRecommendation';
import { planMesocycle } from '../src/services/training/mesocyclePlanner';
import { SESSION_OVERHEAD_MINUTES } from '../src/services/training/sessionDuration';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';

const output = process.argv[2];
const verifyPlans = process.argv.includes('--verify-plans');
const pairedPacking = process.argv.includes('--paired-packing');
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
if (process.argv.includes('--extended')) {
  for (const level of Object.values(ExperienceLevel)) for (const split of Object.values(SplitStructure)) {
    for (const priorityRegions of [[], [VolumeRegion.BICEPS], [VolumeRegion.GLUTES]]) {
      cases.push({ id: `packing-${level}-${split}-${priorityRegions.join('-') || 'balanced'}`,
        input: { level, goal: TrainingGoal.HYPERTROPHY, catalogue: EXERCISE_CATALOGUE, split, priorityRegions } });
    }
  }
}
console.log(JSON.stringify({ loaded: fingerprint, cases: cases.length }));
const reports = cases.map(({ id, input }) => {
  const beforeStart = performance.now();
  const beforeRecommendation = pairedPacking ? recommendCapacity({ ...input, capacityPacking: false }) : undefined;
  const beforeDurationMs = Math.round(performance.now() - beforeStart);
  const start = performance.now();
  const recommendation = recommendCapacity(input);
  const durationMs = Math.round(performance.now() - start);
  const actualPlans = verifyPlans ? [11, 22, 33].map((seed) => {
    const plan = planMesocycle({ ...input, seed, capacity: recommendation });
    return { seed, performedSets: plan.selection.performedSets, limitedBy: plan.limitedBy,
      loads: plan.distribution.sessions.map((session) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0)),
      minutes: plan.distribution.sessions.map((session) => Math.round(session.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES)),
      empty: plan.distribution.sessions.some((session) => !session.exercises.length),
      unassigned: plan.distribution.unassigned.length };
  }) : undefined;
  const report = { id, durationMs, recommendation, ...(actualPlans ? { actualPlans } : {}),
    ...(beforeRecommendation ? { beforeRecommendation, beforeDurationMs } : {}) };
  console.log(JSON.stringify(report));
  return report;
});
writeFileSync(output, JSON.stringify({ fingerprint, reports }, null, 2));
