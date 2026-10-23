import React from 'react';
import { useWorkoutRecordHistory } from '../useWorkoutRecordHistory';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetType } from '@/models';
import { toWorkoutSession } from '@/services/training/sessionMapper';
import { workoutReview } from '@/services/training/workoutReview';
const { create, act } = require('react-test-renderer');
const mockList = jest.fn();
jest.mock('@/services/repositories', () => ({ workoutSessionRepository: { listByUser: (...args: unknown[]) => mockList(...args) } }));
let result: ReturnType<typeof useWorkoutRecordHistory>;
function Probe({ owner }: { owner: string | null }) { result = useWorkoutRecordHistory(owner); return null; }
beforeEach(() => jest.clearAllMocks());
it('loads all exercise baselines on entry without opening Finish, and keeps them through exercise swaps', async () => {
  const history = [{ id: 'squat', exercises: [{ exerciseId: 'sentadilla-libre' }] }];
  mockList.mockResolvedValue(history); let tree: any;
  await act(async () => { tree = create(<Probe owner="a" />); });
  expect(result.ready).toBe(true); expect(result.history).toBe(history); expect(mockList).toHaveBeenCalledWith('a');
  await act(async () => tree.update(<Probe owner="a" />)); expect(mockList).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('does not leak another owner or accept a stale read, and treats read failure as unknown rather than a zero baseline', async () => {
  let resolve!: (history: unknown[]) => void;
  mockList.mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockRejectedValueOnce(Error('offline'));
  let tree: any; await act(async () => { tree = create(<Probe owner="a" />); });
  expect(result.ready).toBe(false);
  await act(async () => tree.update(<Probe owner="b" />));
  await act(async () => resolve([{ id: 'old' }])); expect(result.history).toEqual([]); expect(result.ready).toBe(false);
  await act(async () => tree.update(<Probe owner={null} />)); expect(result.ready).toBe(false);
  await act(async () => tree.unmount());
});
it('marks a historical exercise immediately after a cross-session substitution, without opening the finish screen', async () => {
  const replacement = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'sentadilla-libre') ?? EXERCISE_CATALOGUE[0];
  const row = { id: 'work', setType: SetType.NORMAL, targetWeight: 50, targetReps: 8, targetRIR: 2,
    actualWeight: 50, actualReps: 8, isCompleted: true, isAutoFilled: false };
  const context = { sessionId: 'earlier-leg-day', userId: 'a', mesocycleId: 'm', microcycleId: 'micro', microcycleIndex: 0, performedAt: 1, completedAt: 2 };
  mockList.mockResolvedValue([toWorkoutSession(context, [replacement.id], { [replacement.id]: [row] })]);
  let tree: any; await act(async () => { tree = create(<Probe owner="a" />); });
  const summary = workoutReview([replacement], { [replacement.id]: [{ ...row, actualWeight: 55 }] }, result.history, 'new-pull-day');
  expect(result.ready).toBe(true); expect(summary.recordSetIds).toEqual([`${replacement.id}:work`]);
  await act(async () => tree.unmount());
});
