/** Body-half grouping and per-exercise muscle tags shared by every muscle display. */
import { MuscleGroup } from '@/models';

export const LOWER_BODY_MUSCLES: ReadonlySet<MuscleGroup> = new Set([
  MuscleGroup.QUADS, MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES,
  MuscleGroup.ADDUCTORS, MuscleGroup.CALVES, MuscleGroup.TIBIALIS,
]);

export type BodyHalf = 'UPPER' | 'LOWER';

export function bodyHalfOf(muscle: MuscleGroup): BodyHalf {
  return LOWER_BODY_MUSCLES.has(muscle) ? 'LOWER' : 'UPPER';
}

export interface BodyHalfGroup<T> {
  half: BodyHalf;
  entries: T[];
}

/** Anatomical order is stable across plan seeds, locale, volume and insertion order. */
export const MUSCLE_DISPLAY_ORDER: readonly MuscleGroup[] = [MuscleGroup.CHEST, MuscleGroup.LATS, MuscleGroup.MID_BACK,
  MuscleGroup.DELTS_FRONT, MuscleGroup.DELTS_LATERAL, MuscleGroup.DELTS_REAR, MuscleGroup.BICEPS, MuscleGroup.TRICEPS,
  MuscleGroup.FOREARMS, MuscleGroup.NECK, MuscleGroup.ERECTORS, MuscleGroup.CORE, MuscleGroup.QUADS,
  MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.ADDUCTORS, MuscleGroup.CALVES, MuscleGroup.TIBIALIS, MuscleGroup.UNCLASSIFIED];
/** Drops empty halves; never sorts muscles by their current dose. */
export function groupByBodyHalf<T extends { muscle: MuscleGroup }>(
  entries: readonly T[],
): BodyHalfGroup<T>[] {
  return (['UPPER', 'LOWER'] as const)
    .map((half) => ({ half, entries: entries.filter((entry) => bodyHalfOf(entry.muscle) === half)
      .sort((a, b) => MUSCLE_DISPLAY_ORDER.indexOf(a.muscle) - MUSCLE_DISPLAY_ORDER.indexOf(b.muscle)) }))
    .filter((group) => group.entries.length > 0);
}

export interface MuscleTag {
  muscle: MuscleGroup;
  role: 'primary' | 'secondary';
}

export function exerciseMuscleTags(exercise: {
  primaryMuscle: MuscleGroup;
  secondaryMuscles: readonly MuscleGroup[];
}): MuscleTag[] {
  return [
    { muscle: exercise.primaryMuscle, role: 'primary' },
    ...[...new Set(exercise.secondaryMuscles)]
      .filter((muscle) => muscle !== exercise.primaryMuscle)
      .map((muscle) => ({ muscle, role: 'secondary' as const })),
  ];
}
