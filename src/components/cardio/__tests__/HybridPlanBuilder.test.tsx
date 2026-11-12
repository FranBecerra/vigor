import React from 'react';
import { Alert, Text } from 'react-native';
import { HybridPlanBuilder } from '../HybridPlanBuilder';
import { CardioPlanBuilder } from '../CardioPlanBuilder';
import { CardioCycleView } from '../CardioCycleView';
import { NumericField } from '@/components/train/NumericField';
import { strengthPlacements } from '@/services/cardio/cardioPreview';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { hybridFixture, hybridRunningFixture } from '@/test-support/hybridFixture';
import { reviewedContext, reviewedRecords } from '@/testing/cardioReviewFixture';
import { acceptReviewedCardioStart, reviewedCardioDefaults } from '@/services/cardio/reviewedCardioStart';
const { act, create } = require('react-test-renderer');
jest.mock('@/app/(tabs)/(train)/generate', () => ({ StrengthPlanBuilder: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: any) => key === 'cardioPlan.day' ? `${key}:${options.day}` : key }) }));
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const output = (tree: any) => JSON.stringify(tree.toJSON());
const field = (tree: any, label: string) => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === label);
async function cardioReview(tree: any) {
  await press(tree, 'hybridPlan.resume'); await press(tree, 'cardioPlan.CYCLING');
    await press(tree, 'cardioPlan.review');
}
it('separates priority from availability and restores custom limits when the unrestricted choice is unchecked', async () => {
  const f = hybridFixture(), renderStrength = jest.fn(() => null); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} renderStrength={renderStrength} onCancel={jest.fn()} onSave={jest.fn()} />); });
  expect(field(tree, 'sharedAvailability.minutes')).toBeUndefined();
  await press(tree, 'sharedAvailability.continue');
  expect(button(tree, 'hybridPlan.STRENGTH')).toBeUndefined();
  await act(async () => field(tree, 'sharedAvailability.minutes').props.onChangeValue(75));
  await press(tree, 'sharedAvailability.unrestricted');
  expect(field(tree, 'sharedAvailability.minutes')).toBeUndefined();
  await press(tree, 'sharedAvailability.unrestricted');
  expect(field(tree, 'sharedAvailability.minutes').props.value).toBe(75);
  await press(tree, 'sharedAvailability.unrestricted');
  await press(tree, 'hybridPlan.buildStrength');
  expect((renderStrength.mock.lastCall as any)[0].sharedAvailability).toEqual({ cycleDays: 7, trainingDays: 6, minutesPerSession: 60, allowDoubles: false });
  await act(async () => tree.unmount());
});
it('saves only the accepted prescription and rejects an expired Health review', async () => {
  const now = Date.UTC(2026, 10, 3, 12), f = hybridFixture(), save = jest.fn(); let tree: any;
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  try {
    await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={jest.fn()} onSave={save} />); });
    await cardioReview(tree); const currentInput = tree.root.findByType(CardioCycleView).props.input; await press(tree, 'hybridPlan.editCardio');
    const b = acceptReviewedCardioStart(reviewedRecords(now), now, now, { ...reviewedContext, cycleDays: 8, maxSessionMinutes: 60, totalMinutes: 120 });
    const input = { ...currentInput, ...reviewedCardioDefaults(b, currentInput.profile) };
    await act(async () => tree.root.findByType(CardioPlanBuilder).props.hybrid.onReview(input));
    expect(button(tree, 'healthPlanning.saveConsent')).toBeUndefined();
    await press(tree, 'hybridPlan.save'); expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].cardio.healthPlanningConsent).toBeUndefined();
    expect(save.mock.calls[0][0].cardio.input.healthBaseline).toBeUndefined();
    await press(tree, 'hybridPlan.editCardio'); await act(async () => tree.root.findByType(CardioPlanBuilder).props.hybrid.onReview({ ...input }));
    const stale = button(tree, 'hybridPlan.save').props.onPress;
    clock.mockReturnValue(now + 86400001); await act(async () => stale()); expect(save).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  } finally { clock.mockRestore(); }
});
it('keeps both doses unsaved until a valid joint review and retries the exact atomic payload', async () => {
  const f = hybridFixture(), save = jest.fn().mockRejectedValueOnce(Error('network')).mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={jest.fn()} onSave={save} />); });
  expect(field(tree, 'hybridPlan.totalBudget')).toBeUndefined(); expect(field(tree, 'sharedAvailability.minutes').props.compact).toBe(true);
  for (const control of tree.root.findAllByType(Stepper)) {
    expect(control.props.labelAbove).toBe(true);
    const label = control.findAllByType(Text).find((n: any) => n.props.children === control.props.label);
    expect(label.parent.props.style.height).toBeUndefined();
    expect(label.parent.props.style.flexDirection).toBeUndefined();
  }
  await press(tree, 'generate.back'); await press(tree, 'hybridPlan.CARDIO'); await press(tree, 'sharedAvailability.continue'); await cardioReview(tree);
  expect(save).not.toHaveBeenCalled(); expect(output(tree)).toContain('combinedReview.hybridTitle');
  expect(tree.root.findAllByType(CardioCycleView)).toHaveLength(1);
  expect(button(tree, 'hybridPlan.review')).toBeUndefined();
  expect(tree.root.findAllByType(CardioCycleView)[0].props.strengthRoutine.id).toBe(f.draft.routine.id);
  expect(button(tree, 'hybridPlan.save').props.disabled).toBe(false);
  await press(tree, 'hybridPlan.save'); expect(output(tree)).toContain('hybridPlan.saveFailed');
  const first = save.mock.calls[0][0]; await press(tree, 'hybridPlan.save'); expect(save.mock.calls[1][0]).toBe(first);
  expect(first.routine.isActive).toBe(false); expect(first.routine.hybrid.priority).toBe('CARDIO');
  await act(async () => tree.unmount());
});
it('asks availability once, derives two independent 60-minute slots for doubles and never saves a stale review', async () => {
  const f = hybridFixture(), save = jest.fn(); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={jest.fn()} onSave={save} />); });
  const doubles = tree.root.findAll((n: any) => n.props.accessibilityLabel === 'sharedAvailability.doubles' && n.props.onValueChange)[0];
  await act(async () => doubles.props.onValueChange(true));
  await cardioReview(tree);
  const staleSave = button(tree, 'hybridPlan.save').props.onPress;
  expect(tree.root.findByType(CardioCycleView).props.sessionCeiling).toBe(60);
  await press(tree, 'hybridPlan.editAvailability');
  await act(async () => field(tree, 'sharedAvailability.minutes').props.onChangeValue(45));
  await act(async () => staleSave()); expect(save).not.toHaveBeenCalled();
  await press(tree, 'hybridPlan.resume');
  const keys = tree.root.findAllByType(Stepper).map((n: any) => n.props.label);
  expect(keys).toContain('cardioPlan.sessions'); expect(keys).not.toContain('cardioPlan.sessionLimit');
  expect(keys).not.toContain('cardioPlan.cardioBudget'); expect(keys).not.toContain('cardioPlan.activeLimit');
  await press(tree, 'cardioPlan.review'); await press(tree, 'hybridPlan.save');
  expect(save.mock.calls[0][0].routine.hybrid).toMatchObject({ maxSessionMinutes: 45, totalMinutesPerCycle: 360 });
  expect(save.mock.calls[0][0].cardio.input).toMatchObject({ allowDoubles: true, maxActiveDays: 4 });
  await act(async () => tree.unmount());
});
it('blocks oversubscribed shared capacity, retains authored cardio while editing availability and never writes on cancellation', async () => {
  const f = hybridFixture(), save = jest.fn(), cancel = jest.fn(); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={cancel} onSave={save} />); });
  f.draft.mesocycle.plannedSessions![0].exercises[0].sets = Array.from({ length: 25 }, () => ({ setType: 'NORMAL' as any, targetReps: 10, targetRIR: 2 }));
  await act(async () => tree.update(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={cancel} onSave={save} />));
  await act(async () => field(tree, 'sharedAvailability.minutes').props.onChangeValue(30)); await cardioReview(tree);
  expect(output(tree)).toContain('hybridPlan.issue_SESSION_TIME'); expect(button(tree, 'hybridPlan.save').props.disabled).toBe(true);
  await press(tree, 'hybridPlan.save'); expect(save).not.toHaveBeenCalled();
  await press(tree, 'hybridPlan.editAvailability'); await act(async () => field(tree, 'sharedAvailability.minutes').props.onChangeValue(undefined));
  expect(button(tree, 'hybridPlan.resume').props.disabled).toBe(true);
  await act(async () => field(tree, 'sharedAvailability.minutes').props.onChangeValue(180)); await press(tree, 'hybridPlan.resume');
  await press(tree, 'cardioPlan.review');
  expect(button(tree, 'hybridPlan.save').props.disabled).toBe(false);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); await press(tree, 'generate.cancel');
  const options = alert.mock.calls[0][2]!; expect(cancel).not.toHaveBeenCalled(); await act(async () => options[1].onPress!());
  expect(cancel).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled(); alert.mockRestore(); await act(async () => tree.unmount());
});
it('keeps strength mandatory and returns locally to the previous authoring step', async () => {
  const f = hybridFixture(); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={jest.fn()} onSave={jest.fn()} />); });
  await press(tree, 'hybridPlan.resume'); const cardio = tree.root.findByType(CardioPlanBuilder);
  expect(cardio.props.hybrid.name).toBe('Hybrid foundation');
  await act(async () => cardio.props.onBack()); expect(output(tree)).toContain('sharedAvailability.minutes');
  await act(async () => tree.unmount());
});
it('ignores a cancellation confirmation belonging to an unmounted draft', async () => {
  const f = hybridFixture(), cancel = jest.fn(), alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={cancel} onSave={jest.fn()} />); });
  await press(tree, 'generate.cancel'); const options = alert.mock.calls[0][2]!;
  await act(async () => tree.unmount()); await act(async () => options[1].onPress!()); expect(cancel).not.toHaveBeenCalled(); alert.mockRestore();
});

it('passes the joint frequency into new strength authoring and refreshes it after priority edits', async () => {
  const f = hybridFixture(), renderStrength = jest.fn(() => null); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} renderStrength={renderStrength}
    onCancel={jest.fn()} onSave={jest.fn()} />); });
  await press(tree, 'hybridPlan.STRENGTH'); await press(tree, 'sharedAvailability.continue'); await press(tree, 'hybridPlan.buildStrength');
  const props = () => (renderStrength.mock.lastCall as any)[0];
  expect(props().recommendedSessions).toBe(3);
  await act(async () => props().onExit());
  await press(tree, 'generate.back'); await press(tree, 'hybridPlan.CARDIO'); await press(tree, 'sharedAvailability.continue'); await press(tree, 'hybridPlan.buildStrength');
  expect(props().recommendedSessions).toBe(2);
  await act(async () => tree.unmount());
});
it('uses the actual accepted strength count to reserve cardio days before review', async () => {
  const f = hybridFixture(); let tree: any;
  const sessions = f.draft.mesocycle.plannedSessions!;
  sessions.push({ ...sessions[0], index: 2 });
  f.draft.mesocycle.sessionsPerMicrocycle = 3;
  f.draft.mesocycle.scheduleTemplate!.slots[6] = { kind: 'workout', sessionIndex: 2 };
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft}
    onCancel={jest.fn()} onSave={jest.fn()} />); });
  await press(tree, 'generate.back'); await press(tree, 'hybridPlan.STRENGTH'); await press(tree, 'sharedAvailability.continue'); await cardioReview(tree);
  expect(tree.root.findByType(CardioCycleView).props.input.sessions).toBe(1);
  await act(async () => tree.unmount());
});

it('previews, undoes and saves the explicitly selected leg alternative', async () => {
  const f = hybridRunningFixture(), save = jest.fn(); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={jest.fn()} onSave={save} />); });
  await press(tree, 'hybridPlan.resume');
  const editor = tree.root.findByType(CardioPlanBuilder);
  await act(async () => editor.props.hybrid.onReview({ ...f.input, strength: strengthPlacements(editor.props.routine, true).sessions }));
  const option = () => tree.root.findAll((n: any) => n.props.testID === 'hybrid-leg-alternative' && n.props.onPress)[0];
  expect(option().props.accessibilityState.checked).toBe(false);
  for (const checked of [true,false,true]) {
    await act(async () => option().props.onPress());
    expect(option().props.accessibilityState.checked).toBe(checked);
    expect(tree.root.findByType(CardioCycleView).props.strengthRoutine.microcycles[0].sessions[0].exercises[0].sets.length).toBe(checked ? 3 : 4);
  }
  expect(save).not.toHaveBeenCalled();
  await press(tree, 'hybridPlan.save');
  expect(save.mock.calls[0][0].mesocycle.plannedSessions.map((s: any) => s.exercises[0].sets.length)).toEqual([3,3]);
  await act(async () => tree.unmount());
});

it('recommends the complete structure, allows undo and retries exactly what was reviewed', async () => {
  const f = hybridRunningFixture(), save = jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined); let tree: any;
  f.draft.routine.generation.split = 'AUTO' as any;
  f.draft.templates = [{ split:'UPPER_LOWER' as any,routineName:'Upper / lower',
    sessions:f.sessions.map((s,i) => ({ ...s,exercises:f.sessions[1-i].exercises })) }];
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} initialStrength={f.draft} onCancel={jest.fn()} onSave={save} />); });
  await press(tree,'hybridPlan.resume');
  const editor = tree.root.findByType(CardioPlanBuilder);
  await act(async () => editor.props.hybrid.onReview({ ...f.input,strength:strengthPlacements(editor.props.routine,true).sessions }));
  const option = () => tree.root.findAll((n: any) => n.props.testID === 'hybrid-leg-alternative' && n.props.onPress)[0];
  expect(option().props.accessibilityState.checked).toBe(true);
  expect(tree.root.findByType(CardioCycleView).props.strengthRoutine.name).toBe('Upper / lower');
  await act(async () => option().props.onPress());
  expect(tree.root.findByType(CardioCycleView).props.strengthRoutine.name).toBe(f.draft.routine.name);
  await act(async () => option().props.onPress());
  await press(tree,'hybridPlan.save'); await press(tree,'hybridPlan.save');
  expect(save.mock.calls[1][0]).toBe(save.mock.calls[0][0]);
  expect(save.mock.calls[0][0].routine.name).toBe('Upper / lower');
  expect(save.mock.calls[0][0].mesocycle.plannedSessions[0].exercises).toEqual(f.sessions[1].exercises);
  expect(save.mock.calls[0][0].templates).toBeUndefined();
  await act(async () => tree.unmount());
});

it('retains the mounted cardio prescription when strength changes and requires a fresh joint review', async () => {
  const f = hybridFixture(), save = jest.fn(), renderStrength = jest.fn(() => null); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} renderStrength={renderStrength}
    onCancel={jest.fn()} onSave={save} />); });
  await press(tree, 'sharedAvailability.continue');
  await press(tree, 'hybridPlan.buildStrength');
  const strengthProps = () => (renderStrength.mock.lastCall as any)[0];
  await act(async () => strengthProps().onPrepared(f.draft));
  await press(tree, 'cardioPlan.CYCLING');
  const editor = tree.root.findByType(CardioPlanBuilder);
  const duration = () => tree.root.findAllByType(Stepper).find((n: any) => n.props.label === 'cardioSections.duration');
  await act(async () => duration().props.onChange(45));
  await press(tree, 'cardioPlan.review');
  const first = tree.root.findByType(CardioCycleView).props.input;
  expect(first.sessionMinutes).toBe(45);
  const staleSave = button(tree, 'hybridPlan.save').props.onPress;
  await press(tree, 'hybridPlan.editCardio');
  await act(async () => tree.root.findByType(CardioPlanBuilder).props.onBack());
  const staleReview = editor.props.hybrid.onReview;
  const revised = { ...f.draft, routine: { ...f.draft.routine, name: 'Edited strength' }, mesocycle: { ...f.draft.mesocycle,
    plannedSessions: f.draft.mesocycle.plannedSessions!.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e,
      sets: e.sets.map(set => ({ ...set, targetRIR: 3 })) })) })) } };
  await act(async () => strengthProps().onPrepared(revised));
  expect(tree.root.findByType(CardioPlanBuilder)).toBe(editor);
  expect(duration().props.value).toBe(45);
  expect(tree.root.findByType(CardioPlanBuilder).props.routine.name).toBe('Edited strength');
  expect(button(tree, 'hybridPlan.save')).toBeUndefined();
  await act(async () => { staleSave(); staleReview(first); });
  expect(save).not.toHaveBeenCalled(); expect(button(tree, 'hybridPlan.save')).toBeUndefined();
  await press(tree, 'cardioPlan.review');
  const next = tree.root.findByType(CardioCycleView).props;
  expect(next.input.sessionMinutes).toBe(45); expect(next.input.sessions).toBe(first.sessions);
  expect(next.strengthRoutine.name).toBe('Edited strength');
  await press(tree, 'hybridPlan.save'); expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0].routine.name).toBe('Edited strength');
  expect(save.mock.calls[0][0].cardio.input.sessionMinutes).toBe(45);
  await act(async () => tree.unmount());
});

it('ignores late editor callbacks outside their owning phase and after unmount', async () => {
  const f = hybridFixture(), renderStrength = jest.fn(() => null), save = jest.fn(); let tree: any;
  await act(async () => { tree = create(<HybridPlanBuilder exercises={f.exercises} renderStrength={renderStrength}
    onCancel={jest.fn()} onSave={save} />); });
  await press(tree, 'sharedAvailability.continue');
  await press(tree, 'hybridPlan.buildStrength');
  const strength = (renderStrength.mock.lastCall as any)[0];
  await act(async () => strength.onPrepared(f.draft));
  await press(tree, 'cardioPlan.CYCLING');
  const cardio = tree.root.findByType(CardioPlanBuilder).props;
  await act(async () => { strength.onExit(); strength.onPrepared({ ...f.draft }); });
  expect(button(tree, 'cardioPlan.review')).toBeDefined();
  await press(tree, 'cardioPlan.review');
  const input = tree.root.findByType(CardioCycleView).props.input;
  await press(tree, 'hybridPlan.editCardio');
  await act(async () => tree.root.findByType(CardioPlanBuilder).props.onBack());
  await act(async () => strength.onExit());
  expect(button(tree, 'hybridPlan.resume')).toBeUndefined();
  await act(async () => (renderStrength.mock.lastCall as any)[0].onExit());
  await act(async () => cardio.hybrid.onReview(input));
  expect(button(tree, 'hybridPlan.save')).toBeUndefined();
  expect(field(tree, 'sharedAvailability.minutes')).toBeDefined();
  await act(async () => tree.unmount());
  await act(async () => { strength.onPrepared(f.draft); strength.onExit(); cardio.hybrid.onReview(input); });
  expect(save).not.toHaveBeenCalled();
});

it('edits the selected alternative, returns unchanged on exit, and requires a new cardio review on apply', async () => {
  const f = hybridRunningFixture(), renderStrength = jest.fn(() => null), save = jest.fn(); let tree: any;
  f.draft.routine.generation.split = 'AUTO' as any;
  f.draft.templates = [{ split: 'UPPER_LOWER' as any, routineName: 'Reviewed alternative',
    sessions: f.sessions.map((s, i) => ({ ...s, exercises: f.sessions[1-i].exercises })) }];
  await act(async () => { tree = create(<HybridPlanBuilder initialStrength={f.draft} exercises={f.exercises}
    renderStrength={renderStrength} onCancel={jest.fn()} onSave={save} />); });
  await press(tree, 'hybridPlan.resume');
  const cardio = () => tree.root.findByType(CardioPlanBuilder).props;
  await act(async () => cardio().hybrid.onReview({ ...f.input, strength: strengthPlacements(cardio().routine, true).sessions }));
  expect(tree.root.findByType(CardioCycleView).props.strengthRoutine.name).toBe('Reviewed alternative');
  const savedCallback = button(tree, 'hybridPlan.save').props.onPress;
  await press(tree, 'hybridPlan.editStrength');
  const editor = () => (renderStrength.mock.lastCall as any)[0];
  const firstEdit = editor();
  expect(firstEdit.revision.routine.name).toBe('Reviewed alternative');
  expect(firstEdit.revision.mesocycle.plannedSessions[0].exercises).toEqual(f.sessions[1].exercises);
  await act(async () => firstEdit.onExit());
  expect(tree.root.findByType(CardioCycleView).props.strengthRoutine.name).toBe('Reviewed alternative');

  await press(tree, 'hybridPlan.editStrength');
  const revised = { ...editor().revision, routine: { ...editor().revision.routine, name: 'Revised' } };
  await act(async () => firstEdit.onPrepared(revised));
  expect(cardio().routine.name).toBe(f.draft.routine.name);
  await act(async () => editor().onPrepared(revised));
  await act(async () => savedCallback());
  expect(save).not.toHaveBeenCalled();
  expect(button(tree, 'hybridPlan.save')).toBeUndefined();
  expect(cardio().routine.name).toBe('Revised');
  await act(async () => cardio().hybrid.onReview({ ...f.input, strength: strengthPlacements(cardio().routine, true).sessions }));
  expect(tree.root.findByType(CardioCycleView).props.strengthRoutine.name).toBe('Revised');
  await press(tree, 'hybridPlan.save');
  expect(save.mock.calls[0][0].routine.name).toBe('Revised');
  await act(async () => tree.unmount());
});
