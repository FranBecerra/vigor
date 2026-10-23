/** Reproducible back-emphasis regression matrix. No accounts, network or athlete writes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ExperienceLevel, MovementVector } from '../src/models';
import { EXERCISE_CATALOGUE } from '../src/services/training/exerciseCatalogue';
import { planDoseFirstMesocycle } from '../src/services/training/mesocyclePlanner';
import { recommendCapacity, generateFromCapacityRecommendation } from '../src/services/training/capacityRecommendation';
import { SESSION_OVERHEAD_MINUTES } from '../src/services/training/sessionDuration';
import { TrainingGoal, VolumeRegion } from '../src/services/training/volumePlan';

const reports = Object.values(ExperienceLevel).flatMap((level) => {
  const input = { level, goal: TrainingGoal.HYPERTROPHY, catalogue: EXERCISE_CATALOGUE, priorityRegions: [VolumeRegion.BACK] };
  const recommendation = recommendCapacity(input);
  return Array.from({ length: 10 }, (_, seed) => {
    const request = { ...input, seed, capacity: recommendation };
    const start = performance.now(); const plan = generateFromCapacityRecommendation(request, recommendation) ?? planDoseFirstMesocycle(request);
    const rows = plan.distribution.sessions.flatMap((session) => session.exercises);
    const { preparedPlan: _prepared, ...calendar } = recommendation;
    const report = { level, seed, recommendation: calendar, generationMs: Math.round(performance.now() - start), sets: rows.reduce((sum, entry) => sum + entry.sets, 0),
      verticalPull: rows.some((entry) => entry.exercise.movementVector === MovementVector.PULL_VERTICAL),
      horizontalPull: rows.some((entry) => entry.exercise.movementVector === MovementVector.PULL_HORIZONTAL),
      unassigned: plan.distribution.unassigned.length, empty: plan.distribution.sessions.some((session) => !session.exercises.length),
      maxMinutes: Math.max(...plan.distribution.sessions.map((session) => session.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES)),
      targetShortfalls: plan.uncappedPlan.muscles.flatMap((target) => {
        const attributed = plan.selection.attributedByMuscle[target.muscle] ?? 0;
        return target.meav - attributed > 1 ? [{ muscle: target.muscle, target: target.meav, attributed }] : [];
      }),
      sessions: plan.distribution.sessions.map((session) => session.exercises.map((entry) => ({ id: entry.exercise.id, sets: entry.sets }))) };
    console.log(JSON.stringify(report)); return report;
  });
});
const sources = ['capacityRecommendation', 'targetCoverage', 'exerciseSelection', 'sessionDistribution', 'splitAdherence', 'mesocyclePlanner', 'volumePlan'];
const engineFingerprint = createHash('sha256').update(sources.map((name) => readFileSync(`src/services/training/${name}.ts`, 'utf8')).join('\n')).digest('hex');
writeFileSync(process.argv[2] ?? '/private/tmp/vigor-oct22-generator-matrix.json', JSON.stringify({ date: '2026-10-22', engineFingerprint, reports }, null, 2));
if (reports.some((report) => !report.verticalPull || !report.horizontalPull || report.empty || report.unassigned
  || report.targetShortfalls.length || report.maxMinutes > report.recommendation.minutesPerSession + 0.01)) process.exitCode = 1;
