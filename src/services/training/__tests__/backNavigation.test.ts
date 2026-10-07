import { backToTraining } from '../backNavigation';

it.each([true, false])('uses history only when available (%s)', (canGoBack) => {
  const router = { canGoBack: jest.fn(() => canGoBack), back: jest.fn(), replace: jest.fn() };
  backToTraining(router);
  expect(router.canGoBack).toHaveBeenCalledTimes(1);
  expect(router.back).toHaveBeenCalledTimes(canGoBack ? 1 : 0);
  expect(router.replace).toHaveBeenCalledTimes(canGoBack ? 0 : 1);
  if (!canGoBack) expect(router.replace).toHaveBeenCalledWith('/(tabs)/(train)');
});
