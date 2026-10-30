import React from 'react';
import { Switch, TextInput } from 'react-native';
import { CardioPlanBuilder } from '../CardioPlanBuilder';
import CardioPlanScreen from '@/app/(tabs)/(train)/cardio-plan';
import { NumericField } from '@/components/train/NumericField';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { reviewedNow, reviewedStart } from '@/testing/cardioReviewFixture';
import { CardioCycleView } from '../CardioCycleView';
import { CardioPlanFlow } from '../CardioPlanFlow';
const { create, act } = require('react-test-renderer');
let mockUid = 'owner';
const mockRoutines = { routines: [] as any[], status: 'ready', reload: jest.fn() };
const mockRouter = { canGoBack: () => false, replace: jest.fn(), back: jest.fn() };
const mockPlans = { ready: true, error: false, reload: jest.fn(), newId: jest.fn(() => 'new'), save: jest.fn() };
jest.mock('@/hooks/useCardioPlans', () => ({ useCardioPlans: () => mockPlans }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => mockRoutines }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: any) =>
  key === 'cardioPlan.strengthDay' ? `${key}:${options.name}` : ['cardioPlan.openSession', 'cardioPlan.day'].includes(key) ? `${key}:${options.day}` : key }) }));
const onCancel = jest.fn(), onRetry = jest.fn();
const props = { ready: true, error: false, onCancel, onRetry };
const output = (tree: any) => JSON.stringify(tree.toJSON());
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const stepper = (tree: any, label: string) => tree.root.findAllByType(Stepper).find((n: any) => n.props.label === label);
async function reachAvailability(tree: any) {
  await press(tree, 'cardioPlan.CYCLING'); await press(tree, 'exerciseWizard.next'); await press(tree, 'exerciseWizard.next');
}
const routine = { id: 'strength', name: 'Upper / Lower', isActive: true, domain: 'STRENGTH', currentMicrocycleIndex: 0,
  microcycles: [{ sessions: [{ id: 'upper', name: 'Upper', plannedSessionIndex: 0, exercises: [] }, { id: 'lower', name: 'Lower', plannedSessionIndex: 1, exercises: [] }] }] } as any;
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockRoutines.status = 'ready'; mockRoutines.routines = []; mockPlans.ready = true; mockPlans.error = false; mockPlans.save.mockResolvedValue(undefined); });
afterEach(() => jest.restoreAllMocks());

it('applies a reviewed initial ceiling, requires separate save consent, and resets consent after edits without changing legacy flow', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow);
  const save = jest.fn().mockRejectedValueOnce(Error('save')).mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} initialBaseline={reviewedStart()} onSave={save} />); });
  expect(button(tree, 'cardioPlan.CYCLING').props.disabled).toBe(true);
  await press(tree, 'exerciseWizard.next'); await press(tree, 'exerciseWizard.next');
  expect(stepper(tree, 'cardioPlan.cycle').props.min).toBe(7); expect(stepper(tree, 'cardioPlan.cycle').props.max).toBe(7);
  expect(stepper(tree, 'cardioPlan.sessions').props.max).toBe(2); expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(40);
  await press(tree, 'cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.preview.usedMinutes).toBe(60);
  await act(async () => tree.root.findAllByType(TextInput).find((n: any) => n.props.accessibilityLabel === 'cardioSaved.name').props.onChangeText('Reviewed base'));
  expect(button(tree, 'cardioSaved.save').props.disabled).toBe(true); await press(tree, 'cardioSaved.save'); expect(save).not.toHaveBeenCalled();
  await press(tree, 'healthPlanning.saveConsent'); await press(tree, 'cardioSaved.save'); expect(output(tree)).toContain('cardioSaved.saveFailed');
  expect(button(tree, 'healthPlanning.saveConsent').props.accessibilityState.checked).toBe(true);
  await press(tree, 'cardioSaved.save'); expect(save).toHaveBeenLastCalledWith('Reviewed base', expect.objectContaining({ healthBaseline: expect.any(Object) }), true);
  await press(tree, 'cardioPlan.edit'); await act(async () => stepper(tree, 'cardioPlan.sessionLimit').props.onChange(20)); await press(tree, 'cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.preview.usedMinutes).toBe(40); expect(button(tree, 'healthPlanning.saveConsent').props.accessibilityState.checked).toBe(false);
  await press(tree, 'cardioPlan.edit'); await press(tree, 'healthPlanning.remove');
  expect(stepper(tree, 'cardioPlan.cycle').props.max).toBe(31); expect(stepper(tree, 'cardioPlan.sessions').props.max).toBe(14);
  expect(output(tree)).not.toContain('healthPlanning.applied'); expect(stepper(tree, 'cardioPlan.cardioBudget').props.value).toBe(40);
  await act(async () => tree.unmount());
});
it('offers a direct exit from expired reviewed drafts and never falls back to unlabelled Health-derived values', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow + 86400001); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} initialBaseline={reviewedStart()} />); });
  expect(output(tree)).toContain('healthPlanning.expired'); expect(button(tree, 'exerciseWizard.next')).toBeUndefined();
  await press(tree, 'generate.cancel'); expect(onCancel).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
it('keeps caller cancellation local and drops a reviewed handoff permanently across an account round trip', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow); const cancel = jest.fn(); let tree: any;
  await act(async () => { tree = create(<CardioPlanFlow initialBaseline={reviewedStart()} onCancel={cancel} />); });
  expect(output(tree)).toContain('healthPlanning.applied'); await press(tree, 'generate.cancel');
  expect(cancel).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(mockPlans.save).not.toHaveBeenCalled();
  mockUid = 'other'; await act(async () => tree.update(<CardioPlanFlow initialBaseline={reviewedStart()} onCancel={cancel} />));
  expect(output(tree)).not.toContain('healthPlanning.applied');
  mockUid = 'owner'; await act(async () => tree.update(<CardioPlanFlow initialBaseline={reviewedStart()} onCancel={cancel} />));
  expect(output(tree)).not.toContain('healthPlanning.applied'); await act(async () => tree.unmount());
});
it('saves a v3 proposal through the shared flow only after explicit Health-summary consent', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow); let tree: any;
  await act(async () => { tree = create(<CardioPlanFlow initialBaseline={reviewedStart()} onCancel={onCancel} />); });
  await press(tree, 'exerciseWizard.next'); await press(tree, 'exerciseWizard.next'); await press(tree, 'cardioPlan.review');
  await act(async () => tree.root.findAllByType(TextInput).find((n: any) => n.props.accessibilityLabel === 'cardioSaved.name').props.onChangeText('From reviewed history'));
  await press(tree, 'cardioSaved.save'); expect(mockPlans.save).not.toHaveBeenCalled();
  await press(tree, 'healthPlanning.saveConsent'); await press(tree, 'cardioSaved.save');
  expect(mockPlans.save).toHaveBeenCalledWith(expect.objectContaining({ policy: 'CARDIO_PREVIEW_V3', userId: 'owner',
    healthPlanningConsent: { policy: 'HEALTH_DERIVED_PRIVATE_PLAN_V1', acceptedAt: reviewedNow }, preview: expect.objectContaining({ usedMinutes: 60 }) }));
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/cardio-cycle', params: { id: 'new' } });
  await act(async () => tree.unmount());
});

it('requires a modality, accepts unknown practice and keeps the numeric editor compact', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} />); });
  expect(button(tree, 'exerciseWizard.next').props.disabled).toBe(true);
  await press(tree, 'cardioPlan.CYCLING'); await press(tree, 'exerciseWizard.next');
  const duration = () => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.durationFor');
  expect(duration().props.compact).toBe(true);
  expect(duration().props.value).toBeUndefined();
  await act(async () => duration().props.onChangeValue(700));
  expect(button(tree, 'exerciseWizard.next').props.disabled).toBe(true); expect(output(tree)).toContain('cardioPlan.issue_PROFILE');
  await act(async () => duration().props.onChangeValue(undefined));
  await press(tree, 'cardioPlan.REGULAR'); await press(tree, 'cardioPlan.UNSURE'); await press(tree, 'exerciseWizard.next');
  expect(stepper(tree, 'cardioPlan.cycle').props.value).toBe(7);
  await press(tree, 'cardioPlan.review'); expect(output(tree)).toContain('cardioPlan.step3');
  const open = tree.root.findAll((n: any) => String(n.props.accessibilityLabel).startsWith('cardioPlan.openSession') && typeof n.props.onPress === 'function')[0];
  await act(async () => open.props.onPress()); expect(output(tree)).toContain('20:00'); expect(output(tree)).toContain('cardioPlan.familiarization');
  await press(tree, 'workout.done'); await press(tree, 'cardioPlan.info'); expect(output(tree)).toContain('cardioPlan.infoBody');
  await press(tree, 'workout.done'); await press(tree, 'cardioPlan.edit'); expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(2);
  await press(tree, 'generate.cancel'); expect(onCancel).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('reports omissions and preserves edits through back/review without saving a plan', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} />); }); await reachAvailability(tree);
  await act(async () => stepper(tree, 'cardioPlan.cardioBudget').props.onChange(5));
  await press(tree, 'cardioPlan.review'); expect(output(tree)).toContain('cardioPlan.omitted_TIME_CAP'); expect(output(tree)).toContain('cardioPlan.draftOnly');
  await press(tree, 'generate.back'); expect(stepper(tree, 'cardioPlan.cardioBudget').props.value).toBe(5);
  await act(async () => stepper(tree, 'cardioPlan.cardioBudget').props.onChange(60));
  await act(async () => stepper(tree, 'cardioPlan.cycle').props.onChange(10));
  await act(async () => tree.root.findAllByType(Switch).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.doubles').props.onValueChange(true));
  await press(tree, 'cardioPlan.review'); expect(output(tree)).not.toContain('cardioPlan.omitted_TIME_CAP');
  expect(onCancel).not.toHaveBeenCalled(); expect(onRetry).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('requires explicit strength placement, rejects collisions and reacts to source changes', async () => {
  const original = JSON.stringify(routine); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} routine={routine} />); });
  await press(tree, 'cardioPlan.CYCLING'); await press(tree, 'exerciseWizard.next');
  expect(output(tree)).not.toContain('cardioPlan.issue_STRENGTH_DAY');
  await press(tree, 'exerciseWizard.next');
  await act(async () => tree.root.findAllByType(Switch).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.strengthContext').props.onValueChange(true));
  expect(output(tree)).toContain('cardioPlan.issue_STRENGTH_DAY');
  const field = (name: string) => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === `cardioPlan.strengthDay:${name}`);
  await act(async () => field('Upper').props.onChangeValue(1)); await act(async () => field('Lower').props.onChangeValue(1));
  expect(output(tree)).toContain('cardioPlan.issue_STRENGTH_COLLISION');
  await act(async () => field('Lower').props.onChangeValue(4)); await press(tree, 'cardioPlan.review');
  expect(output(tree)).toContain('Upper'); expect(output(tree)).toContain('Lower');
  await act(async () => tree.update(<CardioPlanBuilder {...props} routine={{ ...routine, id: 'other' }} />));
  expect(output(tree)).toContain('cardioPlan.strengthChanged'); expect(output(tree)).toContain('cardioPlan.step2');
  expect(tree.root.findAllByType(Switch).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.strengthContext').props.value).toBe(true);
  expect(field('Upper').props.value).toBeUndefined();
  expect(JSON.stringify(routine)).toBe(original); await act(async () => tree.unmount());
});
it('blocks review until strength context has loaded and offers retry on read failure', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} ready={false} />); }); await reachAvailability(tree);
  expect(button(tree, 'cardioPlan.review').props.disabled).toBe(true);
  await act(async () => tree.update(<CardioPlanBuilder {...props} error />)); await press(tree, 'home.retry'); expect(onRetry).toHaveBeenCalledTimes(1);
  expect(button(tree, 'cardioPlan.review').props.disabled).toBe(true);
  await act(async () => tree.update(<CardioPlanBuilder {...props} />)); expect(button(tree, 'cardioPlan.review').props.disabled).toBe(false);
  await act(async () => tree.unmount());
});
it('resets an owner-scoped draft after account changes and returns home on cancellation', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanScreen />); });
  await press(tree, 'cardioPlan.RUNNING'); await press(tree, 'exerciseWizard.next'); expect(output(tree)).toContain('cardioPlan.step1');
  mockUid = 'other'; await act(async () => tree.update(<CardioPlanScreen />)); expect(output(tree)).toContain('cardioPlan.step0');
  expect(button(tree, 'exerciseWizard.next').props.disabled).toBe(true);
  await press(tree, 'generate.cancel'); expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/(train)');
  await act(async () => tree.unmount());
});

it('requires a name and scheduled cardio, saves explicitly, locks duplicate taps and retains a failed proposal for retry', async () => {
  const save = jest.fn(); let finish!: () => void;
  save.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; })).mockRejectedValueOnce(Error('native')).mockResolvedValue(undefined);
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} onSave={save} />); }); await reachAvailability(tree);
  await press(tree, 'cardioPlan.review'); expect(save).not.toHaveBeenCalled(); expect(button(tree, 'cardioSaved.save').props.disabled).toBe(true);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('  Base  '));
  let pending: Promise<void>; await act(async () => { pending = button(tree, 'cardioSaved.save').props.onPress(); });
  expect(save).toHaveBeenCalledWith('Base', expect.objectContaining({ cycleDays: 7, modalities: ['CYCLING'] }));
  expect(button(tree, 'generate.cancel').props.disabled).toBe(true); expect(button(tree, 'cardioPlan.edit').props.disabled).toBe(true);
  await act(async () => button(tree, 'cardioSaved.saving').props.onPress()); expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await pending!; });
  await press(tree, 'cardioSaved.save'); expect(output(tree)).toContain('cardioSaved.saveFailed');
  expect(tree.root.findByType(TextInput).props.value).toBe('  Base  '); await press(tree, 'cardioSaved.save');
  expect(output(tree)).not.toContain('cardioSaved.saveFailed');
  await press(tree, 'cardioPlan.edit'); await act(async () => stepper(tree, 'cardioPlan.cardioBudget').props.onChange(5));
  await press(tree, 'cardioPlan.review'); expect(button(tree, 'cardioSaved.save').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});

it('saves from the route under the signed-in owner and ignores navigation after an account change', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanScreen />); }); await reachAvailability(tree); await press(tree, 'cardioPlan.review');
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Base')); await press(tree, 'cardioSaved.save');
  expect(mockPlans.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'new', userId: 'owner', name: 'Base', strengthSource: null }));
  expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/cardio-cycle', params: { id: 'new' } }); mockRouter.replace.mockClear();
  let finish!: () => void; mockPlans.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  let pending: Promise<void>; await act(async () => { pending = button(tree, 'cardioSaved.save').props.onPress(); });
  mockUid = 'other'; await act(async () => tree.update(<CardioPlanScreen />)); await act(async () => { finish(); await pending!; });
  expect(mockPlans.newId).toHaveBeenCalledTimes(1);
  expect(mockPlans.save.mock.calls[0][0].createdAt).toBe(mockPlans.save.mock.calls[1][0].createdAt);
  expect(mockRouter.replace).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});

it('suggests editable limits and hides already-known relative strength dates until explicitly requested', async () => {
  const scheduled = { ...routine, mesocycleSnapshot: { restDays: [{ id: 'rest', afterSessionIndex: 0 }] } };
  let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} routine={scheduled} />); });
  await reachAvailability(tree);
  expect(output(tree)).not.toContain('cardioPlan.strengthDay:');
  await press(tree, 'cardioGuidance.editPlacement');
  expect(output(tree)).toContain('cardioPlan.strengthDay:Upper');
  await press(tree, 'cardioGuidance.hidePlacement');
  expect(output(tree)).not.toContain('cardioPlan.strengthDay:');
  await act(async () => stepper(tree, 'cardioPlan.sessions').props.onChange(6));
  await press(tree, 'cardioGuidance.suggest');
  expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(2);
  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(20);
  expect(stepper(tree, 'cardioPlan.cardioBudget').props.value).toBe(40);
  await act(async () => stepper(tree, 'cardioPlan.sessions').props.onChange(3));
  expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(3);
  await act(async () => tree.unmount());
});
