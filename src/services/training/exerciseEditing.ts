import { Equipment, ExerciseApparatus, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup, type Exercise, type ExerciseCriteria } from '@/models';
import { createCustomExercise, type CustomExerciseInput } from './customExercises';
import manualVariants from '@/data/manual-exercise-variants.json';

export const CRITERIA_KEYS = ['stretchedPositionLoading', 'rangeOfMotion', 'resistanceProfileMatch', 'stabilityCost', 'loadProgressability', 'systemicFatigueCost'] as const;
export interface ExerciseEditInput extends CustomExerciseInput {
  criteria?: ExerciseCriteria | null;
  requiredApparatus?: ExerciseApparatus[];
}
export interface ExerciseOverride { id: string; ownerId: string; changes: ExerciseEditInput; updatedAt: number }

/** Remove only the known agent-authored import annotations, never arbitrary user prose. */
export function cleanImportedExerciseNotes(note?: string): string {
  let result = note ?? '';
  for (const exercise of manualVariants.exercises) result = result.replace(exercise.notes, '');
  return result.split('\n').filter((line) => !/^Source: Micro 1\.html \/ .+$/.test(line.trim())).join('\n').trim();
}
export function exerciseEditInput(exercise: Exercise): ExerciseEditInput {
  return { name: exercise.name, recording: exercise.recording ?? { measure: 'REPETITIONS', load: 'TOTAL_KG' },
    primaryMuscles: exercise.primaryMuscles ?? (exercise.primaryMuscle === 'UNCLASSIFIED' ? [] : [exercise.primaryMuscle]),
    secondaryMuscles: exercise.secondaryMuscles, equipment: exercise.equipment, profile: exercise.profile,
    movementVectors: exercise.movementVectors ?? (exercise.movementVector === 'UNCLASSIFIED' ? [] : [exercise.movementVector]),
    notes: cleanImportedExerciseNotes(exercise.notes), referenceUrl: exercise.referenceUrl ?? '',
    laterality: exercise.laterality ?? 'BILATERAL', criteria: exercise.criteria ?? null,
    ...(exercise.requiredApparatus === undefined ? {} : { requiredApparatus: exercise.requiredApparatus }) };
}
export function createExerciseOverride(exercise: Exercise, input: ExerciseEditInput, ownerId: string, now: number): ExerciseOverride {
  if (!ownerId || !exercise.id || (exercise.isCustom && exercise.ownerId !== ownerId)) throw Error('invalidIdentity');
  const validated = createCustomExercise(input, ownerId, `custom:${ownerId}:validation`, [], now);
  if (input.criteria !== undefined && input.criteria !== null && (!input.criteria || typeof input.criteria !== 'object'
    || Object.keys(input.criteria).length !== CRITERIA_KEYS.length || CRITERIA_KEYS.some((key) =>
      !Number.isInteger(input.criteria![key]) || input.criteria![key] < 1 || input.criteria![key] > 5))) throw Error('invalidCriteria');
  if (input.requiredApparatus !== undefined && (!Array.isArray(input.requiredApparatus)
    || input.requiredApparatus.some((value) => !Object.values(ExerciseApparatus).includes(value)))) throw Error('invalidClassification');
  const { id: _id, ownerId: _owner, createdAt: _created, updatedAt: _updated, isCustom: _custom, generationTier: _tier, ...fields } = validated;
  return { id: exercise.id, ownerId, updatedAt: now, changes: { ...fields, recording: validated.recording!,
    notes: input.notes?.trim() ?? '', referenceUrl: input.referenceUrl?.trim() ?? '',
    criteria: input.criteria ?? null,
    ...(input.requiredApparatus === undefined ? {} : { requiredApparatus: [...new Set(input.requiredApparatus)] }) } };
}
export function validExerciseOverride(entry: ExerciseOverride, ownerId: string) {
  try { return entry.ownerId === ownerId && createExerciseOverride({ id: entry.id, isCustom: false } as Exercise, entry.changes, ownerId, entry.updatedAt).id === entry.id; } catch { return false; }
}
export function mergeExerciseOverrides(catalogue: readonly Exercise[], entries: readonly ExerciseOverride[], ownerId: string | null): Exercise[] {
  const overrides = new Map(entries.filter((entry) => entry.ownerId === ownerId).map((entry) => [entry.id, entry]));
  return catalogue.map((exercise) => {
    const saved = overrides.get(exercise.id);
    if (!saved || !ownerId) return exercise;
    try {
      const { changes } = createExerciseOverride(exercise, saved.changes, ownerId, saved.updatedAt);
      const { criteria, ...fields } = changes;
      return { ...exercise, ...fields, criteria: criteria ?? undefined, isPersonalized: true,
        // Scoring a manual movement never silently enrolls it in automatic programming.
        generationTier: exercise.isCustom || !criteria || (fields.primaryMuscles?.length ?? 0) > 1 || (fields.movementVectors?.length ?? 0) > 1
          || fields.recording.measure !== 'REPETITIONS' || fields.recording.load !== 'TOTAL_KG' || fields.primaryMuscle === MuscleGroup.UNCLASSIFIED
          || fields.profile === ExerciseProfile.UNCLASSIFIED || fields.movementVector === MovementVector.UNCLASSIFIED || fields.equipment === Equipment.UNSPECIFIED
          ? ExerciseGenerationTier.MANUAL_ONLY : exercise.generationTier };
    } catch { return exercise; }
  });
}
