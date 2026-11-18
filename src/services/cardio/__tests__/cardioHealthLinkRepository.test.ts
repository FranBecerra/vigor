import { saveCardioHealthLink } from '../cardioHealthLinkRepository';
import { createLinkedCardioWorkout } from '../cardioHealthLink';
import { cardioFixture } from '@/test-support/cardioFixture';

const mockRecords = new Map<string, Record<string, unknown>>();
const mockSet = jest.fn();
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => path,
  doc: (path: string, id: string) => `${path}/${id}`,
  runTransaction: (_db: unknown, callback: (transaction: unknown) => Promise<void>) => callback({
    get: async (path: string) => ({
      exists: () => mockRecords.has(path), data: () => mockRecords.get(path), id: path.split('/').at(-1),
    }),
    set: mockSet,
  }),
}));
const now = Date.UTC(2026, 9, 29, 16), block = cardioFixture({}, now);
const key = 'a'.repeat(64);
const next = createLinkedCardioWorkout(block, block.slots[0].id, 'watch', {
  version: 1, truncated: false, workouts: [{ id: 'watch', kind: 'RUNNING', start: now - 3_600_000, end: now - 1800000,
    durationSeconds: 1800, sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, mixedActivities: false, ownExport: false, linkKey: key }],
}, [], now, 'linked');
const workouts = 'users/owner/cardioWorkouts', claims = 'users/owner/cardioHealthLinks', blockPath = 'users/owner/cardioBlocks/block';
const recordClaim = `${claims}/workout:${key}`, slotClaim = `${claims}/slot:5:block:${next.slotId}`;
beforeEach(() => { mockSet.mockClear(); mockRecords.clear(); mockRecords.set(blockPath, { ...block }); });

it('atomically creates the linked result and both reservation records', async () => {
  await saveCardioHealthLink(next, block, () => true);
  const { id, ...data } = next;
  expect(mockSet.mock.calls).toEqual([
    [`${workouts}/${id}`, data], [recordClaim, { workoutId: id }], [slotClaim, { workoutId: id }],
  ]);
});
it('makes retries safe and rejects duplicates across slots or across Health records for one slot', async () => {
  mockRecords.set(recordClaim, { workoutId: next.id });
  mockRecords.set(slotClaim, { workoutId: next.id });
  mockRecords.set(`${workouts}/${next.id}`, { ...next });
  await expect(saveCardioHealthLink({ ...next, id: 'retry' }, block, () => true)).resolves.toBeUndefined();
  await expect(saveCardioHealthLink({ ...next, slotId: block.slots[1].id }, block, () => true)).rejects.toThrow('healthCardioAlreadyLinked');
  await expect(saveCardioHealthLink({ ...next, healthLinkKey: 'b'.repeat(64) }, block, () => true)).rejects.toThrow('healthCardioAlreadyLinked');
  expect(mockSet).not.toHaveBeenCalled();
});
it('allows explicit unlink to free both claims, and rejects stale block revisions and account changes', async () => {
  mockRecords.set(recordClaim, { workoutId: next.id });
  mockRecords.set(slotClaim, { workoutId: next.id });
  mockRecords.set(`${workouts}/${next.id}`, { ...next, status: 'DISCARDED' });
  await saveCardioHealthLink({ ...next, id: 'replacement' }, block, () => true);
  expect(mockSet).toHaveBeenCalledTimes(3);
  mockSet.mockClear();
  mockRecords.set(blockPath, { ...block, revision: 2 });
  await expect(saveCardioHealthLink(next, block, () => true)).rejects.toThrow('staleCardioRecord');
  await expect(saveCardioHealthLink(next, block, () => false)).rejects.toThrow('invalidHealthCardioLink');
  expect(mockSet).not.toHaveBeenCalled();
});

it('never overwrites a workout that already exists at the target ID', async () => {
  mockRecords.set(`${workouts}/${next.id}`, { ...next });
  await expect(saveCardioHealthLink(next, block, () => true)).rejects.toThrow('invalidHealthCardioLink');
  expect(mockSet).not.toHaveBeenCalled();
});
