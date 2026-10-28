import { SetType, type RehabBlock, type ExerciseRecording } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { newRehabLog, validateRehabLog } from '../rehabilitation';
import { patchRehabRow, rehabRows, reshapeRehab, rehabSupersets, linkRehabSuperset } from '../rehabExecution';
import { IDLE_REST_TIMER, startRest } from '../restTimer';
import { cleanSupersets, linkSuperset, supersetTransition } from '../workoutStructure';

const blockFor = (recording: ExerciseRecording, load?: number): RehabBlock => ({
  id: 'b', userId: 'u', version: 1, name: 'Fixture', active: true, createdAt: 1, updatedAt: 1,
  schedule: { kind: 'WEEKLY', target: 1 }, items: ['a', 'b'].map((id) => ({ id, exerciseId: EXERCISE_CATALOGUE[0].id,
    exerciseSnapshot: { ...EXERCISE_CATALOGUE[0], recording }, sets: 1, min: 10, max: 20, restSeconds: 15, notes: '',
    ...(load === undefined ? {} : { load }) })),
});

it.each([
  [{ measure: 'SECONDS', load: 'NONE' }, undefined, { actualDurationSeconds: 20 }],
  [{ measure: 'SECONDS', load: 'LEVEL' }, 3, { actualDurationSeconds: 20, actualLoadLevel: 3 }],
  [{ measure: 'REPETITIONS', load: 'TOTAL_KG' }, 20, { actualReps: 10, actualWeight: 20 }],
] as const)('round-trips the shared row contract for %j without creating an effort target', (mode, load, actuals) => {
  const block = blockFor(mode, load), item = block.items[0];
  let log = newRehabLog(block, '2026-10-25', 1);
  expect(rehabRows(log, item)[0].actualRIR).toBeNull();
  log = patchRehabRow(log, item, 'a:0', { ...actuals, actualRIR: 3, isCompleted: true, setType: SetType.NORMAL, extensions: [{ reps: 3 }], actualPartialReps: 2 }, 2);
  expect(rehabRows(log, item)[0]).toMatchObject({ ...actuals, isCompleted: true, actualRIR: 3, extensions: [{ reps: 3 }] });
  const required = mode.measure === 'SECONDS' ? 'actualDurationSeconds' : 'actualReps';
  log = patchRehabRow(log, item, 'a:0', { [required]: undefined }, 3);
  expect(rehabRows(log, item)[0]).toMatchObject({ isCompleted: false, completionWasRecorded: true });
  log = patchRehabRow(JSON.parse(JSON.stringify(log)), item, 'a:0', { ...actuals, isCompleted: true }, 4);
  expect(rehabRows(log, item)[0].completionWasRecorded).toBe(true);
  validateRehabLog(log);
});

it('keeps occurrence identity and rest ownership through reordering, new rows and deletion', () => {
  const block = blockFor({ measure: 'REPETITIONS', load: 'TOTAL_KG' }, 20);
  const original = { ...newRehabLog(block, '2026-10-25', 1), activeItemId: 'a', restTimer: startRest('a:0', 30, 1) };
  const reshaped = reshapeRehab(original, [block.items[1], { ...block.items[0], sets: 2 }], 2);
  expect(reshaped.activeItemId).toBe('a'); expect(reshaped.restTimer).toBe(original.restTimer);
  expect(reshaped.sets.map((set) => `${set.itemId}:${set.index}`)).toEqual(['b:0', 'a:0', 'a:1']);
  expect(reshaped.sets[1]).toBe(original.sets[0]); expect(reshaped.sets[2].completed).toBe(false); validateRehabLog(reshaped);
  const removed = reshapeRehab(reshaped, [block.items[1]], 3);
  expect(removed.activeItemId).toBe('b'); expect(removed.restTimer).toEqual(IDLE_REST_TIMER); validateRehabLog(removed);
  expect(reshapeRehab(removed, [], 4).activeItemId).toBeUndefined();
  expect(() => validateRehabLog({ ...reshapeRehab(removed, [], 4), status: 'COMPLETED', completedAt: 4 })).toThrow();
});

it('cleans invalid groups and finishes uneven circuits with missing or warmup-only members', () => {
  expect(cleanSupersets(['a', 'b', 'c'], { a: '', b: 'pair', c: 'pair', foreign: 'pair' })).toEqual({ b: 'pair', c: 'pair' });
  const groups = linkSuperset(['a', 'b', 'c'], { a: 'pair', b: 'pair' }, 'c', 'b');
  expect(linkSuperset(['a', 'b'], {}, 'a', 'missing')).toEqual({});
  expect(supersetTransition(['a', 'b', 'c'], groups, { a: [], b: [], c: [] }, 'a')).toEqual({ next: null, rest: true });
  expect(supersetTransition(['a', 'b', 'c'], groups, {}, 'a')).toEqual({ next: null, rest: true });
  expect(supersetTransition(['a', 'b'], { a: 'pair', b: 'pair' }, { b: [{ id: 'w', setType: SetType.WARMUP } as any] }, 'a')).toEqual({ next: null, rest: true });
  const block = blockFor({ measure: 'SECONDS', load: 'NONE' });
  expect(rehabSupersets(linkRehabSuperset(block.items, 'missing', 'a'))).toEqual({});
  expect(linkRehabSuperset([], 'missing')).toEqual([]);
});
