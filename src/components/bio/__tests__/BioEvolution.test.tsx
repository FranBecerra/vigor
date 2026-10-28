import React from 'react';
import { BioEvolution } from '../BioEvolution';
import { BioVolumeReview } from '../BioVolumeReview';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { MuscleGroup, SetType } from '@/models';
const { create, act } = require('react-test-renderer');
let mockDaily: any = { ready: true, error: false, entries: [] }; const mockReload = jest.fn();
jest.mock('@/hooks/useBioDailyHistory', () => ({ useBioDailyHistory: () => ({ ...mockDaily, reload: mockReload }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
const exercise = EXERCISE_CATALOGUE[0], catalogue = new Map([[exercise.id, exercise]]);
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = (tree: any) => JSON.stringify(tree.toJSON());
it('switches actual-work granularities and exposes daily context/errors and observed exercise results without writes', async () => {
  const history: any[] = Array.from({ length: 10 }, (_, index) => ({ id: `workout${index}`, userId: 'owner', mesocycleId: 'plan', microcycleIndex: index,
    performedAt: 1000 + index * 86400000, completedAt: 61000 + index * 86400000,
    exercises: [{ id: 'entry', exerciseId: exercise.id, exerciseSnapshot: exercise, order: 0, sets: [{ id: 'set', setType: SetType.NORMAL,
      actualWeight: 40 + index, actualReps: 10, actualRIR: 2, completionState: 'DONE' }] }] }));
  let tree: any; await act(async () => { tree = create(<BioEvolution owner="owner" history={history} catalogue={catalogue} />); });
  expect(button(tree, 'bioEvolution.moreWork')).toBeDefined(); await act(async () => button(tree, 'bioEvolution.moreWork').props.onPress());
  expect(button(tree, 'bioEvolution.moreWork')).toBeUndefined();
  await act(async () => button(tree, 'bioEvolution.SESSION').props.onPress()); expect(text(tree)).toContain('bioEvolution.credit');
  await act(async () => button(tree, 'bioEvolution.performance').props.onPress()); expect(text(tree)).toContain('bioEvolution.unknownEffort');
  expect(tree.root.findAll((node: any) => Array.isArray(node.props.children) && node.props.children.join('') === '49 kg × 10')).not.toHaveLength(0);
  mockDaily = { ready: true, error: true, entries: [] };
  await act(async () => button(tree, 'bioEvolution.daily').props.onPress()); await act(async () => tree.update(<BioEvolution owner="owner" history={history} catalogue={catalogue} />));
  await act(async () => button(tree, 'bio.retry').props.onPress()); expect(mockReload).toHaveBeenCalled();
  mockDaily = { ready: true, error: false, entries: [{ id: 'date', localDate: '2026-10-26', answers: { recovery: 'USUAL', discomfort: 'PRESENT' } }] };
  await act(async () => tree.update(<BioEvolution owner="owner" history={history} catalogue={catalogue} />)); expect(text(tree)).toContain('dailyCheckIn.PRESENT');
  await act(async () => tree.unmount());
});
it('shows missing observations and separate dose-review explanations rather than an invented recommendation', async () => {
  let tree: any; await act(async () => { tree = create(<BioVolumeReview items={[]} />); }); expect(text(tree)).toContain('bioDose.empty');
  await act(async () => tree.update(<BioVolumeReview items={[{ muscle: MuscleGroup.CHEST, reason: 'DISCOMFORT', action: 'REVIEW', observations: 0, cycleIndexes: [1], exerciseIds: [] }]} />));
  expect(text(tree)).toContain('bioDose.DISCOMFORT'); expect(text(tree)).toContain('bioDose.REVIEW'); expect(text(tree)).toContain('bioDose.boundary');
  await act(async () => tree.unmount());
});
