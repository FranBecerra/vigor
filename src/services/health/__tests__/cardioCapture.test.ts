import { cardioFixture, CARDIO_FIXTURE_NOW } from '@/test-support/cardioFixture';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { syncCardioCapture } from '../cardioCapture';

const now = CARDIO_FIXTURE_NOW;
const block = cardioFixture({}, now);
const running = startCardioWorkout(block, block.slots[0].id, now, 'session');
const paused = transitionCardioWorkout(running, 'PAUSE', now + 60000);
const finished = transitionCardioWorkout(paused, 'FINISH', now + 75000, 60);

it('opens one native measurement path for an enabled new workout', () => {
  const bridge = { startCardioCapture: jest.fn(async () => {}) };
  syncCardioCapture(bridge, running, false, true);
  syncCardioCapture(bridge, paused, true, true);
  syncCardioCapture(bridge, transitionCardioWorkout(paused, 'RESUME', now + 61000), true, true);
  syncCardioCapture(bridge, running, true, true);
  expect(bridge.startCardioCapture).toHaveBeenCalledTimes(1);
  expect(bridge.startCardioCapture).toHaveBeenCalledWith('["owner","session"]', 'RUNNING', now);
});

it('forwards saved pauses, resumes and discards while the export queue owns finish', () => {
  const bridge = { setCardioCaptureState: jest.fn(async () => {}) };
  syncCardioCapture(bridge, paused, true);
  syncCardioCapture(bridge, transitionCardioWorkout(paused, 'RESUME', now + 61000), true);
  syncCardioCapture(bridge, transitionCardioWorkout(paused, 'DISCARD', now + 63000), true);
  syncCardioCapture(bridge, finished, true);
  syncCardioCapture(bridge, { ...finished, source: 'APPLE_HEALTH_LINK_V1' }, true);
  expect(bridge.setCardioCaptureState.mock.calls).toEqual([
    ['["owner","session"]', 'PAUSED'],
    ['["owner","session"]', 'RUNNING'],
    ['["owner","session"]', 'DISCARDED'],
  ]);
});

it('leaves the normal timer usable when the bridge is old or native measurement fails', async () => {
  const bridge = {
    startCardioCapture: jest.fn(async () => { throw Error('permission'); }),
    setCardioCaptureState: jest.fn(async () => { throw Error('unavailable'); }),
  };
  expect(() => syncCardioCapture(null, running, true, true)).not.toThrow();
  expect(() => syncCardioCapture({}, paused, true)).not.toThrow();
  syncCardioCapture(bridge, running, true, true);
  syncCardioCapture(bridge, paused, true);
  await Promise.resolve();
});
