import { IDLE_REST_TIMER, restFeedbackDeadline, startRest } from '../restTimer';

it('preserves future deadlines and never replays expired restored rests', () => {
  expect(restFeedbackDeadline(null, startRest('s', 120, 1000), 10000)).toBe(121000);
  expect(restFeedbackDeadline(null, startRest('s', 1, 1000), 10000)).toBeNull();
  expect(restFeedbackDeadline(startRest('s', 120, 1000), IDLE_REST_TIMER, 10000)).toBeNull();
});
it('rings once when an edit crosses zero but not when an expired timer is unchanged or restored', () => {
  const initial = startRest('s', 120, 1000), short = startRest('s', 5, 1000);
  expect(restFeedbackDeadline(initial, short, 10000)).toBe(10100);
  expect(restFeedbackDeadline(short, short, 10000)).toBeNull();
  expect(restFeedbackDeadline(startRest('s', 6, 1000), short, 10000)).toBeNull();
  expect(restFeedbackDeadline(startRest('other', 120, 1000), short, 10000)).toBeNull();
  expect(restFeedbackDeadline(startRest('s', 120, 2000), short, 10000)).toBeNull();
  expect(restFeedbackDeadline(initial, startRest('s', 20, 1000), 10000)).toBe(21000);
});
