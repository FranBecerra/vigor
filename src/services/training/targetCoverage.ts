import { ExerciseGenerationTier, ExerciseProfile, type Exercise } from '@/models';
import { FOUNDATIONAL_PATTERNS, summarizeSelection, type SelectionResult } from './exerciseSelection';
import { exerciseMinutes } from './trainingCapacity';
import { RegionEmphasis, TOTAL_SETS_RANGE, type VolumePlan } from './volumePlan';

/** Fill the original fixed targets, not a lower capacity-dependent budget. Bounded and deterministic. */
export function completeTargetCoverage(selection: SelectionResult, plan: VolumePlan, catalogue: readonly Exercise[]): SelectionResult {
  let current = selection;
  const ceiling = TOTAL_SETS_RANGE[plan.goal][plan.level][1];
  const eligible = catalogue.filter((exercise) => !exercise.isCustom && !exercise.archivedAt
    && ![ExerciseGenerationTier.MANUAL_ONLY, ExerciseGenerationTier.STRENGTH_VARIANT, ExerciseGenerationTier.FALLBACK].includes(exercise.generationTier!));
  for (let step = 0; step < ceiling; step++) {
    const needs = plan.muscles.filter((muscle) => muscle.meav - (current.attributedByMuscle[muscle.muscle] ?? 0) > 1);
    if (!needs.length) break;
    const candidates = eligible.flatMap((exercise) => {
      if (!needs.some((muscle) => muscle.muscle === exercise.primaryMuscle)) return [];
      const existing = current.selected.find((entry) => entry.exercise.id === exercise.id);
      if (existing && existing.sets >= 4) return [];
      const target = plan.muscles.find((muscle) => muscle.muscle === exercise.primaryMuscle);
      const variants = target?.emphasis === RegionEmphasis.PRIORITY ? Math.max(4, Math.ceil(target.meav / 4)) : 4;
      if (!existing && current.selected.filter((entry) => entry.exercise.primaryMuscle === exercise.primaryMuscle).length >= variants) return [];
      const sets = existing ? 1 : exercise.profile === ExerciseProfile.ISOLATION ? 2 : 3;
      if (current.performedSets + sets > ceiling) return [];
      const utility = needs.reduce((sum, muscle) => sum + Math.min(muscle.meav - (current.attributedByMuscle[muscle.muscle] ?? 0),
        muscle.muscle === exercise.primaryMuscle ? sets : exercise.secondaryMuscles.includes(muscle.muscle) ? sets * 0.5 : 0), 0);
      const minutes = exerciseMinutes(exercise, (existing?.sets ?? 0) + sets) - (existing ? exerciseMinutes(exercise, existing.sets) : 0);
      return [{ exercise, sets, existing, score: utility / Math.max(1, minutes) }];
    }).sort((a, b) => b.score - a.score || Number(!!b.existing) - Number(!!a.existing) || a.exercise.id.localeCompare(b.exercise.id));
    const next = candidates[0];
    if (!next) {
      // Release redundant surplus before claiming a hard volume-ceiling shortfall.
      const donor = current.selected.find((entry) => entry.sets > (entry.exercise.profile === ExerciseProfile.ISOLATION ? 2 : 3)
        && plan.muscles.every((muscle) => {
          const before = current.attributedByMuscle[muscle.muscle] ?? 0;
          const credit = entry.exercise.primaryMuscle === muscle.muscle ? 1 : entry.exercise.secondaryMuscles.includes(muscle.muscle) ? 0.5 : 0;
          return before - credit >= Math.min(before, muscle.meav - 1);
        }));
      if (!donor) break;
      current = summarizeSelection(current.selected.map((entry) => ({ ...entry, sets: entry.sets - Number(entry === donor) })), plan, current.missingFoundationalPatterns);
      continue;
    }
    const selected = current.selected.map((entry) => ({ ...entry, sets: entry.sets + (entry.exercise.id === next.exercise.id ? next.sets : 0) }));
    if (!next.existing) selected.push({ exercise: next.exercise, sets: next.sets });
    current = summarizeSelection(selected, plan, current.missingFoundationalPatterns);
  }
  return current;
}

/** Re-evaluate actual selected identities after repairs, not stale selection diagnostics. */
export function missingRequiredPatterns(selection: SelectionResult, plan: VolumePlan) {
  return FOUNDATIONAL_PATTERNS.filter(({ vector, muscles }) => muscles.some((muscle) => plan.muscles.some((target) => target.muscle === muscle && target.meav > 0))
    && !selection.selected.some((entry) => entry.sets > 0 && entry.exercise.profile !== ExerciseProfile.ISOLATION && entry.exercise.movementVector === vector)).map(({ vector }) => vector);
}
