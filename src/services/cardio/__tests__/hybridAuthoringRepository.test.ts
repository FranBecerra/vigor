import { saveHybridBundle } from '../hybridAuthoringRepository';
import { prepareHybridBundle } from '../hybridAuthoring';
import { hybridFixture } from '@/test-support/hybridFixture';
const mockGet = jest.fn(), mockSet = jest.fn(), mockCommit = jest.fn(), mockAuth = { currentUser: { uid: 'owner' } as { uid: string } | null };
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => ({ path }),
  doc: (col: { path: string }, id: string) => ({ path: `${col.path}/${id}` }),
  runTransaction: (_db: unknown, callback: any) => mockCommit(callback),
}));
jest.mock('@/services/firebase', () => ({ db: {}, get authInstance() { return mockAuth; } }));
const bundle = () => { const f = hybridFixture(); return prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, 1800000000000); };
beforeEach(() => { jest.clearAllMocks(); mockAuth.currentUser = { uid: 'owner' }; mockGet.mockResolvedValue({ exists: () => false }); mockCommit.mockImplementation(async callback => callback({ get: mockGet, set: mockSet })); });
it('reads the permitted absent private receipt before atomically writing both prescriptions and source link', async () => {
  const b = bundle(); await saveHybridBundle(b, 'owner', () => true);
  expect(mockGet).toHaveBeenCalledTimes(1); expect(mockSet).toHaveBeenCalledTimes(3);
  expect(mockGet.mock.calls[0][0].path).toBe(`users/owner/cardioPlans/${b.cardio.id}`);
  expect(mockGet.mock.invocationCallOrder[0]).toBeLessThan(mockSet.mock.invocationCallOrder[0]);
  expect(mockSet.mock.calls.map(([ref]) => ref.path)).toEqual([`routines/${b.routine.id}`, `mesocycles/${b.mesocycle.id}`, `users/owner/cardioPlans/${b.cardio.id}`]);
});
it('does not overwrite an existing, partial or changed target, and accepts only exact idempotent retries', async () => {
  const b = bundle(); const data = [b.routine, b.mesocycle, b.cardio].map(({ id, ...item }) => JSON.parse(JSON.stringify(item)));
  mockGet.mockImplementation(async (ref: { path: string }) => ({ exists: () => true, data: () => data[ref.path.startsWith('routines') ? 0 : ref.path.startsWith('mesocycles') ? 1 : 2] }));
  await saveHybridBundle(b, 'owner', () => true); expect(mockSet).not.toHaveBeenCalled();
  data[0].name = 'changed'; await expect(saveHybridBundle(b, 'owner', () => true)).rejects.toThrow('hybridTargetChanged');
  mockGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...data[2], name: 'changed receipt' }) });
  await expect(saveHybridBundle(b, 'owner', () => true)).rejects.toThrow('hybridTargetChanged');
  mockGet.mockResolvedValueOnce({ exists: () => true, data: () => data[2] }).mockResolvedValue({ exists: () => false });
  await expect(saveHybridBundle(b, 'owner', () => true)).rejects.toThrow('hybridTargetChanged'); expect(mockSet).not.toHaveBeenCalled();
});
it('rejects owner changes before entry, after reads and during retry, and propagates failures without partial writes', async () => {
  const b = bundle(); await expect(saveHybridBundle(b, 'other', () => true)).rejects.toThrow();
  await expect(saveHybridBundle(b, 'owner', () => false)).rejects.toThrow(); expect(mockCommit).not.toHaveBeenCalled();
  let current = true; mockGet.mockImplementation(async () => { current = false; return { exists: () => false }; });
  await expect(saveHybridBundle(b, 'owner', () => current)).rejects.toThrow('staleHybridOwner'); expect(mockSet).not.toHaveBeenCalled();
  mockCommit.mockImplementation(async callback => { mockAuth.currentUser = null; return callback({ get: mockGet, set: mockSet }); });
  await expect(saveHybridBundle(b, 'owner', () => true)).rejects.toThrow('staleHybridOwner');
  mockAuth.currentUser = { uid: 'owner' }; mockCommit.mockRejectedValue(Error('network'));
  await expect(saveHybridBundle(b, 'owner', () => true)).rejects.toThrow('network'); expect(mockSet).not.toHaveBeenCalled();
});
it('suppresses success after a committed transaction belongs to an unmounted caller', async () => {
  let current = true;
  mockCommit.mockImplementation(async callback => { await callback({ get: mockGet, set: mockSet }); current = false; });
  await expect(saveHybridBundle(bundle(), 'owner', () => current)).rejects.toThrow('staleHybridOwner');
  expect(mockSet).toHaveBeenCalledTimes(3);
});
it('invalidates an owner change after the receipt retry reads', async () => {
  const b = bundle(), { id, ...data } = b.cardio; let current = true;
  mockGet.mockResolvedValueOnce({ exists: () => true, data: () => JSON.parse(JSON.stringify(data)) })
    .mockImplementation(async () => { current = false; return { exists: () => false }; });
  await expect(saveHybridBundle(b, 'owner', () => current)).rejects.toThrow('staleHybridOwner'); expect(mockSet).not.toHaveBeenCalled();
});
