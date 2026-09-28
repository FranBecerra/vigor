import { MuscleGroup, SetType, type Exercise, type PlannedSession, type PlannedSet } from '@/models';
import { deriveSetRIRs } from './setIntensity';

/**
 * The set whose range and effort describe an exercise: the last one. The first can
 * be a heavy single, which describes nothing but itself.
 */
export function representativeSet(sets: readonly PlannedSet[]): PlannedSet | undefined {
  return sets[sets.length - 1];
}

/** One deliberate edit made before saving a generated mesocycle. */
export interface PreviewExerciseEdit {
  exerciseId?: string;
  sets?: number;
  targetRepsMin?: number;
  targetReps?: number;
}

export type PreviewEdits = Readonly<Record<string, PreviewExerciseEdit>>;

export interface PreviewMuscleVolume {
  muscle: MuscleGroup;
  /** Direct sets count 1; secondary-muscle exposure counts 0.5. */
  sets: number;
}

export function previewEditKey(sessionIndex: number, order: number): string {
  return `${sessionIndex}:${order}`;
}

/** Applies local preview changes without mutating the generated plan. */
export function applyPreviewEdits(
  sessions: readonly PlannedSession[],
  edits: PreviewEdits,
): PlannedSession[] {
  return sessions.map((session) => ({
    ...session,
    exercises: session.exercises.map((exercise) => {
      const edit = edits[previewEditKey(session.index, exercise.order)];
      if (edit === undefined) return exercise;
      const setCount = edit.sets ?? exercise.sets.length;
      const source = exercise.sets[exercise.sets.length - 1] ?? exercise.sets[0];
      const targetRIR = source?.targetRIR ?? 0;
      const maxExtraReserve = exercise.sets.reduce(
        (maximum, set) => Math.max(maximum, set.targetRIR - targetRIR),
        0,
      );
      const targetRIRs = deriveSetRIRs(targetRIR, setCount, maxExtraReserve);
      const sets = source === undefined
        ? []
        : Array.from({ length: setCount }, (_, index) => {
            const base = exercise.sets[index] ?? source;
            // The heavy single is a fixed rep at a fixed effort; editing the working
            // range must not turn it into another working set.
            if (base.setType === SetType.TOP_SINGLE) return { ...base };
            return {
              ...base,
              targetRIR: targetRIRs[index],
              ...(edit.targetRepsMin === undefined
                ? {}
                : { targetRepsMin: edit.targetRepsMin }),
              ...(edit.targetReps === undefined ? {} : { targetReps: edit.targetReps }),
            };
          });
      return {
        ...exercise,
        exerciseId: edit.exerciseId ?? exercise.exerciseId,
        sets,
        isEdited: true,
      };
    }),
  }));
}

/** Attributed volume of the edited preview, ordered from highest to lowest. */
export function previewVolumeByMuscle(
  sessions: readonly PlannedSession[],
  exercisesById: ReadonlyMap<string, Exercise>,
): PreviewMuscleVolume[] {
  const totals = new Map<MuscleGroup, number>();
  sessions.forEach((session) => {
    session.exercises.forEach((planned) => {
      const exercise = exercisesById.get(planned.exerciseId);
      if (exercise === undefined) return;
      const sets = planned.sets.length;
      totals.set(exercise.primaryMuscle, (totals.get(exercise.primaryMuscle) ?? 0) + sets);
      exercise.secondaryMuscles.forEach((muscle) => {
        totals.set(muscle, (totals.get(muscle) ?? 0) + sets * 0.5);
      });
    });
  });
  return [...totals.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((left, right) => right.sets - left.sets || left.muscle.localeCompare(right.muscle));
}
