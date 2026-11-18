let mockOS = 'ios'; let mockNative: any = null; let mockText: string | null = null;
let mockPending: string | null = null;
const mockProtectedFiles = new Map<unknown, string>();
const mockRead = jest.fn(); const mockMove = jest.fn(); const mockCreate = jest.fn(); const mockWrite = jest.fn();
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockNative }));
// These adapter tests do not use networking. Keep Expo's lazy fetch getter from
// initializing unrelated native modules during Jest's global cleanup.
jest.mock('expo/src/winter/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-file-system', () => ({ Paths: { document: 'fixture' }, File: class {
  private pending: boolean;
  private name: unknown;
  private protected: boolean;
  constructor(...paths: unknown[]) {
    this.name = paths.at(-1);
    this.pending = this.name === 'vigor-health-exports.pending';
    this.protected = paths[0] === 'file:///VigorHealth/';
    mockRead(...paths);
  }
  get exists() { return this.textSync() !== null; }
  textSync() { return this.protected ? mockProtectedFiles.get(this.name) ?? null : this.pending ? mockPending : mockText; }
  create(value: unknown) { mockCreate(value); }
  write(value: string) {
    if (this.protected) mockProtectedFiles.set(this.name, value);
    else if (this.pending) mockPending = value;
    else mockText = value;
    mockWrite(value);
  }
  move(destination: { write(value: string): void }, options: unknown) {
    mockMove(destination, options);
    if (this.protected) {
      destination.write(mockProtectedFiles.get(this.name)!);
      mockProtectedFiles.delete(this.name);
    } else if (this.pending) {
      mockText = mockPending;
      mockPending = null;
    }
  }
} }));
beforeEach(() => { jest.clearAllMocks(); mockOS = 'ios'; mockNative = null; mockText = null; mockPending = null; mockProtectedFiles.clear(); });
function loadClient() { let client: any; jest.isolateModules(() => { client = require('../healthClient'); }); return client; }
it('fails safely on an older native binary without losing ordinary history deletion', async () => {
  const { workoutHealth } = loadClient(); await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot()).toMatchObject({ ready: true, available: false });
  const remove = jest.fn(); expect(await workoutHealth.remove({ userId: 'owner', id: 'draft', exercises: [] }, false, remove)).toBe(true);
  expect(remove).toHaveBeenCalled(); expect(await workoutHealth.setEnabled('owner', true)).toBe(false);
});
it('writes the journal through a temporary file and replacement', async () => {
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

it('recovers an interrupted replacement only when the committed journal is missing', async () => {
  mockNative = { authorization: async () => 'authorized' };
  mockPending = JSON.stringify({ version: 1, owners: { owner: { enabled: true, entries: {} } } });
  let { workoutHealth } = loadClient(); await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot().enabled).toBe(true);
  mockText = JSON.stringify({ version: 1, owners: { owner: { enabled: false, entries: {} } } });
  ({ workoutHealth } = loadClient()); await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot().enabled).toBe(false);
});

it('retains legacy consent and gives the private directory precedence after its first write', async () => {
  mockNative = { authorization: async () => 'authorized', healthJournalDirectory: async () => 'file:///VigorHealth/' };
  mockText = JSON.stringify({ version: 1, owners: { owner: { enabled: true, entries: {} } } });
  let { workoutHealth } = loadClient();
  await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot().enabled).toBe(true);
  expect(await workoutHealth.setEnabled('owner', false)).toBe(true);
  expect(JSON.parse(mockProtectedFiles.get('vigor-health-exports.json')!).owners.owner.enabled).toBe(false);
  expect(JSON.parse(mockText).owners.owner.enabled).toBe(true);
  ({ workoutHealth } = loadClient());
  await workoutHealth.activate('owner');
  expect(workoutHealth.getSnapshot().enabled).toBe(false);
});
