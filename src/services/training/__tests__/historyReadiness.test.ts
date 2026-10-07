import { SetType, type WorkoutSession } from '@/models';
import { exerciseHistoryReadiness, recentE1RMByExerciseFromHistory } from '../historyReadiness';

const day = 86400000; const now = 100 * day;
function exposure(id: string, ageDays: number, weight: number, rir: number | null = null): WorkoutSession {
  return { id, userId: 'u', mesocycleId: 'm', microcycleId: 'c', microcycleIndex: 0,
    performedAt: now - ageDays * day, completedAt: now - ageDays * day,
    exercises: [{ id: 'bench-entry', exerciseId: 'bench', order: 0, isSwap: false,
      sets: [{ id: 'set', setType: SetType.NORMAL, targetReps: 5, targetRIR: 2, targetWeight: weight,
        actualWeight: weight, actualReps: 5, actualRIR: rir, isAutoFilled: false }] }] };
}
it('uses recent repeated observations instead of an old maximum or a single outlier', () => {
  const sessions = [exposure('old', 50, 200), exposure('a', 3, 90, 2), exposure('b', 6, 100, 2), exposure('c', 9, 500)];
  const result = exerciseHistoryReadiness(sessions, now)[0];
  expect(result.status).toBe('repeated-observations');
  expect(result.recentExposures).toBe(3);
  expect(result.exposuresWithLoggedEffort).toBe(2);
  expect(result.estimate).toBeCloseTo(100 * (1 + 5 / 30));
  expect(recentE1RMByExerciseFromHistory(sessions, now).get('bench')).toBe(result.estimate);
});
it('marks a small sample provisional and does not invent effort or stagnation', () => {
  const result = exerciseHistoryReadiness([exposure('a', 1, 80), exposure('b', 2, 150)], now)[0];
  expect(result).toMatchObject({ status: 'provisional', recentExposures: 2, exposuresWithLoggedEffort: 0 });
  expect(result.estimate).toBeCloseTo(80 * (1 + 5 / 30));
});
it('deduplicates sessions and handles future, incomplete, stale, malformed and warm-up-only data', () => {
  const valid = exposure('a', 1, 80);
  const warmup = exposure('warm', 0, 500); warmup.exercises[0].sets[0].setType = SetType.WARMUP;
  const incomplete = exposure('incomplete', 0, 100); incomplete.completedAt = undefined;
  const malformed = exposure('bad', 0, 100); malformed.completedAt = NaN;
  expect(exerciseHistoryReadiness([valid, valid, warmup, incomplete, malformed,
    exposure('future', -1, 200), exposure('old', 43, 200)], now)[0].recentExposures).toBe(1);
  expect(exerciseHistoryReadiness([], now)).toEqual([]);
  expect(() => exerciseHistoryReadiness([], NaN)).toThrow(RangeError);
});
it('accepts serialized timestamps and keeps the rolling boundary inclusive', () => {
  const entry = exposure('boundary', 42, 80, Infinity);
  entry.completedAt = { seconds: (now - 42 * day) / 1000, nanoseconds: 0 };
  expect(exerciseHistoryReadiness([entry], now)[0]).toMatchObject({ recentExposures: 1, exposuresWithLoggedEffort: 0 });
});
