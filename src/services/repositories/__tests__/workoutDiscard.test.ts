import { workoutSessionRepository } from '../index';
import { BaseRepository } from '../BaseRepository';
import type { WorkoutSession } from '@/models';
jest.mock('@react-native-firebase/firestore', () => ({}));
jest.mock('@/services/firebase', () => ({ db: {} }));
const session = { id: 'workout', userId: 'owner', exercises: [] } as unknown as WorkoutSession;
afterEach(() => jest.restoreAllMocks());
it('excludes discarded records from all workout read paths while retaining legacy history', async () => {
  const discarded = { ...session, discardedAt: 100 };
  jest.spyOn(BaseRepository.prototype, 'listWhere').mockResolvedValue([session, discarded]);
  jest.spyOn(BaseRepository.prototype, 'list').mockResolvedValue([session, discarded]);
  expect(await workoutSessionRepository.listByUser('owner')).toEqual([session]);
  expect(await workoutSessionRepository.listByMesocycle('meso')).toEqual([session]);
  expect(await workoutSessionRepository.listByMicrocycle('micro')).toEqual([session]);
  expect(await workoutSessionRepository.list()).toEqual([session]);
  const get = jest.spyOn(BaseRepository.prototype, 'get'); get.mockResolvedValueOnce(discarded).mockResolvedValueOnce(session).mockResolvedValueOnce(null);
  expect(await workoutSessionRepository.get('workout')).toBeNull(); expect(await workoutSessionRepository.get('workout')).toEqual(session);
  expect(await workoutSessionRepository.get('missing')).toBeNull();
});
it('uses local-first discard without changing prescription or silently accepting a rejection', async () => {
  const write = jest.spyOn(workoutSessionRepository, 'createLocally').mockResolvedValue('pending');
  await workoutSessionRepository.discardLocally(session);
  expect(write).toHaveBeenCalledWith({ ...session, discardedAt: expect.any(Number) }, undefined, expect.any(Function));
  await expect(workoutSessionRepository.discardLocally({ ...session, id: '' })).rejects.toThrow();
  write.mockImplementationOnce(async (_item, _synced, rejected) => { rejected?.(Error('denied')); return 'pending'; });
  await expect(workoutSessionRepository.discardLocally(session)).rejects.toThrow('Discard rejected');
});
