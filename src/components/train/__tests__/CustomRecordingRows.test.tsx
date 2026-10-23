import React from 'react';
import { CustomRecordingRows } from '../CustomRecordingRows';
import { ExercisePage } from '../ExercisePage';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
const { create, act } = require('react-test-renderer');
jest.mock('../SwipeableSet', () => ({ SwipeableSet: ({ children }: any) => children }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../SetRow', () => ({ SetRow: () => null, COLUMN_WIDTHS: { set: 1, weight: 1, reps: 1, intensity: 1, done: 1, remove: 1 } }));
it('does not render technical descriptions, import annotations or reference links above custom set rows', async () => {
  const exercise = { ...EXERCISE_CATALOGUE[0], isCustom: true, notes: 'Source: Micro 1.html / import', referenceUrl: 'https://example.com/internal-reference', recording: { measure: 'SECONDS' as const, load: 'NONE' as const } };
  let tree: any; await act(async () => { tree = create(<CustomRecordingRows exercise={exercise} sets={[]} update={jest.fn()} />); });
  const output = JSON.stringify(tree.toJSON()); expect(output).not.toContain('Micro 1'); expect(output).not.toContain('internal-reference');
  expect(output).toContain('custom.SECONDS'); await act(async () => tree.unmount());
});
it('uses unit-appropriate controls for a personalized builtin without claiming it is a custom identity', async () => {
  const exercise = { ...EXERCISE_CATALOGUE[0], isPersonalized: true, recording: { measure: 'SECONDS' as const, load: 'LEVEL' as const } };
  let tree: any; await act(async () => { tree = create(<ExercisePage exercise={exercise} sets={[]} scale="RIR" width={390} bottomInset={0}
    onUpdateSet={jest.fn()} onAddSet={jest.fn()} onPressSetType={jest.fn()} />); });
  expect(tree.root.findAllByType(CustomRecordingRows)).toHaveLength(1); await act(async () => tree.unmount());
});
