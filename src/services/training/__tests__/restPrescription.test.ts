import type { Mesocycle } from '@/models';
import { SetType } from '@/models';
import { changeExerciseRest } from '../restPrescription';
import { sessionsForMicrocycle } from '../mesocycleEditing';

const meso: Mesocycle = { id: 'm', userId: 'u', status: 'ACTIVE', sessionsPerMicrocycle: 1,
  currentMicrocycleIndex: 0, startedAt: 1, updatedAt: 1, targetVolumePerGroup: {},
  plannedSessions: [{ index: 0, focus: 'PULL', estimatedWorkMinutes: 10,
    exercises: [{ exerciseId: 'row', order: 0, isEdited: false, sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 }] }] }],
  exerciseRestOverrides: { other: 120 } };
it('persists an exercise rest for current/future prescriptions and existing one-off edits, preserving targets and unrelated rest', () => {
  const patch = changeExerciseRest({ ...meso, sessionOverrides: { '0:0': meso.plannedSessions![0] } }, 'u', 'row', 165);
  expect(patch.exerciseRestOverrides).toEqual({ other: 120, row: 165 });
  const edited = { ...meso, ...patch };
  for (const index of [0, 1, 4]) expect(sessionsForMicrocycle(edited, 'HYPERTROPHY', index)[0].exercises[0].restSeconds).toBe(165);
  expect(meso.plannedSessions![0].exercises[0].restSeconds).toBeUndefined();
  expect(changeExerciseRest(meso, 'u', 'row', 0).exerciseRestOverrides.row).toBe(0);
});
it.each([-1, NaN, Infinity, 1.2, 3601])('rejects malformed seconds %s', (seconds) => expect(() => changeExerciseRest(meso, 'u', 'row', seconds)).toThrow());
it('rejects foreign owners/empty IDs and ignores invalid persisted overrides without inventing zero', () => {
  expect(() => changeExerciseRest(meso, 'other', 'row', 90)).toThrow();
  expect(() => changeExerciseRest(meso, 'u', '', 90)).toThrow();
  for (const seconds of [NaN, -2, 4000]) expect(sessionsForMicrocycle({ ...meso, exerciseRestOverrides: { row: seconds } }, 'HYPERTROPHY', 0)[0].exercises[0].restSeconds).toBeUndefined();
});
