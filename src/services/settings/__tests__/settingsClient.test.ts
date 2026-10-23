let mockOS = 'ios'; let mockText: string | null = null;
const mockCreate = jest.fn(); const mockMove = jest.fn(); const mockGet = jest.fn(); const mockSet = jest.fn();
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS; } } }));
jest.mock('expo/src/winter/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-file-system', () => ({ Paths: { document: 'fixture' }, File: class {
  get exists() { return mockText !== null; } textSync() { return mockText; }
  create(...args: unknown[]) { mockCreate(...args); } write(value: string) { mockText = value; }
  move(...args: unknown[]) { mockMove(...args); }
} }));
function load() { let client: any; jest.isolateModules(() => { client = require('../settingsClient').appSettingsRepository; }); return client; }
beforeEach(() => { jest.clearAllMocks(); mockOS = 'ios'; mockText = null; });
it('persists and restores native settings through atomic file replacement', async () => {
  const repository = load(); expect(await repository.get('owner')).toEqual({ appearance: 'system', language: 'system' });
  await repository.update('owner', { appearance: 'dark' }); expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
  expect(mockMove).toHaveBeenCalledWith(expect.any(Object), { overwrite: true }); expect((await load().get('owner')).appearance).toBe('dark');
});
it('uses browser storage rather than a native file on web', async () => {
  mockOS = 'web'; const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  mockGet.mockReturnValue(null); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: mockGet, setItem: mockSet } });
  try {
    const repository = load(); await repository.update('owner', { language: 'en' });
    expect(mockGet).toHaveBeenCalledWith('vigor-app-settings'); expect(mockSet).toHaveBeenCalledWith('vigor-app-settings', expect.stringContaining('"language":"en"'));
    expect(mockCreate).not.toHaveBeenCalled();
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as any).localStorage; }
});
