import { MuscleGroup } from '@/models';

/** Direct credit is per target, not a partition of one set between muscles. */
export function primaryMusclesOf(exercise: { primaryMuscle: MuscleGroup; primaryMuscles?: readonly MuscleGroup[] }): MuscleGroup[] {
  return [...new Set(exercise.primaryMuscles?.length ? exercise.primaryMuscles : [exercise.primaryMuscle])]
    .filter((muscle) => muscle !== MuscleGroup.UNCLASSIFIED);
}
