import { Text } from 'react-native';
import { RIRProgressionPreview } from '../RIRProgressionPreview';
import { SetType, type PlannedSession } from '@/models';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const session: PlannedSession = { index: 0, focus: 'UPPER', estimatedWorkMinutes: 15, exercises: ['changed', 'unchanged'].map((exerciseId, order) => ({
  exerciseId, order, isEdited: false, sets: [{ setType: SetType.NORMAL, targetRepsMin: 8, targetReps: 10, targetRIR: 2 }],
})) };
it('shows only the changed exercise and fields while applying through the original callback', async () => {
  const baseline = [{ index: 0, session }, { index: 1, session }];
  const steps = [baseline[0], { index: 1, session: { ...session, exercises: [{ ...session.exercises[0],
    sets: [{ ...session.exercises[0].sets[0], targetRIR: 3 }] }, session.exercises[1]] } }];
  const apply = jest.fn(); let tree: any;
  const render = (proposal: typeof steps) => <RIRProgressionPreview steps={proposal} baseline={baseline} catalogue={new Map()} busy={false} onApply={apply} onClose={jest.fn()} />;
  await act(async () => { tree = create(render(steps)); });
  const text = () => tree.root.findAllByType(Text).map((node: any) => node.props.children).flat(Infinity).join(' ');
  expect(text()).toContain('changed');
  expect(text()).not.toContain('unchanged');
  expect(text()).toContain('progression.diff.targetRIR');
  expect(text()).not.toContain('progression.diff.targetReps');
  const button = () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'progression.apply' && typeof node.props.onPress === 'function')[0];
  await act(async () => button().props.onPress()); expect(apply).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(render(baseline)));
  expect(button().props.disabled).toBe(true);
  expect(text()).toContain('historyProgression.noChanges');
  await act(async () => tree.unmount());
});
