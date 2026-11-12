import { Text } from 'react-native';
import { MesocycleContinuityFlow } from '../MesocycleContinuityFlow';
import { continuityAutomaticFixture, continuityComparisonFixture, continuityFixture } from '@/test-support/continuityFixture';
const { create, act } = require('react-test-renderer');

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

const action = (tree: any, label: string) => tree.root.findAll((node: any) =>
  node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
  && (node.props.accessibilityLabel === label || node.findAllByType(Text).some((text: any) => text.props.children === label)))[0];

it('shows a compact comparison with only one brief microcycle detail open at a time', async () => {
  const { data, exercises, feedback } = continuityComparisonFixture();
  const save = jest.fn();
  let tree: any;
  await act(async () => { tree = create(<MesocycleContinuityFlow data={data} catalogue={exercises} feedback={feedback}
    onCancel={jest.fn()} onReload={jest.fn()} onSave={save} />); });
  const content = () => JSON.stringify(tree.toJSON());
  const rows = () => tree.root.findAll((node: any) => node.type === 'View' && typeof node.props.onClick === 'function'
    && node.props.accessibilityLabel === 'continuity.comparison.row');
  const buttons = () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'continuity.comparison.row'
    && typeof node.props.onPress === 'function');
  expect(rows()).toHaveLength(4);
  expect(content()).toContain('continuity.comparison.reviewRir');
  expect(content()).not.toContain('continuity.comparison.detail');
  await act(async () => buttons()[0].props.onPress());
  expect(content()).toContain('continuity.comparison.noPairs');
  expect(buttons()[0].props.accessibilityState.expanded).toBe(true);
  await act(async () => buttons()[2].props.onPress());
  expect(buttons()[0].props.accessibilityState.expanded).toBe(false);
  expect(buttons()[2].props.accessibilityState.expanded).toBe(true);
  expect(content()).toContain('continuity.comparison.rir');
  expect(content()).toContain('continuity.comparison.coverage');
  expect(content()).not.toContain('continuity.comparison.noPairs');
  await act(async () => buttons()[2].props.onPress());
  expect(content()).not.toContain('continuity.comparison.detail');
  expect(save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('reviews both steps and keeps duration and the baseline prescription when save fails', async () => {
  const { data, exercises } = continuityFixture();
  const save = jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(undefined);
  const cancel = jest.fn();
  let tree: any;
  await act(async () => { tree = create(<MesocycleContinuityFlow data={data} catalogue={exercises} onCancel={cancel} onReload={jest.fn()} onSave={save} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('continuity.HIGHER');
  await act(async () => action(tree, 'continuity.prepare').props.onPress());
  expect(save).not.toHaveBeenCalled();
  expect(tree.root.findAll((node: any) => node.props.accessibilityRole === 'checkbox')).toHaveLength(0);
  await act(async () => action(tree, 'continuity.more').props.onPress());
  await act(async () => action(tree, 'continuity.activate').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('continuity.saveError');
  await act(async () => action(tree, 'continuity.retry').props.onPress());
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  expect(save.mock.calls[1][0]).toEqual({ reason: 'COMPLETED', microcycles: 5 });
  await act(async () => tree.unmount());
});

it('blocks the next step on a resumable draft and permits cancellation', async () => {
  const { data, exercises } = continuityFixture();
  data.history[0] = { ...data.history[0], completedAt: undefined };
  const cancel = jest.fn(), save = jest.fn();
  let tree: any;
  await act(async () => { tree = create(<MesocycleContinuityFlow data={data} catalogue={exercises} onCancel={cancel} onReload={jest.fn()} onSave={save} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('continuity.blocked');
  expect(action(tree, 'continuity.prepare').props.disabled).toBe(true);
  await act(async () => action(tree, 'continuity.cancel').props.onPress());
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('explains automatic progression on preparation and updates the explanation for one loading cycle', async () => {
  const { data, exercises } = continuityAutomaticFixture();
  let tree: any;
  await act(async () => { tree = create(<MesocycleContinuityFlow data={data} catalogue={exercises}
    onCancel={jest.fn()} onReload={jest.fn()} onSave={jest.fn()} />); });
  await act(async () => action(tree, 'continuity.prepare').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('continuity.automaticProgression');
  expect(JSON.stringify(tree.toJSON())).not.toContain('continuity.fixedDose');
  for (let index = 0; index < 3; index++) await act(async () => action(tree, 'continuity.fewer').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('continuity.automaticSingleCycle');
  expect(JSON.stringify(tree.toJSON())).not.toContain('continuity.automaticProgression');
  await act(async () => tree.unmount());
});
