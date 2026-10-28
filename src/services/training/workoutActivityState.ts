import { SetType, type Exercise } from '@/models';
import { isLiveSetCompleted, sessionProgress, type SessionSetsByExercise } from './sessionMapper';
import type { RestTimerState } from './restTimer';
import { exerciseName } from './exerciseName';
import { displayLoad } from './numericWheel';

/** Serializable lock-screen state; the OS renders the countdown without JS polling. */
export function workoutActivityState(exercises: readonly Exercise[], sets: SessionSetsByExercise,
  activeId: string | undefined, rest: RestTimerState, language = 'es', unit: 'kg' | 'lb' = 'kg') {
  const active = exercises.findIndex((exercise) => exercise.id === activeId);
  const ordered = active < 0 ? exercises : [...exercises.slice(active), ...exercises.slice(0, active)];
  for (const exercise of ordered) {
    const rows = sets[exercise.id] ?? [];
    if (!rows.some((row) => row.setType !== SetType.WARMUP && !isLiveSetCompleted(row))) continue;
    const index = rows.findIndex((row) => !isLiveSetCompleted(row));
    const row = rows[index];
    return { ...sessionProgress(sets), nextExercise: exerciseName(exercise, language), nextSet: row.setType === SetType.WARMUP ? 'W' : String(rows.slice(0, index + 1).filter((set) => set.setType !== SetType.WARMUP).length),
      nextSetTotal: rows.filter((set) => set.setType !== SetType.WARMUP).length,
      nextIntensity: row.actualRIR !== undefined ? row.actualRIR : row.targetRIR,
      nextReps: row.recording?.measure === 'SECONDS' ? `${row.actualDurationSeconds ?? row.targetDurationSeconds ?? '—'} s` : `${row.actualReps ?? row.targetReps} reps`,
      nextWeight: row.recording && !['TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG', 'ASSISTANCE_KG'].includes(row.recording.load) ? '' : `${row.actualWeight !== undefined || row.targetWeight > 0 ? Number(displayLoad(row.actualWeight ?? row.targetWeight, unit).toFixed(2)) : '—'} ${unit}`,
      restStart: rest.startedAt ?? 0, restEnd: rest.startedAt === null ? 0 : rest.startedAt + rest.durationSeconds * 1000 };
  }
  return { ...sessionProgress(sets), nextExercise: '', nextSet: '', nextSetTotal: 0, nextIntensity: null, nextReps: '', nextWeight: '', restStart: 0, restEnd: 0 };
}
