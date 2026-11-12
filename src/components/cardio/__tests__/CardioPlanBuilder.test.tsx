import React from 'react';
import { CardioSelectRow } from '../CardioSelectRow';
import { ScrollView, Switch, TextInput } from 'react-native';
import { CardioPlanBuilder } from '../CardioPlanBuilder';
import CardioPlanScreen from '@/app/(tabs)/(train)/cardio-plan';
import { NumericField } from '@/components/train/NumericField';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { reviewedNow, reviewedStart } from '@/testing/cardioReviewFixture';
import { CardioCycleView } from '../CardioCycleView';
import { CardioPlanFlow } from '../CardioPlanFlow';
import { hybridFixture } from '@/test-support/hybridFixture';
import { toRoutineView } from '@/services/training/routineView';
import * as hybridRhythm from '@/services/cardio/hybridRhythm';
import { buildCardioPreview } from '@/services/cardio/cardioPreview';
const { create, act } = require('react-test-renderer');
let mockUid = 'owner';
const mockRoutines = { routines: [] as any[], status: 'ready', reload: jest.fn() };
const mockRouter = { canGoBack: () => false, replace: jest.fn(), back: jest.fn() };
const mockPlans = { ready: true, error: false, reload: jest.fn(), newId: jest.fn(() => 'new'), save: jest.fn() };
jest.mock('@/hooks/useCardioPlans', () => ({ useCardioPlans: () => mockPlans }));
jest.mock('@/hooks/useCardioTraining', () => ({ useCardioWorkouts: () => ({ owner: mockUid, ready: true, error: false, entries: [], reload: jest.fn() }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]), useRouter: () => mockRouter }));
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
  await press(tree, 'cardioPlan.CYCLING');
}
const routine = { id: 'strength', name: 'Upper / Lower', isActive: true, domain: 'STRENGTH', currentMicrocycleIndex: 0,
  microcycles: [{ sessions: [{ id: 'upper', name: 'Upper', plannedSessionIndex: 0, exercises: [] }, { id: 'lower', name: 'Lower', plannedSessionIndex: 1, exercises: [] }] }] } as any;
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockRoutines.status = 'ready'; mockRoutines.routines = []; mockPlans.ready = true; mockPlans.error = false; mockPlans.save.mockResolvedValue(undefined); });
afterEach(() => jest.restoreAllMocks());

it('keeps the new hybrid strength source mandatory and blocks a strength placement on an unavailable shared day', async () => {
  const f = hybridFixture(), view = toRoutineView(f.draft.routine, f.draft.mesocycle, f.exercises, f.labels)!; let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} routine={view} hybrid={{ name: view.name }} />); });
  await reachAvailability(tree);
  const source = tree.root.findAllByType(Switch).find((n: any) => n.props.accessibilityLabel === 'hybridPlan.strengthContext');
  expect(source.props.disabled).toBe(true); await act(async () => source.props.onValueChange(false)); expect(source.props.value).toBe(true);
  expect(output(tree)).toContain('hybridPlan.availableDays'); expect(output(tree)).not.toContain('cardioPlan.strengthContext');
  await press(tree, 'cardioPlan.day:1'); expect(button(tree, 'cardioPlan.review').props.disabled).toBe(true);
  expect(output(tree)).toContain('hybridPlan.unavailableStrength'); await press(tree, 'cardioPlan.review'); expect(output(tree)).not.toContain('cardioPlan.step3');
  await press(tree, 'cardioPlan.day:1'); expect(button(tree, 'cardioPlan.review').props.disabled).toBe(false);
  await act(async () => tree.unmount());
});

it('reviews the default joint rhythm but retains an explicitly edited strength placement unless redistribution is requested', async () => {
  const f = hybridFixture(), view = toRoutineView(f.draft.routine, f.draft.mesocycle, f.exercises, f.labels)!;
  const search = jest.spyOn(hybridRhythm, 'suggestHybridRhythm'); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} routine={view} hybrid={{ name: view.name }} />); });
  await reachAvailability(tree); await press(tree, 'cardioPlan.review'); expect(search).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(CardioCycleView).props.preview.omitted).toHaveLength(0);
  await press(tree, 'cardioPlan.edit'); await press(tree, 'cardioGuidance.editPlacement');
  const field = tree.root.findAllByType(NumericField).find((n: any) => String(n.props.accessibilityLabel).startsWith('cardioPlan.strengthDay:'));
  await act(async () => field.props.onChangeValue(field.props.value));
  await press(tree, 'cardioPlan.review'); expect(search).toHaveBeenCalledTimes(1);
  await press(tree, 'hybridRhythm.improve'); expect(search).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});

it('cancels an in-flight rhythm review when availability changes and ignores the older result', async () => {
  const f = hybridFixture(), view = toRoutineView(f.draft.routine, f.draft.mesocycle, f.exercises, f.labels)!;
  let finish!: () => void;
  jest.spyOn(hybridRhythm, 'suggestHybridRhythm').mockImplementationOnce(input => new Promise(resolve => {
    finish = () => resolve({ input, preview: buildCardioPreview(input), changed: false, examined: 1,
      before: { proximity: 0, longestRun: 2, adjacentActivePairs: 1 }, after: { proximity: 0, longestRun: 2, adjacentActivePairs: 1 } });
  }));
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} routine={view} hybrid={{ name: view.name }} />); });
  await reachAvailability(tree); let pending!: Promise<void>;
  await act(async () => { pending = button(tree, 'cardioPlan.review').props.onPress(); });
  expect(output(tree)).toContain('hybridRhythm.working');
  await act(async () => stepper(tree, 'cardioPlan.sessionLimit').props.onChange(35));
  await act(async () => { finish(); await pending; });
  expect(output(tree)).toContain('cardioSections.title'); expect(output(tree)).not.toContain('hybridRhythm.working');
  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(35);
  await act(async () => tree.unmount());
});

it('applies a reviewed initial ceiling, restores the same recommendation and saves without a separate checkbox', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow);
  const save = jest.fn().mockRejectedValueOnce(Error('save')).mockResolvedValue(undefined); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} initialBaseline={reviewedStart()} onSave={save} />); });
  expect(button(tree, 'cardioPlan.CYCLING').props.disabled).toBe(true);

  expect(stepper(tree, 'cardioPlan.cycle').props.min).toBe(7); expect(stepper(tree, 'cardioPlan.cycle').props.max).toBe(7);
  expect(stepper(tree, 'cardioPlan.sessions').props.max).toBe(2); expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(30);
  await press(tree, 'cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.preview.usedMinutes).toBe(60);
  await act(async () => tree.root.findAllByType(TextInput).find((n: any) => n.props.accessibilityLabel === 'cardioSaved.name').props.onChangeText('Reviewed base'));
  expect(button(tree, 'healthPlanning.saveConsent')).toBeUndefined();
  await press(tree, 'cardioSaved.save'); expect(output(tree)).toContain('cardioSaved.saveFailed');
  await press(tree, 'cardioSaved.save'); expect(save).toHaveBeenLastCalledWith('Reviewed base', expect.objectContaining({ healthBaseline: expect.any(Object) }));
  await press(tree, 'cardioPlan.edit'); await press(tree, 'cardioGuidance.suggest');
  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(30);
  await act(async () => stepper(tree, 'cardioPlan.sessionLimit').props.onChange(20)); await press(tree, 'cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.preview.usedMinutes).toBe(40);
  await press(tree, 'cardioPlan.edit'); await press(tree, 'healthPlanning.remove');
  expect(stepper(tree, 'cardioPlan.cycle').props.max).toBe(31); expect(stepper(tree, 'cardioPlan.sessions').props.max).toBe(14);
  expect(output(tree)).not.toContain('healthPlanning.applied'); expect(stepper(tree, 'cardioPlan.sessionLimit').props.value * stepper(tree, 'cardioPlan.sessions').props.value).toBe(40);
  await act(async () => tree.unmount());
});
it('offers a direct exit from expired reviewed drafts and never falls back to unlabelled Health-derived values', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow + 86400001); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} initialBaseline={reviewedStart()} />); });
  expect(output(tree)).toContain('healthPlanning.expired'); expect(button(tree, 'cardioPlan.review')).toBeUndefined();
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
it('saves the reviewed dose without uploading a Health summary', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(reviewedNow); let tree: any;
  await act(async () => { tree = create(<CardioPlanFlow initialBaseline={reviewedStart()} onCancel={onCancel} />); });
    await press(tree, 'cardioPlan.review');
  await act(async () => tree.root.findAllByType(TextInput).find((n: any) => n.props.accessibilityLabel === 'cardioSaved.name').props.onChangeText('From reviewed history'));
  await press(tree, 'cardioSaved.save');
  expect(mockPlans.save).toHaveBeenCalledWith(expect.objectContaining({ policy: 'CARDIO_PREVIEW_V2', userId: 'owner',
    preview: expect.objectContaining({ usedMinutes: 60 }) }));
  expect(mockPlans.save.mock.calls[0][0].input.healthBaseline).toBeUndefined();
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/cardio-cycle', params: { id: 'new' } });
  await act(async () => tree.unmount());
});

it('requires a modality, accepts unknown practice and keeps the numeric editor compact', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} />); });
  expect(button(tree, 'cardioPlan.review').props.disabled).toBe(true);
  await press(tree, 'cardioPlan.CYCLING');
  const duration = () => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.durationFor');
  expect(duration().props.compact).toBe(true);
  expect(duration().props.value).toBeUndefined();
  await act(async () => duration().props.onChangeValue(700));
  expect(button(tree, 'cardioPlan.review').props.disabled).toBe(true); expect(output(tree)).toContain('cardioPlan.issue_PROFILE');
  await act(async () => duration().props.onChangeValue(undefined));
  await press(tree, 'cardioSections.experience'); await press(tree, 'cardioPlan.REGULAR'); await press(tree, 'cardioSections.experience'); await press(tree, 'cardioPlan.UNSURE');
  expect(stepper(tree, 'cardioPlan.cycle').props.value).toBe(7);
  await press(tree, 'cardioPlan.review'); expect(output(tree)).toContain('cardioPlan.step3');
  const open = tree.root.findAll((n: any) => String(n.props.accessibilityLabel).startsWith('cardioPlan.openSession') && typeof n.props.onPress === 'function')[0];
  await act(async () => open.props.onPress()); expect(output(tree)).toContain('20:00'); expect(output(tree)).toContain('cardioPlan.familiarization');
  await act(async () => open.props.onPress()); await press(tree, 'cardioPlan.info'); expect(output(tree)).toContain('cardioPlan.infoBody');
  await press(tree, 'workout.done'); await press(tree, 'cardioPlan.edit'); expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(2);
  await press(tree, 'generate.cancel'); expect(onCancel).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('preserves explicit duration through review/edit and never saves during review', async () => {
  let tree:any; await act(async()=>{tree=create(<CardioPlanBuilder {...props} />)}); await reachAvailability(tree);
  await act(async()=>stepper(tree,'cardioPlan.sessionLimit').props.onChange(35));
  await press(tree,'cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.input.cardioMinutes).toBe(70);
  expect(tree.root.findByType(CardioCycleView).props.input.sessionMinutes).toBe(35);
  await press(tree,'generate.back'); expect(stepper(tree,'cardioPlan.sessionLimit').props.value).toBe(35);
  await act(async()=>stepper(tree,'cardioPlan.cycle').props.onChange(10));
  await press(tree,'cardioPlan.review'); expect(tree.root.findByType(CardioCycleView).props.input.cycleDays).toBe(10);
  expect(onCancel).not.toHaveBeenCalled(); await act(async()=>tree.unmount());
});
it('requires explicit strength placement, rejects collisions and reacts to source changes', async () => {
  const original = JSON.stringify(routine); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} routine={routine} />); });
  await press(tree, 'cardioPlan.CYCLING');
  expect(output(tree)).toContain('cardioPlan.issue_STRENGTH_DAY');

  await act(async () => tree.root.findAllByType(Switch).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.strengthContext').props.onValueChange(true));
  expect(output(tree)).toContain('cardioPlan.issue_STRENGTH_DAY');
  const field = (name: string) => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === `cardioPlan.strengthDay:${name}`);
  await act(async () => field('Upper').props.onChangeValue(1)); await act(async () => field('Lower').props.onChangeValue(1));
  expect(output(tree)).toContain('cardioPlan.issue_STRENGTH_COLLISION');
  await act(async () => field('Lower').props.onChangeValue(4)); await press(tree, 'cardioPlan.review');
  expect(output(tree)).toContain('Upper'); expect(output(tree)).toContain('Lower');
  await act(async () => tree.update(<CardioPlanBuilder {...props} routine={{ ...routine, id: 'other' }} />));
  expect(output(tree)).toContain('cardioPlan.strengthChanged'); expect(output(tree)).toContain('cardioSections.title');
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
  await press(tree, 'cardioPlan.RUNNING');  expect(output(tree)).toContain('cardioSections.title');
  mockUid = 'other'; await act(async () => tree.update(<CardioPlanScreen />)); expect(output(tree)).toContain('cardioSections.title');
  expect(button(tree, 'cardioPlan.review').props.disabled).toBe(true);
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
  await press(tree, 'cardioPlan.edit'); await press(tree,'cardioPlan.CYCLING');
  expect(button(tree,'cardioPlan.review').props.disabled).toBe(true);
  await press(tree,'cardioPlan.review'); expect(tree.root.findAllByType(CardioCycleView)).toHaveLength(0);
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
  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value * stepper(tree, 'cardioPlan.sessions').props.value).toBe(40);
  await act(async () => stepper(tree, 'cardioPlan.sessions').props.onChange(3));
  expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(3);
  await act(async () => tree.unmount());
});
it('seeds availability from declared current duration once and preserves later manual availability edits', async () => {
  let tree: any; await act(async () => { tree = create(<CardioPlanBuilder {...props} />); });
  await press(tree, 'cardioPlan.RUNNING');
  await press(tree, 'cardioSections.experience'); await press(tree, 'cardioPlan.NEW');
  const duration = () => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel.startsWith('cardioPlan.durationFor'));
  await act(async () => duration().props.onChangeValue(40));
  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(40);
  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value * stepper(tree, 'cardioPlan.sessions').props.value).toBe(80);
  await act(async () => stepper(tree, 'cardioPlan.sessionLimit').props.onChange(30));
  await act(async () => duration().props.onChangeValue(35));

  expect(stepper(tree, 'cardioPlan.sessionLimit').props.value).toBe(30);
  expect(output(tree)).not.toContain('healthPlanning.source');
  await act(async () => tree.unmount());
});

it('keeps one wand recommendation visible through setup and only replaces edited limits on a tap', async () => {
  const { WandIcon } = require('@/components/icons/ActionIcons'); let tree: any;
  await act(async () => { tree = create(<CardioPlanBuilder {...props} />); });
  await press(tree,'cardioPlan.RUNNING');
  expect(button(tree,'cardioGuidance.suggest').findAllByType(WandIcon)).toHaveLength(1);
  await press(tree,'cardioGuidance.suggest');
  expect(output(tree)).toContain('cardioPlan.currentDuration');
  expect(button(tree,'cardioGuidance.suggest').findAllByType(WandIcon)).toHaveLength(1);
  await press(tree,'cardioGuidance.suggest');
  expect(stepper(tree,'cardioPlan.sessionLimit')).toBeDefined();
  await act(async()=>stepper(tree,'cardioPlan.sessionLimit').props.onChange(35));
  await act(async()=>tree.update(<CardioPlanBuilder {...props} />));
  expect(stepper(tree,'cardioPlan.sessionLimit').props.value).toBe(35);
  await press(tree,'cardioGuidance.suggest');
  expect(stepper(tree,'cardioPlan.sessionLimit').props.value).not.toBe(35);
  expect(tree.root.findAllByType(WandIcon)).toHaveLength(1);
  await act(async()=>tree.unmount());
});

it('shows the complete Sections form with one review action and no intermediate Next steps',async()=>{
  let tree:any; await act(async()=>{tree=create(<CardioPlanBuilder {...props} sharedAvailability={{cycleDays:8,trainingDays:5,minutesPerSession:60,allowDoubles:true}}/>)});
  expect(button(tree,'exerciseWizard.next')).toBeUndefined();
  expect(tree.root.findAllByType(ScrollView)[0].findAll((n:any)=>n.props.accessibilityLabel==='cardioPlan.review')).toHaveLength(0);
  expect(button(tree,'cardioPlan.review').props.disabled).toBe(true);
  await press(tree,'cardioPlan.RUNNING');
  expect(tree.root.findByType(CardioSelectRow)).toBeDefined();
  expect(stepper(tree,'cardioSections.duration').props.max).toBe(60);
  expect(stepper(tree,'cardioSections.duration').props.plain).toBe(true);
  expect(stepper(tree,'cardioPlan.cardioBudget')).toBeUndefined();
  await act(async()=>stepper(tree,'cardioSections.duration').props.onChange(45));
  await press(tree,'cardioPlan.review');
  expect(tree.root.findByType(CardioCycleView).props.input).toMatchObject({sessionMinutes:45,cardioMinutes:90,cycleDays:8,maxActiveDays:5});
  await press(tree,'cardioPlan.edit');
  expect(stepper(tree,'cardioSections.duration').props.value).toBe(45);
  await act(async()=>tree.unmount());
});

it('uses the shared cardio allocation for an untouched draft and retains an explicit frequency', async () => {
  let tree: any;
  const hybrid = { name: 'Hybrid', priority: 'STRENGTH' as const };
  const sharedAvailability = { cycleDays: 7, trainingDays: 4, minutesPerSession: 60, allowDoubles: false };
  const render = (recommendedSessions: number) => <CardioPlanBuilder {...props}
    routine={routine} hybrid={hybrid} sharedAvailability={sharedAvailability} recommendedSessions={recommendedSessions} />;
  await act(async () => { tree = create(render(1)); });
  await press(tree, 'cardioPlan.CYCLING');
  expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(1);
  await act(async () => tree.update(render(2)));
  expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(2);
  await act(async () => stepper(tree, 'cardioPlan.sessions').props.onChange(1));
  await act(async () => tree.update(render(1)));
  await act(async () => tree.update(render(2)));
  expect(stepper(tree, 'cardioPlan.sessions').props.value).toBe(1);
  await act(async () => tree.unmount());
});
