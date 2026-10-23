export type WorkoutNoteScope = 'SESSION' | 'EXERCISE' | 'MESOCYCLE';
export type SharedNoteScope = Exclude<WorkoutNoteScope, 'SESSION'>;
export interface TrainingNote { id: string; userId: string; scope: SharedNoteScope; targetId: string; text: string; updatedAt: number }
export function normalizeWorkoutNote(text: string): string {
  if (typeof text !== 'string' || text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw Error('invalidNote');
  return text.trim();
}
export function trainingNoteId(scope: SharedNoteScope, targetId: string) {
  if (!['EXERCISE', 'MESOCYCLE'].includes(scope) || typeof targetId !== 'string' || !targetId.trim() || targetId.length > 300 || /[\u0000-\u001f/]/.test(targetId)) throw Error('invalidIdentity');
  return `${scope}:${encodeURIComponent(targetId)}`;
}
export function createTrainingNote(userId: string, scope: SharedNoteScope, targetId: string, text: string, now: number): TrainingNote {
  if (!userId || !Number.isFinite(now) || now < 0) throw Error('invalidIdentity');
  return { id: trainingNoteId(scope, targetId), userId, scope, targetId, text: normalizeWorkoutNote(text), updatedAt: now };
}
export function validTrainingNote(note: TrainingNote, userId: string): boolean {
  try { return note.userId === userId && createTrainingNote(userId, note.scope, note.targetId, note.text, note.updatedAt).id === note.id; } catch { return false; }
}
export function visibleWorkoutNotes(session: string, exercise: string, mesocycle: string, legacyExecution = '') {
  return ([{ scope: 'SESSION', text: session }, { scope: 'EXERCISE', text: exercise }, { scope: 'MESOCYCLE', text: mesocycle },
    { scope: 'SESSION', text: legacyExecution }] as const).filter((entry) => !!entry.text.trim());
}
