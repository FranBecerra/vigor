import React from 'react';
import { Modal, TextInput } from 'react-native';
import { WorkoutHistoryEditor } from '../WorkoutHistoryEditor';
import { NumericField } from '../NumericField';
import { SetType, type WorkoutSession } from '@/models';
import { ActionMenuSheet } from '../ActionMenuSheet';
import { SessionEffortInput } from '../SessionEffortInput';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const session: WorkoutSession = { id: 'history', userId: 'owner', performedAt: 1000, completedAt: 5000, mesocycleId: 'm', microcycleId: 'micro', microcycleIndex: 0,
  sessionName: 'Upper', exercises: [{ id: 'entry', exerciseId: 'ex', order: 0, isSwap: false,
    sets: [{ id: 'set', setType: SetType.NORMAL, targetWeight: 20, targetReps: 10, targetRIR: 2, actualWeight: 20, actualReps: 10, isAutoFilled: false }] }] };
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
it('offers inline Save/Cancel at the top, reports unsaved actuals and closes after saving without a navigation modal', async () => {
  const dirty = jest.fn(), close = jest.fn(), savedClose = jest.fn(), save = jest.fn().mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor inline session={session} onSave={save} onClose={close} onSavedClose={savedClose} onDirtyChange={dirty} />); });
  expect(tree.root.findAllByType(Modal).filter((node: any) => node.props.visible)).toHaveLength(0);
  expect(tree.root.findAllByType(SessionEffortInput)).toHaveLength(0);
  await act(async () => button(tree, 'editorFlow.sessionDetails').props.onPress());
  expect(tree.root.findAllByType(SessionEffortInput)).toHaveLength(1);
  await act(async () => button(tree, 'editorFlow.sessionDetails').props.onPress());
  expect(dirty).toHaveBeenLastCalledWith(false);
  await act(async () => tree.root.findAllByType(NumericField)[0].props.onChangeValue(22.5));
  expect(dirty).toHaveBeenLastCalledWith(true); expect(session.exercises[0].sets[0].actualWeight).toBe(20);
  await act(async () => button(tree, 'custom.save').props.onPress());
  expect(savedClose).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('restores, corrects and clears session effort without mutating the original or set intensity', async () => {
  const feedback = { scale: 'VIGOR_SESSION_EFFORT_1_10_V1' as const, effort: 8, recordedAt: 5000, timing: 'AT_FINISH' as const };
  const original = { ...session, sessionFeedback: feedback }; const save = jest.fn().mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={original} onSave={save} onClose={jest.fn()} />); });
  expect(tree.root.findByType(SessionEffortInput).props.value).toBe(8);
  await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(6));
  expect(save).not.toHaveBeenCalled(); expect(original.sessionFeedback.effort).toBe(8);
  await act(async () => button(tree, 'custom.save').props.onPress());
  expect(save.mock.calls[0][0].sessionEffort).toBe(6);
  await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(null));
  await act(async () => button(tree, 'custom.save').props.onPress());
  expect(save.mock.calls[1][0].sessionEffort).toBeNull();
  await act(async () => tree.unmount());
});
it('keeps edits private until Save, retains a failed draft and closes only after a successful save', async () => {
  const save = jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={session} onSave={save} onClose={close} />); });
  await act(async () => tree.root.findAllByType(TextInput)[0].props.onChangeText('Corrected'));
  await act(async () => tree.root.findAllByType(NumericField)[0].props.onChangeValue(35));
  expect(session.exercises[0].sets[0].actualWeight).toBe(20); expect(save).not.toHaveBeenCalled();
  await act(async () => button(tree, 'custom.save').props.onPress()); expect(close).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('historyEdit.failed');
  await act(async () => button(tree, 'custom.save').props.onPress()); expect(close).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[1][0]).toMatchObject({ sessionName: 'Corrected', exercises: [{ sets: [{ actualWeight: 35 }] }] });
  await act(async () => tree.unmount());
});
it('can remove a set from the draft without writing the original', async () => {
  const save = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={session} onSave={save} onClose={jest.fn()} />); });
  await act(async () => button(tree, 'workout.removeSet').props.onPress());
  expect(tree.root.findAllByType(NumericField)).toHaveLength(0); expect(session.exercises[0].sets).toHaveLength(1); expect(save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('offers an explicit save-and-review action only when the completed workout links to a prescribed session', async () => {
  const save = jest.fn().mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={{ ...session, plannedSessionIndex: 0 }} onSave={save} onClose={jest.fn()} />); });
  await act(async () => button(tree, 'historyProgression.saveReview').props.onPress());
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: session.id }), true);
  await act(async () => tree.update(<WorkoutHistoryEditor session={session} onSave={save} onClose={jest.fn()} />));
  expect(button(tree, 'historyProgression.saveReview')).toBeUndefined();
  await act(async () => tree.unmount());
});
it('edits failure and advanced segments explicitly and labels partials without cryptic abbreviations', async () => {
  const save = jest.fn().mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<WorkoutHistoryEditor session={session} onSave={save} onClose={jest.fn()} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('trainingUpdates.partials');
  expect(JSON.stringify(tree.toJSON())).not.toContain('+ P');
  await act(async () => button(tree, 'prescription.setType').props.onPress());
  await act(async () => tree.root.findByType(ActionMenuSheet).props.actions.find((item: any) => item.label === 'setType.FAILURE').onPress());
  expect(tree.root.findAllByType(NumericField).find((node: any) => node.props.accessibilityLabel === 'RIR').props).toMatchObject({ value: 0, editable: false });
  await act(async () => button(tree, 'custom.save').props.onPress());
  expect(save.mock.calls[0][0].exercises[0].sets[0]).toMatchObject({ setType: SetType.FAILURE, actualRIR: 0 });
  await act(async () => button(tree, 'prescription.setType').props.onPress());
  await act(async () => tree.root.findByType(ActionMenuSheet).props.actions.find((item: any) => item.label === 'setType.DROP_SET').onPress());
  await act(async () => tree.root.findAllByType(NumericField).find((node: any) => node.props.accessibilityLabel === 'train.extension 1').props.onChangeValue(4));
  await act(async () => tree.root.findAllByType(NumericField).find((node: any) => node.props.accessibilityLabel === 'KG 1').props.onChangeValue(15));
  await act(async () => button(tree, 'custom.save').props.onPress());
  expect(save.mock.calls[1][0].exercises[0].sets[0]).toMatchObject({ setType: SetType.DROP_SET, extensions: [{ weight: 15, reps: 4 }] });
  await act(async () => tree.unmount());
});
