/** Shoulder position is not a measured resistance curve. Retain geometry, not inferred curve novelty. */
import { MuscleGroup, type Exercise } from '@/models';
import { bicepsReviewForExercise } from './bicepsSourceReview';
import { tricepsSourceReview } from './tricepsSourceReview';

const matchingTricepsPages: Readonly<Record<string, number>> = {
  'press-frances': 200, 'pushdown-barra': 213, 'pushdown-cuerda': 230,
};

export function withArmGeometryDescriptors(exercise: Exercise): Exercise {
  if (![MuscleGroup.BICEPS, MuscleGroup.TRICEPS].includes(exercise.primaryMuscle) || !exercise.stimulusTags) return exercise;
  const tags = exercise.stimulusTags.filter((tag) => !tag.startsWith('RESISTANCE:'));
  // Known implement/support can diversify execution without inventing a curve.
  const source = bicepsReviewForExercise(exercise).source
    ?? tricepsSourceReview(exercise.guidePage ?? matchingTricepsPages[exercise.id]);
  const geometry = [...new Set([...tags, `IMPLEMENT:${exercise.equipment}`,
    ...(source && !tags.some((tag) => tag.startsWith('SUPPORT:')) ? [`SUPPORT:${source.support}`] : [])])];
  return JSON.stringify(geometry) === JSON.stringify(exercise.stimulusTags) ? exercise
    : { ...exercise, stimulusTags: geometry };
}

/** Paired promotion control; does not change ratings, eligibility or attribution. */
export function catalogueWithArmGeometry(catalogue: readonly Exercise[]): Exercise[] {
  return catalogue.map(withArmGeometryDescriptors);
}
