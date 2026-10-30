import { SetType, type Mesocycle, type PlannedSession, type WorkoutSession } from '@/models';
import { historyProgressionPatch, historyProgressionProposal } from '../historyProgression';
import { sessionsForMicrocycle } from '../mesocycleEditing';

const set = { setType: SetType.NORMAL, targetRIR: 2, targetReps: 10, targetRepsMin: 8, targetWeightKg: 40 };
const session: PlannedSession = { index: 0, focus: 'LOWER', estimatedWorkMinutes: 20, exercises: ['rdl', 'curl'].map((exerciseId, order) => ({ exerciseId, order, isEdited: false, sets: [{ ...set }, { ...set }] })) };
const meso: Mesocycle = { id: 'm', userId: 'owner', status: 'ACTIVE', prescriptionMode: 'MANUAL', currentMicrocycleIndex: 1, sessionsPerMicrocycle: 1,
  plannedSessions: [session], projectedMicrocycles: 6, startedAt: 1, updatedAt: 1, targetVolumePerGroup: {},
  scheduleTemplate: { days: 10, slots: [{ kind: 'workout', sessionIndex: 0 }, ...Array.from({ length: 9 }, () => ({ kind: 'rest' as const }))] } };
const workout = (patch: Partial<WorkoutSession> = {}): WorkoutSession => ({ id: 'actual', userId: 'owner', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0,
  plannedSessionIndex: 0, performedAt: 1, completedAt: 2, exercises: [{ id: 'rdl', exerciseId: 'rdl', order: 0, isSwap: false,
    sets: [0, 1].map(index => ({ id: String(index), setType: SetType.NORMAL, targetWeight: 40, targetReps: 10, targetRIR: 2,
      actualWeight: 80, actualReps: 6, actualRIR: 3, completionState: 'DONE' as const, isAutoFilled: false })) }], ...patch });

it('anchors reviewed effort only, excluding the corrected workout, performed/skipped future work and earlier pending cycles', () => {
  const original = { ...meso, currentMicrocycleIndex: 2, skippedSessions: { '4:0': 100 }, sessionOverrides: { '3:0': session, '0:0': session } };
  const history = [workout(), workout({ id: 'later', microcycleIndex: 3 })];
  const before = JSON.stringify([original, history]);
  const steps = historyProgressionProposal(original, 'HYPERTROPHY', history[0], history);
  expect(steps.map(step => step.index)).toEqual([2, 5]);
  for (const step of steps) {
    expect(step.session.exercises[0].sets[0].targetReps).toBe(10);
    expect(step.session.exercises[0].sets[0].targetWeightKg).not.toBe(80);
    expect(step.session.exercises[1]).toEqual(sessionsForMicrocycle(original, 'HYPERTROPHY', step.index)[0].exercises[1]);
  }
  const patch = historyProgressionPatch(original, steps);
  expect(patch.sessionOverrides['0:0']).toBe(session); expect(patch.sessionOverrides['3:0']).toBe(session);
  expect(patch.sessionOverrides['4:0']).toBeUndefined(); expect(patch.sessionOverrides['2:0']).toEqual(steps[0].session);
  expect(JSON.stringify([original, history])).toBe(before);
  expect(historyProgressionPatch(meso, []).sessionOverrides).toEqual({});
});
it.each([{ userId: 'other' }, { mesocycleId: 'other' }, { completedAt: undefined }, { discardedAt: 3 },
  { microcycleIndex: -1 }, { microcycleIndex: 1.5 }, { plannedSessionIndex: undefined }, { plannedSessionIndex: -1 }, { plannedSessionIndex: 99 }])('rejects invalid/foreign anchors %p', patch => {
  expect(() => historyProgressionProposal(meso, 'HYPERTROPHY', workout(patch), [])).toThrow('invalidHistoryProgression');
});
it('does not invent effort, infer change from corrected load/repetitions, or treat discarded/uncompleted foreign work as locks', () => {
  for (const rir of [undefined, null, NaN, 6, -1, 2.5, 2]) {
    const w = workout(); w.exercises[0].sets.forEach(s => { s.actualRIR = rir; });
    expect(historyProgressionProposal(meso, 'HYPERTROPHY', w, [])).toEqual([]);
  }
  expect(historyProgressionProposal(meso, 'HYPERTROPHY', workout({ exercises: [] }), [])).toEqual([]);
  const pending = workout(); pending.exercises[0].sets.forEach(s => { s.completionState = 'PENDING'; });
  expect(historyProgressionProposal(meso, 'HYPERTROPHY', pending, [])).toEqual([]);
  const excluded = [workout({ id: 'x', userId: 'other', microcycleIndex: 1 }), workout({ id: 'x', mesocycleId: 'other', microcycleIndex: 2 }),
    workout({ id: 'x', plannedSessionIndex: 1, microcycleIndex: 3 }), workout({ id: 'x', discardedAt: 3, microcycleIndex: 4 }), workout({ id: 'x', completedAt: undefined, exercises: [], microcycleIndex: 5 })];
  expect(historyProgressionProposal(meso, 'HYPERTROPHY', workout(), excluded).map(s => s.index)).toEqual([1, 2, 3, 4, 5]);
  const underway = workout({ id: 'underway', completedAt: undefined, microcycleIndex: 2 });
  expect(historyProgressionProposal(meso, 'HYPERTROPHY', workout(), [underway]).map(s => s.index)).toEqual([1, 3, 4, 5]);
});
it('keeps warmups/singles/timed sets separate and failure effort at zero without shifting working ordinals', () => {
  const special: PlannedSession = { ...session, exercises: [{ ...session.exercises[0], sets: [
    { ...set, setType: SetType.WARMUP }, { ...set, setType: SetType.TOP_SINGLE }, { ...set, targetDurationSeconds: 30 },
    { ...set }, { ...set, setType: SetType.FAILURE, targetRIR: 0 },
  ] }] };
  const w = workout(); const row = w.exercises[0].sets[0];
  w.exercises[0].sets = [{ ...row, setType: SetType.WARMUP }, { ...row, setType: SetType.TOP_SINGLE },
    { ...row, recording: { measure: 'SECONDS', load: 'NONE' }, actualDurationSeconds: 30 }, { ...row, actualRIR: 4 }, { ...row, actualRIR: 1 }];
  const steps = historyProgressionProposal({ ...meso, plannedSessions: [special] }, 'HYPERTROPHY', w, []);
  expect(steps[0].session.exercises[0].sets.map(s => s.targetRIR)).toEqual([2, 2, 2, 4, 0]);
  const timed = workout(); timed.exercises[0].sets.forEach(s => { s.recording = { measure: 'SECONDS', load: 'NONE' }; s.actualDurationSeconds = 30; });
  expect(historyProgressionProposal(meso, 'HYPERTROPHY', timed, [])).toEqual([]);
});
