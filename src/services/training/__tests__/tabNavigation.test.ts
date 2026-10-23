import { canResetTrainingTab } from '../tabNavigation';
it('resets only known read-only destinations and never unknown or draft routes', () => {
  for (const route of ['index', 'exercises', 'history', 'performance', 'routine', 'mesocycle', 'create-routine']) expect(canResetTrainingTab(['(tabs)', '(train)', route])).toBe(true);
  for (const route of ['generate', 'manual-routine', 'rehab', 'session', 'workout-check', 'future-draft']) expect(canResetTrainingTab(['(tabs)', '(train)', route])).toBe(false);
  expect(canResetTrainingTab(['(tabs)', '(train)'])).toBe(true);
  expect(canResetTrainingTab([])).toBe(false); expect(canResetTrainingTab(['(tabs)', 'bio'])).toBe(false);
});
