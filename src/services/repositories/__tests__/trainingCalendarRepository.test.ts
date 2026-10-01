import { mesocycleRepository } from '../index';

const mockGet = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((col, id) => ({ path: `${col.path}/${id}` })),
  runTransaction: jest.fn((_db, callback) => callback({ get: mockGet, update: mockUpdate })),
}));
jest.mock('@/services/firebase', () => ({ db: {} }));

beforeEach(() => jest.clearAllMocks());
it('saves undated rest structure atomically without changing dated entries or workout progression', async () => {
  const current = { plannedSessions: [{ index: 0 }, { index: 1 }], currentMicrocycleIndex: 2,
    trainingCalendar: { existing: { date: '2026-09-30' } } };
  mockGet.mockResolvedValue({ exists: () => true, data: () => current });
  const template = { days: 3, slots: [{ kind: 'workout' as const, sessionIndex: 0 },
    { kind: 'rest' as const }, { kind: 'workout' as const, sessionIndex: 1 }] };
  const result = await mesocycleRepository.updateScheduleTemplate('m', template, 10);
  expect(mockUpdate).toHaveBeenCalledWith({ path: 'mesocycles/m' }, { scheduleTemplate: template, updatedAt: 10 });
  expect(result.trainingCalendar).toEqual(current.trainingCalendar);
  expect(result.currentMicrocycleIndex).toBe(2);
});
it('rejects stale workout sequences and missing mesocycles before writing a template', async () => {
  const template = { days: 1, slots: [{ kind: 'workout' as const, sessionIndex: 0 }] };
  mockGet.mockResolvedValue({ exists: () => false });
  await expect(mesocycleRepository.updateScheduleTemplate('m', template, 1)).rejects.toThrow('Missing');
  mockGet.mockResolvedValue({ exists: () => true, data: () => ({ plannedSessions: [{ index: 1 }] }) });
  await expect(mesocycleRepository.updateScheduleTemplate('m', template, 1)).rejects.toThrow('sequence');
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('atomically preserves existing entries and writes only calendar data', async () => {
  const rest = { kind: 'rest' as const, date: '2026-09-30', microcycleIndex: 0, checked: true };
  mockGet.mockResolvedValue({ exists: () => true, data: () => ({ userId: 'u', currentMicrocycleIndex: 0,
    trainingCalendar: { 'rest:2026-09-30': rest } }) });
  const result = await mesocycleRepository.updateTrainingCalendar('m', (current) => ({ ...current,
    '0:0': { kind: 'workout', date: '2026-10-01', microcycleIndex: 0, sessionIndex: 0 } }), 100);
  expect(result.trainingCalendar?.['rest:2026-09-30']).toEqual(rest);
  expect(mockUpdate).toHaveBeenCalledWith({ path: 'mesocycles/m' }, {
    trainingCalendar: result.trainingCalendar, updatedAt: 100,
  });
  expect(result.currentMicrocycleIndex).toBe(0);
});
it('fails without a write if the mesocycle is gone or the transformation is invalid', async () => {
  mockGet.mockResolvedValue({ exists: () => false });
  await expect(mesocycleRepository.updateTrainingCalendar('m', (c) => c, 1)).rejects.toThrow('Missing');
  expect(mockUpdate).not.toHaveBeenCalled();
  mockGet.mockResolvedValue({ exists: () => true, data: () => ({}) });
  await expect(mesocycleRepository.updateTrainingCalendar('m', () => { throw new Error('Conflict'); }, 1)).rejects.toThrow('Conflict');
  expect(mockUpdate).not.toHaveBeenCalled();
});
