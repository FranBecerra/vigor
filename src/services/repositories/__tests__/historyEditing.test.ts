import { workoutSessionRepository } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { WorkoutSession } from '@/models';
jest.mock('@react-native-firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({ db: {} }));
const session: WorkoutSession = { id: 'workout', userId: 'owner', sessionName: 'Upper', exercises: [], performedAt: 1000, completedAt: 5000,
  microcycleId: 'micro', microcycleIndex: 0, mesocycleId: 'meso' };
afterEach(() => jest.restoreAllMocks());
it('merges only the execution correction, never rewrites identity, completion or progression', async () => {
  jest.spyOn(BaseRepository.prototype, 'get').mockResolvedValue(session);
  const write = jest.spyOn(workoutSessionRepository, 'updateLocally').mockResolvedValue('pending');
  const result = await workoutSessionRepository.editCompletedLocally(session, 'owner', { ...session, sessionName: 'Corrected' });
  expect(result.sessionName).toBe('Corrected');
  expect(write).toHaveBeenCalledWith('workout', { sessionName: 'Corrected', sessionNote: '', exercises: [], editedAt: expect.any(Number) }, expect.any(Function));
  expect(Object.keys(write.mock.calls[0][1]).sort()).toEqual(['editedAt', 'exercises', 'sessionName', 'sessionNote']);
});
it.each([null, { ...session, userId: 'other' }, { ...session, discardedAt: 6 }, { ...session, editedAt: 6 }, { ...session, sessionNote: 'Updated elsewhere' },
  { ...session, exercises: [{ id: 'new' }] }])('rejects stale, missing and foreign records without writing', async (latest) => {
  jest.spyOn(BaseRepository.prototype, 'get').mockResolvedValue(latest as WorkoutSession | null);
  const write = jest.spyOn(workoutSessionRepository, 'updateLocally');
  await expect(workoutSessionRepository.editCompletedLocally(session, 'owner', session)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
});
it('surfaces an immediate rejected local write', async () => {
  jest.spyOn(BaseRepository.prototype, 'get').mockResolvedValue(session);
  jest.spyOn(workoutSessionRepository, 'updateLocally').mockImplementation(async (_id, _patch, rejected) => { rejected?.(Error('rejected')); return 'pending'; });
  await expect(workoutSessionRepository.editCompletedLocally(session, 'owner', session)).rejects.toThrow('historyEditRejected');
});
it('aborts if the account or editor changes while the document read is in flight', async () => {
  let active = true;
  jest.spyOn(BaseRepository.prototype, 'get').mockImplementation(async () => { active = false; return session; });
  const write = jest.spyOn(workoutSessionRepository, 'updateLocally');
  await expect(workoutSessionRepository.editCompletedLocally(session, 'owner', session, () => active)).rejects.toThrow();
  expect(write).not.toHaveBeenCalled();
});
