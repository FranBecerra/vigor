import { createTrainingNote, normalizeWorkoutNote, trainingNoteId, validTrainingNote, visibleWorkoutNotes } from '../trainingNotes';
it('creates owner-scoped stable identities and supports explicit clearing without deleting another scope', () => {
  const note = createTrainingNote('owner', 'EXERCISE', 'press:a', '  Seat 4\nNeutral grip  ', 0);
  expect(note.text).toBe('Seat 4\nNeutral grip'); expect(validTrainingNote(note, 'owner')).toBe(true);
  expect(validTrainingNote(note, 'other')).toBe(false); expect(validTrainingNote({ ...note, id: 'bad' }, 'owner')).toBe(false);
  expect(createTrainingNote('owner', 'EXERCISE', 'press:a', '', 2).id).toBe(note.id);
  expect(trainingNoteId('EXERCISE', 'press:a')).not.toBe(trainingNoteId('MESOCYCLE', 'press:a'));
  expect(trainingNoteId('EXERCISE', 'a:b')).not.toBe(trainingNoteId('EXERCISE', 'a%3Ab'));
});
it.each([null, 2, 'x'.repeat(2001), 'bad\u0000note'])('rejects invalid note text %#', (text) => {
  expect(() => normalizeWorkoutNote(text as any)).toThrow();
});
it.each(['', ' ', 'a/b', 'a\n', 'x'.repeat(301), 2, undefined])('rejects malformed target identities %#', (id) => {
  expect(() => trainingNoteId('EXERCISE', id as any)).toThrow();
});
it.each([['', 1], ['owner', NaN], ['owner', -1]])('rejects missing owner or invalid time', (owner, now) => {
  expect(() => createTrainingNote(owner as string, 'MESOCYCLE', 'meso', '', now as number)).toThrow();
});
it('rejects unknown scopes and malformed stored records, and displays only nonempty authored notes', () => {
  expect(() => trainingNoteId('OTHER' as any, 'm')).toThrow(); expect(validTrainingNote({} as any, 'owner')).toBe(false);
  expect(validTrainingNote({ userId: 'owner', scope: 'OTHER' } as any, 'owner')).toBe(false);
  expect(visibleWorkoutNotes('', 'Seat 4', 'Keep technique consistent', 'Today: seat 5')).toEqual([
    { scope: 'EXERCISE', text: 'Seat 4' }, { scope: 'MESOCYCLE', text: 'Keep technique consistent' }, { scope: 'SESSION', text: 'Today: seat 5' },
  ]);
  expect(visibleWorkoutNotes(' ', '', '')).toEqual([]);
});
