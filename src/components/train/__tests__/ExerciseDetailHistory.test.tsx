import { Text } from 'react-native';
import { ExerciseDetailSheet } from '../ExerciseDetailSheet';
import { exerciseHistory } from '@/services/training/exerciseHistory';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { SetType, type WorkoutSession } from '@/models';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../BodyMap', () => ({ BodyMap: () => null }));
const exercise = EXERCISE_CATALOGUE[0];
const history: WorkoutSession[] = [1, 2].map(day => ({ id: `workout-${day}`, userId: 'u', mesocycleId: 'm', microcycleId: 'mi',
  microcycleIndex: day, sessionName: `Session ${day}`, performedAt: day * 1000, completedAt: day * 1000 + 1,
  exercises: [{ id: 'entry', exerciseId: exercise.id, order: 0, isSwap: false, sets: [
    { id: 'actual', setType: SetType.NORMAL, targetReps: 99, targetWeight: 999, targetRIR: 4,
      actualReps: 11, actualWeight: 75, actualRIR: 2, completionState: 'DONE', isAutoFilled: false },
  ] }],
}));
const entries = exerciseHistory('u', exercise.id, history, new Map(), 10000);

it('shows the chosen continuous history inside Info and closes directly without navigation', async () => {
  const onClose = jest.fn(); let tree: any;
  const render = (ready: boolean, data = entries) => <ExerciseDetailSheet exercise={exercise} mode="info" note=""
    onNote={jest.fn()} onClose={onClose} history={data} historyReady={ready} />;
  await act(async () => { tree = create(render(true)); });
  const text = () => tree.root.findAllByType(Text).map((node: any) => node.props.children).flat(Infinity).join(' ');
  expect(text()).toContain('exerciseHistory.title');
  expect(text().indexOf('Session 2')).toBeLessThan(text().indexOf('Session 1'));
  expect(text()).toContain('75'); expect(text()).toContain('11'); expect(text()).toContain('RIR');
  expect(text()).not.toContain('999'); expect(text()).not.toContain('99');
  const close = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.done' && typeof node.props.onPress === 'function')[0];
  await act(async () => close.props.onPress()); expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(render(false, [])));
  expect(text()).toContain('exerciseHistory.unavailable'); expect(text()).not.toContain('Session 2');
  await act(async () => tree.update(render(true, [])));
  expect(text()).toContain('exerciseHistory.empty');
  await act(async () => tree.unmount());
});

it('does not leak exercise history into note editing or retain it when switching exercises', async () => {
  let tree: any; const other = EXERCISE_CATALOGUE[1];
  await act(async () => { tree = create(<ExerciseDetailSheet exercise={exercise} mode="note" note="My note" onNote={jest.fn()}
    onClose={jest.fn()} history={entries} historyReady />); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Session 2');
  await act(async () => tree.update(<ExerciseDetailSheet exercise={other} mode="info" note="" onNote={jest.fn()}
    onClose={jest.fn()} history={exerciseHistory('u', other.id, history, new Map(), 10000)} historyReady />));
  expect(JSON.stringify(tree.toJSON())).toContain('exerciseHistory.empty');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Session 2');
  await act(async () => tree.unmount());
});
