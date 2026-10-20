import { writeLocally } from '../localWrite';
const mockStop = jest.fn();
const mockSetDoc = jest.fn();
const mockSnapshot = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockSnapshot(...args),
}));
const ref = {} as Parameters<typeof writeLocally>[0];
let next: (snapshot: unknown) => void;
let failure: (error: unknown) => void;
const snap = (token: string, pending = true) => ({ exists: () => true, data: () => ({ _clientWriteId: token }), metadata: { hasPendingWrites: pending } });
beforeEach(() => {
  jest.clearAllMocks(); mockSnapshot.mockImplementation((_ref, _options, callback, error) => { next = callback; failure = error; return mockStop; });
  mockSetDoc.mockImplementation(() => new Promise(() => {}));
});
it('resolves on the matching native local snapshot even while the server is unavailable', async () => {
  const result = writeLocally(ref, { name: 'hold' }, 'new');
  next({ exists: () => false }); next(snap('older'));
  expect(mockStop).not.toHaveBeenCalled();
  next(snap('new'));
  await expect(result).resolves.toBe('pending');
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(mockSetDoc).toHaveBeenCalledWith(ref, { name: 'hold', _clientWriteId: 'new' });
});
it('distinguishes cloud acknowledgment and handles acknowledgment before a local event', async () => {
  mockSetDoc.mockResolvedValue(undefined); const synced = jest.fn();
  await expect(writeLocally(ref, {}, 'new', synced)).resolves.toBe('synced'); expect(synced).toHaveBeenCalled();
  expect(mockStop).toHaveBeenCalled();
});
it('surfaces rejection after local acceptance instead of claiming cloud synchronization', async () => {
  let reject!: (error: Error) => void;
  mockSetDoc.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  const failed = jest.fn(), synced = jest.fn(); const result = writeLocally(ref, {}, 'new', synced, failed);
  next(snap('new')); await expect(result).resolves.toBe('pending');
  reject(new Error('permission-denied')); await Promise.resolve(); await Promise.resolve();
  expect(failed).toHaveBeenCalled(); expect(synced).not.toHaveBeenCalled();
});
it('rejects listener failures and synchronous write failures', async () => {
  const result = writeLocally(ref, {}, 'new'); failure(new Error('listener')); await expect(result).rejects.toThrow('listener');
  mockSetDoc.mockImplementation(() => { throw new Error('write'); });
  await expect(writeLocally(ref, {}, 'new')).rejects.toThrow('write');
});
it('cleans a synchronous matching listener and accepts cloud-confirmed snapshots', async () => {
  mockSnapshot.mockImplementation((_ref, _options, callback) => { callback(snap('new', false)); return mockStop; });
  await expect(writeLocally(ref, {}, 'new')).resolves.toBe('synced'); expect(mockStop).toHaveBeenCalled();
});
