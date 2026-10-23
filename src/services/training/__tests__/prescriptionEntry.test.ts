import { SetType, type PlannedSet, type PlannedSession } from '@/models';
import { mergePrescriptionEdit, prescriptionPatch } from '../prescriptionEntry';
import { applyPreviewEdits, hasInvalidRepRanges, type PreviewExerciseEdit } from '../previewEditing';
import { changesForSessionEdit, sessionsForMicrocycle } from '../mesocycleEditing';
const base: PlannedSet = { setType: SetType.NORMAL, targetRepsMin: 8, targetReps: 12, targetRIR: 2 };

it('commits exact repetitions or independent range bounds without changing another field', () => {
  expect(prescriptionPatch(base, 'reps', 10)).toEqual({ targetRepsMin: 10, targetReps: 10 });
  expect(prescriptionPatch(base, 'min', 6)).toEqual({ targetRepsMin: 6 });
  expect(prescriptionPatch(base, 'max', 6)).toEqual({ targetReps: 6 });
  expect(prescriptionPatch(base, 'rir', 0)).toEqual({ targetRIR: 0 });
  expect(prescriptionPatch(base, 'seconds', 45)).toEqual({ targetDurationSeconds: 45 });
});
it.each([undefined, NaN, Infinity])('ignores incomplete/nonfinite input %s', (value) => expect(prescriptionPatch(base, 'reps', value)).toEqual({}));
it('bounds quantities and keeps a fixed strength single immutable', () => {
  expect(prescriptionPatch(base, 'rir', 99)).toEqual({ targetRIR: 5 });
  expect(prescriptionPatch(base, 'rir', -1)).toEqual({ targetRIR: 0 });
  expect(prescriptionPatch(base, 'seconds', 9999)).toEqual({ targetDurationSeconds: 3600 });
  expect(prescriptionPatch(base, 'reps', -1)).toEqual({ targetRepsMin: 1, targetReps: 1 });
  expect(prescriptionPatch(base, 'max', 999)).toEqual({ targetReps: 100 });
  expect(prescriptionPatch(base, 'reps', 8.8)).toEqual({ targetRepsMin: 8, targetReps: 8 });
  expect(prescriptionPatch(base, 'rest', 180)).toEqual({});
  expect(prescriptionPatch(base, 'type', 1)).toEqual({});
  expect(prescriptionPatch({ ...base, setType: SetType.FAILURE }, 'rir', 3)).toEqual({ targetRIR: 0 });
  expect(prescriptionPatch({ ...base, setType: SetType.TOP_SINGLE }, 'reps', 10)).toEqual({});
});
it('retains a 10/8/6 prescription and individual RIR through plan edits and a seven-day-independent session override', () => {
  const session: PlannedSession = { index: 0, focus: 'UPPER', estimatedWorkMinutes: 20, exercises: [{ exerciseId: 'press', order: 0, isEdited: false, sets: [base, { ...base }, { ...base }] }] };
  let edit: PreviewExerciseEdit | undefined;
  [10, 8, 6].forEach((reps, index) => { edit = mergePrescriptionEdit(edit, session.exercises[0].sets, index, prescriptionPatch(base, 'reps', reps)); });
  edit = mergePrescriptionEdit(edit, session.exercises[0].sets, 1, { targetRIR: 1 });
  edit = mergePrescriptionEdit(edit, session.exercises[0].sets, 2, { targetRIR: 0 });
  const edited = applyPreviewEdits([session], { '0:0': edit! })[0];
  expect(edited.exercises[0].sets.map((set) => [set.targetRepsMin, set.targetReps, set.targetRIR])).toEqual([[10, 10, 2], [8, 8, 1], [6, 6, 0]]);
  expect(hasInvalidRepRanges([edited])).toBe(false);
  const meso: any = { id: 'm', userId: 'u', prescriptionMode: 'MANUAL', projectedMicrocycles: 6, plannedSessions: [session], scheduleTemplate: { days: 9, slots: [] } };
  const patch = changesForSessionEdit(meso, 'HYPERTROPHY', 2, edited, 'microcycle', false);
  const roundtrip = JSON.parse(JSON.stringify({ ...meso, ...patch }));
  expect(sessionsForMicrocycle(roundtrip, 'HYPERTROPHY', 2)[0]).toEqual(edited);
  expect(sessionsForMicrocycle(roundtrip, 'HYPERTROPHY', 1)[0]).toEqual(session);
  expect(session.exercises[0].sets[0]).toEqual(base);
});
it('merges each range bound, timed sets and invalid indexes without erasing neighbouring edits', () => {
  let edit = mergePrescriptionEdit(undefined, [base, base], 0, { targetRepsMin: 6 });
  edit = mergePrescriptionEdit(edit, [base, base], 0, { targetReps: 10 });
  expect(edit.repsBySet?.[0]).toEqual({ min: 6, max: 10 });
  expect(mergePrescriptionEdit(edit, [], 0, { targetRIR: 1 })).toBe(edit);
  expect(mergePrescriptionEdit(undefined, [], 0, {})).toEqual({});
  expect(mergePrescriptionEdit(edit, [{ ...base, setType: SetType.TOP_SINGLE }], 0, { targetRIR: 1 })).toBe(edit);
  const timed = { ...base, targetRepsMin: 0, targetReps: 0, targetDurationSeconds: 30 };
  edit = mergePrescriptionEdit(undefined, [timed, timed], 1, { targetDurationSeconds: 45 });
  const session: PlannedSession = { index: 0, focus: 'FULL_BODY', estimatedWorkMinutes: 1, exercises: [{ exerciseId: 'hold', order: 0, isEdited: false, sets: [timed, timed] }] };
  expect(applyPreviewEdits([session], { '0:0': edit })[0].exercises[0].sets.map((set) => set.targetDurationSeconds)).toEqual([30, 45]);
});
