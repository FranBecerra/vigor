import React from 'react';
import { TextInput, Pressable, Modal } from 'react-native';
import ManualRoutineScreen from '@/app/(tabs)/(train)/manual-routine';
import CreateRoutineScreen from '@/app/(tabs)/(train)/create-routine';
import { PlanPreview } from '../generate/PlanPreview';
import { ExerciseSwapSheet } from '../generate/ExerciseSwapSheet';
import { Stepper } from '../generate/GenerateControls';
import { NumericField } from '../NumericField';
import { MusclePicture } from '../MusclePicture';
import { ScheduleTemplateView } from '../ScheduleTemplateView';
import { Equipment, MuscleGroup, SetType } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { createCustomExercise } from '@/services/training/customExercises';
const { create, act } = require('react-test-renderer');
const mockRouter = { push: jest.fn(), dismissTo: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
const mockList = jest.fn(), mockRoutine = jest.fn(), mockMesocycle = jest.fn();
const mockCatalogue = [
  { ...EXERCISE_CATALOGUE[0], id: 'free', name: 'Free chest', primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: [], equipment: Equipment.DUMBBELL },
  { ...EXERCISE_CATALOGUE[0], id: 'machine', name: 'Machine chest', primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: [], equipment: Equipment.MACHINE },
];
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-screens/experimental', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: any) =>
  key === 'generate.previewSession' ? `Session ${options.index}` : key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'u' }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ catalogue: mockCatalogue,
  exercisesById: new Map(mockCatalogue.map((ex) => [ex.id, ex])), create: jest.fn() }), useOptionalExerciseCatalogue: () => null }));
jest.mock('@/services/repositories', () => ({
  routineRepository: { listByUser: (...args: unknown[]) => mockList(...args), create: (...args: unknown[]) => mockRoutine(...args) },
  mesocycleRepository: { create: (...args: unknown[]) => mockMesocycle(...args) },
}));
jest.mock('@/components/GlassSurface', () => ({ GlassSurface: ({ children }: any) => children }));
jest.mock('@/components/train/MuscleVolumeCard', () => ({ MuscleVolumeCard: () => null }));
jest.mock('@/components/train/ScheduleTemplateView', () => ({ ScheduleTemplateView: () => null }));
const button = (root: any, label: string) => root.findAll((node: any) => typeof node.props.onPress === 'function')
  .find((node: any) => node.findAll((child: any) => child.props.children === label).length > 0);
// React Native's Jest host mocks forward accessibility props through multiple wrappers.
const leafMatches = (root: any, predicate: (node: any) => boolean) => root.findAll(predicate)
  .filter((node: any) => node.findAll(predicate).length === 1);
beforeEach(() => { jest.clearAllMocks(); mockList.mockResolvedValue([]); mockRoutine.mockResolvedValue(undefined); mockMesocycle.mockResolvedValue(undefined); });
it('offers both modes before opening a builder', async () => {
  let tree: any;
  await act(async () => { tree = create(<CreateRoutineScreen />); });
  await act(async () => button(tree.root, 'routineCreation.MANUAL').props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/manual-routine');
  await act(async () => button(tree.root, 'routineCreation.AUTOMATIC').props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/generate');
  await act(async () => tree.unmount());
});
it('keeps additions while switching tabs and persists a manual routine containing an inline-created exercise', async () => {
  let tree: any;
  await act(async () => { tree = create(<ManualRoutineScreen />); });
  await act(async () => {
    tree.root.findAllByType(Stepper).find((node: any) => node.props.label === 'generate.sessions').props.onChange(1);
    tree.root.findByProps({ accessibilityLabel: 'generate.name' }).props.onChangeText('Manual test');
  });
  await act(async () => tree.root.findByType(PlanPreview).props.onAdd(0));
  const custom = createCustomExercise({ name: 'New hold', recording: { measure: 'SECONDS', load: 'NONE' } }, 'u', 'custom:u:new', [], 1);
  await act(async () => tree.root.findByType(ExerciseSwapSheet).props.onSelect(custom));
  expect(tree.root.findByType(PlanPreview).props.sessions[0].exercises[0].exerciseSnapshot).toEqual(custom);
  await act(async () => button(tree.root, 'routineCreation.overview').props.onPress());
  expect(tree.root.findByType(PlanPreview).props.sessions[0].exercises).toHaveLength(1);
  await act(async () => button(tree.root, 'generate.save').props.onPress());
  expect(mockMesocycle).toHaveBeenCalledWith(expect.objectContaining({ prescriptionMode: 'MANUAL', plannedSessions: [expect.objectContaining({
    exercises: [expect.objectContaining({ exerciseId: custom.id })] })] }));
  expect(mockRoutine).toHaveBeenCalledWith(expect.objectContaining({ name: 'Manual test', generation: expect.objectContaining({ creationMode: 'MANUAL' }) }));
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(train)');
  await act(async () => tree.unmount());
});
it('shows only the selected session or overview, and recovers when the selected session is removed', async () => {
  const sessions = [0, 1].map((index) => ({ index, focus: 'FULL_BODY' as const, exercises: [], estimatedWorkMinutes: 0 }));
  const add = jest.fn(); let tree: any;
  const render = (entries: typeof sessions) => <PlanPreview sessionTabs sessions={entries} performedSets={0} exercisesById={new Map()} onAdd={add} />;
  await act(async () => { tree = create(render(sessions)); });
  expect(leafMatches(tree.root, (node) => node.props.accessibilityRole === 'tab' && node.props.accessibilityState.selected)).toHaveLength(1);
  await act(async () => button(tree.root, 'generate.focusFULL_BODY B').props.onPress());
  const addButtons = leafMatches(tree.root, (node) => node.props.accessibilityLabel === 'generate.addExercise');
  expect(addButtons).toHaveLength(1);
  await act(async () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'generate.addExercise' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(add).toHaveBeenCalledWith(1);
  await act(async () => tree.update(render([sessions[0]])));
  expect(leafMatches(tree.root, (node) => node.props.accessibilityRole === 'tab' && node.props.accessibilityState.selected)).toHaveLength(1);
  await act(async () => tree.unmount());
});
it('does not invent rest days for a single session and displays its actual default rest rather than zero', async () => {
  const exercise = EXERCISE_CATALOGUE[0]; let tree: any;
  await act(async () => { tree = create(<PlanPreview sessions={[{ index: 0, focus: 'UPPER', estimatedWorkMinutes: 15,
    exercises: [{ exerciseId: exercise.id, order: 0, isEdited: false, sets: [{ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 }] }] }]}
    performedSets={1} exercisesById={new Map([[exercise.id, exercise]])} onChangeRest={jest.fn()} />); });
  expect(tree.root.findAllByType(ScheduleTemplateView)).toHaveLength(0);
  expect(tree.root.findAllByType(NumericField).find((node: any) => node.props.accessibilityLabel === 'exerciseEditor.restSeconds').props.value)
    .toBe(require('@/services/training/restTimer').restDurationFor(exercise.profile));
  await act(async () => tree.unmount());
});
it('keeps a minimum of six while typing twelve, and edits each manual RIR independently', async () => {
  let tree: any;
  await act(async () => { tree = create(<ManualRoutineScreen />); });
  await act(async () => tree.root.findByType(PlanPreview).props.onAdd(0));
  await act(async () => tree.root.findByType(ExerciseSwapSheet).props.onSelect(mockCatalogue[0]));
  const field = (label: string) => ({ props: { onChangeText: (text: string) => {
    const preview = tree.root.findByType(PlanPreview).props;
    if (label.startsWith('RIR')) preview.onChangeSet(0, 0, Number(label.split(' ')[1]) - 1, { targetRIR: Number(text) });
    else if (label === 'exerciseEditor.restSeconds') preview.onChangeRest(0, 0, Number(text));
    else preview.onChangeSet(0, 0, 0, { targetReps: Number(text) });
  } } });
  const prescription = () => tree.root.findByType(PlanPreview).props.sessions[0].exercises[0];
  expect(prescription().sets[0].targetRepsMin).toBe(6);
  await act(async () => field('generate.previewRepMax').props.onChangeText('1'));
  expect(prescription().sets[0].targetRepsMin).toBe(6);
  await act(async () => field('generate.previewRepMax').props.onChangeText('12'));
  expect(prescription().sets[0].targetRepsMin).toBe(6);
  expect(prescription().sets[0].targetReps).toBe(12);
  await act(async () => field('RIR 3').props.onChangeText('0'));
  expect(prescription().sets.map((set: any) => set.targetRIR)).toEqual([2, 2, 0]);
  await act(async () => field('RIR 2').props.onChangeText('1'));
  expect(prescription().sets.map((set: any) => set.targetRIR)).toEqual([2, 1, 0]);
  await act(async () => field('exerciseEditor.restSeconds').props.onChangeText('180'));
  expect(prescription().restSeconds).toBe(180);
  expect(prescription().sets.map((set: any) => set.targetRIR)).toEqual([2, 1, 0]);
  await act(async () => tree.unmount());
});
it('retains the manual draft after a save failure and retries with the same document identities', async () => {
  mockRoutine.mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  let tree: any;
  await act(async () => { tree = create(<ManualRoutineScreen />); });
  await act(async () => {
    tree.root.findAllByType(Stepper).find((node: any) => node.props.label === 'generate.sessions').props.onChange(1);
    tree.root.findByProps({ accessibilityLabel: 'generate.name' }).props.onChangeText('Retry test');
  });
  await act(async () => tree.root.findByType(PlanPreview).props.onAdd(0));
  await act(async () => tree.root.findByType(ExerciseSwapSheet).props.onSelect(mockCatalogue[0]));
  await act(async () => button(tree.root, 'generate.save').props.onPress());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityLabel: 'generate.name' }).props.value).toBe('Retry test');
  expect(tree.root.findByType(PlanPreview).props.sessions[0].exercises).toHaveLength(1);
  await act(async () => button(tree.root, 'generate.save').props.onPress());
  expect(mockMesocycle.mock.calls[0][0].id).toBe(mockMesocycle.mock.calls[1][0].id);
  expect(mockRoutine.mock.calls[0][0].id).toBe(mockRoutine.mock.calls[1][0].id);
  expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('intersects muscle, material and query filters, then resets them on reopening', async () => {
  let tree: any;
  const render = (open: boolean) => <ExerciseSwapSheet open={open} current={null} candidates={mockCatalogue} onSelect={jest.fn()} onClose={jest.fn()} />;
  await act(async () => { tree = create(render(true)); });
  await act(async () => button(tree.root, 'picker.targetMuscle').props.onPress());
  await act(async () => { button(tree.root, 'muscle.CHEST').props.onPress(); button(tree.root, 'picker.MACHINES').props.onPress(); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Free chest' })).toHaveLength(0);
  expect(leafMatches(tree.root, (node) => node.props.accessibilityLabel === 'Machine chest')).toHaveLength(1);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('absent'));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Machine chest' })).toHaveLength(0);
  await act(async () => tree.update(render(false)));
  await act(async () => tree.update(render(true)));
  expect(leafMatches(tree.root, (node) => node.props.accessibilityLabel === 'Free chest')).toHaveLength(1);
  await act(async () => tree.unmount());
});

it('does not mount a hidden catalogue or anatomical illustrations per result row', async () => {
  const candidates = Array.from({ length: 200 }, (_, index) => ({ ...mockCatalogue[0], id: `exercise-${index}`, name: `Exercise ${index}` }));
  let tree: any;
  const render = (open: boolean) => <ExerciseSwapSheet open={open} current={null} candidates={candidates} onSelect={jest.fn()} onClose={jest.fn()} />;
  await act(async () => { tree = create(render(false)); });
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await act(async () => tree.update(render(true)));
  expect(tree.root.findByType(Modal).props.animationType).toBe('none');
  const mounted = leafMatches(tree.root, (node) => /^Exercise \d+$/.test(node.props.accessibilityLabel ?? ''));
  expect(mounted.length).toBeGreaterThan(0); expect(mounted.length).toBeLessThan(30);
  expect(tree.root.findAllByType(MusclePicture)).toHaveLength(0);
  await act(async () => button(tree.root, 'picker.targetMuscle').props.onPress());
  expect(tree.root.findAllByType(MusclePicture).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
});

it('keeps a batch selected across muscle filters and search before adding once', async () => {
  const add = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ExerciseSwapSheet open mode="add" current={null} candidates={mockCatalogue}
    onSelect={jest.fn()} onSelectMany={add} onClose={jest.fn()} />); });
  const exerciseButton = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await act(async () => exerciseButton('Free chest').props.onPress());
  await act(async () => button(tree.root, 'picker.MACHINES').props.onPress());
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('machine'));
  await act(async () => exerciseButton('Machine chest').props.onPress());
  await act(async () => button(tree.root, 'workout.addSelected').props.onPress());
  expect(add).toHaveBeenCalledWith(mockCatalogue);
  await act(async () => tree.unmount());
});
