import { CardioPlanRepository, cardioPlanPath } from '../cardioPlanRepository';
import { saveCardioProposal } from '../savedCardioPlan';
import { BaseRepository } from '@/services/repositories/BaseRepository';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path, doc: (path: string) => ({ id: 'auto-id', path }) }));
const now = Date.UTC(2026, 9, 29);
const plan = saveCardioProposal('plan', 'owner', 'Base', { modalities: ['CYCLING'], profile: { schemaVersion: 1, modalities: {} },
  cycleDays: 7, availableDays: [0, 3], sessions: 2, cardioMinutes: 60, sessionMinutes: 30, maxActiveDays: 3, allowDoubles: false, strength: [] }, null, now);
let read: jest.SpyInstance, save: jest.SpyInstance, patch: jest.SpyInstance;
beforeEach(() => {
  read = jest.spyOn(BaseRepository.prototype, 'get').mockResolvedValue(plan);
  save = jest.spyOn(BaseRepository.prototype, 'createLocally').mockResolvedValue('pending');
  patch = jest.spyOn(BaseRepository.prototype, 'updateLocally').mockResolvedValue('pending');
});
afterEach(() => jest.restoreAllMocks());
it('uses private auto ids and queues explicit proposal writes offline without a network read', async () => {
  expect(cardioPlanPath('owner')).toBe('users/owner/cardioPlans'); expect(() => cardioPlanPath('../x')).toThrow();
  const repo = new CardioPlanRepository('owner'); expect(repo.newId()).toBe('auto-id');
  expect(await repo.save(plan, () => true, jest.fn())).toEqual(plan); expect(read).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledWith(plan, undefined, expect.any(Function));
  await expect(repo.save({ ...plan, userId: 'other' }, () => true, jest.fn())).rejects.toThrow();
  await expect(repo.save(plan, () => false, jest.fn())).rejects.toThrow();
  await expect(repo.save({ ...plan, archivedAt: now }, () => true, jest.fn())).rejects.toThrow();
});
it('only patches the archive marker and refuses stale, missing or foreign records', async () => {
  const repo = new CardioPlanRepository('owner');
  expect((await repo.archive(plan, now + 1, () => true, jest.fn())).archivedAt).toBe(now + 1);
  expect(patch).toHaveBeenCalledWith('plan', { archivedAt: now + 1 }, expect.any(Function));
  for (const value of [null, { ...plan, createdAt: now - 1 }, { ...plan, archivedAt: now }, { ...plan, userId: 'other' }]) {
    read.mockResolvedValueOnce(value); await expect(repo.archive(plan, now + 1, () => true, jest.fn())).rejects.toThrow();
  }
  await expect(repo.archive(plan, now, () => false, jest.fn())).rejects.toThrow();
  const current = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
  await expect(repo.archive(plan, now, current, jest.fn())).rejects.toThrow();
});
it.each(['save', 'archive'] as const)('reports immediate and late native rejection for %s and silences callbacks after ownership changes', async method => {
  const repo = new CardioPlanRepository('owner'), reject = jest.fn(); let current = true;
  const invoke = () => method === 'save' ? repo.save(plan, () => current, reject) : repo.archive(plan, now, () => current, reject);
  const writer = method === 'save' ? save : patch;
  writer.mockImplementationOnce(async (...args: any[]) => { args.at(-1)(); return 'pending'; });
  await expect(invoke()).rejects.toThrow('cardioSaveFailed'); expect(reject).toHaveBeenCalledTimes(1);
  await invoke(); const callback = writer.mock.calls.at(-1)!.at(-1); callback(); expect(reject).toHaveBeenCalledTimes(2);
  current = false; callback(); expect(reject).toHaveBeenCalledTimes(2);
  current = true; writer.mockImplementationOnce(async () => { current = false; return 'pending'; });
  await expect(invoke()).rejects.toThrow('cardioSaveFailed');
  current = true; writer.mockRejectedValueOnce(Error('native')); await expect(invoke()).rejects.toThrow('native');
});
