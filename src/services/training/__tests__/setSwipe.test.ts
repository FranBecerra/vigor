import { setSwipeDestination } from '../setSwipe';
it('distinguishes a short reveal, full destructive swipe and reversal', () => {
  expect(setSwipeDestination(-80, 360)).toBe('reveal');
  expect(setSwipeDestination(-180, 360)).toBe('remove');
  expect(setSwipeDestination(-179, 360)).toBe('reveal');
  expect(setSwipeDestination(-20, 360)).toBe('close');
  expect(setSwipeDestination(10, 360)).toBe('close');
  expect(setSwipeDestination(-100, 200)).toBe('remove');
  expect(setSwipeDestination(-99, 200)).toBe('reveal');
});
it.each([[NaN, 360], [0, NaN], [-200, 0], [-200, -1], [Infinity, 360]])('rejects invalid geometry %j', (x, width) => expect(setSwipeDestination(x, width)).toBe('close'));
