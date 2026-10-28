let mockOS = 'ios'; let mockNative: any = null;
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
jest.mock('expo/src/winter/fetch', () => ({ fetch: jest.fn() }));
function load() { let client: any; jest.isolateModules(() => { client = require('../bioHealthClient').bioHealthBridge; }); return client; }
function night() { let client: any; jest.isolateModules(() => { client = require('../bioHealthClient').bioNightBridge; }); return client; }
beforeEach(() => { mockOS = 'ios'; mockNative = null; });
it('does not request permissions when checking availability and handles old/unsupported binaries', async () => {
  expect(await load().bioAvailable()).toBe(false);
  await expect(load().authorizeBio()).rejects.toThrow('bioHealthUnavailable');
  await expect(load().readBio(1, 2)).rejects.toThrow('bioHealthUnavailable');
  mockNative = { bioAvailable: async () => true }; expect(await load().bioAvailable()).toBe(false);
  mockOS = 'web'; expect(await load().bioAvailable()).toBe(false);
});
it('gates overnight reads independently for old binaries and delegates only explicit permissions', async () => {
  expect(await night().available()).toBe(false);
  await expect(night().authorize()).rejects.toThrow('bioNightUnavailable');
  await expect(night().read(1, 2)).rejects.toThrow('bioNightUnavailable');
  mockNative = { bioNightAvailable: jest.fn(async () => true), authorizeBioNight: jest.fn(async () => undefined),
    readBioNight: jest.fn(async () => ({ version: 1, metrics: {} })) };
  const client = night(); expect(await client.available()).toBe(true); expect(mockNative.authorizeBioNight).not.toHaveBeenCalled();
  await client.authorize(); expect(mockNative.authorizeBioNight).toHaveBeenCalledTimes(1);
  expect(await client.read(1, 2)).toEqual({ version: 1, metrics: {} }); expect(mockNative.readBioNight).toHaveBeenCalledWith(1, 2);
  mockOS = 'web'; expect(await night().available()).toBe(false);
});
it('delegates only the separately requested reads and never treats authorization completion as granted access', async () => {
  mockNative = { bioAvailable: jest.fn(async () => true), authorizeBio: jest.fn(async () => undefined), readBio: jest.fn(async () => ({})) };
  const client = load(); expect(await client.bioAvailable()).toBe(true); expect(mockNative.authorizeBio).not.toHaveBeenCalled();
  await client.authorizeBio(); expect(await client.readBio(1, 2)).toEqual({}); expect(mockNative.readBio).toHaveBeenCalledWith(1, 2);
});
