import { MuscleGroup, SetType, type Exercise, type PlannedSession, type PlannedSet } from '@/models';
import { deriveSetRIRs } from './setIntensity';
import { exercisePrescription, loadForTarget } from './exercisePrescription';
import { TrainingGoal } from './volumePlan';
import { restDurationFor } from './restTimer';

export interface PreviewAddition {
  sessionIndex: number;
  exerciseId: string;
}

/** Re-evaluate the session floor after manual edits, not just on generator output. */
export function underfilledSessionIndexes(
  sessions: readonly Pick<PlannedSession, 'index' | 'exercises'>[],
  minimumSets: number,
): number[] {
  if (!Number.isFinite(minimumSets) || minimumSets <= 0) return [];
  return sessions.filter((session) =>
    session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) < minimumSets,
  ).map((session) => session.index);
}

/** Appends athlete-chosen exercises without mutating the generator output. */
export function appendPreviewExercises(
  sessions: readonly PlannedSession[],
  additions: readonly PreviewAddition[],
  catalogue: ReadonlyMap<string, Exercise>,
  goal: TrainingGoal,
): PlannedSession[] {
  return sessions.map((session) => {
    const used = new Set(session.exercises.map((entry) => entry.exerciseId));
    const exercises = [...session.exercises];
    for (const addition of additions) {
      if (addition.sessionIndex !== session.index || used.has(addition.exerciseId)) continue;
      const exercise = catalogue.get(addition.exerciseId);
      if (exercise === undefined) continue;
      used.add(exercise.id);
      const prescription = exercisePrescription(goal, exercise.profile);
      const rir = deriveSetRIRs(prescription.targetRIR, 3, prescription.maxExtraReserve);
      exercises.push({
        exerciseId: exercise.id,
        order: Math.max(-1, ...exercises.map((entry) => entry.order)) + 1,
        isEdited: true,
        restSeconds: restDurationFor(exercise.profile),
        sets: rir.map((targetRIR): PlannedSet => ({
          setType: SetType.NORMAL,
          targetRepsMin: prescription.reps.min,
          targetReps: prescription.reps.max,
          targetRIR,
        })),
      });
    }
    return { ...session, exercises };
  });
}

/**
 * The set whose range and effort describe an exercise: the last one. The first can
 * be a heavy single, which describes nothing but itself.
 */
export function representativeSet(sets: readonly PlannedSet[]): PlannedSet | undefined {
  return sets[sets.length - 1];
}

/** One deliberate edit made before saving a generated mesocycle. */
export interface PreviewExerciseEdit {
  restSeconds?: number;
  exerciseId?: string;
  sets?: number;
  targetRepsMin?: number;
  targetReps?: number;
  repsBySet?: Readonly<Record<number, { min: number; max: number }>>;
  rirBySet?: Readonly<Record<number, number>>;
}

export type PreviewEdits = Readonly<Record<string, PreviewExerciseEdit>>;

export interface PreviewMuscleVolume {
  muscle: MuscleGroup;
  /** Direct sets count 1; secondary-muscle exposure counts 0.5. */
  sets: number;
}

export interface PreviewMuscleVolumeBreakdown extends PreviewMuscleVolume {
  directSets: number;
  indirectSets: number;
}

/** Omit empty components instead of displaying noisy zero-credit labels. */
export function visibleVolumeComponents(
  volume: Pick<PreviewMuscleVolumeBreakdown, 'directSets' | 'indirectSets'>,
): ('direct' | 'indirect')[] {
  return ([
    ...(volume.directSets > 0 ? ['direct'] : []),
    ...(volume.indirectSets > 0 ? ['indirect'] : []),
  ] as ('direct' | 'indirect')[]);
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
      const swapped = edit.exerciseId !== undefined && edit.exerciseId !== exercise.exerciseId;
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
            if (base.setType === SetType.TOP_SINGLE) {
              if (!swapped) return { ...base };
              const { targetWeightKg: _oldWeight, ...withoutWeight } = base;
              return withoutWeight;
            }
            const nextRIR = edit.rirBySet?.[index] ?? targetRIRs[index];
            const individualRange = edit.repsBySet?.[index];
            const nextReps = individualRange?.max ?? edit.targetReps ?? base.targetReps;
            const prescribed = {
              ...base,
              targetRIR: nextRIR,
              ...((swapped || base.targetWeightKg === undefined) ||
                (nextRIR === base.targetRIR && nextReps === base.targetReps) ? {} : {
                targetWeightKg: loadForTarget(base.targetWeightKg *
                  (1 + (base.targetReps + base.targetRIR) / 30), nextReps, nextRIR),
              }),
              ...(individualRange !== undefined ? { targetRepsMin: individualRange.min }
                : edit.targetRepsMin === undefined
                ? {}
                : { targetRepsMin: edit.targetRepsMin }),
              ...(individualRange !== undefined ? { targetReps: individualRange.max }
                : edit.targetReps === undefined ? {} : { targetReps: edit.targetReps }),
            };
            if (!swapped) return prescribed;
            const { targetWeightKg: _oldWeight, ...withoutWeight } = prescribed;
            return withoutWeight;
          });
      const { manualRIRBySet: previousManual, ...withoutManual } = exercise;
      const manualRIRBySet = Object.fromEntries(Object.entries({
        ...(swapped ? {} : previousManual), ...edit.rirBySet,
      }).filter(([index]) => Number(index) < sets.length &&
        sets[Number(index)]?.setType !== SetType.TOP_SINGLE));
      return {
        ...withoutManual,
        exerciseId: edit.exerciseId ?? exercise.exerciseId,
        sets,
        ...(edit.restSeconds !== undefined && Number.isFinite(edit.restSeconds)
          ? { restSeconds: Math.max(0, Math.min(600, Math.round(edit.restSeconds))) } : {}),
        ...(Object.keys(manualRIRBySet).length === 0 ? {} : { manualRIRBySet }),
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
  return previewVolumeBreakdownByMuscle(sessions, exercisesById)
    .map(({ muscle, sets }) => ({ muscle, sets }));
}

/** Direct and fractional indirect work remain visible as separate quantities. */
export function previewVolumeBreakdownByMuscle(
  sessions: readonly PlannedSession[],
  exercisesById: ReadonlyMap<string, Exercise>,
): PreviewMuscleVolumeBreakdown[] {
  const totals = new Map<MuscleGroup, { directSets: number; indirectSets: number }>();
  const add = (muscle: MuscleGroup, direct: number, indirect: number) => {
    const previous = totals.get(muscle) ?? { directSets: 0, indirectSets: 0 };
    totals.set(muscle, {
      directSets: previous.directSets + direct,
      indirectSets: previous.indirectSets + indirect,
    });
  };
  sessions.forEach((session) => {
    session.exercises.forEach((planned) => {
      const exercise = exercisesById.get(planned.exerciseId);
      if (exercise === undefined) return;
      const sets = planned.sets.length;
      add(exercise.primaryMuscle, sets, 0);
      new Set(exercise.secondaryMuscles).forEach((muscle) => {
        if (muscle !== exercise.primaryMuscle) add(muscle, 0, sets * 0.5);
      });
    });
  });
  return [...totals.entries()]
    .map(([muscle, { directSets, indirectSets }]) => ({
      muscle, directSets, indirectSets, sets: directSets + indirectSets,
    }))
    .sort((left, right) => right.sets - left.sets || left.muscle.localeCompare(right.muscle));
}
