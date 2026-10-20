import React from 'react';
import { useWorkoutActivity, useWorkoutActivityOwner } from '../useWorkoutActivity.ios';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
let mockFile: string | null = null;
let mockInstances: any[] = [];
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockEnd = jest.fn().mockImplementation(async () => { mockInstances = []; });
const mockStart = jest.fn().mockImplementation(() => {
  const instance = { getId: () => 'activity', update: mockUpdate, end: mockEnd }; mockInstances.push(instance); return instance;
});
jest.mock('@/components/train/WorkoutLiveActivity.ios', () => ({ __esModule: true, default: {
  getInstances: () => mockInstances, start: (...args: unknown[]) => mockStart(...args),
} }));
jest.mock('expo-file-system', () => ({ Paths: { document: 'fixture' }, File: class {
  get exists() { return mockFile !== null; } create() {} textSync() { return mockFile; }
  write(value: string) { mockFile = value; } delete() { mockFile = null; }
} }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const exercise = EXERCISE_CATALOGUE[0];
const context = { sessionId: 'workout', userId: 'owner', mesocycleId: 'meso', microcycleId: 'micro', microcycleIndex: 0, plannedSessionIndex: 0,
  performedAt: 1, trainingGoal: 'HYPERTROPHY', sessionName: 'Upper' };
const sets = { [exercise.id]: [{ id: 's', setType: SetType.NORMAL, targetReps: 10, targetWeight: 20, targetRIR: 2, isAutoFilled: false, isCompleted: false }] };
let unavailable = false;
function Probe({ finished = false, weight = 20 }) { unavailable = useWorkoutActivity(context, [exercise],
  { [exercise.id]: sets[exercise.id].map((row) => ({ ...row, actualWeight: weight })) }, finished); return null; }
const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
beforeEach(() => { jest.clearAllMocks(); mockFile = null; mockInstances = []; });

it('updates and resumes one activity without ending it when a workout screen unmounts', async () => {
  let tree: any;
  await act(async () => { tree = create(<Probe />); }); await act(drain);
  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(mockStart.mock.calls[0][1]).toContain('vigor://session?mesocycleId=meso');
  await act(async () => tree.update(<Probe weight={35} />)); await act(drain);
  expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ nextWeight: '35 kg' }));
  await act(async () => tree.unmount()); await act(drain);
  expect(mockEnd).not.toHaveBeenCalled();
  await act(async () => { tree = create(<Probe />); }); await act(drain);
  expect(mockStart).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Probe finished />)); await act(drain);
  expect(mockEnd).toHaveBeenCalledWith('immediate'); expect(mockFile).toBeNull();
  await act(async () => tree.unmount());
});

it('cleans a previous owner on sign-out but not during auth restoration or matching-owner startup', async () => {
  mockFile = JSON.stringify({ owner: 'owner', sessionId: 'workout', activityId: 'activity' });
  mockInstances = [{ getId: () => 'activity', end: mockEnd }];
  function Owner({ owner, loading = false }: { owner: string | null; loading?: boolean }) { useWorkoutActivityOwner(owner, loading); return null; }
  let tree: any;
  await act(async () => { tree = create(<Owner owner={null} loading />); }); await act(drain); expect(mockEnd).not.toHaveBeenCalled();
  await act(async () => tree.update(<Owner owner="owner" />)); await act(drain); expect(mockEnd).not.toHaveBeenCalled();
  await act(async () => tree.update(<Owner owner={null} />)); await act(drain); expect(mockEnd).toHaveBeenCalled(); expect(mockFile).toBeNull();
  await act(async () => tree.unmount());
});

it('reports unavailable activities without rejecting or losing a workout', async () => {
  mockStart.mockImplementationOnce(() => { throw new Error('Activities disabled'); }); let tree: any;
  await act(async () => { tree = create(<Probe />); }); await act(drain);
  expect(unavailable).toBe(true); expect(mockFile).toBeNull();
  await act(async () => tree.unmount());
});
