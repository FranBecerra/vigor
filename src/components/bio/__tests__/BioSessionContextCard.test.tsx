import React from 'react';
import { BioSessionContextCard } from '../BioSessionContextCard';
import { buildBioSessionContext } from '@/services/bio/sessionContext';
import { buildBioCycles, createMicrocycleReview } from '@/services/bio/microcycleReview';
import { MuscleGroup } from '@/models';
import { sessionContextFixture, contextWorkout, CONTEXT_UPPER, CONTEXT_LOWER } from '@/test-support/sessionContextFixture';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn(), mockSelect = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, args?: any) => {
  const value = key.split('.').reduce((entry: any, part: string) => entry?.[part], require('@/i18n/locales/en.json'));
  if (typeof value !== 'string') throw Error(`Missing translation: ${key}`);
  return args ? `${key}:${JSON.stringify(args)}` : key;
}, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = (tree: any) => JSON.stringify(tree.toJSON());
beforeEach(() => jest.clearAllMocks());
it('offers an inline preview picker, expandable factual context and a detail link without starting a workout', async () => {
  const input = sessionContextFixture(); input.history = [contextWorkout()];
  let tree: any; const context = buildBioSessionContext(input);
  await act(async () => { tree = create(<BioSessionContextCard view={{ state: 'READY', context, select: mockSelect }} />); });
  expect(text(tree)).toContain('bioSession.planUnchanged'); expect(text(tree)).not.toContain('bioSession.boundary');
  expect(text(tree)).not.toContain('bioSession.general');
  expect(text(tree)).not.toContain('bioSession.exposureBoundary'); expect(mockSelect).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
  await act(async () => button(tree, 'bioSession.choose').props.onPress());
  await act(async () => button(tree, 'Synthetic Lower').props.onPress()); expect(mockSelect).toHaveBeenCalledWith(1);
  expect(button(tree, 'bioSession.closePicker')).toBeUndefined();
  await act(async () => button(tree, 'bioSession.choose').props.onPress());
  await act(async () => button(tree, 'bioSession.closePicker').props.onPress());
  await act(async () => button(tree, 'bioSession.details').props.onPress());
  expect(text(tree)).toContain('bioSession.boundary'); expect(text(tree)).toContain('bioSession.general');
  expect(text(tree)).toContain('bioSession.exposureBoundary'); expect(text(tree)).toContain('bioSession.lastRecorded');
  expect(text(tree)).toContain('bioSession.performanceMissing'); expect(text(tree)).toContain('bioSession.reviewStatus.MISSING');
  await act(async () => button(tree, 'bioSession.hideDetails').props.onPress()); expect(text(tree)).not.toContain('bioSession.exposureBoundary');
  await act(async () => button(tree, 'bioSession.viewSession').props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/routine', params: { mesocycleId: 'synthetic-plan', goal: 'HYPERTROPHY', microcycleIndex: '0', plannedSessionIndex: '0' } });
  await act(async () => tree.unmount());
});
it('keeps retrospective concerns dated and separate from current general signals, unknown work and dose evidence', async () => {
  const input = sessionContextFixture(), plan = input.plans[0];
  input.history = [contextWorkout(CONTEXT_UPPER, { id: 'upper', mesocycleId: plan.id, plannedSessionIndex: 0 }),
    contextWorkout(CONTEXT_LOWER, { id: 'lower', mesocycleId: plan.id, plannedSessionIndex: 1 })];
  const cycle = buildBioCycles(input.owner, [plan], input.history, input.now).find((item) => item.closed)!;
  input.reviews = [createMicrocycleReview(input.owner, cycle, { discomfort: 'PRESENT', unrecoveredMuscles: [MuscleGroup.CHEST] }, 'SUBMITTED', undefined, input.now)];
  plan.restDays = [{ id: 'start', afterSessionIndex: null }];
  plan.plannedSessions![0].exercises.push({ exerciseId: 'missing', order: 1, isEdited: true, sets: plan.plannedSessions![0].exercises[0].sets });
  const context = buildBioSessionContext(input); let tree: any;
  await act(async () => { tree = create(<BioSessionContextCard view={{ state: 'READY', context, select: mockSelect }} />); });
  expect(text(tree)).toContain('bioSession.restBefore'); expect(text(tree)).toContain('bioSession.reviewContext');
  expect(text(tree)).toContain('bioSession.prompt.DATED_DISCOMFORT');
  await act(async () => button(tree, 'bioSession.details').props.onPress());
  expect(text(tree)).toContain('bioSession.reviewDate'); expect(text(tree)).toContain('bioSession.unknownMuscles');
  expect(text(tree)).toContain('bioDose.DISCOMFORT'); expect(text(tree)).toContain('bio.discomfort.PRESENT');
  context.review!.answers.unrecoveredMuscles = []; context.review!.answers.discomfort = 'NONE';
  await act(async () => tree.update(<BioSessionContextCard view={{ state: 'READY', context, select: mockSelect }} />)); expect(text(tree)).toContain('bio.none');
  await act(async () => tree.unmount());
});
it('does not leak earlier targets during errors/loading and explains unavailable, ambiguous, complete and unclassified states', async () => {
  let tree: any; await act(async () => { tree = create(<BioSessionContextCard view={{ state: 'LOADING', select: mockSelect }} />); });
  await act(async () => tree.update(<BioSessionContextCard view={{ state: 'ERROR', select: mockSelect }} />)); expect(text(tree)).toContain('bio.loadError');
  for (const status of ['NO_ACTIVE_ROUTINE', 'AMBIGUOUS', 'UNAVAILABLE', 'COMPLETE'] as const) {
    const context = { ...buildBioSessionContext(sessionContextFixture()), status, target: undefined };
    await act(async () => tree.update(<BioSessionContextCard view={{ state: 'READY', context, select: mockSelect }} />));
    expect(text(tree)).toContain(`bioSession.status.${status}`); expect(text(tree)).not.toContain('Synthetic Upper');
  }
  const context = buildBioSessionContext({ ...sessionContextFixture(), catalogue: new Map(), reviewsAvailable: false });
  context.general = { coverage: 'PARTIAL', signals: ['SLEEP_SHORTFALL', 'CARDIAC_DEPARTURE', 'UNUSUAL_SIGNAL'] };
  await act(async () => tree.update(<BioSessionContextCard view={{ state: 'READY', context, select: mockSelect }} />));
  await act(async () => button(tree, 'bioSession.details').props.onPress()); expect(text(tree)).toContain('bioSession.noMuscles');
  expect(text(tree)).toContain('bioSession.reviewStatus.UNAVAILABLE'); expect(text(tree)).toContain('bioSession.signal.SLEEP_SHORTFALL');
  await act(async () => tree.unmount());
});
