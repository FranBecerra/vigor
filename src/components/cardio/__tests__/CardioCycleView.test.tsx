import React from 'react';
import { Modal, Text } from 'react-native';
import { CardioCycleView } from '../CardioCycleView';
import { hybridFixture } from '@/test-support/hybridFixture';
import { buildCardioPreview } from '@/services/cardio/cardioPreview';
import { toRoutineView } from '@/services/training/routineView';
import { SetType } from '@/models';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: any) =>
  ['combinedReview.openStrength', 'cardioPlan.openSession'].includes(key) ? `${key}:${options.day}` : key, i18n: { language: 'en' } }) }));
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const output = (tree: any) => JSON.stringify(tree.toJSON());
function fixture() {
  const f = hybridFixture();
  f.draft.mesocycle.plannedSessions![0].exercises[0].sets = [
    { setType: SetType.NORMAL, targetRepsMin: 6, targetReps: 8, targetRIR: 3 },
    { setType: SetType.NORMAL, targetReps: 12, targetRIR: 2 },
    { setType: SetType.FAILURE, targetReps: 15, targetRIR: 0 },
  ];
  const routine = toRoutineView(f.draft.routine, f.draft.mesocycle, f.exercises, f.labels)!;
  // Keep fixture placement estimates in step with the changed prescription.
  const { strengthPlacements } = require('@/services/cardio/cardioPreview');
  const input = { ...f.input, strength: strengthPlacements(routine, true).sessions };
  return { input, preview: buildCardioPreview(input), routine };
}
it('expands strength and cardio inline, keeps one detail open and never opens a session-detail modal', async () => {
  const f = fixture(); let tree: any;
  await act(async () => { tree = create(<CardioCycleView input={f.input} preview={f.preview} strengthRoutine={f.routine} sessionCeiling={60} />); });
  const strengthDay = f.input.strength[0].dayIndex! + 1, label = `combinedReview.openStrength:${strengthDay}`;
  expect(button(tree, label).props.accessibilityState.expanded).toBe(false);
  await press(tree, label); expect(button(tree, label).props.accessibilityState.expanded).toBe(true);
  expect(output(tree)).toContain('6–8'); expect(output(tree)).toContain('setType.FAILURE'); expect(output(tree)).toContain(' @ RIR 0');
  expect(tree.root.findByProps({ testID: `combined-detail-strength:${f.input.strength[0].id}` })).toBeDefined();
  const cardioDay = f.preview.scheduled[0].dayIndex + 1;
  await press(tree, `cardioPlan.openSession:${cardioDay}`);
  expect(button(tree, label).props.accessibilityState.expanded).toBe(false);
  expect(output(tree)).toContain('cardioPlan.WARMUP'); expect(output(tree)).toContain('cardioPlan.COOLDOWN');
  expect(tree.root.findAllByType(Modal).filter((n: any) => n.props.visible)).toHaveLength(0);
  await press(tree, `cardioPlan.openSession:${cardioDay}`);
  expect(output(tree)).not.toContain('cardioPlan.WARMUP');
  await act(async () => tree.unmount());
});
it('uses full-width days, muted rest separators and independent workout ceilings in a double', async () => {
  const f = fixture(), input = { ...f.input, allowDoubles: true, availableDays: [0, 4], maxActiveDays: 2 };
  const preview = buildCardioPreview(input); let tree: any;
  await act(async () => { tree = create(<CardioCycleView input={input} preview={preview} strengthRoutine={f.routine} sessionCeiling={60} />); });
  expect(output(tree)).toContain('60 min');
  expect(tree.root.findAll((n: any) => String(n.props.testID).startsWith('combined-day-') && typeof n.type !== 'string')).toHaveLength(8);
  expect(output(tree)).not.toContain('48%'); expect(output(tree)).toContain('calendar.rest');
  const day = preview.scheduled[0].dayIndex + 1;
  expect(button(tree, `combinedReview.openStrength:${day}`)).toBeDefined(); expect(button(tree, `cardioPlan.openSession:${day}`)).toBeDefined();
  await act(async () => tree.unmount());
});
it('does not invent original strength details when absent and labels compatible saved context as current', async () => {
  const f = fixture(); let tree: any;
  const render = (routine?: typeof f.routine) => <CardioCycleView input={f.input} preview={f.preview} strengthRoutine={routine} currentStrengthDetails />;
  await act(async () => { tree = create(render()); });
  const label = `combinedReview.openStrength:${f.input.strength[0].dayIndex! + 1}`;
  await press(tree, label); expect(output(tree)).toContain('combinedReview.strengthUnavailable');
  await act(async () => tree.update(render(f.routine)));
  expect(output(tree)).toContain('combinedReview.currentStrength'); expect(output(tree)).toContain('6–8');
  await act(async () => tree.update(render({ ...f.routine, id: 'other' })));
  expect(output(tree)).not.toContain('6–8'); expect(output(tree)).toContain('combinedReview.strengthUnavailable');
  await act(async () => tree.unmount());
});
it('keeps explanations behind information and reports omissions or missing cardio details explicitly', async () => {
  const f = fixture(); let tree: any;
  await act(async () => { tree = create(<CardioCycleView input={f.input} preview={{ ...f.preview, prescriptions: [], closeDemandingSessions: true,
    omitted: [{ candidateId: 'omitted', reason: 'TIME_CAP' }] }} />); });
  expect(output(tree)).toContain('cardioPlan.omitted_TIME_CAP'); expect(output(tree)).toContain('cardioPlan.overlap');
  await press(tree, `cardioPlan.openSession:${f.preview.scheduled[0].dayIndex + 1}`);
  expect(output(tree)).toContain('combinedReview.cardioUnavailable');
  await press(tree, 'editorFlow.cardioWhy'); expect(tree.root.findByType(Modal).props.visible).toBe(true);
  await press(tree, 'workout.done'); expect(tree.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => tree.unmount());
});
