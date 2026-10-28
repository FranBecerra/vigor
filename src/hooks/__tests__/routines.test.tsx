import React from 'react';
import { useRoutines } from '../useRoutines';
const { create, act } = require('react-test-renderer');
const mockLoad = jest.fn(); let mockOwner: string | null = 'owner';
const mockMap = new Map(); const mockTranslate = (key: string) => key;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate, i18n: { language: 'en' } }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockOwner }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockMap }) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: {}, routineRepository: {}, workoutSessionRepository: {} }));
jest.mock('@/services/training/routineView', () => ({ loadRoutineViews: (...args: unknown[]) => mockLoad(...args) }));
let result: ReturnType<typeof useRoutines>;
function Probe() { result = useRoutines(); return null; }
it('renders a warm snapshot immediately, revalidates, and never shows it to another account', async () => {
  mockOwner = 'owner'; mockLoad.mockResolvedValueOnce([{ id: 'r' }]); let tree: any;
  await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('ready'); expect(result.routines).toEqual([{ id: 'r' }]);
  await act(async () => tree.unmount());
  let resolve!: (value: unknown[]) => void;
  mockLoad.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  await act(async () => { tree = create(<Probe />); });
  expect(result.status).toBe('ready'); expect(result.routines).toEqual([{ id: 'r' }]);
  mockLoad.mockImplementationOnce(() => new Promise(() => {})); mockOwner = 'other';
  await act(async () => tree.update(<Probe />));
  expect(result.routines).toEqual([]); expect(result.status).toBe('loading');
  await act(async () => resolve([{ id: 'stale' }])); expect(result.routines).toEqual([]);
  mockOwner = null; await act(async () => tree.update(<Probe />)); expect(result.routines).toEqual([]);
  await act(async () => tree.unmount());
});
