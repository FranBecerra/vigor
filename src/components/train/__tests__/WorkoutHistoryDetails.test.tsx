import React from 'react';
import { WorkoutHistoryDetails } from '../WorkoutHistoryDetails';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it('shows actual values, missing effort and unfinished rows instead of the target prescription', async () => {
  const details = workoutHistoryDetails({ id: 's', userId: 'u', performedAt: 1000, completedAt: 10000,
    mesocycleId: 'm', microcycleId: 'mi', microcycleIndex: 0,
    exercises: [{ id: 'ex', exerciseId: 'ex', isSwap: false, order: 0, notes: 'Seat 4', sets: [
      { id: 'one', setType: SetType.NORMAL, targetReps: 99, targetWeight: 999, targetRIR: 4,
        actualReps: 8, actualWeight: 35, actualRIR: 2, isAutoFilled: false, completionState: 'DONE' },
      { id: 'two', setType: SetType.WARMUP, targetReps: 99, targetWeight: 999, targetRIR: 4, isAutoFilled: false, completionState: 'PENDING' },
    ] }] }, new Map());
  let tree: any; await act(async () => { tree = create(<WorkoutHistoryDetails details={details} />); });
  const output = JSON.stringify(tree.toJSON()); expect(output).toContain('35'); expect(output).toContain('8'); expect(output).toContain('Seat 4');
  expect(output).toContain('historyDetails.notCompleted'); expect(output).toContain('historyDetails.unknownExercise');
  expect(output).not.toContain('999'); expect(output).not.toContain('99'); expect(output).toContain('W'); expect(output).toContain('—');
  await act(async () => tree.unmount());
});
