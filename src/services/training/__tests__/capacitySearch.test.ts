import { ExperienceLevel, SplitStructure } from '@/models';
import { planMesocycle, type MesocyclePlan, type MesocyclePlanInput } from '../mesocyclePlanner';
import { recommendCapacity, recommendCapacityAsync, recommendCapacityExhaustive, CapacityRecommendationCancelled } from '../capacityRecommendation';
import { TrainingGoal } from '../volumePlan';
import { MINUTES_PER_WORKING_SET_FLOOR, SESSION_OVERHEAD_MINUTES } from '../trainingCapacity';

jest.mock('../mesocyclePlanner', () => ({ planMesocycle: jest.fn() }));
const planner = jest.mocked(planMesocycle);
const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  split: SplitStructure.AUTO, catalogue: [] };
function scenario(value: number) {
  planner.mockImplementation((request: MesocyclePlanInput) => {
    const { sessionsPerMicrocycle: sessions, minutesPerSession: minutes } = request.capacity;
    const upper = Math.floor((minutes - SESSION_OVERHEAD_MINUTES) / MINUTES_PER_WORKING_SET_FLOOR) * sessions;
    const total = value < 0 ? 0 : Math.min(upper, 40 + value % 10);
    return { limitedBy: value < 0 || (sessions + request.seed + value) % 5 === 0 ? 'time' : 'recovery',
      distribution: { structureWarnings: Array.from({ length: (minutes + request.seed + value) % 4 }),
        sessions: Array.from({ length: sessions }, (_, index) => ({ exercises: total
          ? [{ sets: Math.floor(total / sessions) + (index < total % sessions ? 1 : 0) }] : [] })) },
    } as unknown as MesocyclePlan;
  });
}
beforeEach(() => { planner.mockReset(); });
it.each(Array.from({ length: 40 }, (_, i) => i))('matches exhaustive ranking for deterministic scenario %s', (value) => {
  scenario(value);
  const reference = recommendCapacityExhaustive(input);
  planner.mockClear();
  expect(recommendCapacity(input)).toEqual(reference);
  expect(planner.mock.calls.length).toBeLessThanOrEqual(45);
});
it('prunes only physical impossibilities and failed seeds, reducing full-plan calls', () => {
  scenario(2);
  recommendCapacity(input);
  expect(planner.mock.calls.length).toBeLessThan(45);
  expect(planner.mock.calls.some(([request]) => request.capacity.sessionsPerMicrocycle === 2
    && request.capacity.minutesPerSession === 45)).toBe(false);
});
it('completes the original fallback without recomputing partial samples', () => {
  scenario(-1);
  const reference = recommendCapacityExhaustive(input);
  planner.mockClear();
  expect(recommendCapacity(input)).toEqual(reference);
  expect(planner).toHaveBeenCalledTimes(45);
  const keys = planner.mock.calls.map(([request]) => JSON.stringify([request.capacity, request.seed]));
  expect(new Set(keys).size).toBe(45);
});
it('yields before computation and agrees with the synchronous search', async () => {
  scenario(2);
  const expected = recommendCapacity(input);
  planner.mockClear();
  const scheduler = jest.fn(async () => undefined);
  const promise = recommendCapacityAsync(input, { yieldToUI: scheduler });
  expect(planner).not.toHaveBeenCalled();
  expect(await promise).toEqual(expected);
  expect(scheduler).toHaveBeenCalledTimes(planner.mock.calls.length);
});
it('cancels before starting or after yielding, without returning a partial result', async () => {
  scenario(2);
  await expect(recommendCapacityAsync(input, { isCancelled: () => true })).rejects.toBeInstanceOf(CapacityRecommendationCancelled);
  expect(planner).not.toHaveBeenCalled();
  let cancelled = false;
  await expect(recommendCapacityAsync(input, { yieldToUI: async () => { cancelled = true; },
    isCancelled: () => cancelled })).rejects.toBeInstanceOf(CapacityRecommendationCancelled);
  expect(planner).not.toHaveBeenCalled();
});
it('stops between plans when cancellation follows a completed sample', async () => {
  scenario(2);
  let pauses = 0;
  await expect(recommendCapacityAsync(input, { yieldToUI: async () => { pauses += 1; },
    isCancelled: () => pauses >= 2 })).rejects.toBeInstanceOf(CapacityRecommendationCancelled);
  expect(planner).toHaveBeenCalledTimes(1);
});
it('propagates planner and scheduling errors', async () => {
  planner.mockImplementation(() => { throw new Error('Planner failed'); });
  await expect(recommendCapacityAsync(input, { yieldToUI: async () => undefined })).rejects.toThrow('Planner failed');
  await expect(recommendCapacityAsync(input, { yieldToUI: async () => { throw new Error('Scheduler failed'); } }))
    .rejects.toThrow('Scheduler failed');
});
it('uses the default cooperative scheduler', async () => {
  scenario(2);
  expect(await recommendCapacityAsync(input)).toEqual(recommendCapacity(input));
});
