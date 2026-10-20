import React from 'react';
import { ScrollView } from 'react-native';
import { ExercisePage } from '../ExercisePage';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../SetRow', () => ({ SetRow: () => null, COLUMN_WIDTHS: { set: 1, weight: 1, reps: 1, intensity: 1, done: 1, remove: 1 } }));
jest.mock('../CustomRecordingRows', () => ({ CustomRecordingRows: () => null }));

it('shows a note within its exercise and opens the same note editor on tap', async () => {
  const action = jest.fn(); let tree: any;
  const render = (note: string) => <ExercisePage exercise={EXERCISE_CATALOGUE[0]} sets={[]} scale="RIR" width={390} bottomInset={0}
    note={note} onUpdateSet={jest.fn()} onAddSet={jest.fn()} onPressSetType={jest.fn()} onAction={action} />;
  await act(async () => { tree = create(render('Bench at notch 3')); });
  expect(tree.root.findAll((node: any) => node.props.children === 'Bench at notch 3').length).toBeGreaterThan(0);
  const note = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'train.note' && typeof node.props.onPress === 'function')[0];
  await act(async () => note.props.onPress());
  expect(action).toHaveBeenCalledWith(EXERCISE_CATALOGUE[0].id, 'note');
  await act(async () => tree.update(render('')));
  expect(tree.root.findAll((node: any) => node.props.children === 'Bench at notch 3')).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('keeps offscreen exercise pages out of the accessibility traversal', async () => {
  let tree: any;
  await act(async () => { tree = create(<ExercisePage active={false} exercise={EXERCISE_CATALOGUE[0]} sets={[]} scale="RIR" width={390} bottomInset={0}
    onUpdateSet={jest.fn()} onAddSet={jest.fn()} onPressSetType={jest.fn()} />); });
  expect(tree.root.findByType(ScrollView).props.accessibilityElementsHidden).toBe(true);
  expect(tree.root.findByType(ScrollView).props.importantForAccessibility).toBe('no-hide-descendants');
  await act(async () => tree.unmount());
});
