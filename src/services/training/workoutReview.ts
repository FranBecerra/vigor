import { SetType, type Exercise, type MuscleGroup, type PlannedSession, type WorkoutSession } from '@/models';
import { primaryMusclesOf } from './exerciseMuscles';
import { isLiveSetCompleted, isSetCompleted, type SessionSetsByExercise } from './sessionMapper';
import { cleanSupersets } from './workoutStructure';

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
  const recordSetIds: string[] = [];
  for (const exercise of exercises) {
    const rows = sets[exercise.id] ?? [];
    pending += rows.filter((set) => set.setType !== SetType.WARMUP && !isLiveSetCompleted(set)).length;
    const working = rows.filter((set) => isLiveSetCompleted(set) && set.setType !== SetType.WARMUP);
    completed += working.length;
    for (const muscle of primaryMusclesOf(exercise)) if (working.length) muscles.set(muscle, (muscles.get(muscle) ?? 0) + working.length);
    for (const muscle of exercise.secondaryMuscles.filter((muscle) => !primaryMusclesOf(exercise).includes(muscle))) {
      if (working.length) muscles.set(muscle, (muscles.get(muscle) ?? 0) + working.length * 0.5);
    }
    // Compare same-exercise load/repetition performances only, never different machines or assisted loads.
    const comparable = exercise.recording?.measure !== 'SECONDS' && (!exercise.recording || ['TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG'].includes(exercise.recording.load));
    const validPerformance = (weight: number | undefined, reps: number | undefined) => typeof weight === 'number' && Number.isFinite(weight) && weight > 0
      && typeof reps === 'number' && Number.isInteger(reps) && reps > 0 && reps <= 999;
    const previous = history.filter((session) => session.id !== sessionId && session.completedAt !== undefined && session.discardedAt === undefined)
      .flatMap((session) => session.exercises.filter((entry) => entry.exerciseId === exercise.id).flatMap((entry) => entry.sets.filter((set) =>
        (set.recording?.measure ?? entry.exerciseSnapshot?.recording?.measure ?? 'REPETITIONS') === (exercise.recording?.measure ?? 'REPETITIONS')
        && (set.recording?.load ?? entry.exerciseSnapshot?.recording?.load ?? 'TOTAL_KG') === (exercise.recording?.load ?? 'TOTAL_KG'))))
      .filter((set) => isSetCompleted(set) && set.setType !== SetType.WARMUP && validPerformance(set.actualWeight, set.actualReps));
    const hasBaseline = previous.length > 0;
    for (const set of working) {
      if (comparable && set.recording?.measure !== 'SECONDS') {
        const weight = set.actualWeight ?? 0; const reps = set.actualReps ?? 0;
        if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight < 0 || reps < 0) continue;
        tonnage += weight * reps + (set.extensions ?? []).reduce((sum, extra) => sum + (Number.isFinite(extra.weight ?? weight) && Number.isFinite(extra.reps) ? (extra.weight ?? weight) * (extra.reps ?? 0) : 0), 0);
        // First observation establishes a baseline; it is not reported as a PR.
        if (hasBaseline && validPerformance(weight, reps) && !previous.some((old) => old.actualWeight! >= weight && old.actualReps! >= reps)
          && previous.some((old) => (old.actualWeight === weight && old.actualReps! < reps) || old.actualWeight! < weight)) {
          records.push({ exerciseId: exercise.id, weight, reps });
          recordSetIds.push(`${exercise.id}:${set.id}`);
        }
        previous.push({ ...set, completionState: 'DONE' });
      }
    }
  }
  return { completed, pending, tonnage, volumes: [...muscles].map(([muscle, sets]) => ({ muscle, sets })),
    recordSetIds, records: records.filter((record, index, all) => all.findIndex((other) => other.exerciseId === record.exerciseId) === index) };
}

/** Explicit finish-time opt-in: persist roster/dose edits, never today's kg or achieved RIR as a future target. */
export function prescriptionFromWorkout(base: PlannedSession, exercises: readonly Exercise[], sets: SessionSetsByExercise, supersets = base.supersets ?? {}): PlannedSession {
  return { ...base, supersets: cleanSupersets(exercises.map((exercise) => exercise.id), supersets), exercises: exercises.map((exercise, order) => {
    const previous = base.exercises.find((entry) => entry.exerciseId === exercise.id);
    let workingIndex = 0; let warmupIndex = 0;
    return { ...previous, exerciseId: exercise.id, exerciseSnapshot: exercise, order, isEdited: true,
      sets: (sets[exercise.id] ?? []).map((row) => {
        const warmup = row.setType === SetType.WARMUP;
        const planned = previous?.sets.filter((set) => (set.setType === SetType.WARMUP) === warmup)[warmup ? warmupIndex++ : workingIndex++];
        return { ...planned, setType: row.setType, targetRIR: row.targetRIR,
          targetReps: planned?.targetReps ?? row.targetReps,
          targetRepsMin: planned?.targetRepsMin ?? row.targetReps,
          ...(row.targetDurationSeconds === undefined ? {} : { targetDurationSeconds: row.targetDurationSeconds }),
          ...(warmup ? { targetWeightKg: row.targetWeight } : {}),
        };
      }) };
  }) };
}

export function hasWorkoutPlanChanges(base: PlannedSession, exercises: readonly Exercise[], sets: SessionSetsByExercise): boolean {
  return workoutPlanChanges(base, exercises, sets).length > 0;
}

export interface WorkoutPlanChange {
  kind: 'added' | 'removed' | 'order' | 'sets' | 'warmups' | 'type' | 'reps' | 'superset';
  exercise?: Exercise;
  exerciseId: string;
  set?: number;
  before?: string | number;
  after?: string | number;
}
/** Describe only the prescription changes that the finish action actually applies. */
export function workoutPlanChanges(base: PlannedSession, exercises: readonly Exercise[], sets: SessionSetsByExercise, supersets = base.supersets ?? {}): WorkoutPlanChange[] {
  const changes: WorkoutPlanChange[] = [];
  const previous = [...base.exercises].sort((a, b) => a.order - b.order);
  previous.forEach((entry) => {
    if (!exercises.some((exercise) => exercise.id === entry.exerciseId))
      changes.push({ kind: 'removed', exercise: entry.exerciseSnapshot, exerciseId: entry.exerciseId });
  });
  exercises.forEach((exercise, index) => {
    const beforeIndex = previous.findIndex((entry) => entry.exerciseId === exercise.id);
    const entry = previous[beforeIndex];
    if ((base.supersets?.[exercise.id] ?? '') !== (supersets[exercise.id] ?? '')) changes.push({ kind: 'superset', exercise, exerciseId: exercise.id });
    if (!entry) { changes.push({ kind: 'added', exercise, exerciseId: exercise.id }); return; }
    if (beforeIndex !== index) changes.push({ kind: 'order', exercise, exerciseId: exercise.id, before: beforeIndex + 1, after: index + 1 });
    const rows = sets[exercise.id] ?? [];
    const beforeWarmups = entry.sets.filter((set) => set.setType === SetType.WARMUP).length;
    const afterWarmups = rows.filter((set) => set.setType === SetType.WARMUP).length;
    if (entry.sets.length - beforeWarmups !== rows.length - afterWarmups) changes.push({ kind: 'sets', exercise, exerciseId: exercise.id, before: entry.sets.length - beforeWarmups, after: rows.length - afterWarmups });
    if (beforeWarmups !== afterWarmups) changes.push({ kind: 'warmups', exercise, exerciseId: exercise.id, before: beforeWarmups, after: afterWarmups });
    let warmupIndex = 0; let workingIndex = 0;
    rows.forEach((row, i) => {
      const warmup = row.setType === SetType.WARMUP;
      const original = entry.sets.filter((set) => (set.setType === SetType.WARMUP) === warmup)[warmup ? warmupIndex++ : workingIndex++];
      if (!original) return;
      if (row.setType !== original.setType) changes.push({ kind: 'type', exercise, exerciseId: exercise.id, set: i + 1, before: original.setType, after: row.setType });
    });
  });
  return changes;
}
