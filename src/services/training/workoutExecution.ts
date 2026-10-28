import { SetType } from '@/models';
import { isLiveSetCompleted, type SessionSetState, type SessionSetsByExercise } from './sessionMapper';
import { startRest, type RestTimerState } from './restTimer';

/** Only the completion edge matters, never the execution position or prior PRs. */
export function restAfterCompletion(previous: SessionSetState | undefined, next: SessionSetState | undefined,
  timer: RestTimerState, duration: number, now: number): RestTimerState {
  return isNewSetCompletion(previous, next) ? startRest(next!.id, duration, now) : timer;
}

/** Clearing a required actual cannot leave a checked-but-invalid completed row. */
export function updateWorkoutSet(row: SessionSetState, patch: Partial<SessionSetState>): SessionSetState {
  const next = { ...row, ...patch,
    ...(Object.hasOwn(patch, 'actualRIR') ? { actualRIRSource: patch.actualRIRSource
      ?? (patch.isCompleted === undefined ? 'ATHLETE' as const : row.actualRIRSource ?? 'INHERITED_TARGET' as const) } : {}),
    ...(row.isCompleted && patch.isCompleted !== false ? { completionWasRecorded: true } : {}),
    ...(patch.isCompleted === false ? { completionWasRecorded: false } : {}) };
  if (next.actualPartialReps !== undefined && (!Number.isInteger(next.actualPartialReps) || next.actualPartialReps < 0 || next.actualPartialReps > 999)) {
    next.actualPartialReps = row.actualPartialReps;
  }
  return next.isCompleted && !isLiveSetCompleted(next) ? { ...next, isCompleted: false } : next;
}

/** Data correction of a completed row is not a new physical set. */
export function isNewSetCompletion(previous: SessionSetState | undefined, next: SessionSetState | undefined): boolean {
  return !!previous && !previous.isCompleted && !previous.completionWasRecorded && !!next && isLiveSetCompleted(next);
}

/** Advance only on a newly completed exercise; stop at the end without wrapping. */
export function nextExerciseAfterCompletion(order: readonly string[], sets: SessionSetsByExercise,
  exerciseId: string): number | null {
  const index = order.indexOf(exerciseId);
  const working = (sets[exerciseId] ?? []).filter((row) => row.setType !== SetType.WARMUP);
  if (index < 0 || !working.length || !working.every(isLiveSetCompleted)) return null;
  for (let next = index + 1; next < order.length; next++) {
    if ((sets[order[next]] ?? []).some((row) => row.setType !== SetType.WARMUP && !isLiveSetCompleted(row))) return next;
  }
  return null;
}

/** Keep editable numeric drafts empty and canonicalize accidental leading zeros. */
export function editNumericDraft(text: string, key: string, decimal: boolean): string {
  if (key === 'clear') return '';
  if (key === 'backspace') return text.slice(0, -1);
  if (key === '.') return decimal && !text.includes('.') ? `${text || '0'}.` : text;
  if (!/^\d$/.test(key)) return text;
  return `${text === '0' ? '' : text}${key}`.slice(0, 7);
}

/** Swap only unfinished work. Never transfer actuals or a load between different exercises. */
export function replacementWorkoutSets(source: readonly SessionSetState[], defaults: readonly SessionSetState[], token: string): SessionSetState[] {
  const pending = source.filter((set) => !isLiveSetCompleted(set));
  const rows = pending.length ? pending : defaults;
  return rows.map((set, index) => {
    const fallback = defaults[index % Math.max(1, defaults.length)];
    if (!fallback) throw Error('missingReplacementPrescription');
    const sameMeasure = (set.recording?.measure ?? 'REPETITIONS') === (fallback.recording?.measure ?? 'REPETITIONS');
    return { ...fallback, id: `${token}:${index}`, setType: set.setType,
      ...(sameMeasure ? { targetReps: set.targetReps, targetRIR: set.targetRIR,
        ...(set.targetDurationSeconds === undefined ? {} : { targetDurationSeconds: set.targetDurationSeconds }) } : {}),
      actualWeight: undefined, actualReps: undefined, actualRIR: undefined, actualRIRSource: undefined, actualPartialReps: undefined,
      actualDurationSeconds: undefined, actualLoadLevel: undefined, extensions: undefined, previous: undefined,
      isCompleted: false, completionWasRecorded: false, completionState: 'PENDING' as const, isAutoFilled: false };
  });
}
