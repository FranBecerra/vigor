/** Optional evaluated alternatives; never silently change the athlete's frequency. */
import { type MesocyclePlan, type MesocyclePlanInput, planMesocycle } from './mesocyclePlanner';
import { evaluateGeneratorQuality } from './generatorQuality';
import { directVolumeFloor } from './exerciseSelection';
import { TrainingGoal } from './volumePlan';
import { MIN_HYPERTROPHY_SESSION_SETS } from './sessionDistribution';

export function findAlternativeSchedule(input: MesocyclePlanInput, original: MesocyclePlan) {
  const short = original.distribution.sessions.some((s) =>
    s.exercises.reduce((n, e) => n + e.sets, 0) < MIN_HYPERTROPHY_SESSION_SETS);
  if (input.goal !== TrainingGoal.HYPERTROPHY || !short || !original.selection.performedSets) return null;
  const originalRecoveryWarnings = evaluateGeneratorQuality(input, original).templateRecovery.filter((p) => p.reviewSuggested).length;
  for (let sessions = input.capacity.sessionsPerMicrocycle - 1; sessions >= 2; sessions -= 1) {
    const candidateInput = { ...input, capacity: { ...input.capacity, sessionsPerMicrocycle: sessions } };
    const plan = planMesocycle(candidateInput);
    if (plan.selection.performedSets < original.selection.performedSets) continue;
    const quality = evaluateGeneratorQuality(candidateInput, plan);
    if (!quality.valid || quality.sessions.some((s) => s.sets < MIN_HYPERTROPHY_SESSION_SETS)) continue;
    if (quality.templateRecovery.filter((p) => p.reviewSuggested).length > originalRecoveryWarnings) continue;
    const direct = (p: MesocyclePlan, muscle: typeof original.uncappedPlan.muscles[number]['muscle']) =>
      p.selection.selected.filter((e) => e.exercise.primaryMuscle === muscle).reduce((n, e) => n + e.sets, 0);
    if (original.uncappedPlan.muscles.some((m) =>
      (plan.selection.attributedByMuscle[m.muscle] ?? 0) < Math.min(m.meav,
        original.selection.attributedByMuscle[m.muscle] ?? 0) - 1
      || direct(plan, m.muscle) < Math.min(direct(original, m.muscle), directVolumeFloor(m.muscle, m.meav)))) continue;
    return { input: candidateInput, plan, quality };
  }
  return null;
}
