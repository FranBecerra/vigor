import { SetType, type Exercise, type WorkoutSession } from '@/models';
import { recordingOf } from './customExercises';
import { isSetCompleted, type SessionSetState, type SessionSetsByExercise } from './sessionMapper';

export interface PreviousPerformance { weight: number; reps: number; rir: number | null }
type Bucket = 'warmup' | 'single' | 'working';
export type ExercisePerformance = Record<Bucket, (PreviousPerformance | undefined)[]>;
export interface PerformanceContext {
  userId: string; sessionId: string; mesocycleId: string; plannedSessionIndex?: number; performedAt: number;
}
const bucket = (type: SetType): Bucket => type === SetType.WARMUP ? 'warmup' : type === SetType.TOP_SINGLE ? 'single' : 'working';
function millis(value: WorkoutSession['performedAt'] | undefined): number {
  if (typeof value === 'number') return value;
  return value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number'
    ? value.seconds * 1000 + value.nanoseconds / 1e6 : NaN;
}

/** Same prescribed session first; cross-session history is an exercise-specific fallback. */
export function previousPerformance(exercises: readonly Exercise[], history: readonly WorkoutSession[], context: PerformanceContext): ReadonlyMap<string, ExercisePerformance> {
  const sameSession = (session: WorkoutSession) => context.plannedSessionIndex !== undefined
    && session.mesocycleId === context.mesocycleId && session.plannedSessionIndex === context.plannedSessionIndex;
  const candidates = history.filter((session) => session.userId === context.userId && session.id !== context.sessionId
    && session.discardedAt === undefined && Number.isFinite(millis(session.completedAt))
    && millis(session.completedAt) <= context.performedAt && Number.isFinite(millis(session.performedAt))
    && millis(session.performedAt) <= context.performedAt)
    .sort((a, b) => Number(sameSession(b)) - Number(sameSession(a)) || millis(b.performedAt) - millis(a.performedAt) || a.id.localeCompare(b.id));
  const result = new Map<string, ExercisePerformance>();
  for (const exercise of exercises) {
    const mode = recordingOf(exercise); const selected: ExercisePerformance = { warmup: [], single: [], working: [] };
    for (const session of candidates) {
      const found: ExercisePerformance = { warmup: [], single: [], working: [] };
      for (const entry of session.exercises.filter((item) => item.exerciseId === exercise.id)) for (const set of entry.sets) {
        const rows = found[bucket(set.setType)]; rows.push(undefined);
        const sourceMode = set.recording ?? recordingOf(entry.exerciseSnapshot ?? {});
        if (sourceMode.measure !== mode.measure || sourceMode.load !== mode.load || !isSetCompleted({ ...set, recording: sourceMode })) continue;
        const load = mode.load === 'NONE' ? 0 : mode.load === 'LEVEL' ? set.actualLoadLevel! : set.actualWeight!;
        if (load > 10000) continue;
        rows[rows.length - 1] = { weight: load, reps: (mode.measure === 'SECONDS' ? set.actualDurationSeconds : set.actualReps)!,
          rir: typeof set.actualRIR === 'number' && Number.isFinite(set.actualRIR) && set.actualRIR >= 0 && set.actualRIR <= 5 ? set.actualRIR : null };
      }
      for (const kind of ['warmup', 'single', 'working'] as const) if (!selected[kind].length && found[kind].some(Boolean)) selected[kind] = found[kind];
      if (selected.warmup.length && selected.single.length && selected.working.length) break;
    }
    result.set(exercise.id, selected);
  }
  return result;
}

/** Idempotent hydration never changes actuals, completion, reps or prescribed effort. */
export function applyPreviousPerformance(sets: SessionSetsByExercise, baselines: ReadonlyMap<string, ExercisePerformance>, protectedLoads: ReadonlySet<string> = new Set()): SessionSetsByExercise {
  let next = sets;
  for (const [id, rows] of Object.entries(sets)) {
    const baseline = baselines.get(id); if (!baseline) continue;
    const indexes = { warmup: 0, single: 0, working: 0 };
    const changed = rows.map((row): SessionSetState => {
      const values = baseline[bucket(row.setType)]; const previous = values[indexes[bucket(row.setType)]++];
      const fallback = previous ?? values.findLast((value) => value !== undefined);
      const loadField = row.recording?.load === 'LEVEL' ? 'targetLoadLevel' : 'targetWeight';
      const seed = !row.isCompleted && !row.completionWasRecorded && !row.isAutoFilled && !protectedLoads.has(row.id) && row.recording?.load !== 'NONE'
        && row.actualWeight === undefined && row.actualLoadLevel === undefined
        && (row.setType !== SetType.WARMUP || row[loadField] === undefined || row[loadField] === 0);
      const weight = seed && fallback ? fallback.weight : row[loadField];
      if (row.previous?.weight === previous?.weight && row.previous?.reps === previous?.reps && row.previous?.rir === previous?.rir && weight === row[loadField]) return row;
      return { ...row, previous, ...(weight === undefined ? {} : { [loadField]: weight }) };
    });
    if (changed.some((row, index) => row !== rows[index])) { if (next === sets) next = { ...sets }; next[id] = changed; }
  }
  return next;
}
