import { SetType, type Exercise, type MuscleGroup, type PlannedSession, type WorkoutSession } from '@/models';
import { primaryMusclesOf } from './exerciseMuscles';
import { isSetCompleted, type SessionSetsByExercise } from './sessionMapper';

/** Stable move: payloads and completed work stay attached to their exercise identity. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function workoutReview(exercises: readonly Exercise[], sets: SessionSetsByExercise,
  history: readonly WorkoutSession[], sessionId: string) {
  let completed = 0; let pending = 0; let tonnage = 0;
  const muscles = new Map<MuscleGroup, number>();
  const records: { exerciseId: string; weight: number; reps: number }[] = [];
  for (const exercise of exercises) {
    const rows = sets[exercise.id] ?? [];
    pending += rows.filter((set) => !set.isCompleted).length;
    const working = rows.filter((set) => set.isCompleted && isSetCompleted(set) && set.setType !== SetType.WARMUP);
    completed += working.length;
    for (const muscle of primaryMusclesOf(exercise)) muscles.set(muscle, (muscles.get(muscle) ?? 0) + working.length);
    for (const muscle of exercise.secondaryMuscles.filter((muscle) => !primaryMusclesOf(exercise).includes(muscle))) {
      muscles.set(muscle, (muscles.get(muscle) ?? 0) + working.length * 0.5);
    }
    // Compare same-exercise load/repetition performances only, never different machines or assisted loads.
    const comparable = !exercise.recording || ['TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG'].includes(exercise.recording.load);
    const previous = history.filter((session) => session.id !== sessionId && session.completedAt !== undefined)
      .flatMap((session) => session.exercises.filter((entry) => entry.exerciseId === exercise.id).flatMap((entry) => entry.sets))
      .filter((set) => isSetCompleted(set) && set.setType !== SetType.WARMUP && (set.actualWeight ?? 0) > 0 && (set.actualReps ?? 0) > 0);
    for (const set of working) {
      if (comparable && set.recording?.measure !== 'SECONDS') {
        const weight = set.actualWeight ?? 0; const reps = set.actualReps ?? 0;
        tonnage += weight * reps + (set.extensions ?? []).reduce((sum, extra) => sum + (extra.weight ?? weight) * (extra.reps ?? 0), 0);
        // First observation establishes a baseline; it is not reported as a PR.
        if (previous.length && weight > 0 && reps > 0 && !previous.some((old) => old.actualWeight! >= weight && old.actualReps! >= reps)
          && previous.some((old) => (old.actualWeight === weight && old.actualReps! < reps) || (old.actualReps! >= reps && old.actualWeight! < weight))) {
          records.push({ exerciseId: exercise.id, weight, reps });
        }
      }
    }
  }
  return { completed, pending, tonnage, volumes: [...muscles].map(([muscle, sets]) => ({ muscle, sets })),
    records: records.filter((record, index, all) => all.findIndex((other) => other.exerciseId === record.exerciseId) === index) };
}

/** Explicit finish-time opt-in: persist roster/dose edits, never today's kg or achieved RIR as a future target. */
export function prescriptionFromWorkout(base: PlannedSession, exercises: readonly Exercise[], sets: SessionSetsByExercise): PlannedSession {
  return { ...base, exercises: exercises.map((exercise, order) => {
    const previous = base.exercises.find((entry) => entry.exerciseId === exercise.id);
    return { ...previous, exerciseId: exercise.id, exerciseSnapshot: exercise, order, isEdited: true,
      sets: (sets[exercise.id] ?? []).map((row, index) => {
        const planned = previous?.sets[index];
        const repsChanged = row.actualReps !== undefined && row.actualReps !== row.targetReps;
        return { setType: row.setType, targetRIR: planned?.targetRIR ?? row.targetRIR,
          targetReps: repsChanged ? row.actualReps! : (planned?.targetReps ?? row.targetReps),
          targetRepsMin: repsChanged ? row.actualReps! : (planned?.targetRepsMin ?? row.targetReps),
          ...(row.targetDurationSeconds === undefined ? {} : { targetDurationSeconds: row.targetDurationSeconds }),
        };
      }) };
  }) };
}

export function hasWorkoutPlanChanges(base: PlannedSession, exercises: readonly Exercise[], sets: SessionSetsByExercise): boolean {
  const previous = [...base.exercises].sort((a, b) => a.order - b.order);
  return previous.length !== exercises.length || exercises.some((exercise, index) => {
    const entry = previous[index]; const rows = sets[exercise.id] ?? [];
    return entry?.exerciseId !== exercise.id || entry.sets.length !== rows.length || rows.some((row, i) =>
      row.setType !== entry.sets[i]?.setType || (row.actualReps !== undefined && row.actualReps !== row.targetReps));
  });
}
