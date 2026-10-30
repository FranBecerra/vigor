import React from 'react';
import Screen from '@/app/(tabs)/(train)/session';
import { ExercisePage } from '../ExercisePage';
import { ExerciseQuickMenu } from '../ExerciseQuickMenu';
import { WorkoutExerciseStrip } from '../WorkoutExerciseStrip';
import { ExerciseSwapSheet } from '../generate/ExerciseSwapSheet';
import { RestTimer } from '../RestTimer';
import { WorkoutFinishSheet } from '../WorkoutFinishSheet';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetType } from '@/models';
import { Gesture } from 'react-native-gesture-handler';
const { create, act } = require('react-test-renderer');
const mockExercises = EXERCISE_CATALOGUE.slice(0, 2);
const mockCatalogue = { catalogue: mockExercises, exercisesById: new Map(mockExercises.map((exercise) => [exercise.id, exercise])), ready: true };
const mockNotes = { ready: true, error: false, get: () => '', save: jest.fn() };
let mockHistory: any[]; let mockReady = true;
const mockFlush = jest.fn().mockResolvedValue(true);
const mockUpdatePlan = jest.fn().mockResolvedValue(undefined);
let mockParams = { mesocycleId: 'm', goal: 'HYPERTROPHY', microcycleIndex: '1', plannedSessionIndex: '0' };
const mockTranslate = (key: string) => key;
const mockPlan = { id: 'm', userId: 'owner', prescriptionMode: 'MANUAL', plannedSessions: [{ index: 0, focus: 'UPPER', estimatedWorkMinutes: 20,
  exercises: mockExercises.map((exercise, order) => ({ exerciseId: exercise.id, exerciseSnapshot: exercise, order, isEdited: false,
    sets: [0, 1].map(() => ({ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 })) })) }] };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => mockCatalogue, useOptionalExerciseCatalogue: () => null }));
jest.mock('@/hooks/useWorkoutRecordHistory', () => ({ useWorkoutRecordHistory: () => ({ history: mockHistory, ready: mockReady }) }));
jest.mock('@/hooks/useSessionPersistence', () => ({ useSessionPersistence: () => ({ status: 'saved', hasRestored: true, flush: mockFlush, discard: jest.fn(), restoreError: false, retryRestore: jest.fn() }) }));
jest.mock('@/hooks/useTrainingNotes', () => ({ useTrainingNotes: () => mockNotes }));
jest.mock('@/hooks/useHealthExport', () => ({ useHealthExport: () => ({ service: { export: jest.fn() } }) }));
jest.mock('@/hooks/useWorkoutActivity', () => ({ useWorkoutActivity: () => false, endWorkoutActivity: jest.fn() }));
jest.mock('@/hooks/useRestAlert', () => ({ clearWorkoutRestAlerts: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: { get: async () => mockPlan, update: (...args: any[]) => mockUpdatePlan(...args) }, workoutSessionRepository: {} }));
jest.mock('../ExercisePage', () => ({ ExercisePage: () => null }));
jest.mock('../IntensityCell', () => ({ IntensityPickerProvider: ({ children }: any) => children }));
jest.mock('../ExerciseQuickMenu', () => ({ ExerciseQuickMenu: () => null }));
jest.mock('../WorkoutExerciseStrip', () => ({ WorkoutExerciseStrip: () => null }));
jest.mock('../RestTimer', () => ({ RestTimer: () => null }));
jest.mock('../WorkoutClock', () => ({ WorkoutClock: () => null }));
jest.mock('../PreWorkoutRehab', () => ({ PreWorkoutRehab: () => null }));
jest.mock('../WorkoutHealthExport', () => ({ WorkoutHealthExport: () => null }));
jest.mock('../generate/ExerciseSwapSheet', () => ({ ExerciseSwapSheet: () => null }));
beforeEach(() => {
  mockFlush.mockReset().mockResolvedValue(true); mockUpdatePlan.mockReset().mockResolvedValue(undefined);
  mockParams = { mesocycleId: 'm', goal: 'HYPERTROPHY', microcycleIndex: '1', plannedSessionIndex: '0' };
  Gesture.Native = jest.fn(() => ({})) as any;
  mockReady = true;
  mockHistory = [{ id: 'last-upper', userId: 'owner', mesocycleId: 'm', microcycleId: 'm0', microcycleIndex: 0, plannedSessionIndex: 0, performedAt: 1, completedAt: 2,
    exercises: mockExercises.map((exercise) => ({ exerciseId: exercise.id, order: 0, isSwap: false, sets: [70, 67.5].map((weight, index) => ({ id: String(index),
      setType: SetType.NORMAL, targetWeight: 0, targetReps: 10, targetRIR: 2, actualWeight: weight, actualReps: 8, actualRIR: 1, completionState: 'DONE' })) })) }];
});
it('saves actual work first and retries only the failed plan update without replacing the completed record', async () => {
  mockUpdatePlan.mockRejectedValueOnce(Error('invalid optional plan field')).mockResolvedValue(undefined);
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const page = () => tree.root.findAllByType(ExercisePage)[0], sheet = () => tree.root.findByType(WorkoutFinishSheet);
  const row = page().props.sets[0];
  await act(async () => page().props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: 70, actualReps: 10, isCompleted: true }));
  await act(async () => sheet().props.onFinish(true));
  expect(sheet().props.saved).toBe(true); expect(sheet().props.error).toBe(false); expect(sheet().props.planUpdateError).toBe(true);
  expect(mockFlush.mock.invocationCallOrder[0]).toBeLessThan(mockUpdatePlan.mock.invocationCallOrder[0]);
  const writes = mockFlush.mock.calls.length;
  await act(async () => sheet().props.onRetryPlan());
  expect(mockUpdatePlan).toHaveBeenCalledTimes(2); expect(mockFlush).toHaveBeenCalledTimes(writes);
  expect(sheet().props.planUpdateError).toBe(false);
  await act(async () => tree.unmount());
});
it('does not update a plan or claim completion if the actual-work save fails', async () => {
  mockFlush.mockResolvedValueOnce(false);
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const page = tree.root.findAllByType(ExercisePage)[0], row = page.props.sets[0];
  await act(async () => page.props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: 70, actualReps: 10, isCompleted: true }));
  await act(async () => tree.root.findByType(WorkoutFinishSheet).props.onFinish(true));
  expect(mockUpdatePlan).not.toHaveBeenCalled();
  expect(tree.root.findByType(WorkoutFinishSheet).props).toMatchObject({ saved: false, error: true });
  await act(async () => tree.unmount());
});
it('does not propagate plan changes while performed-history context is still unknown', async () => {
  mockReady = false; let tree: any; await act(async () => { tree = create(<Screen />); });
  const page = tree.root.findAllByType(ExercisePage)[0], row = page.props.sets[0];
  await act(async () => page.props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: 70, actualReps: 10, isCompleted: true }));
  await act(async () => tree.root.findByType(WorkoutFinishSheet).props.onFinish(true));
  expect(mockUpdatePlan).not.toHaveBeenCalled();
  expect(tree.root.findByType(WorkoutFinishSheet).props).toMatchObject({ saved: true, planUpdateError: true, error: false });
  mockReady = true; await act(async () => tree.update(<Screen />));
  await act(async () => tree.root.findByType(WorkoutFinishSheet).props.onRetryPlan());
  expect(mockUpdatePlan).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('does not carry a finish answer into a different workout on the same mounted route', async () => {
  let tree: any; await act(async () => { tree = create(<Screen />); });
  await act(async () => tree.root.findByType(WorkoutFinishSheet).props.onChangeEffort(8));
  expect(tree.root.findByType(WorkoutFinishSheet).props.effortValue).toBe(8);
  mockParams = { ...mockParams, microcycleIndex: '2' };
  await act(async () => tree.update(<Screen />));
  expect(tree.root.findByType(WorkoutFinishSheet).props.effortValue).toBeNull();
  await act(async () => tree.unmount());
});
it('saves the chosen whole-session effort in the same accepted finish write, independently of set intensity', async () => {
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const page = () => tree.root.findAllByType(ExercisePage)[0];
  const row = page().props.sets[0];
  await act(async () => page().props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: 70, actualReps: 10, isCompleted: true }));
  await act(async () => tree.root.findByType(WorkoutFinishSheet).props.onChangeEffort(8));
  await act(async () => tree.root.findByType(WorkoutFinishSheet).props.onFinish(false));
  expect(mockFlush).toHaveBeenCalledWith(expect.any(Number), { sessionFeedback: { scale: 'VIGOR_SESSION_EFFORT_1_10_V1', effort: 8, recordedAt: expect.any(Number), timing: 'AT_FINISH' } });
  expect(tree.root.findByType(WorkoutFinishSheet).props.saved).toBe(true);
  expect(page().props.sets[0].actualRIR).not.toBe(8);
  await act(async () => tree.unmount());
});
it('hydrates the actual execution screen before Finish and keeps first/subsequent timer completions working', async () => {
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const page = () => tree.root.findAllByType(ExercisePage)[0];
  expect(page().props.sets[0]).toMatchObject({ targetWeight: 70, targetReps: 10, targetRIR: 2, previous: { weight: 70, reps: 8, rir: 1 } });
  expect(page().props.sets[1].targetWeight).toBe(67.5);
  for (const index of [0, 1]) {
    const row = page().props.sets[index];
    await act(async () => page().props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: row.targetWeight, actualReps: 10, isCompleted: true }));
    expect(tree.root.findByType(RestTimer).props.state.anchorSetId).toBe(row.id);
    expect(tree.root.findByType(RestTimer).props.state.durationSeconds).toBeGreaterThan(0);
  }
  await act(async () => tree.root.findByType(WorkoutExerciseStrip).props.onExerciseMenu(mockExercises[1].id, { x: 110, y: 140, width: 84, height: 72 }));
  await act(async () => tree.root.findByType(ExerciseQuickMenu).props.onSwap());
  expect(tree.root.findByType(ExerciseSwapSheet).props.current.id).toBe(mockExercises[1].id);
  await act(async () => tree.unmount());
});
it('does not overwrite an edited or cleared load when history arrives late', async () => {
  mockReady = false; let tree: any; await act(async () => { tree = create(<Screen />); });
  const page = () => tree.root.findAllByType(ExercisePage)[0]; const row = page().props.sets[0];
  await act(async () => page().props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: 35 }));
  await act(async () => page().props.onUpdateSet(mockExercises[0].id, row.id, { actualWeight: undefined }));
  mockReady = true; await act(async () => tree.update(<Screen />));
  expect(page().props.sets[0]).toMatchObject({ targetWeight: 0, previous: { weight: 70 } });
  expect(page().props.sets[1].targetWeight).toBe(67.5);
  await act(async () => tree.unmount());
});
