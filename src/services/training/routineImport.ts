/** Import an authored baseline; mesocycle policy separately controls continuation. */
import { SetType, type Exercise, type PlannedSession, type PlannedSessionFocus } from '@/models';
import { timeManualSessions } from './manualRoutine';
import { cleanImportedExerciseNotes } from './exerciseEditing';

export interface AuthoredMicrocycle {
  source: string;
  name: string;
  sessions: readonly { name: string; focus: string; exercises: readonly {
    sourceName: string; exerciseId: string; min: number; max: number; rir: readonly number[]; notes?: string;
  }[] }[];
}
const FOCUSES: readonly string[] = ['FULL_BODY', 'UPPER', 'LOWER', 'PUSH', 'PULL', 'LEGS'];
export function importAuthoredMicrocycle(source: AuthoredMicrocycle, catalogue: ReadonlyMap<string, Exercise>): PlannedSession[] {
  if (!source.source.trim() || !source.name.trim() || !source.sessions.length || source.sessions.length > 7) throw new Error('invalidImport');
  return timeManualSessions(source.sessions.map((session, index) => {
    if (!session.name.trim() || !FOCUSES.includes(session.focus) || !session.exercises.length) throw new Error('invalidImport');
    const used = new Set<string>();
    return { index, name: session.name, focus: session.focus as PlannedSessionFocus, estimatedWorkMinutes: 0,
      exercises: session.exercises.map((entry, order) => {
        const exercise = catalogue.get(entry.exerciseId);
        if (!exercise || exercise.archivedAt !== undefined || used.has(entry.exerciseId)) throw new Error('invalidExercise');
        if (!entry.sourceName.trim() || !Number.isInteger(entry.min) || !Number.isInteger(entry.max)
          || entry.min < 1 || entry.max > 100 || entry.min > entry.max || !entry.rir.length || entry.rir.length > 30
          || entry.rir.some((rir) => !Number.isInteger(rir) || rir < 0 || rir > 5)) throw new Error('invalidPrescription');
        used.add(entry.exerciseId);
        // Snapshots allow an already-installed app to resolve new catalogue IDs.
        const snapshot = { ...exercise, notes: [cleanImportedExerciseNotes(exercise.notes), entry.notes].filter(Boolean).join('\n') };
        return { exerciseId: exercise.id, order, isEdited: true, exerciseSnapshot: snapshot,
          sets: entry.rir.map((rir) => ({ setType: SetType.NORMAL, targetRepsMin: entry.min, targetReps: entry.max, targetRIR: rir })) };
      }) };
  }), catalogue);
}
