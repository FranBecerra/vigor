import React from 'react';
import { WorkoutPersistenceNotice } from '../WorkoutPersistenceNotice';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it('keeps all normal save transitions silent and preserves actionable errors', () => {
  let tree: any;
  act(() => { tree = create(<WorkoutPersistenceNotice status="idle" activityUnavailable={false} />); });
  for (const status of ['saving', 'queued', 'saved', 'idle'] as const) {
    act(() => tree.update(<WorkoutPersistenceNotice status={status} activityUnavailable={false} />));
    expect(tree.toJSON()).toBeNull();
  }
  act(() => tree.update(<WorkoutPersistenceNotice status="error" activityUnavailable />));
  expect(JSON.stringify(tree.toJSON())).toContain('train.saveError');
  act(() => tree.update(<WorkoutPersistenceNotice status="saved" activityUnavailable />));
  expect(JSON.stringify(tree.toJSON())).toContain('workout.activityUnavailable');
  act(() => tree.unmount());
});
