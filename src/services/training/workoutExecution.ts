import { SetType } from '@/models';
import { isLiveSetCompleted, type SessionSetState, type SessionSetsByExercise } from './sessionMapper';

/** Clearing a required actual cannot leave a checked-but-invalid completed row. */
export function updateWorkoutSet(row: SessionSetState, patch: Partial<SessionSetState>): SessionSetState {
  const next = { ...row, ...patch };
  return next.isCompleted && !isLiveSetCompleted(next) ? { ...next, isCompleted: false } : next;
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
