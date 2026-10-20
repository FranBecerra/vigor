/** User-authored identity, never an inferred biomechanical efficacy score. */
import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup,
  type Exercise, type ExerciseRecording } from '@/models';

export interface CustomExerciseInput {
  name: string;
  recording: ExerciseRecording;
  primaryMuscle?: MuscleGroup;
  primaryMuscles?: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  equipment?: Equipment;
  movementVector?: MovementVector;
  movementVectors?: MovementVector[];
  profile?: ExerciseProfile;
  notes?: string;
  referenceUrl?: string;
  laterality?: 'BILATERAL' | 'PER_SIDE';
}
export const normalizedExerciseName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
export function recordingOf(exercise: Pick<Exercise, 'recording'>): ExerciseRecording {
  return exercise.recording ?? { measure: 'REPETITIONS', load: 'TOTAL_KG' };
}
export function supportsEstimatedMax(exercise: Exercise): boolean {
  const mode = recordingOf(exercise);
  return !exercise.isCustom && mode.measure === 'REPETITIONS' && mode.load === 'TOTAL_KG';
}
export function isValidCustomExercise(exercise: Exercise, ownerId: string): boolean {
  try {
    if (exercise.ownerId !== ownerId || !exercise.isCustom || !exercise.recording
      || !Number.isFinite(exercise.updatedAt) || (exercise.archivedAt !== undefined &&
        (!Number.isFinite(exercise.archivedAt) || exercise.archivedAt < 0))) return false;
    createCustomExercise({ ...exercise, recording: exercise.recording }, ownerId, exercise.id, [], exercise.createdAt!);
    return true;
  } catch { return false; }
}
export function createCustomExercise(input: CustomExerciseInput, ownerId: string, id: string,
  existing: readonly Exercise[], now: number): Exercise {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!ownerId || !id.startsWith(`custom:${ownerId}:`) || !Number.isFinite(now) || now < 0) throw new Error('invalidIdentity');
  if (!name || name.length > 120) throw new Error('invalidName');
  if (existing.some((entry) => entry.ownerId === ownerId && entry.archivedAt === undefined
    && normalizedExerciseName(entry.name) === normalizedExerciseName(name))) throw new Error('duplicateName');
  if (!input.recording || !['REPETITIONS', 'SECONDS'].includes(input.recording.measure)
    || !['NONE', 'TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG', 'ASSISTANCE_KG', 'LEVEL'].includes(input.recording.load)) throw new Error('invalidRecording');
  if (input.primaryMuscles !== undefined && (!Array.isArray(input.primaryMuscles)
    || input.primaryMuscles.some((muscle) => !Object.values(MuscleGroup).includes(muscle) || muscle === MuscleGroup.UNCLASSIFIED))) throw new Error('invalidMuscles');
  const primaries = [...new Set(input.primaryMuscles ?? (input.primaryMuscle && input.primaryMuscle !== MuscleGroup.UNCLASSIFIED ? [input.primaryMuscle] : []))];
  const primary = primaries[0] ?? MuscleGroup.UNCLASSIFIED;
  if (input.primaryMuscles !== undefined && input.primaryMuscle !== undefined && input.primaryMuscle !== primary) throw new Error('invalidMuscles');
  const secondary = [...new Set(input.secondaryMuscles ?? [])];
  if (!Object.values(MuscleGroup).includes(primary) || secondary.some((muscle) =>
    !Object.values(MuscleGroup).includes(muscle) || primaries.includes(muscle) || muscle === MuscleGroup.UNCLASSIFIED)) throw new Error('invalidMuscles');
  if (input.primaryMuscle !== undefined && !Object.values(MuscleGroup).includes(input.primaryMuscle)) throw new Error('invalidMuscles');
  if (primary === MuscleGroup.UNCLASSIFIED && secondary.length) throw new Error('invalidMuscles');
  const equipment = input.equipment ?? Equipment.UNSPECIFIED;
  if (input.movementVectors !== undefined && (!Array.isArray(input.movementVectors)
    || input.movementVectors.some((value) => !Object.values(MovementVector).includes(value) || value === MovementVector.UNCLASSIFIED))) throw new Error('invalidClassification');
  const movementVectors = [...new Set(input.movementVectors ?? (input.movementVector && input.movementVector !== MovementVector.UNCLASSIFIED ? [input.movementVector] : []))];
  const movementVector = movementVectors[0] ?? MovementVector.UNCLASSIFIED;
  if (input.movementVectors !== undefined && input.movementVector !== undefined && input.movementVector !== movementVector) throw new Error('invalidClassification');
  const profile = input.profile ?? ExerciseProfile.UNCLASSIFIED;
  if (!Object.values(Equipment).includes(equipment) || !Object.values(MovementVector).includes(movementVector)
    || !Object.values(ExerciseProfile).includes(profile)) throw new Error('invalidClassification');
  if ((input.notes?.length ?? 0) > 2000 || (input.referenceUrl?.length ?? 0) > 1000
    || (input.referenceUrl?.trim() && !/^https:\/\/[^\s]+$/i.test(input.referenceUrl.trim()))
    || (input.laterality !== undefined && !['BILATERAL', 'PER_SIDE'].includes(input.laterality))) throw new Error('invalidDetails');
  return { id, ownerId, name, primaryMuscle: primary, secondaryMuscles: secondary,
    ...(input.primaryMuscles !== undefined ? { primaryMuscles: primaries } : {}),
    equipment, movementVector, profile, isCustom: true, generationTier: ExerciseGenerationTier.MANUAL_ONLY,
    ...(input.movementVectors !== undefined ? { movementVectors } : {}),
    recording: { ...input.recording }, createdAt: now, updatedAt: now,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.referenceUrl?.trim() ? { referenceUrl: input.referenceUrl.trim() } : {}),
    ...(input.laterality ? { laterality: input.laterality } : {}) };
}
export function mergeExerciseCatalogue(builtins: readonly Exercise[], customs: readonly Exercise[], ownerId: string | null) {
  const ids = new Set(builtins.map((entry) => entry.id));
  return [...builtins, ...customs.filter((entry) => {
    if (!ownerId || !isValidCustomExercise(entry, ownerId) || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  }).map((entry) => ({ ...entry, criteria: undefined, generationTier: ExerciseGenerationTier.MANUAL_ONLY }))];
}
