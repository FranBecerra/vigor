import { skipRoutineDay } from '../skipRoutineDay';
import type { Mesocycle, WorkoutSession } from '@/models';
const meso: Mesocycle = { id: 'm', userId: 'u', status: 'ACTIVE', currentMicrocycleIndex: 0,
  sessionsPerMicrocycle: 1, startedAt: 1, updatedAt: 1, targetVolumePerGroup: {},
  plannedSessions: [{ index: 2, focus: 'PULL', exercises: [], estimatedWorkMinutes: 0 }], skippedSessions: { '0:1': 5 } };
it('marks a stable slot skipped without completion credit or altering the prescription', () => {
  expect(skipRoutineDay(meso, 'u', 2, 2, [], 10)).toEqual({ skippedSessions: { '0:1': 5, '2:2': 10 } });
  expect(meso.skippedSessions).toEqual({ '0:1': 5 });
});
it('rejects foreign, malformed, past and already completed slots', () => {
  const completed = { userId: 'u', mesocycleId: 'm', microcycleIndex: 0, plannedSessionIndex: 2, completedAt: 9 } as WorkoutSession;
  expect(() => skipRoutineDay(meso, 'u', 0, 2, [completed], 10)).toThrow();
  expect(skipRoutineDay(meso, 'u', 0, 2, [{ ...completed, discardedAt: 10 }], 11).skippedSessions['0:2']).toBe(11);
  expect(() => skipRoutineDay(meso, 'other', 0, 2, [], 10)).toThrow();
  for (const [microcycle, index, time] of [[-1, 2, 10], [0.5, 2, 10], [0, 1, 10], [0, 2, NaN], [0, 2, 0]])
    expect(() => skipRoutineDay(meso, 'u', microcycle, index, [], time)).toThrow();
});
