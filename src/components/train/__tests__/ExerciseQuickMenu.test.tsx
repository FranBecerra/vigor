import React from 'react';
import { Modal } from 'react-native';
import { ExerciseQuickMenu } from '../ExerciseQuickMenu';
import { exerciseMenuLayout } from '@/services/training/exerciseMenuLayout';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 50, bottom: 30 }) }));
const props = () => ({ exercise: { id: 'a', name: 'Fixture' }, partners: [{ id: 'b', name: 'Partner' }],
  onClose: jest.fn(), onRemove: jest.fn(), onSwap: jest.fn(), onLink: jest.fn(), onUnlink: jest.fn() });
const press = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress();
it('shows exactly three actions in a compact overlay, not a new modal, and swaps/removes explicitly', async () => {
  let tree: any; const handlers = props(); await act(async () => { tree = create(<ExerciseQuickMenu {...handlers} />); });
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Partner');
  await act(async () => press(tree, 'train.swap')); expect(handlers.onSwap).toHaveBeenCalledTimes(1); expect(handlers.onClose).toHaveBeenCalledTimes(1);
  await act(async () => press(tree, 'executionUpdates.removeExercise')); expect(handlers.onRemove).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('opens the partner chooser in place, supports back/unlink and dismisses without changing the workout', async () => {
  let tree: any; const handlers = props(); await act(async () => { tree = create(<ExerciseQuickMenu {...handlers} grouped />); });
  await act(async () => press(tree, 'executionUpdates.superset'));
  expect(JSON.stringify(tree.toJSON())).toContain('Partner'); expect(handlers.onLink).not.toHaveBeenCalled();
  await act(async () => press(tree, 'Partner')); expect(handlers.onLink).toHaveBeenCalledWith('b');
  await act(async () => press(tree, 'generate.back')); expect(JSON.stringify(tree.toJSON())).not.toContain('Partner');
  await act(async () => press(tree, 'executionUpdates.superset'));
  const unlink = tree.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.findAll((child: any) => child.props.children === 'executionUpdates.unlink').length)[0];
  await act(async () => unlink.props.onPress()); expect(handlers.onUnlink).toHaveBeenCalled();
  await act(async () => press(tree, 'generate.cancel')); expect(handlers.onClose).toHaveBeenCalled();
  await act(async () => tree.update(<ExerciseQuickMenu {...handlers} exercise={null} />)); expect(tree.toJSON()).toBeNull();
  await act(async () => tree.unmount());
});
it('keeps floating actions inside portrait and landscape safe bounds', () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) for (const anchor of [undefined, { x: 800, y: 800, width: 84, height: 72 }, { x: NaN, y: NaN, width: 0, height: NaN }, { x: -100, y: -100, width: 84, height: 72 }]) {
    const rect = exerciseMenuLayout(width, height, 48, 34, anchor);
    expect(rect.left).toBeGreaterThanOrEqual(12); expect(rect.left + rect.width).toBeLessThanOrEqual(width - 12);
    expect(rect.top).toBeGreaterThanOrEqual(60); expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(height - 34 - 12);
  }
});
