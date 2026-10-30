let mockOS = 'ios'; let mockNative: any = null;
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
jest.mock('expo/src/winter/fetch', () => ({ fetch: jest.fn() }));
const load = () => { let client: any; jest.isolateModules(() => { client = require('../cardioHealthClient').cardioHealthBridge; }); return client; };
beforeEach(() => { jest.clearAllMocks(); mockOS = 'ios'; mockNative = null; });
it('does not request access on mount or availability checks and handles missing/partial native binaries', async () => {
  expect(await load().available()).toBe(false);
  await expect(load().authorize()).rejects.toThrow('cardioHealthUnavailable');
  await expect(load().read(1, 2)).rejects.toThrow('cardioHealthUnavailable');
  mockNative = { cardioHistoryAvailable: async () => true }; expect(await load().available()).toBe(false);
  mockOS = 'android'; expect(await load().available()).toBe(false);
});
it('delegates only explicitly requested workout operations, preserving native rejections', async () => {
  mockNative = { cardioHistoryAvailable: jest.fn(async () => true), authorizeCardioHistory: jest.fn(async () => undefined),
    readCardioHistory: jest.fn(async () => ({ version: 1, truncated: false, workouts: [] })) };
  const bridge = load(); expect(await bridge.available()).toBe(true); expect(mockNative.authorizeCardioHistory).not.toHaveBeenCalled();
  await bridge.authorize(); expect(mockNative.authorizeCardioHistory).toHaveBeenCalledTimes(1);
  expect(await bridge.read(1, 2)).toMatchObject({ workouts: [] }); expect(mockNative.readCardioHistory).toHaveBeenCalledWith(1, 2);
  mockNative.readCardioHistory.mockRejectedValueOnce(Error('locked')); await expect(bridge.read(1, 2)).rejects.toThrow('locked');
});
