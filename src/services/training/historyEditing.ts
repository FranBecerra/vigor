import { SetType, type WorkoutSession } from '@/models';
import { isSetCompleted } from './sessionMapper';
import { normalizeWorkoutNote } from './trainingNotes';

export type HistoryEdit = Pick<WorkoutSession, 'sessionName' | 'sessionNote' | 'exercises'>;
/** Only execution details are editable; identity, dates, progression and Health linkage stay intact. */
export function editWorkoutHistory(original: WorkoutSession, owner: string, draft: HistoryEdit, now: number): WorkoutSession {
  if (!owner || original.userId !== owner || !original.completedAt || original.discardedAt !== undefined
    || !Number.isFinite(now) || now <= 0) throw Error('invalidHistoryOwner');
  const name = draft.sessionName?.trim();
  if (name && (name.length > 100 || /[\p{Cc}]/u.test(name))) throw Error('invalidHistoryName');
  if (!Array.isArray(draft.exercises) || draft.exercises.length > 100) throw Error('invalidHistoryExercises');
  const seen = new Set<string>();
  const exercises = draft.exercises.map((entry, order) => {
    const previous = original.exercises.find((item) => item.id === entry.id && item.exerciseId === entry.exerciseId);
    if (!previous || seen.has(entry.id) || !Array.isArray(entry.sets) || entry.sets.length > 100) throw Error('invalidHistoryExercise');
    seen.add(entry.id); const setIds = new Set<string>();
    const sets = entry.sets.map((set) => {
      if (!set.id || set.id.length > 200 || setIds.has(set.id) || !Object.values(SetType).includes(set.setType)) throw Error('invalidHistorySet');
      setIds.add(set.id);
      const integer = (value: number | undefined, max: number) => value === undefined || Number.isInteger(value) && value >= 0 && value <= max;
      const load = (value: number | undefined) => value === undefined || Number.isFinite(value) && value >= 0 && value <= 100000;
      if (!integer(set.actualReps, 999) || !integer(set.actualDurationSeconds, 3600) || !integer(set.actualPartialReps, 999)
        || !load(set.actualWeight) || !load(set.actualLoadLevel)
        || set.actualRIR !== undefined && set.actualRIR !== null && (!Number.isFinite(set.actualRIR) || set.actualRIR < 0 || set.actualRIR > 5)
        || (set.extensions ?? []).some((extra) => !integer(extra.reps, 999) || !load(extra.weight))) throw Error('invalidHistoryActuals');
      const baseline = previous.sets.find((row) => row.id === set.id);
      const recording = previous.exerciseSnapshot?.recording ?? baseline?.recording ?? previous.sets[0]?.recording;
      if (set.completionState !== undefined && !['DONE', 'PENDING'].includes(set.completionState)) throw Error('invalidHistoryCompletion');
      const result = { ...(baseline ?? { id: set.id, targetReps: 10, targetWeight: 0, targetRIR: 2, isAutoFilled: false }),
        setType: set.setType, completionState: set.completionState, actualReps: set.actualReps,
        actualWeight: set.actualWeight, actualRIR: set.actualRIR, actualLoadLevel: set.actualLoadLevel,
        actualDurationSeconds: set.actualDurationSeconds, actualPartialReps: set.actualPartialReps,
        extensions: set.extensions?.map((extra) => ({ reps: extra.reps, weight: extra.weight })),
        ...(recording ? { recording } : {}) };
      if (set.completionState === 'DONE' && (!isSetCompleted(result)
        || (recording?.measure !== 'SECONDS' && !(set.actualReps! > 0)))) throw Error('invalidHistoryCompletion');
      return result;
    });
    return { ...previous, order, sets, notes: normalizeWorkoutNote(entry.notes ?? '') };
  });
  return { ...original, sessionName: name || original.sessionName || '', sessionNote: normalizeWorkoutNote(draft.sessionNote ?? ''), exercises, editedAt: now };
}
