import { CardioTrainingRepository, cardioTrainingPath } from '../cardioTrainingRepository';
import { validCardioBlock, endCardioBlock } from '../cardioBlock';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
jest.mock('@/services/firebase', () => ({ db: {} }));
const mockGet = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path, doc: () => ({ id: 'new' }),
  getDocFromCache: async () => { const value = await mockGet(); return { id: value?.id, exists: () => value !== null, data: () => value }; } }));
const block = cardioFixture(), next = endCardioBlock(block, now + 1);
let get: jest.Mock, write: jest.SpyInstance;
beforeEach(() => { get = mockGet.mockReset().mockResolvedValue(block); write = jest.spyOn(BaseRepository.prototype, 'createLocally').mockResolvedValue('pending'); });
afterEach(() => jest.restoreAllMocks());
it('uses private collections and native local acceptance for explicit independent auto-id creates', async () => {
  expect(cardioTrainingPath('owner', 'cardioBlocks')).toBe('users/owner/cardioBlocks');
  expect(cardioTrainingPath('owner', 'cardioWorkouts')).toBe('users/owner/cardioWorkouts');
  expect(() => cardioTrainingPath('../x', 'cardioBlocks')).toThrow(); expect(() => cardioTrainingPath('owner', 'other' as any)).toThrow();
  const repo = new CardioTrainingRepository('owner', 'cardioBlocks', validCardioBlock);
  expect(repo.newId()).toBe('new'); expect(await repo.save(block, null, () => true, jest.fn())).toEqual(block); expect(get).not.toHaveBeenCalled();
  await expect(repo.save(next, null, () => true, jest.fn())).rejects.toThrow();
  await expect(repo.save({ ...block, userId: 'other' }, null, () => true, jest.fn())).rejects.toThrow();
  await expect(repo.save(block, null, () => false, jest.fn())).rejects.toThrow();
});
it('rejects observed stale revisions and identity/owner changes before replacing a record', async () => {
  const repo = new CardioTrainingRepository('owner', 'cardioBlocks', validCardioBlock);
  expect(await repo.save(next, block, () => true, jest.fn())).toEqual(next);
  for (const previous of [{ ...block, userId: 'other' }, { ...block, id: 'other' }, { ...block, revision: 2 }, { ...block, updatedAt: now + 2 }]) await expect(repo.save(next, previous, () => true, jest.fn())).rejects.toThrow();
  for (const latest of [null, { ...block, userId: 'other' }, { ...block, id: 'other' }, { ...block, revision: 9 }]) {
    get.mockResolvedValueOnce(latest); await expect(repo.save(next, block, () => true, jest.fn())).rejects.toThrow();
  }
  const stale = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
  await expect(repo.save(next, block, stale, jest.fn())).rejects.toThrow();
  const beforeWrite = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
  await expect(repo.save(block, null, beforeWrite, jest.fn())).rejects.toThrow();
  get.mockRejectedValueOnce(Error('cache-unavailable')); await expect(repo.save(next, block, () => true, jest.fn())).rejects.toThrow('cache-unavailable');
});
it('handles immediate/late failures and never reports a rejected write to a different owner', async () => {
  const repo = new CardioTrainingRepository('owner', 'cardioBlocks', validCardioBlock), reject = jest.fn(); let current = true;
  write.mockImplementationOnce(async (_value: unknown, _sync: unknown, failure: () => void) => { failure(); return 'pending'; });
  await expect(repo.save(block, null, () => current, reject)).rejects.toThrow('cardioSaveFailed'); expect(reject).toHaveBeenCalledTimes(1);
  await repo.save(block, null, () => current, reject); const callback = write.mock.calls.at(-1)![2]; callback(); expect(reject).toHaveBeenCalledTimes(2);
  current = false; callback(); expect(reject).toHaveBeenCalledTimes(2); current = true;
  write.mockImplementationOnce(async () => { current = false; return 'pending'; });
  await expect(repo.save(block, null, () => current, reject)).rejects.toThrow('cardioSaveFailed');
  current = true; write.mockRejectedValueOnce(Error('native')); await expect(repo.save(block, null, () => current, reject)).rejects.toThrow('native');
});
