import { SportActivityRepository, sportActivityPath } from '../sportActivityRepository';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { saveSportDraft } from '../sportActivities';
import type { SportActivityDraft } from '@/models/sportActivity';
import { createSportActivitySeries } from '../sportActivitySeries';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({ collection: (_db: unknown, path: string) => path, doc: (path: string) => ({ id: 'auto-id', path }) }));
const now = Date.UTC(2026, 9, 28, 12);
const draft: SportActivityDraft = { sport: 'FOOTBALL', context: 'MATCH', name: '', notes: '', mode: 'RECORD', startAt: now - 3600000, durationMinutes: 60, timeZone: 'UTC', effort: 8 };
const original = saveSportDraft('sport', 'owner', draft, now);
let get: jest.SpyInstance, write: jest.SpyInstance;
beforeEach(() => {
  get = jest.spyOn(BaseRepository.prototype, 'get').mockResolvedValue(original);
  write = jest.spyOn(BaseRepository.prototype, 'createLocally').mockResolvedValue('pending');
});
afterEach(() => jest.restoreAllMocks());
it('scopes storage to the owner and queues a new auto-id record without requiring a network read', async () => {
  expect(sportActivityPath('owner')).toBe('users/owner/sportActivities');
  expect(() => sportActivityPath('../other')).toThrow(); expect(() => new SportActivityRepository('')).toThrow();
  const repo = new SportActivityRepository('owner'); expect(repo.newId()).toBe('auto-id');
  const next = await repo.save('auto-id', null, draft, now, () => true, jest.fn());
  expect(get).not.toHaveBeenCalled(); expect(write).toHaveBeenCalledWith(next, undefined, expect.any(Function));
  expect((repo as any).collectionPath).toBe('users/owner/sportActivities');
});
it('edits a current owned record and creates a recoverable discard without deleting it', async () => {
  const repo = new SportActivityRepository('owner');
  const edited = await repo.save(original.id, original, { ...draft, effort: 6 }, now + 1, () => true, jest.fn());
  expect(edited).toMatchObject({ revision: 2, record: { feedback: { effort: 6 } } });
  const discarded = await repo.discard(original, now + 2, () => true, jest.fn());
  expect(discarded.discardedAt).toBe(now + 2); expect(write).toHaveBeenLastCalledWith(discarded, undefined, expect.any(Function));
});
it('rejects missing, malformed, foreign, stale and mismatched originals before writing', async () => {
  const repo = new SportActivityRepository('owner');
  await expect(repo.save('wrong', original, draft, now, () => true, jest.fn())).rejects.toThrow('staleSportActivity');
  await expect(repo.save(original.id, { ...original, userId: 'other' }, draft, now, () => true, jest.fn())).rejects.toThrow();
  for (const latest of [null, { ...original, userId: 'other' }, { ...original, revision: 2 }]) {
    get.mockResolvedValueOnce(latest);
    await expect(repo.save(original.id, original, draft, now, () => true, jest.fn())).rejects.toThrow('staleSportActivity');
  }
  expect(write).not.toHaveBeenCalled();
});
it('guards account changes before reading, between reading and writing, and after local acceptance', async () => {
  const repo = new SportActivityRepository('owner'); let current = false;
  await expect(repo.discard(original, now, () => current, jest.fn())).rejects.toThrow();
  current = true; get.mockImplementationOnce(async () => { current = false; return original; });
  await expect(repo.discard(original, now, () => current, jest.fn())).rejects.toThrow();
  await expect(repo.save('new', null, draft, now, () => false, jest.fn())).rejects.toThrow(); expect(write).not.toHaveBeenCalled();
  current = true; write.mockImplementationOnce(async () => { current = false; return 'pending'; });
  await expect(repo.save('new', null, draft, now, () => current, jest.fn())).rejects.toThrow('sportSaveFailed');
});
it('propagates local rejection, reports later server rejection, and ignores a late result for an old account', async () => {
  const repo = new SportActivityRepository('owner'); const rejected = jest.fn();
  write.mockRejectedValueOnce(Error('cache failed'));
  await expect(repo.save('new', null, draft, now, () => true, rejected)).rejects.toThrow('cache failed');
  write.mockImplementationOnce(async (_entry, _synced, reject) => { reject(); return 'pending'; });
  await expect(repo.save('new', null, draft, now, () => true, rejected)).rejects.toThrow('sportSaveFailed'); expect(rejected).toHaveBeenCalledTimes(1);
  let current = true;
  await repo.save('new', null, draft, now, () => current, rejected);
  const late = write.mock.calls.at(-1)![2]; late(); expect(rejected).toHaveBeenCalledTimes(2);
  current = false; late(); expect(rejected).toHaveBeenCalledTimes(2);
});

const repeated: SportActivityDraft = { ...draft, mode: 'PLAN', startAt: now + 3600000,
  repeat: { frequency: 'WEEKLY', interval: 1, weekdays: [3], untilDate: '2026-11-11' } };
it('saves a whole recurring reservation in one local write, with no partial multi-document creation', async () => {
  const repo = new SportActivityRepository('owner');
  const entries = await repo.save('series', null, repeated, now, () => true, jest.fn());
  expect(Array.isArray(entries)).toBe(true); expect(entries).toHaveLength(3);
  expect(write).toHaveBeenCalledTimes(1); expect(write.mock.calls[0][0]).toMatchObject({ schemaVersion: 2, id: 'series' });
  expect(get).not.toHaveBeenCalled();
  await expect(repo.save(original.id, original, repeated, now, () => true, jest.fn())).rejects.toThrow('invalidSportRecurrence');
  await expect(repo.save('new', null, repeated, now, () => false, jest.fn())).rejects.toThrow();
  const changing = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
  await expect(repo.save('new', null, repeated, now, changing, jest.fn())).rejects.toThrow('staleSportActivity');
  expect(write).toHaveBeenCalledTimes(1);
});
it('edits or cancels only an occurrence leaf and leaves sibling actuals untouched', async () => {
  const series = createSportActivitySeries('series', 'owner', repeated, now), first = series.occurrences['0'];
  get.mockResolvedValue(series);
  const update = jest.spyOn(BaseRepository.prototype, 'updateLocally').mockResolvedValue('pending');
  const repo = new SportActivityRepository('owner');
  const next = await repo.save(first.id, first, { ...repeated, repeat: undefined, name: 'Only this class' }, now + 1, () => true, jest.fn());
  expect(get).toHaveBeenLastCalledWith('series');
  expect(update).toHaveBeenLastCalledWith('series', { occurrences: { '0': next } }, expect.any(Function));
  const cancelled = await repo.discard(first, now + 2, () => true, jest.fn());
  expect(update).toHaveBeenLastCalledWith('series', { occurrences: { '0': cancelled } }, expect.any(Function));
  expect(write).not.toHaveBeenCalled(); expect(series.occurrences['1'].record).toBeNull();
  for (const stale of [null, { ...series, userId: 'other' }, { ...series, occurrences: { ...series.occurrences, '0': { ...first, revision: 2 } } }]) {
    get.mockResolvedValueOnce(stale);
    await expect(repo.discard(first, now + 3, () => true, jest.fn())).rejects.toThrow('staleSportActivity');
  }
  expect(update).toHaveBeenCalledTimes(2);
});
it('guards local acceptance and late rejection for an entire series and an occurrence patch', async () => {
  const repo = new SportActivityRepository('owner'), rejected = jest.fn(); let current = true;
  write.mockImplementationOnce(async () => { current = false; });
  await expect(repo.save('series', null, repeated, now, () => current, rejected)).rejects.toThrow('sportSaveFailed');
  current = true;
  write.mockImplementationOnce(async (_value, _synced, reject) => { reject(); });
  await expect(repo.save('series', null, repeated, now, () => current, rejected)).rejects.toThrow('sportSaveFailed');
  await repo.save('series', null, repeated, now, () => current, rejected);
  const late = write.mock.calls.at(-1)![2]; current = false; late(); expect(rejected).toHaveBeenCalledTimes(1);
  const series = createSportActivitySeries('series', 'owner', repeated, now), first = series.occurrences['0'];
  current = true; get.mockResolvedValue(series);
  jest.spyOn(BaseRepository.prototype, 'updateLocally').mockImplementationOnce(async (_id, _patch, reject) => { reject?.(Error('denied')); return 'pending'; });
  await expect(repo.discard(first, now + 1, () => current, rejected)).rejects.toThrow('sportSaveFailed');
  expect(rejected).toHaveBeenCalledTimes(2);
});
