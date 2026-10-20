import React from 'react';
import * as RN from 'react-native';
import GenerateScreen from '@/app/(tabs)/(train)/generate';
import { GenerationChoice, PriorityBudget } from '../generate/GenerationChoice';
import { Stepper } from '../generate/GenerateControls';
import { EquipmentIllustration } from '../generate/EquipmentIllustration';
import { SplitDiagram } from '../generate/SplitDiagram';
import { SplitStructure } from '@/models';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn();
let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, canGoBack: () => false, replace: jest.fn() }), Stack: { Screen: () => null } }));
jest.mock('react-native-reanimated', () => ({ __esModule: true,
  default: { View: require('react-native').View },
  useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: (style: () => unknown) => style(),
  withTiming: (value: unknown) => value,
}));
jest.mock('react-native-screens/experimental', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ catalogue: [], exercisesById: new Map() }) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: {}, routineRepository: {}, workoutSessionRepository: {} }));
const press = (tree: any, key: string) => tree.root.findAll((node: any) => typeof node.props.onPress === 'function' &&
  node.findAllByType(RN.Text).some((text: any) => text.props.children === key))[0].props.onPress();
beforeEach(() => { mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 }; });

it('keeps emphasis state across steps, aligns help inline and illustrates every equipment option', async () => {
  let tree: any;
  await act(async () => { tree = create(<GenerateScreen />); });
  for (let index = 0; index < 2; index++) await act(async () => press(tree, 'exerciseWizard.next'));
  expect(tree.root.findByType(PriorityBudget).props.hint).toBe('generate.budgetHint');
  const chips = () => tree.root.findAll((node: any) => node.props.cornerBadge && node.props.label && typeof node.props.onPress === 'function');
  expect(chips().length).toBeGreaterThan(10);
  expect(chips()[0].props.style.width).toBe('48%'); expect(chips()[0].props.style.minHeight).toBe(106);
  await act(async () => chips()[0].props.onPress());
  expect(tree.root.findByType(PriorityBudget).props.used).toBeGreaterThan(0);
  await act(async () => press(tree, 'exerciseWizard.next'));
  const materials = tree.root.findAllByType(GenerationChoice);
  expect(materials).toHaveLength(13); expect(materials.every((node: any) => node.props.selected)).toBe(true);
  expect(tree.root.findAllByType(EquipmentIllustration)).toHaveLength(13);
  expect(materials.every((node: any) => node.props.description.startsWith('generate.equipmentHelp.'))).toBe(true);
  await act(async () => materials[0].props.onPress());
  await act(async () => press(tree, 'generate.back'));
  expect(tree.root.findByType(PriorityBudget).props.used).toBeGreaterThan(0);
  await act(async () => press(tree, 'exerciseWizard.next'));
  expect(tree.root.findAllByType(GenerationChoice)[0].props.selected).toBe(false);
  await act(async () => press(tree, 'exerciseWizard.next'));
  await act(async () => tree.root.findAllByType(Stepper).find((node: any) => node.props.label === 'generate.sessions').props.onChange(5));
  await act(async () => press(tree, 'exerciseWizard.next'));
  expect(tree.root.findAllByType(SplitDiagram)).toHaveLength(4);
  expect(tree.root.findAllByType(SplitDiagram).every((node: any) => node.props.sessions === 5)).toBe(true);
  expect(tree.root.findAllByType(SplitDiagram).map((node: any) => node.props.split)).not.toContain(SplitStructure.PUSH_PULL_LEGS_UPPER);
  await act(async () => tree.unmount());
});
it('falls back to a readable single column with large accessibility text', async () => {
  mockDimensions = { ...mockDimensions, fontScale: 1.6 };
  let tree: any;
  await act(async () => { tree = create(<GenerateScreen />); });
  for (let index = 0; index < 2; index++) await act(async () => press(tree, 'exerciseWizard.next'));
  const chip = tree.root.findAll((node: any) => node.props.cornerBadge && node.props.label && typeof node.props.onPress === 'function')[0];
  expect(chip.props.style.width).toBe('100%'); expect(chip.props.style.minHeight).toBe(82);
  await act(async () => tree.unmount());
});
