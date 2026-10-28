import React from 'react';
import { Modal } from 'react-native';
import { MicrocycleReviewSheet } from '../MicrocycleReviewSheet';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 12 }) }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
it('starts unanswered, accepts a short partial review and never preselects an effort or readiness value', async () => {
  const save = jest.fn().mockResolvedValue(undefined), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<MicrocycleReviewSheet initial={{}} cycleNumber={1} onSave={save} onSkip={jest.fn()} onClose={close} />); });
  expect(button(tree, 'bio.save').props.disabled).toBe(true);
  expect(tree.root.findAll((node: any) => node.props.accessibilityState?.selected === true)).toHaveLength(0);
  await act(async () => button(tree, 'bio.recovery.USUAL').props.onPress());
  expect(button(tree, 'bio.save').props.disabled).toBe(false);
  await act(async () => button(tree, 'bio.save').props.onPress());
  expect(save).toHaveBeenCalledWith({ recovery: 'USUAL' }); expect(close).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('supports local recovery, separate discomfort and conditional context, clearing hidden pain locations', async () => {
  const save = jest.fn().mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<MicrocycleReviewSheet initial={{}} cycleNumber={2} onSave={save} onSkip={jest.fn()} onClose={jest.fn()} />); });
  await act(async () => button(tree, 'bio.chooseMuscles').props.onPress());
  await act(async () => button(tree, 'muscle.TRICEPS').props.onPress());
  await act(async () => button(tree, 'muscle.TRICEPS').props.onPress());
  await act(async () => button(tree, 'bio.none').props.onPress());
  await act(async () => button(tree, 'bio.discomfort.PRESENT').props.onPress());
  await act(async () => button(tree, 'muscle.CHEST').props.onPress());
  await act(async () => button(tree, 'bio.discomfort.NONE').props.onPress());
  await act(async () => button(tree, 'bio.contextTitle').props.onPress());
  await act(async () => button(tree, 'bio.context.STRESS').props.onPress());
  await act(async () => button(tree, 'bio.context.STRESS').props.onPress());
  await act(async () => button(tree, 'bio.context.TIME').props.onPress());
  await act(async () => button(tree, 'bio.sustainability.TIGHT').props.onPress());
  await act(async () => button(tree, 'bio.save').props.onPress());
  expect(save).toHaveBeenCalledWith({ unrecoveredMuscles: [], discomfort: 'NONE', sustainability: 'TIGHT', context: ['TIME'] });
  await act(async () => tree.unmount());
});
it('retains failed drafts, prevents dismissal while saving and lets retry complete', async () => {
  let resolve!: () => void; const close = jest.fn(), save = jest.fn().mockRejectedValueOnce(Error('offline'))
    .mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; })); let tree: any;
  await act(async () => { tree = create(<MicrocycleReviewSheet initial={{ recovery: 'WORSE' }} cycleNumber={1} onSave={save} onSkip={jest.fn()} onClose={close} />); });
  await act(async () => button(tree, 'bio.save').props.onPress());
  expect(close).not.toHaveBeenCalled(); expect(JSON.stringify(tree.toJSON())).toContain('bio.saveError');
  expect(button(tree, 'bio.recovery.WORSE').props.accessibilityState.selected).toBe(true);
  await act(async () => button(tree, 'bio.save').props.onPress());
  expect(button(tree, 'bio.close').props.disabled).toBe(true);
  await act(async () => tree.root.findByType(Modal).props.onRequestClose()); expect(close).not.toHaveBeenCalled();
  await act(async () => resolve()); expect(close).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
it('offers explicit skip for a new review and cancel never deletes existing feedback', async () => {
  const skip = jest.fn().mockResolvedValue(undefined), close = jest.fn(), save = jest.fn(); let tree: any;
  await act(async () => { tree = create(<MicrocycleReviewSheet initial={{}} cycleNumber={1} onSave={save} onSkip={skip} onClose={close} />); });
  await act(async () => button(tree, 'bio.skip').props.onPress()); expect(skip).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<MicrocycleReviewSheet initial={{ recovery: 'BETTER' }} cycleNumber={1} onSave={save} onSkip={skip} onClose={close} />); });
  expect(button(tree, 'bio.skip')).toBeUndefined(); await act(async () => button(tree, 'generate.cancel').props.onPress());
  expect(skip).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
