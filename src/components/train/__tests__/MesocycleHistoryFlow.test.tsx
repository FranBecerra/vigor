import React from 'react';
import { Text } from 'react-native';
import Screen from '@/app/(tabs)/(train)/mesocycle';
import { MuscleGroup, SetType } from '@/models';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn();
const exercise = { exerciseId: 'fixture', name: 'Fixture exercise', primaryMuscle: MuscleGroup.CHEST, secondaryMuscles: [],
  restSeconds: 120, repRange: '8–10', targetRIR: 2, sets: [{ setType: SetType.NORMAL, targetRIR: 2 }] };
let mockRoutine: any;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => ({ mesocycleId: 'm' }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0, top: 0 }) }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => ({ routines: [mockRoutine], status: 'ready' }) }));
jest.mock('../SharedNoteButton', () => ({ SharedNoteButton: () => null }));
jest.mock('../MuscleTags', () => ({ MuscleTags: () => null }));
beforeEach(() => {
  jest.clearAllMocks(); mockRoutine = { id: 'r', mesocycleId: 'm', name: 'Plan', objective: 'Hypertrophy', currentMicrocycleIndex: 0,
    microcycles: [0, 1].map((index) => ({ id: `m${index}`, number: index + 1, isDeload: false, isProjected: index > 0,
      sessions: [{ id: `s${index}`, name: 'Upper', plannedSessionIndex: 4, exercises: [exercise] }] })) };
});
const buttons = (tree: any) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function');
const header = (tree: any) => buttons(tree).find((node: any) => node.findAllByType(Text).some((text: any) => Array.isArray(text.props.children) && text.props.children.includes('Upper')));
it('keeps exercise cards non-navigating and opens the pending session from its header', async () => {
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(buttons(tree).some((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === 'Fixture exercise'))).toBe(false);
  await act(async () => header(tree).props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/routine', params: { mesocycleId: 'm', microcycleIndex: '0', plannedSessionIndex: '4' } });
  await act(async () => tree.unmount());
});
it('shows recorded effort, opens its editor and preserves the selected past microcycle after refresh', async () => {
  mockRoutine.currentMicrocycleIndex = 1;
  Object.assign(mockRoutine.microcycles[0].sessions[0], { completedOn: '2026-10-20', completedWorkoutId: 'actual',
    performedExercises: [{ ...exercise, sets: [{ setType: SetType.NORMAL, targetRIR: 4 }, { setType: SetType.NORMAL }] }] });
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const column = buttons(tree).find((node: any) => node.findAllByType(Text).some((text: any) => text.props.children === 'M1'));
  await act(async () => column.props.onPress());
  mockRoutine = { ...mockRoutine }; await act(async () => tree.update(<Screen />));
  expect(JSON.stringify(tree.toJSON())).toContain('meso.recordedSession');
  expect(JSON.stringify(tree.toJSON())).toContain('—');
  await act(async () => header(tree).props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/workout-history', params: { id: 'actual', edit: '1' } });
  await act(async () => tree.unmount());
});
