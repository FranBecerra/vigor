let mockOS = 'ios'; let mockNative: any = null; let mockText: string | null = null;
const mockRead = jest.fn(); const mockMove = jest.fn(); const mockCreate = jest.fn(); const mockWrite = jest.fn();
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
// These adapter tests do not use networking. Keep Expo's lazy fetch getter from
// initializing unrelated native modules during Jest's global cleanup.
jest.mock('expo/src/winter/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-file-system', () => ({ Paths: { document: 'fixture' }, File: class {
  constructor(..._paths: unknown[]) { mockRead(); }
  get exists() { return mockText !== null; } textSync() { return mockText; }
  create(value: unknown) { mockCreate(value); } write(value: string) { mockText = value; mockWrite(value); }
  move(...args: unknown[]) { mockMove(...args); }
} }));
beforeEach(() => { jest.clearAllMocks(); mockOS = 'ios'; mockNative = null; mockText = null; });
function loadClient() { let client: any; jest.isolateModules(() => { client = require('../healthClient'); }); return client; }
it('fails safely on an older native binary without losing ordinary history deletion', async () => {
  const { workoutHealth } = loadClient(); await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot()).toMatchObject({ ready: true, available: false });
  const remove = jest.fn(); expect(await workoutHealth.remove({ userId: 'owner', id: 'draft', exercises: [] }, false, remove)).toBe(true);
  expect(remove).toHaveBeenCalled(); expect(await workoutHealth.setEnabled('owner', true)).toBe(false);
});
it('writes the journal through a temporary file and atomic replacement', async () => {
  mockNative = { authorization: async () => 'authorized', authorize: async () => 'authorized' };
  const { workoutHealth } = loadClient(); await workoutHealth.activate('owner');
  expect(await workoutHealth.setEnabled('owner', true)).toBe(true); expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
  expect(mockMove).toHaveBeenCalledWith(expect.any(Object), { overwrite: true });
  expect(JSON.parse(mockText!).owners.owner.enabled).toBe(true);
});
it('keeps unsupported web rendering independent of the native filesystem', async () => {
  mockOS = 'web'; const { workoutHealth } = loadClient(); await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot()).toMatchObject({ ready: true, available: false }); expect(mockRead).not.toHaveBeenCalled();
});
