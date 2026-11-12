import { continuityFixture } from '@/test-support/continuityFixture';
import { loadContinuityReview, saveMesocycleContinuation } from '../mesocycleContinuityRepository';
import type { WorkoutSession } from '@/models';
import { sessionsForMicrocycle } from '../mesocycleEditing';

const mockGet = jest.fn(), mockSet = jest.fn(), mockUpdate = jest.fn();
const mockGetDocFromServer = jest.fn(), mockGetDocsFromServer = jest.fn(), mockTransaction = jest.fn();
const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: 'owner' } };

jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (col: { path: string }, id = 'generated') => ({ id, path: `${col.path}/${id}` }),
  where: (field: string, _op: string, value: string) => ({ field, value }),
  query: (col: { path: string }, ...filters: unknown[]) => ({ ...col, filters }),
  getDocFromServer: (...args: unknown[]) => mockGetDocFromServer(...args),
  getDocsFromServer: (...args: unknown[]) => mockGetDocsFromServer(...args),
  runTransaction: (_db: unknown, callback: unknown) => mockTransaction(callback),
}));
jest.mock('@/services/firebase', () => ({ db: {}, get authInstance() { return mockAuth; } }));

const selection = { reason: 'COMPLETED' as const, microcycles: 6, repSuggestions: [] };
const snap = (id: string, path: string, value: unknown) => ({
  id, ref: { id, path }, exists: () => value !== undefined, data: () => value, metadata: { hasPendingWrites: false },
});
function storeFixture(history?: (rows: WorkoutSession[]) => WorkoutSession[]) {
  const { data } = continuityFixture(Date.now() - 1000);
  const docs = new Map<string, object>([
    [`routines/${data.routine.id}`, data.routine], [`mesocycles/${data.source.id}`, data.source],
    ...(history?.(data.history) ?? data.history).map(record => [`workoutSessions/${record.id}`, record] as const),
  ]);
  mockGet.mockImplementation(async ({ id, path }) => snap(id, path, docs.get(path)));
  mockGetDocFromServer.mockImplementation(mockGet);
  mockGetDocsFromServer.mockImplementation(async ({ path, filters }) => ({
    metadata: { hasPendingWrites: false }, docs: [...docs].filter(([key, value]) => key.startsWith(path + '/') &&
      filters.every((filter: { field: string; value: string }) => (value as Record<string, unknown>)[filter.field] === filter.value))
      .map(([key, value]) => snap(key.split('/')[1], key, value)),
  }));
  mockTransaction.mockImplementation(async callback => {
    const writes: (() => void)[] = [];
    const value = await callback({ get: mockGet,
      set: (ref: { path: string }, entry: object) => { mockSet(ref, entry); writes.push(() => docs.set(ref.path, entry)); },
      update: (ref: { path: string }, patch: object) => { mockUpdate(ref, patch); writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...patch })); },
    });
    writes.forEach(write => write());
    return value;
  });
  return { data, docs };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.currentUser = { uid: 'owner' };
});

it('commits a single successor and recognizes an exact retry after a lost response', async () => {
  const { data, docs } = storeFixture();
  const reviewed = await loadContinuityReview('owner', data.routine.id, data.source.id);
  const run = mockTransaction.getMockImplementation()!;
  mockTransaction.mockImplementationOnce(async callback => { await run(callback); throw Error('connection lost after commit'); });
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('connection lost');
  await expect(saveMesocycleContinuation(reviewed, selection)).resolves.toBe('generated');
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledTimes(2);
  expect(docs.get('mesocycles/generated')).toMatchObject({ routineId: data.routine.id, projectedMicrocycles: 6, currentMicrocycleIndex: 0 });
  expect(docs.get(`routines/${data.routine.id}`)).toMatchObject({ activeMesocycleId: 'generated' });
  expect(docs.get(`mesocycles/${data.source.id}`)).toMatchObject({ status: 'COMPLETED', continuation: { successorId: 'generated' } });
  expect(docs.get(`workoutSessions/${data.history[0].id}`)).toEqual(data.history[0]);
  await expect(saveMesocycleContinuation(reviewed, { ...selection, microcycles: 8 })).rejects.toThrow('staleContinuity');
  expect(mockSet).toHaveBeenCalledTimes(1);
});

it('rejects changed reviews, pending writes and account switches without writing anything', async () => {
  const { data, docs } = storeFixture();
  const reviewed = await loadContinuityReview('owner', data.routine.id, data.source.id);
  const path = `mesocycles/${data.source.id}`;
  docs.set(path, { ...data.source, updatedAt: Date.now() });
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('staleContinuity');
  docs.set(path, data.source);
  mockGetDocsFromServer.mockResolvedValueOnce({ metadata: { hasPendingWrites: true }, docs: [] });
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('continuityPendingWrites');
  mockAuth.currentUser = { uid: 'other' };
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('staleContinuityOwner');
  expect(mockSet).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('blocks a new draft and preserves the full prescription on activation', async () => {
  const { data, docs } = storeFixture();
  const reviewed = await loadContinuityReview('owner', data.routine.id, data.source.id);
  const draft = { ...data.history[0], id: 'new-draft', completedAt: undefined };
  docs.set('workoutSessions/new-draft', draft);
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('staleContinuity');
  expect(mockSet).not.toHaveBeenCalled();
  docs.delete('workoutSessions/new-draft');
  await expect(saveMesocycleContinuation(reviewed, selection)).resolves.toBe('generated');
  expect(docs.get('mesocycles/generated')).toMatchObject({ plannedSessions: data.source.plannedSessions });
});

it('persists the automatic trajectory and reuses its receipt after a lost response', async () => {
  const { data, docs } = storeFixture();
  const source = { ...data.source, prescriptionMode: 'AUTOMATIC' };
  docs.set(`mesocycles/${data.source.id}`, source);
  const reviewed = await loadContinuityReview('owner', data.routine.id, data.source.id);
  const run = mockTransaction.getMockImplementation()!;
  mockTransaction.mockImplementationOnce(async callback => { await run(callback); throw Error('lost response'); });
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('lost response');
  await expect(saveMesocycleContinuation(reviewed, selection)).resolves.toBe('generated');
  const next = docs.get('mesocycles/generated') as typeof reviewed.source;
  expect(next.prescriptionMode).toBe('AUTOMATIC');
  expect(sessionsForMicrocycle(next, data.routine.generation.goal, 4)[0].exercises[0].sets.map(set => set.targetRIR)).toEqual([1, 1, 1]);
  expect(sessionsForMicrocycle(next, data.routine.generation.goal, 5)[0].exercises[0].sets).toHaveLength(2);
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(docs.get(`workoutSessions/${data.history[0].id}`)).toEqual(data.history[0]);
});

it('invalidates reviewed evidence even if the corrected workout still has the same working-set count', async () => {
  const { data, docs } = storeFixture();
  const reviewed = await loadContinuityReview('owner', data.routine.id, data.source.id);
  const workout = data.history[3], exercise = workout.exercises[0];
  docs.set(`workoutSessions/${workout.id}`, { ...workout, editedAt: Date.now(),
    exercises: [{ ...exercise, sets: [{ ...exercise.sets[0], actualReps: 9 }] }] });
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('staleContinuity');
  expect(mockSet).not.toHaveBeenCalled();
});

it('rejects a retired repetition adjustment on a new save but recognizes its exact legacy receipt', async () => {
  const { data, docs } = storeFixture();
  const reviewed = await loadContinuityReview('owner', data.routine.id, data.source.id);
  const exerciseId = data.source.plannedSessions![0].exercises[0].exerciseId;
  const legacy = { ...selection, repSuggestions: [JSON.stringify([0, exerciseId])] };
  await expect(saveMesocycleContinuation(reviewed, legacy)).rejects.toThrow('staleContinuity');
  expect(mockSet).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();

  docs.set(`mesocycles/${data.source.id}`, { ...data.source, status: 'COMPLETED',
    continuation: { successorId: 'prior-successor', microcycles: legacy.microcycles, repSuggestions: legacy.repSuggestions } });
  docs.set(`routines/${data.routine.id}`, { ...data.routine, activeMesocycleId: 'prior-successor' });
  await expect(saveMesocycleContinuation(reviewed, legacy)).resolves.toBe('prior-successor');
  await expect(saveMesocycleContinuation(reviewed, selection)).rejects.toThrow('staleContinuity');
  expect(mockSet).not.toHaveBeenCalled();
});
