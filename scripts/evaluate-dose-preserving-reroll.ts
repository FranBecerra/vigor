/** Paired 30-profile/300-reroll audit, independent of the first-generation seed audit. */
import { writeFileSync } from 'node:fs';
import { Equipment, ExperienceLevel, SplitStructure } from '../src/models';
import { EXERCISE_CATALOGUE } from '../src/services/training/exerciseCatalogue';
import { planMesocycle, rerollMesocycle } from '../src/services/training/mesocyclePlanner';
import { effectiveSetsByMuscle } from '../src/services/training/sessionDistribution';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';

const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length);
const signature = (plan: ReturnType<typeof planMesocycle>) => JSON.stringify({ plan: plan.plan, uncapped: plan.uncappedPlan,
  squeeze: plan.squeeze, total: plan.selection.performedSets, attributed: Object.entries(plan.selection.attributedByMuscle).sort(([a], [b]) => a.localeCompare(b)),
  sessions: plan.distribution.sessions.map((session) => ({ sets: session.exercises.reduce((sum, e) => sum + e.sets, 0),
    direct: [...new Set(session.exercises.map((e) => e.exercise.primaryMuscle))].sort().map((muscle) => [muscle,
      session.exercises.filter((e) => e.exercise.primaryMuscle === muscle).reduce((sum, e) => sum + e.sets, 0)]),
    attributed: [...effectiveSetsByMuscle(session.exercises)].sort(([a], [b]) => a.localeCompare(b)) })) });
const rows = [];
for (const level of [ExperienceLevel.BEGINNER, ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED]) {
  for (const split of [SplitStructure.AUTO, SplitStructure.UPPER_LOWER, SplitStructure.PUSH_PULL_LEGS_UPPER,
    SplitStructure.FULL_BODY, SplitStructure.PUSH_PULL_LEGS]) {
    for (const equipment of ['full', 'free'] as const) {
      const input = { level, goal: TrainingGoal.HYPERTROPHY, split, seed: equipment === 'free' ? 209 : 206,
        capacity: { sessionsPerMicrocycle: split === SplitStructure.FULL_BODY ? 3 : split === SplitStructure.PUSH_PULL_LEGS ? 6 : 4,
          minutesPerSession: 75 },
        priorityRegions: split === SplitStructure.FULL_BODY ? [VolumeRegion.BACK, VolumeRegion.TRICEPS] : [],
        catalogue: equipment === 'full' ? EXERCISE_CATALOGUE : EXERCISE_CATALOGUE.filter((exercise) =>
          [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT].includes(exercise.equipment)) };
      const before = planMesocycle(input);
      const draws = [];
      let current = before;
      for (let seed = 201; seed <= 210; seed++) {
        const start = performance.now();
        const after = rerollMesocycle({ ...input, seed }, current);
        const dosePreserved = signature(after) === signature(before);
        const timeFits = after.distribution.sessions.every((session) => session.estimatedWorkMinutes <= after.availableWorkMinutesPerSession);
        draws.push({ seed, changed: after !== current, dosePreserved, timeFits, durationMs: performance.now() - start,
          sessions: after.distribution.sessions.map((session) => ({ sets: session.exercises.reduce((sum, e) => sum + e.sets, 0),
            exercises: session.exercises.map((e) => ({ id: e.exercise.id, sets: e.sets })) })) });
        current = after;
      }
      rows.push({ level, split, equipment, beforeSets: before.selection.performedSets,
        beforeSessions: before.distribution.sessions.map((session) => session.exercises.map((e) => ({ id: e.exercise.id, sets: e.sets }))), draws });
    }
  }
}
const draws = rows.flatMap((row) => row.draws);
const summary = { profiles: rows.length, draws: draws.length, changes: draws.filter((draw) => draw.changed).length,
  doseViolations: draws.filter((draw) => !draw.dosePreserved).length, timeViolations: draws.filter((draw) => !draw.timeFits).length,
  seedDoseSpan: Math.max(...rows.map((row) => {
    const totals = row.draws.map((draw) => draw.sessions.reduce((sum, session) => sum + session.sets, 0));
    return Math.max(...totals) - Math.min(...totals);
  })), maxDrawMs: Math.max(...draws.map((draw) => draw.durationMs)) };
if (output) writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.doseViolations || summary.timeViolations) process.exitCode = 1;
