import React from 'react';
import { TextInput } from 'react-native';
import ExercisesScreen from '@/app/(tabs)/(train)/exercises';
import ExerciseDetailsScreen from '@/app/exercise-details';
import { CustomExerciseSheet } from '../CustomExerciseSheet';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { createCustomExercise } from '@/services/training/customExercises';
import { exerciseEditInput } from '@/services/training/exerciseEditing';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn(); const mockBack = jest.fn(); const mockEdit = jest.fn(); const mockSetNotRecommended = jest.fn();
const mockBase = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'press-banca')!;
const mockCustom = createCustomExercise({ name: 'My hold', recording: { measure: 'SECONDS', load: 'NONE' } }, 'owner', 'custom:owner:a', [], 1);
let mockId = mockBase.id;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: mockId }), useRouter: () => ({ push: mockPush, canGoBack: () => true, back: mockBack }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ catalogue: [mockBase, mockCustom], exercisesById: new Map([[mockBase.id, mockBase], [mockCustom.id, mockCustom]]), ready: true, error: false, edit: mockEdit, create: jest.fn(), archive: jest.fn(), notRecommendedExerciseIds: new Set(), setExerciseNotRecommended: mockSetNotRecommended, preferencesReady: true }), useOptionalExerciseCatalogue: () => null }));
jest.mock('../SharedNoteButton', () => ({ SharedNoteButton: () => null }));
jest.mock('../BodyMap', () => ({ BodyMap: () => null }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => typeof node.props.onPress === 'function'
  && (node.props.accessibilityLabel === label || node.findAll((child: any) => child.props.children === label).length))[0];
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockId = mockBase.id; mockEdit.mockResolvedValue(mockBase); mockSetNotRecommended.mockResolvedValue(undefined); });
afterEach(() => { act(() => jest.runOnlyPendingTimers()); jest.useRealTimers(); });
it('browses the full catalogue outside routine creation and combines the personal filter with search', async () => {
  let tree: any; await act(async () => { tree = create(<ExercisesScreen />); });
  expect(button(tree, mockBase.name)).toBeDefined(); expect(button(tree, mockCustom.name)).toBeDefined();
  await act(async () => button(tree, 'custom.library').props.onPress()); expect(button(tree, mockBase.name)).toBeUndefined();
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('hold')); expect(button(tree, mockCustom.name)).toBeDefined();
  await act(async () => button(tree, mockCustom.name).props.onPress()); expect(mockPush).toHaveBeenCalledWith({ pathname: '/exercise-details', params: { id: mockCustom.id } });
  await act(async () => tree.unmount());
});
it('shows individual criteria and opens the staged editor with the current definition', async () => {
  let tree: any; await act(async () => { tree = create(<ExerciseDetailsScreen />); });
  for (const key of Object.keys(mockBase.criteria!)) expect(JSON.stringify(tree.toJSON())).toContain(`library.criteria.${key}`);
  await act(async () => button(tree, 'library.edit').props.onPress()); expect(tree.root.findByType(CustomExerciseSheet).props.exercise).toEqual(mockBase);
  expect(tree.root.findByProps({ accessibilityLabel: 'custom.name' }).props.value).toBe(mockBase.name);
  await act(async () => tree.unmount());
});
it('lets the exercise library exclude an exercise from future automatic recommendations', async () => {
  let tree: any; await act(async () => { tree = create(<ExerciseDetailsScreen />); });
  await act(async () => button(tree, 'exercisePreference.notRecommend').props.onPress());
  expect(mockSetNotRecommended).toHaveBeenCalledWith(mockBase.id, true);
  await act(async () => tree.unmount());
});
it('edits description and ratings privately without replacing identity or resetting recording fields', async () => {
  let tree: any; const done = jest.fn(); await act(async () => { tree = create(<CustomExerciseSheet open exercise={mockBase} onClose={jest.fn()} onCreated={done} />); });
  for (let step = 0; step < 4; step++) await act(async () => button(tree, 'exerciseWizard.next').props.onPress());
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'library.description' }).props.onChangeText('My setup'));
  await act(async () => button(tree, 'library.criteria.stabilityCost: 5').props.onPress());
  await act(async () => button(tree, 'custom.save').props.onPress());
  expect(mockEdit).toHaveBeenCalledWith(mockBase, expect.objectContaining({ ...exerciseEditInput(mockBase), notes: 'My setup', criteria: { ...mockBase.criteria, stabilityCost: 5 } }));
  expect(done).toHaveBeenCalledWith(mockBase); await act(async () => tree.unmount());
});
