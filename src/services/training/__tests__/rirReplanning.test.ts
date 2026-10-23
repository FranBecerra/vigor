import { SetType, type Mesocycle, type PlannedSession } from '@/models';
import { changesForSessionEdit, pendingOverridesAfterRevision, sessionProgressionProposal, sessionsForMicrocycle } from '../mesocycleEditing';
import { hasSessionRIRChanges, replanSessionRIR } from '../rirReplanning';
import { initialSetsForPlannedSession } from '../plannedSessionRuntime';
import { applyPreviewEdits } from '../previewEditing';
import { mergePrescriptionEdit } from '../prescriptionEntry';
import { prescriptionForMicrocycle } from '../microcyclePrescription';
const session: PlannedSession = { index: 0, focus: 'LOWER', estimatedWorkMinutes: 20, exercises: ['rdl', 'curl'].map((id, order) => ({ exerciseId: id, order, isEdited: false,
  sets: Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL, targetRIR: 2, targetReps: 10, targetRepsMin: 8, targetWeightKg: 40 })) })) };
const meso: Mesocycle = { id: 'm', userId: 'u', status: 'ACTIVE', sessionsPerMicrocycle: 1, currentMicrocycleIndex: 0, plannedSessions: [session], projectedMicrocycles: 6, targetVolumePerGroup: {}, startedAt: 1, updatedAt: 1,
  scheduleTemplate: { days: 9, slots: [{ kind: 'workout', sessionIndex: 0 }, ...Array.from({ length: 8 }, () => ({ kind: 'rest' as const }))] } };
const adjusted = (original = session): PlannedSession => ({ ...original, exercises: original.exercises.map((exercise, index) => index ? exercise : { ...exercise, isEdited: true, manualRIRBySet: { 0: 3, 1: 3, 2: 3 }, sets: exercise.sets.map((set) => ({ ...set, targetRIR: 3 })) }) });

it('reanchors only the edited exercise, progressively lowers RIR, and preserves every unrelated trajectory', () => {
  const edited = adjusted(); expect(hasSessionRIRChanges(session, edited)).toBe(true); expect(hasSessionRIRChanges(session, session)).toBe(false);
  const proposal = sessionProgressionProposal(meso, 'HYPERTROPHY', 0, edited);
  expect(proposal).toHaveLength(6);
  expect(proposal[0].session.exercises[0].sets.map((set) => set.targetRIR)).toEqual([3, 3, 3]);
  expect(proposal[4].session.exercises[0].sets.map((set) => set.targetRIR)).toEqual([2, 2, 2]);
  for (let i = 0; i < 6; i++) expect(proposal[i].session.exercises[1]).toEqual(sessionsForMicrocycle(meso, 'HYPERTROPHY', i)[0].exercises[1]);
  expect(proposal[5].isDeload).toBe(true);
  expect(proposal[5].session.exercises[0].sets.map((set) => set.targetRIR)).toEqual([4, 4]);
  expect(proposal[4].session.exercises[0].sets[0].targetWeightKg).toBeGreaterThanOrEqual(proposal[0].session.exercises[0].sets[0].targetWeightKg!);
  expect(session.exercises[0].sets[0].targetRIR).toBe(2);
});
it('uses bounded per-session overrides without changing history, rest days, unrelated sessions or previous microcycles', () => {
  const old = sessionsForMicrocycle(meso, 'HYPERTROPHY', 1)[0];
  const withHistory = { ...meso, skippedSessions: { '4:0': 10 }, sessionOverrides: { '3:0': session } };
  const edited = adjusted(old);
  const patch = changesForSessionEdit(withHistory, 'HYPERTROPHY', 1, edited, 'recalculate-progression', true, [3]);
  const roundtrip = JSON.parse(JSON.stringify({ ...withHistory, ...patch }));
  expect(sessionsForMicrocycle(roundtrip, 'HYPERTROPHY', 0)).toEqual(sessionsForMicrocycle(meso, 'HYPERTROPHY', 0));
  expect(patch.sessionOverrides?.['3:0']).toEqual(session);
  expect(patch.sessionOverrides?.['4:0']).toBeUndefined();
  expect(patch.prescriptionRevisions).toBeUndefined();
  expect(roundtrip.scheduleTemplate.days).toBe(9);
  expect(sessionProgressionProposal(withHistory, 'HYPERTROPHY', 1, edited, [3]).map((step) => step.index)).toEqual([1, 2, 5]);
  const fixed = changesForSessionEdit({ ...meso, ...patch }, 'HYPERTROPHY', 2, edited, 'remaining-mesocycle', false, [3]);
  expect(fixed.sessionOverrides?.['2:0']).toBeUndefined();
  expect(fixed.sessionOverrides?.['3:0']).toEqual(session);
  expect(fixed.sessionOverrides?.['5:0']).toBeUndefined();
});
it('supports manual/custom prescriptions, added exercises, fixed singles, warmups, one-step horizons and deload-only edits', () => {
  const manual = { ...meso, prescriptionMode: 'MANUAL' as const };
  const custom = { ...adjusted(), exercises: [{ ...adjusted().exercises[0], exerciseId: 'custom:u:rdl' }] };
  const steps = sessionProgressionProposal(manual, 'STRENGTH', 0, custom);
  expect(steps[4].session.exercises[0].sets[0].targetRIR).toBe(2);
  const special = { ...adjusted(), exercises: [{ ...adjusted().exercises[0], sets: [
    { ...session.exercises[0].sets[0], setType: SetType.WARMUP },
    { ...session.exercises[0].sets[0], setType: SetType.TOP_SINGLE },
    { ...session.exercises[0].sets[0], setType: SetType.FAILURE, targetRIR: 0 },
  ] }] };
  const scheduled = sessionProgressionProposal(meso, 'HYPERTROPHY', 0, special);
  expect(scheduled[2].session.exercises[0].sets.map((set) => set.targetRIR)).toEqual([2, 2, 0]);
  expect(scheduled[5].session.exercises[0].sets.map((set) => set.setType)).toEqual([SetType.WARMUP, SetType.NORMAL]);
  expect(sessionProgressionProposal({ ...meso, projectedMicrocycles: 1 }, 'HYPERTROPHY', 0, adjusted())).toHaveLength(1);
  expect(sessionProgressionProposal(meso, 'HYPERTROPHY', 5, adjusted()).map((step) => step.index)).toEqual([5]);
});
it('rejects invalid anchors and missing sessions, and allows a RIR zero floor', () => {
  for (const start of [-1, NaN, 1.5, 6]) expect(() => replanSessionRIR([], session, start, 6)).toThrow();
  expect(() => replanSessionRIR([], session, 0, 0)).toThrow();
  expect(() => replanSessionRIR([], session, 0, 6)).toThrow();
  const invalid = adjusted(); invalid.exercises[0].sets[0].targetRIR = Infinity;
  expect(() => replanSessionRIR([{ index: 0, session }], invalid, 0, 1)).toThrow();
  expect(() => sessionProgressionProposal({ ...meso, plannedSessions: [] }, 'HYPERTROPHY', 0, session)).toThrow();
  const zero = adjusted(); zero.exercises[0].sets.forEach((set) => { set.targetRIR = 0; });
  expect(sessionProgressionProposal(meso, 'HYPERTROPHY', 0, zero)[4].session.exercises[0].sets.every((set) => set.targetRIR === 0)).toBe(true);
  expect(pendingOverridesAfterRevision({ ...meso, sessionOverrides: { 'bad': session, '0:0': session, '3:1': session } }, 2, 0)).toEqual({ bad: session, '0:0': session, '3:1': session });
});
it('carries programmed types into execution, keeps failure at zero and excludes warmups from deload reduction', () => {
  let edit = mergePrescriptionEdit(undefined, session.exercises[0].sets, 0, { setType: SetType.DROP_SET });
  edit = mergePrescriptionEdit(edit, session.exercises[0].sets, 1, { setType: SetType.FAILURE });
  const edited = applyPreviewEdits([session], { '0:0': edit })[0];
  const rows = initialSetsForPlannedSession(edited).rdl;
  expect(rows[0].setType).toBe(SetType.DROP_SET); expect(rows[0].extensions).toEqual([{}]);
  expect(rows[1].targetRIR).toBe(0);
  expect(prescriptionForMicrocycle([edited], 'HYPERTROPHY', 2, 6)[0].exercises[0].sets[1].targetRIR).toBe(0);
  const warmup = { ...edited, exercises: [{ ...edited.exercises[0], sets: [{ ...rows[0], targetReps: 10, targetRIR: 5, setType: SetType.WARMUP }, ...edited.exercises[0].sets] }] };
  expect(prescriptionForMicrocycle([warmup], 'HYPERTROPHY', 2, 6)[0].exercises[0].sets[0].targetRIR).toBe(5);
});
it('preserves future one-off rosters and does not ramp timed rehabilitation prescriptions', () => {
  const extra = { ...session.exercises[1], exerciseId: 'extra', order: 2 };
  const future = { ...session, exercises: [session.exercises[0], extra] };
  const steps = [0, 1, 2].map((index) => ({ index, session: index === 1 ? future : session }));
  const projected = replanSessionRIR(steps, adjusted(), 0, 3);
  expect(projected[1].session.exercises.map((exercise) => exercise.exerciseId)).toEqual(['rdl', 'extra']);
  expect(projected[1].session.exercises[1]).toEqual(extra);
  const timed = { ...adjusted(), exercises: [{ ...adjusted().exercises[0], sets: adjusted().exercises[0].sets.map((set) => ({ ...set, targetDurationSeconds: 30 })) }] };
  expect(replanSessionRIR(steps, timed, 0, 3)[2].session.exercises[0].sets).toEqual(timed.exercises[0].sets);
});
