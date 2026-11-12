import { SetType } from '@/models';
import { wheelPosition } from '../numericWheel';
import { completedWorkoutExerciseIds } from '../workoutExecution';
import { suggestedRoutineName } from '../routineMapper';

it('moves wheel pixels continuously without changing stored ticks prematurely and clamps both ends', () => {
  expect(wheelPosition(101, 50, -10)).toEqual({ offset: 2210, index: 50 });
  expect(wheelPosition(101, 50, -44)).toEqual({ offset: 2244, index: 51 });
  expect(wheelPosition(101, 50, 1e6)).toEqual({ offset: 0, index: 0 });
  expect(wheelPosition(101, 50, -1e6)).toEqual({ offset: 4400, index: 100 });
  expect(wheelPosition(1, 0, 10)).toEqual({ offset: 0, index: 0 });
});
it.each([[0, 0, 0], [1.5, 0, 0], [1, NaN, 0], [1, 0, Infinity]])('rejects malformed wheel motion %p', (count, start, motion) => {
  expect(() => wheelPosition(count, start, motion)).toThrow('Invalid wheel motion');
});
it('only highlights exercises with nonempty, valid completed working sets, and clears on undo', () => {
  const done: any = { id: 's', setType: SetType.NORMAL, isCompleted: true, actualWeight: 0, actualReps: 10 };
  const rows = { done: [done, { ...done, setType: SetType.WARMUP, isCompleted: false }], empty: [],
    warmup: [{ ...done, setType: SetType.WARMUP }], pending: [{ ...done, isCompleted: false }], invalid: [{ ...done, actualReps: undefined }] };
  expect(completedWorkoutExerciseIds(['missing', 'pending', 'done', 'invalid', 'empty', 'warmup'], rows)).toEqual(['done']);
  expect(completedWorkoutExerciseIds(['done'], { done: [{ ...done, isCompleted: false }] })).toEqual([]);
});
it('offers a structure name, fills the smallest free suffix and normalizes case and whitespace', () => {
  expect(suggestedRoutineName(' Torso / pierna ', [])).toBe('Torso / pierna');
  expect(suggestedRoutineName('Torso', [' torso ', 'TORSO #2', 'Torso #4'])).toBe('Torso #3');
  expect(suggestedRoutineName('', [])).toBe('Routine');
  const long = 'x'.repeat(40);
  expect(suggestedRoutineName(long, [long])).toBe(`${'x'.repeat(37)} #2`);
  expect(suggestedRoutineName('Full body', ['Full body', ...Array.from({ length: 10 }, (_, i) => `Full body #${i + 2}`)])).toBe('Full body #12');
});
