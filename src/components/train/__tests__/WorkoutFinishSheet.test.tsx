import React from 'react';
import { Modal, Text } from 'react-native';
import { WorkoutFinishSheet } from '../WorkoutFinishSheet';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SessionEffortInput } from '../SessionEffortInput';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../BodyMap', () => ({ BodyMap: () => null }));
const summary = { completed: 1, pending: 0, tonnage: 200, volumes: [], records: [], recordSetIds: [] };
const exercise = EXERCISE_CATALOGUE[0];
const press = (tree: any, label: string) => tree.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.findAllByType(Text).some((text: any) => text.props.children === label))[0].props.onPress();
it('offers optional effort only for completed work before saving and never blocks saving without an answer', async () => {
  const finish = jest.fn(), change = jest.fn(); let tree: any;
  const props = { open: true, saved: false, busy: false, error: false, summary, exercises: [], changed: false, historyReady: true, onFinish: finish, onClose: jest.fn(), onChangeEffort: change };
  await act(async () => { tree = create(<WorkoutFinishSheet {...props} />); });
  expect(tree.root.findByType(SessionEffortInput).props.value).toBeNull();
  await act(async () => press(tree, 'workout.saveWorkout'));
  expect(finish).toHaveBeenCalledWith(false); expect(change).not.toHaveBeenCalled();
  await act(async () => tree.update(<WorkoutFinishSheet {...props} busy effortValue={7} />));
  expect(tree.root.findByType(SessionEffortInput).props.disabled).toBe(true);
  await act(async () => tree.update(<WorkoutFinishSheet {...props} saved effortValue={7} />));
  expect(tree.root.findAllByType(SessionEffortInput)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('sessionEffort.summary');
  await act(async () => tree.update(<WorkoutFinishSheet {...props} summary={{ ...summary, completed: 0 }} />));
  expect(tree.root.findAllByType(SessionEffortInput)).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('previews exact changes without applying them, then requires the explicit update action', async () => {
  const finish = jest.fn(), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutFinishSheet open saved={false} busy={false} error={false} summary={summary} exercises={[exercise]} changed historyReady
    changes={[{ kind: 'sets', exercise, exerciseId: exercise.id, before: 3, after: 4 }]} onFinish={finish} onClose={close} />); });
  await act(async () => press(tree, 'trainingUpdates.changes'));
  expect(tree.root.findAllByType(Modal)[1].props.visible).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('3 → 4'); expect(finish).not.toHaveBeenCalled();
  await act(async () => tree.root.findAllByType(Modal)[1].props.onRequestClose());
  expect(tree.root.findAllByType(Modal)[1].props.visible).toBe(false);
  await act(async () => press(tree, 'workout.finishAndUpdate')); expect(finish).toHaveBeenCalledWith(true);
  await act(async () => tree.unmount());
});
it('closes a saved summary only through the completion callback', async () => {
  const close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutFinishSheet open saved busy={false} error={false} summary={summary} exercises={[]} changed={false} historyReady onFinish={jest.fn()} onClose={close} />); });
  await act(async () => press(tree, 'workout.done')); expect(close).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('distinguishes a failed optional plan update from a successfully saved workout', async () => {
  const retry = jest.fn(); let tree: any;
  await act(async () => { tree = create(<WorkoutFinishSheet open saved busy={false} error={false} summary={summary} exercises={[]} changed historyReady
    planUpdateError onRetryPlan={retry} onFinish={jest.fn()} onClose={jest.fn()} />); });
  const output = JSON.stringify(tree.toJSON()); expect(output).toContain('finishPlanUpdate.failed'); expect(output).not.toContain('workout.finishError');
  await act(async () => press(tree, 'finishPlanUpdate.retry')); expect(retry).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
