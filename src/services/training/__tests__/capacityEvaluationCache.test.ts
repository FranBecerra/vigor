import { ExperienceLevel } from '@/models';
import * as selection from '../exerciseSelection';
import { planMesocycle } from '../mesocyclePlanner';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { TrainingGoal } from '../volumePlan';

const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  catalogue: EXERCISE_CATALOGUE, seed: 31, rankingPolicy: 'legacy-weighted' as const,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 } };
afterEach(() => jest.restoreAllMocks());
it('calculates each identical full rounded plan/mode once within a policy invocation', () => {
  const spy = jest.spyOn(selection, 'selectExercises');
  planMesocycle(input);
  const keys = spy.mock.calls.map(([request]) => JSON.stringify([request.timeConstrained, request.volumePlan]));
  expect(keys.length).toBeGreaterThan(2);
  expect(new Set(keys).size).toBe(keys.length);
});
it('does not retain mutable output caches across invocations', () => {
  const spy = jest.spyOn(selection, 'selectExercises');
  const first = planMesocycle(input);
  const count = spy.mock.calls.length;
  first.distribution.sessions[0].exercises = [];
  const second = planMesocycle(input);
  expect(spy.mock.calls.length).toBe(count * 2);
  expect(second.distribution.sessions[0].exercises.length).toBeGreaterThan(0);
});
it('observes catalogue replacements even if the caller reuses its array', () => {
  const catalogue = [EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'press-pecho-maquina')!];
  const first = planMesocycle({ ...input, catalogue });
  catalogue[0] = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'pec-deck')!;
  const second = planMesocycle({ ...input, catalogue });
  expect(first.selection.selected.map((entry) => entry.exercise.id)).toEqual(['press-pecho-maquina']);
  expect(second.selection.selected.map((entry) => entry.exercise.id)).toEqual(['pec-deck']);
});
