import React from 'react';
import { Pressable, Text, TextInput, Modal } from 'react-native';
import { RehabBlockEditor } from '../RehabBlockEditor';
import { PreWorkoutRehab } from '../PreWorkoutRehab';
import { CustomExerciseSheet } from '../CustomExerciseSheet';
import { ExerciseSwapSheet } from '../generate/ExerciseSwapSheet';
import { NumericField } from '../NumericField';
import { RehabRunner } from '../RehabRunner';
import { createCustomExercise } from '@/services/training/customExercises';
import { localDateKey } from '@/services/training/rehabilitation';
import type { RehabBlock } from '@/models';
const { create, act } = require('react-test-renderer');
const mockCreate = jest.fn();
const mockSaveBlock = jest.fn();
const mockSaveLog = jest.fn();
let mockRehab: any;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ catalogue: [], create: mockCreate }) }));
jest.mock('@/hooks/useRehabilitation', () => ({ useRehabilitation: () => mockRehab }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => ({ routines: [] }) }));

const ex = createCustomExercise({ name: 'Synthetic hold', recording: { measure: 'SECONDS', load: 'NONE' } },
  'owner', 'custom:owner:sample', [], 1);
const block: RehabBlock = { id: 'block', userId: 'owner', version: 1, name: 'Synthetic block', active: true,
  createdAt: 1, updatedAt: 1, schedule: { kind: 'WEEKLY', target: 3 }, items: [{ id: 'item', exerciseId: ex.id,
    exerciseSnapshot: ex, sets: 1, min: 20, max: 30, restSeconds: 15, notes: '' }] };
const button = (root: any, key: string) => root.findAll((node: any) => typeof node.props.onPress === 'function')
  .find((node: any) => node.findAll((child: any) => child.props.children === key).length > 0);

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue(ex); mockSaveBlock.mockResolvedValue(undefined); mockSaveLog.mockResolvedValue(undefined);
  mockRehab = { blocks: [block], logs: [], ready: true, error: false, saveBlock: mockSaveBlock, saveLog: mockSaveLog };
});
it('creates an exercise inside a block, preserves the draft, and saves explicit seconds and frequency', async () => {
  const close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<RehabBlockEditor onClose={close} />); });
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'rehab.name' }).props.onChangeText('My draft');
    tree.root.findAllByType(NumericField).find((node: any) => node.props.accessibilityLabel === 'rehab.timesPerWeek').props.onChangeValue(3);
    button(tree.root, 'generate.addExercise').props.onPress();
  });
  expect(tree.root.findByType(ExerciseSwapSheet).props.open).toBe(true);
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  await act(async () => { button(tree.root, 'custom.createInline').props.onPress(); });
  expect(tree.root.findByType(CustomExerciseSheet).props.open).toBe(true);
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  await act(async () => {
    tree.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === 'custom.name').props.onChangeText('Synthetic hold');
    button(tree.root, 'custom.SECONDS').props.onPress();
  });
  const creator = tree.root.findByType(CustomExerciseSheet);
  for (let step = 0; step < 4; step++) await act(async () => button(creator, 'exerciseWizard.next').props.onPress());
  await act(async () => { await button(creator, 'custom.save').props.onPress(); });
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Synthetic hold', recording: { measure: 'SECONDS', load: 'NONE' } }));
  expect(tree.root.findAllByType(ExerciseSwapSheet)).toHaveLength(0);
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByProps({ accessibilityLabel: 'rehab.name' }).props.value).toBe('My draft');
  await act(async () => {
    for (const [label, value] of [['train.sets', 2], ['rehab.secondsMin', 20], ['rehab.secondsMax', 30]] as const) {
      tree.root.findAllByType(NumericField).find((node: any) => node.props.accessibilityLabel === label).props.onChangeValue(value);
    }
  });
  await act(async () => { await button(tree.root, 'custom.save').props.onPress(); });
  expect(mockSaveBlock).toHaveBeenCalledWith(expect.objectContaining({ name: 'My draft', schedule: { kind: 'WEEKLY', target: 3 },
    items: [expect.objectContaining({ exerciseSnapshot: ex, sets: 2, min: 20, max: 30 })] }));
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('offers due rehabilitation before strength, without advancing or completing a strength session', async () => {
  let tree: any;
  await act(async () => { tree = create(<PreWorkoutRehab workoutKey="workout" />); });
  expect(tree.root.findAllByType(Modal)[0].props.visible).toBe(true);
  await act(async () => { button(tree.root, 'rehab.continueStrength').props.onPress(); });
  expect(tree.root.findAllByType(Modal)[0].props.visible).toBe(false);
  expect(mockSaveLog).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('opens pre-workout execution inside the same native modal and returns without advancing strength', async () => {
  let tree: any;
  await act(async () => { tree = create(<PreWorkoutRehab workoutKey="workout" />); });
  await act(async () => button(tree.root, 'rehab.start').props.onPress());
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(RehabRunner).props.embedded).toBe(true);
  await act(async () => { await button(tree.root, 'rehab.saveProgress').props.onPress(); });
  expect(tree.root.findAllByType(RehabRunner)).toHaveLength(0);
  expect(mockSaveBlock).not.toHaveBeenCalled();
  expect(mockSaveLog).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('records a completed timed block separately and restores it read-only', async () => {
  let tree: any; const close = jest.fn();
  await act(async () => { tree = create(<RehabRunner block={block} workoutKey="workout" onClose={close} />); });
  await act(async () => { tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress(); });
  await act(async () => { await button(tree.root, 'rehab.finish').props.onPress(); });
  expect(mockSaveLog).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', date: localDateKey(new Date()),
    sets: [expect.objectContaining({ actual: 30, recording: { measure: 'SECONDS', load: 'NONE' }, completed: true })] }));
  expect(close).toHaveBeenCalledTimes(1);
  const completed = mockSaveLog.mock.calls[0][0];
  await act(async () => tree.unmount());
  mockRehab.logs = [completed];
  await act(async () => { tree = create(<RehabRunner block={block} onClose={close} />); });
  expect(tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.disabled).toBe(true);
  expect(button(tree.root, 'rehab.finish')).toBeUndefined();
  await act(async () => tree.unmount());
});

it('cancels inline creation back to the picker and block without leaving a native overlay', async () => {
  let tree: any;
  await act(async () => { tree = create(<RehabBlockEditor onClose={jest.fn()} />); });
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'rehab.name' }).props.onChangeText('Retained draft');
    button(tree.root, 'generate.addExercise').props.onPress();
  });
  await act(async () => button(tree.root, 'custom.createInline').props.onPress());
  await act(async () => button(tree.root, 'generate.cancel').props.onPress());
  expect(tree.root.findAllByType(CustomExerciseSheet)).toHaveLength(0);
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  await act(async () => button(tree.root, 'generate.cancel').props.onPress());
  expect(tree.root.findByProps({ accessibilityLabel: 'rehab.name' }).props.value).toBe('Retained draft');
  await act(async () => tree.unmount());
});

it('allows multiple primary targets, excludes them from secondary choices, and recovers after a failed save', async () => {
  let tree: any;
  mockCreate.mockRejectedValueOnce(new Error('saveFailed')).mockResolvedValue(ex);
  const created = jest.fn();
  await act(async () => { tree = create(<CustomExerciseSheet open onClose={jest.fn()} onCreated={created} />); });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'custom.name' }).props.onChangeText('Test exercise'));
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'muscle.CHEST' }).props.onPress();
    tree.root.findByProps({ accessibilityLabel: 'muscle.TRICEPS' }).props.onPress();
  });
  expect(tree.root.findByProps({ accessibilityLabel: 'muscle.CHEST' }).props.accessibilityState.checked).toBe(true);
  expect(tree.root.findByProps({ accessibilityLabel: 'muscle.TRICEPS' }).props.accessibilityState.checked).toBe(true);
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  for (const key of ['custom.equipment', 'custom.profile', 'custom.execution']) {
    expect(tree.root.findAll((node: any) => node.props.children === key).length).toBeGreaterThan(0);
  }
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  await act(async () => {
    button(tree.root, 'custom.movements.PUSH_HORIZONTAL').props.onPress();
    button(tree.root, 'custom.movements.ELBOW_EXTENSION').props.onPress();
  });
  await act(async () => button(tree.root, 'exerciseWizard.back').props.onPress());
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  expect(button(tree.root, 'custom.movements.PUSH_HORIZONTAL').props.accessibilityState.checked).toBe(true);
  expect(button(tree.root, 'custom.movements.ELBOW_EXTENSION').props.accessibilityState.checked).toBe(true);
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  await act(async () => { await button(tree.root, 'custom.save').props.onPress(); });
  expect(created).not.toHaveBeenCalled();
  expect(button(tree.root, 'custom.save').props.disabled).toBe(false);
  expect(button(tree.root, 'generate.cancel').props.disabled).toBe(false);
  await act(async () => { await button(tree.root, 'custom.save').props.onPress(); });
  expect(mockCreate).toHaveBeenLastCalledWith(expect.objectContaining({ primaryMuscles: ['CHEST', 'TRICEPS'], secondaryMuscles: [], movementVectors: ['PUSH_HORIZONTAL', 'ELBOW_EXTENSION'] }));
  expect(created).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('requires a name before advancing and preserves recording choices across wizard navigation', async () => {
  let tree: any;
  await act(async () => { tree = create(<CustomExerciseSheet open onClose={jest.fn()} onCreated={jest.fn()} />); });
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  expect(mockCreate).not.toHaveBeenCalled();
  expect(tree.root.findAll((node: any) => node.props.children === 'custom.invalidName').length).toBeGreaterThan(0);
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'custom.name' }).props.onChangeText('My timed hold');
    button(tree.root, 'custom.SECONDS').props.onPress();
  });
  await act(async () => button(tree.root, 'exerciseWizard.next').props.onPress());
  await act(async () => button(tree.root, 'exerciseWizard.back').props.onPress());
  expect(tree.root.findByProps({ accessibilityLabel: 'custom.name' }).props.value).toBe('My timed hold');
  expect(button(tree.root, 'custom.SECONDS').props.accessibilityState.checked).toBe(true);
  await act(async () => tree.unmount());
});
