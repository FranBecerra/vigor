const mockNative = { scheduleRestFeedback: jest.fn(), restFeedbackStatus: jest.fn() };
let mockModule: typeof mockNative | null | {} = mockNative;
jest.mock('expo-modules-core', () => ({ ...jest.requireActual('expo-modules-core'), requireOptionalNativeModule: () => mockModule }));
const load = () => { let bridge: any; jest.isolateModules(() => { bridge = require('../nativeRestFeedback.ios'); }); return bridge; };
beforeEach(() => { jest.clearAllMocks(); mockModule = mockNative; });
it('forwards absolute deadlines and cancellation and reads only the local diagnostic snapshot', async () => {
  mockNative.scheduleRestFeedback.mockResolvedValue(true);
  const status = { phase: 'fired', scheduleCount: 2, audioPlayed: true };
  mockNative.restFeedbackStatus.mockResolvedValue(status); const bridge = load();
  expect(await bridge.scheduleNativeRestFeedback(123456)).toBe(true);
  expect(mockNative.scheduleRestFeedback).toHaveBeenLastCalledWith(123456);
  await bridge.scheduleNativeRestFeedback(null); expect(mockNative.scheduleRestFeedback).toHaveBeenLastCalledWith(null);
  expect(await bridge.nativeRestFeedbackStatus()).toEqual(status);
});
it.each([null, {}])('degrades without native capability, without claiming feedback succeeded (%p)', async (module) => {
  mockModule = module; const bridge = load();
  expect(await bridge.scheduleNativeRestFeedback(123)).toBe(false);
  expect(await bridge.nativeRestFeedbackStatus()).toEqual({ phase: 'unavailable' });
});
it('propagates native errors for the caller fallback rather than reporting success', async () => {
  mockNative.scheduleRestFeedback.mockRejectedValue(Error('audio preparation failed'));
  mockNative.restFeedbackStatus.mockRejectedValue(Error('module failure')); const bridge = load();
  await expect(bridge.scheduleNativeRestFeedback(123)).rejects.toThrow('audio preparation failed');
  await expect(bridge.nativeRestFeedbackStatus()).rejects.toThrow('module failure');
});
