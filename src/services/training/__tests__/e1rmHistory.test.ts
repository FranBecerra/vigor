import { SetType, type WorkoutSession } from '@/models';
import { e1RMByExerciseFromHistory } from '@/services/training/e1rmHistory';

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 's1', userId: 'u1', mesocycleId: 'm1', microcycleId: 'm1:m0', microcycleIndex: 0,
    performedAt: 1, completedAt: 2,
    exercises: [{
      id: 'bench', exerciseId: 'bench', order: 0, isSwap: false,
      sets: [{ id: 'set', setType: SetType.NORMAL, targetReps: 8, targetRIR: 2, targetWeight: 80,
        actualWeight: 80, actualReps: 8, isAutoFilled: false }],
    }],
    ...overrides,
  };
}

describe('e1RMByExerciseFromHistory', () => {
  it('uses the best completed actual attempt for each exercise', () => {
    const result = e1RMByExerciseFromHistory([
      session(),
      session({ id: 's2', exercises: [{
        id: 'bench', exerciseId: 'bench', order: 0, isSwap: false,
        sets: [{ id: 'set2', setType: SetType.NORMAL, targetReps: 5, targetRIR: 2, targetWeight: 90,
          actualWeight: 90, actualReps: 5, isAutoFilled: false }],
      }] }),
    ]);
    expect(result.get('bench')).toBeCloseTo(105, 6);
  });

  it('ignores incomplete, invalid, and high-repetition attempts', () => {
    const highRep = session({ exercises: [{
      id: 'bench', exerciseId: 'bench', order: 0, isSwap: false,
      sets: [{ id: 'set', setType: SetType.NORMAL, targetReps: 20, targetRIR: 2, targetWeight: 50,
        actualWeight: 50, actualReps: 20, isAutoFilled: false }],
    }] });
    const incomplete = session({ id: 'incomplete', completedAt: undefined });
    expect(e1RMByExerciseFromHistory([highRep, incomplete]).size).toBe(0);
  });
});
