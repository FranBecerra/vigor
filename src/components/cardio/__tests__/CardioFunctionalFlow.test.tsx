import React from 'react';
import { Alert, Switch } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { CardioActivation } from '../CardioActivation';
import { CardioSlotEditor, CardioTimeline } from '../CardioTimeline';
import { CardioTrainingHome } from '../CardioTrainingHome';
import CardioBlockScreen from '@/app/(tabs)/(train)/cardio-block';
import CardioWorkoutScreen from '@/app/(tabs)/(train)/cardio-workout';
import CardioCheck from '@/app/(tabs)/(train)/cardio-check';
import { NumericField } from '@/components/train/NumericField';
import { SessionEffortInput } from '@/components/train/SessionEffortInput';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { cardioFixture, weeklyCardioAgendaFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
import { changeCardioSlot } from '@/services/cardio/cardioBlock';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { saveSportDraft } from '@/services/cardio/sportActivities';
import { withCardioProgression } from '@/services/cardio/cardioProgression';
import { CardioProgressionReview } from '../CardioProgressionReview';
import { SportActivityForm } from '../SportActivityForm';
import { hybridFixture } from '@/test-support/hybridFixture';
import { prepareHybridBundle } from '@/services/cardio/hybridAuthoring';
import { toRoutineView } from '@/services/training/routineView';
import { HybridCapacityPanel } from '../HybridCapacityPanel';
import { CardioActivationPanel } from '../CardioActivation';
const { create, act } = require('react-test-renderer');
let mockUid = 'owner', mockParams: any = { id: 'block' };
const mockRouter = { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true), back: jest.fn() };
const mockBlocks = { entries: [] as any[], ready: true, error: false, pending: false, reload: jest.fn(), newId: jest.fn(() => 'block-new'), save: jest.fn() };
const mockWorkouts = { entries: [] as any[], ready: true, error: false, pending: false, reload: jest.fn(), newId: jest.fn(() => 'run-new'), save: jest.fn() };
const mockExportCardio = jest.fn(async () => true);
const mockSports = { entries: [] as any[], ready: true, error: false, reload: jest.fn() };
const mockStrength = { routines: [] as any[], status: 'ready', reload: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('@/app/(tabs)/(train)/generate', () => ({ StrengthPlanBuilder: () => null }));
jest.mock('@/test-support/CardioHomeCheck', () => ({ CardioHomeCheck: () => null }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useHealthExport', () => ({ useHealthExport: () => ({ service: { exportCardio: mockExportCardio } }) }));
jest.mock('@/hooks/useCardioTraining', () => ({ useCardioBlocks: () => mockBlocks, useCardioWorkouts: () => mockWorkouts }));
jest.mock('@/hooks/useSportActivities', () => ({ useSportActivities: () => mockSports }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => mockStrength }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
const block = cardioFixture();
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const output = (tree: any) => JSON.stringify(tree.toJSON());
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(now); jest.clearAllMocks(); mockUid = 'owner'; mockParams = { id: 'block' };
  mockBlocks.entries = []; mockWorkouts.entries = []; mockSports.entries = []; mockStrength.routines = []; mockStrength.status = 'ready';
  for (const store of [mockBlocks, mockWorkouts, mockSports]) { store.ready = true; store.error = false; }
  mockBlocks.save.mockReset().mockImplementation(async (next: any) => { mockBlocks.entries = [...mockBlocks.entries.filter(b => b.id !== next.id), next]; return next; });
  mockWorkouts.save.mockReset().mockImplementation(async (next: any) => { mockWorkouts.entries = [...mockWorkouts.entries.filter(w => w.id !== next.id), next]; return next; });
});

it.each(['1', '-1', '99', 'invalid'])('opens the requested cardio cycle with bounded selection: %s', async cycle => {
  mockBlocks.entries = [block]; mockParams = { id: block.id, cycle };
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  const tabs = tree.root.findByType(CardioTimeline).findAll((node: any) => node.props.accessibilityRole === 'tab' && node.props.onPress);
  expect(tabs.map((tab: any) => tab.props.accessibilityState.selected)).toEqual(cycle === '1' ? [false, true] : [true, false]);
  await act(async () => tree.unmount());
});
afterEach(() => { jest.useRealTimers(); });
it('completes proposal review → activation → start → pause/resume → finish → actual correction', async () => {
  let tree: any; await act(async () => { tree = create(<CardioActivation plan={block.proposal} ready />); });
  expect(mockBlocks.save).not.toHaveBeenCalled(); await act(async () => tree.root.findByType(Stepper).props.onChange(2));
  await press(tree, 'cardioTraining.reviewDates'); expect(button(tree, 'cardioTraining.activate').props.disabled).toBe(true);
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true)); await press(tree, 'cardioTraining.activate');
  expect(mockBlocks.entries[0]).toMatchObject({ id: 'block-new', revision: 1, cycles: 2, endedAt: null });
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/cardio-block', params: { id: 'block-new' } });
  mockParams = { id: 'block-new' }; await act(async () => tree.update(<CardioBlockScreen />));
  await act(async () => tree.root.findByType(CardioTimeline).props.onOpen(mockBlocks.entries[0].slots[0]));
  expect(mockWorkouts.entries[0].status).toBe('RUNNING'); expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/cardio-workout', params: { id: 'run-new' } });
  mockParams = { id: 'run-new' }; await act(async () => tree.update(<CardioWorkoutScreen />));
  await act(async () => jest.advanceTimersByTime(60000)); await press(tree, 'cardioTraining.pause');
  expect(mockWorkouts.entries[0].elapsedMs).toBe(60000); const writes = mockWorkouts.save.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(60000)); expect(mockWorkouts.save).toHaveBeenCalledTimes(writes);
  await press(tree, 'cardioTraining.resume'); await act(async () => jest.advanceTimersByTime(120000)); await press(tree, 'cardioTraining.finish');
  expect(tree.root.findByType(NumericField).props.value).toBe(3); expect(mockWorkouts.entries[0].status).toBe('PAUSED');
  expect(mockExportCardio).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(4)); await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(7));
  mockWorkouts.save.mockRejectedValueOnce(Error('local write failed'));
  await press(tree, 'cardioTraining.saveResult');
  expect(mockExportCardio).not.toHaveBeenCalled(); expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  await press(tree, 'cardioTraining.saveResult'); expect(mockWorkouts.entries[0]).toMatchObject({ status: 'FINISHED', actualSeconds: 240, feedback: { effort: 7 } });
  expect(mockExportCardio).toHaveBeenCalledWith(mockWorkouts.entries[0]);
  expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/(tabs)/(train)'); const finishedAt = mockWorkouts.entries[0].finishedAt;
  mockRouter.dismissTo.mockClear();
  await press(tree, 'cardioTraining.editResult'); await act(async () => tree.root.findByType(NumericField).props.onChangeValue(3.5));
  await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(6)); await act(async () => jest.advanceTimersByTime(1000)); await press(tree, 'cardioTraining.saveResult');
  expect(mockWorkouts.entries[0]).toMatchObject({ actualSeconds: 210, finishedAt, feedback: { effort: 6, timing: 'HISTORY_EDIT' } });
  expect(mockExportCardio).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  await press(tree, 'workout.done'); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('requires loaded context, blocks a second active block and resets acknowledgement after context changes', async () => {
  let tree: any; mockBlocks.ready = false; await act(async () => { tree = create(<CardioActivation plan={block.proposal} ready />); });
  expect(button(tree, 'cardioTraining.reviewDates').props.disabled).toBe(true); mockBlocks.ready = true;
  await act(async () => tree.update(<CardioActivation plan={block.proposal} ready />)); await press(tree, 'cardioTraining.reviewDates');
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  mockSports.entries = [saveSportDraft('padel', 'owner', { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'PLAN', startAt: now, durationMinutes: 60, timeZone: 'UTC', effort: null }, now)];
  await act(async () => tree.update(<CardioActivation plan={block.proposal} ready />)); expect(tree.root.findByType(Switch).props.value).toBe(false);
  mockBlocks.entries = [block]; await act(async () => tree.update(<CardioActivation plan={block.proposal} ready />)); expect(button(tree, 'cardioTraining.activate').props.disabled).toBe(true);
  expect(output(tree)).toContain('cardioTraining.activeExists'); await act(async () => tree.unmount());
});

function hybridActivation() {
  const f = hybridFixture(), bundle = prepareHybridBundle(f.draft, f.input, { ...f.settings, totalMinutesPerCycle: 100 }, f.exercises, f.labels, now);
  return { plan: bundle.cardio, routine: toRoutineView(bundle.routine, bundle.mesocycle, f.exercises, f.labels)! };
}
it('blocks an oversubscribed hybrid horizon until explicit slot adjustment and requires fresh acknowledgement', async () => {
  const f = hybridActivation(); let tree: any;
  mockSports.entries = [saveSportDraft('padel', 'owner', { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'PLAN',
    startAt: now + 86400000, durationMinutes: 60, timeZone: 'UTC', effort: null }, now)];
  await act(async () => { tree = create(<CardioActivation {...f} ready />); });
  await press(tree, 'cardioTraining.reviewDates');
  expect(tree.root.findByType(HybridCapacityPanel).props.review.fits).toBe(false);
  expect(output(tree)).toContain('hybridCapacity.over');
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  await press(tree, 'cardioTraining.activate'); expect(mockBlocks.save).not.toHaveBeenCalled();
  const old = button(tree, 'cardioTraining.activate').props.onPress;
  // Remove an actual reservation from context: it never auto-skips a cardio prescription.
  mockSports.entries = []; await act(async () => tree.update(<CardioActivation {...f} ready />));
  expect(tree.root.findByType(HybridCapacityPanel).props.review.fits).toBe(true);
  expect(tree.root.findByType(Switch).props.value).toBe(false);
  await act(async () => old()); expect(mockBlocks.save).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  mockBlocks.save.mockRejectedValueOnce(Error('offline')); await press(tree, 'cardioTraining.activate');
  expect(output(tree)).toContain('cardioTraining.saveFailed'); expect(tree.root.findByType(HybridCapacityPanel)).toBeDefined();
  await press(tree, 'cardioTraining.activate'); expect(mockBlocks.save).toHaveBeenCalledTimes(2);
  expect(mockBlocks.save.mock.calls[1][0].id).toBe(mockBlocks.save.mock.calls[0][0].id);
  await act(async () => tree.unmount());
});
it('rechecks skipped/replaced cardio and never treats missing or malformed context as free capacity', async () => {
  const f = hybridActivation(); let tree: any;
  await act(async () => { tree = create(<CardioActivation {...f} ready />); });
  await press(tree, 'cardioTraining.reviewDates');
  const before = tree.root.findByType(HybridCapacityPanel).props.review.cycles[0].cardioMinutes;
  const editor = tree.root.findByType(CardioSlotEditor);
  await act(async () => tree.root.findByType(CardioTimeline).props.onEdit(editor.props.block.slots[0]));
  await act(async () => tree.root.findByType(CardioSlotEditor).props.onSave(editor.props.block.slots[0].date, 'SKIPPED', null));
  expect(tree.root.findByType(HybridCapacityPanel).props.review.cycles[0].cardioMinutes).toBe(before - 20);
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  const old = button(tree, 'cardioTraining.activate').props.onPress;
  mockSports.ready = false; await act(async () => tree.update(<CardioActivation {...f} ready />));
  expect(output(tree)).toContain('hybridCapacity.unavailable'); expect(tree.root.findAllByType(HybridCapacityPanel)).toHaveLength(0);
  await act(async () => old()); expect(mockBlocks.save).not.toHaveBeenCalled();
  mockSports.ready = true; mockSports.entries = [{ userId: 'owner', id: 'invalid' }];
  await act(async () => tree.update(<CardioActivation {...f} ready />));
  expect(output(tree)).toContain('hybridCapacity.unavailable'); expect(button(tree, 'cardioTraining.activate').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});
it('edits an unexecuted opportunity, supports explicit skip and preserves a rejected save', async () => {
  mockBlocks.entries = [block]; let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  await act(async () => tree.root.findByType(CardioTimeline).props.onEdit(block.slots[0]));
  await press(tree, 'cardioTraining.skip'); expect(mockBlocks.entries[0].slots[0].disposition).toBe('SKIPPED');
  await act(async () => tree.root.findByType(CardioTimeline).props.onEdit(mockBlocks.entries[0].slots[0]));
  mockBlocks.save.mockRejectedValueOnce(Error('offline')); await press(tree, 'cardioTraining.restore'); expect(output(tree)).toContain('cardioTraining.saveFailed');
  expect(tree.root.findByType(CardioSlotEditor).props.slot).not.toBeNull(); await act(async () => tree.unmount());
});
it('does not start another session when execution exists and requires confirmation to end/discard', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockBlocks.entries = [block]; const run = startCardioWorkout(block, block.slots[0].id, now, 'run'); mockWorkouts.entries = [run];
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  await act(async () => tree.root.findByType(CardioTimeline).props.onOpen(block.slots[1])); expect(mockWorkouts.save).not.toHaveBeenCalled();
  expect(button(tree, 'cardioTraining.end').props.disabled).toBe(true);
  mockParams = { id: 'run' }; await act(async () => tree.update(<CardioWorkoutScreen />)); await press(tree, 'cardioTraining.discard'); expect(mockWorkouts.save).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0][2]![1].onPress!()); expect(mockWorkouts.entries[0].status).toBe('DISCARDED');
  mockParams = { id: 'block' }; await act(async () => tree.update(<CardioBlockScreen />)); await press(tree, 'cardioTraining.end');
  await act(async () => alert.mock.calls[1][2]![1].onPress!()); expect(mockBlocks.entries[0].endedAt).toBe(now);
  await act(async () => tree.unmount()); alert.mockRestore();
});
it('survives a runner remount without resetting elapsed time and exposes saved progress from home', async () => {
  const run = startCardioWorkout(block, block.slots[0].id, now, 'run'); mockWorkouts.entries = [run]; mockBlocks.entries = [block]; mockParams = { id: 'run' };
  jest.setSystemTime(now + 300000); let tree: any; await act(async () => { tree = create(<CardioWorkoutScreen />); }); expect(output(tree)).toContain('5:00');
  await act(async () => tree.unmount()); jest.setSystemTime(now + 600000); await act(async () => { tree = create(<CardioWorkoutScreen />); }); expect(output(tree)).toContain('10:00');
  expect(mockWorkouts.save).not.toHaveBeenCalled(); await act(async () => tree.update(<CardioTrainingHome />)); await press(tree, 'cardioTraining.resume');
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/cardio-workout', params: { id: 'run' } }); await act(async () => tree.unmount());
});

it('shows actual completed duration separately from the target instead of claiming the whole prescription was performed', async () => {
  const run = startCardioWorkout(block, block.slots[0].id, now, 'run');
  const done = transitionCardioWorkout(run, 'FINISH', now + 6000, 6, 7);
  let tree: any; await act(async () => { tree = create(<CardioTimeline block={block} sports={[]} strength={[]} workouts={[done]} />); });
  expect(output(tree)).toContain('0:06 ✓'); expect(output(tree)).toContain('cardioTraining.plannedDuration');
  await act(async () => tree.unmount());
});

it('requires actual-date review before starting an ahead-of-schedule session without moving the slot', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); mockBlocks.entries = [block];
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  await act(async () => tree.root.findByType(CardioTimeline).props.onOpen(block.slots[1]));
  expect(mockWorkouts.save).not.toHaveBeenCalled(); expect(alert.mock.calls[0][0]).toBe('cardioTraining.startNow');
  await act(async () => alert.mock.calls[0][2]![1].onPress!()); expect(mockWorkouts.entries[0].slotId).toBe(block.slots[1].id);
  expect(mockBlocks.entries[0].slots[1].date).toBe(block.slots[1].date); await act(async () => tree.unmount()); alert.mockRestore();
});
it('retains state on transition failure and suppresses navigation after an owner change', async () => {
  const run = startCardioWorkout(block, block.slots[0].id, now, 'run'); mockWorkouts.entries = [run]; mockParams = { id: 'run' };
  mockWorkouts.save.mockRejectedValueOnce(Error('native')); let tree: any; await act(async () => { tree = create(<CardioWorkoutScreen />); }); await press(tree, 'cardioTraining.pause');
  expect(mockWorkouts.entries[0].status).toBe('RUNNING'); expect(output(tree)).toContain('cardioTraining.saveFailed');
  let done!: (value: any) => void; mockWorkouts.save.mockImplementationOnce(() => new Promise(resolve => { done = resolve; }));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); await press(tree, 'cardioTraining.discard');
  let pending: Promise<void>; await act(async () => { pending = alert.mock.calls[0][2]![1].onPress!() as any; });
  mockUid = 'other'; mockWorkouts.entries = []; await act(async () => tree.update(<CardioWorkoutScreen />)); await act(async () => { done(run); await pending!; });
  expect(mockRouter.dismissTo).not.toHaveBeenCalled(); await act(async () => tree.unmount()); alert.mockRestore();
});

it('reviews a completed microcycle, confirms the next dose and starts from it without changing recorded work', async () => {
  const progressive = withCardioProgression(block);
  mockBlocks.entries = [progressive];
  mockWorkouts.entries = progressive.slots.filter(s => s.cycle === 0).map((s, i) => {
    const run = startCardioWorkout(progressive, s.id, now, `completed-${i}`);
    return transitionCardioWorkout(run, 'FINISH', now + 3600000, run.prescription.durationSeconds, 3);
  });
  const actuals = JSON.stringify(mockWorkouts.entries);
  jest.setSystemTime(now + 8 * 86400000);
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  await press(tree, 'cardioProgression.review');
  expect(button(tree, 'cardioProgression.about')).toBeUndefined();
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(true);
  expect(button(tree, 'cardioProgression.repeat').props.disabled).toBe(false);
  expect(output(tree)).toContain('cardioProgression.current'); expect(output(tree)).not.toContain('cardioProgression.next');
  for (const key of ['easy_YES', 'recovered_YES', 'symptoms_NONE']) await press(tree, `cardioProgression.answer_${key}`);
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(false);
  expect(output(tree)).toContain('cardioProgression.next');
  expect(mockBlocks.save).not.toHaveBeenCalled();
  mockBlocks.save.mockRejectedValueOnce(Error('offline'));
  await press(tree, 'cardioProgression.increase'); expect(output(tree)).toContain('cardioTraining.saveFailed');
  expect(tree.root.findByType(CardioProgressionReview).props.block.progression.reviews).toHaveLength(0);
  await press(tree, 'cardioProgression.increase');
  expect(mockBlocks.entries[0].progression.reviews[0].nextSeconds).toEqual([1260, 1260]);
  expect(JSON.stringify(mockWorkouts.entries)).toBe(actuals);
  await act(async () => tree.update(<CardioBlockScreen />));
  expect(startCardioWorkout(mockBlocks.entries[0], block.slots[2].id, Date.now(), 'confirmed').prescription.durationSeconds).toBe(1260);
  expect(mockWorkouts.save).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});

it('shows no microcycle review right after activation and offers it once the first microcycle has ended', async () => {
  const progressive = withCardioProgression(block); mockBlocks.entries = [progressive];
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  expect(tree.root.findAllByType(CardioProgressionReview)).toHaveLength(1);
  expect(button(tree, 'cardioProgression.review')).toBeUndefined();
  expect(output(tree)).not.toContain('cardioProgression.title');
  jest.setSystemTime(now + 8 * 86400000); await act(async () => tree.update(<CardioBlockScreen />));
  expect(button(tree, 'cardioProgression.review').props.disabled).toBe(false);
  await act(async () => tree.unmount());
});

it('keeps a pending review read-only when context is unavailable and can explicitly repeat an unknown dose', async () => {
  const progressive = withCardioProgression(block); mockBlocks.entries = [progressive];
  mockWorkouts.ready = false; jest.setSystemTime(now + 8 * 86400000);
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  expect(button(tree, 'cardioProgression.review').props.disabled).toBe(true);
  mockWorkouts.ready = true; await act(async () => tree.update(<CardioBlockScreen />)); await press(tree, 'cardioProgression.review');
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(true);
  await press(tree, 'cardioProgression.repeat');
  expect(mockBlocks.entries[0].progression.reviews[0]).toMatchObject({ decision: 'REPEAT', nextSeconds: [1200, 1200] });
  await act(async () => tree.unmount());
});

it('saves a final microcycle evaluation without offering a nonexistent next-dose increase', async () => {
  mockBlocks.entries = [withCardioProgression({ ...block, cycles: 1, slots: block.slots.filter(s => s.cycle === 0) })];
  jest.setSystemTime(now + 8 * 86400000);
  let tree: any; await act(async () => { tree = create(<CardioBlockScreen />); });
  await press(tree, 'cardioProgression.review');
  expect(button(tree, 'cardioProgression.increase')).toBeUndefined();
  await press(tree, 'cardioProgression.finishReview');
  expect(mockBlocks.entries[0].progression.reviews[0]).toMatchObject({ decision: 'REPEAT', cycle: 0 });
  expect(mockWorkouts.save).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});

it('stages a memory-only just-activated block without a microcycle review', async () => {
  let tree: any; await act(async () => { tree = create(<CardioCheck />); });
  await press(tree, 'Preview just-activated block (fixture)');
  expect(tree.root.findByType(CardioProgressionReview).props.block.progression.reviews).toEqual([]);
  expect(button(tree, 'cardioProgression.review')).toBeUndefined();
  await press(tree, 'Preview completed cycle (fixture)');
  expect(button(tree, 'cardioProgression.review')).toBeDefined();
  expect(mockBlocks.save).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});

it('stages the memory-only completed-cycle fixture by civil days across the autumn DST change', async () => {
  jest.setSystemTime(Date.UTC(2026, 9, 29, 22, 30));
  let tree: any; await act(async () => { tree = create(<CardioCheck />); });
  await press(tree, 'Preview completed cycle (fixture)'); await press(tree, 'cardioProgression.review');
  for (const key of ['easy_YES', 'recovered_YES', 'symptoms_NONE']) await press(tree, `cardioProgression.answer_${key}`);
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(false);
  await press(tree, 'cardioProgression.increase'); expect(mockBlocks.save).not.toHaveBeenCalled(); expect(mockWorkouts.save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('keeps recurring creation/failure/retry and a single-occurrence edit entirely in memory', async () => {
  let tree: any; await act(async () => { tree = create(<CardioCheck />); });
  await press(tree, 'Preview recurring save failure (memory only)');
  const draft = { sport: 'PADEL' as const, context: 'CLASS' as const, name: 'Synthetic class', notes: '', mode: 'PLAN' as const,
    startAt: now + 86400000, durationMinutes: 60, timeZone: 'UTC', effort: null,
    repeat: { frequency: 'WEEKLY' as const, interval: 1, weekdays: [4], untilDate: '2026-11-12' } };
  await act(async () => { await expect(tree.root.findByType(SportActivityForm).props.onSave(draft)).rejects.toThrow('syntheticSaveFailure'); });
  expect(tree.root.findByType(SportActivityForm)).toBeDefined();
  await act(async () => tree.root.findByType(SportActivityForm).props.onSave(draft));
  expect(output(tree)).toContain('Synthetic activities saved in memory only: ');
  await press(tree, 'Edit first occurrence (memory only)');
  const form = tree.root.findByType(SportActivityForm); expect(form.props.activity.occurrence.index).toBe(0);
  const original = form.props.activity;
  await act(async () => form.props.onSave({ ...draft, repeat: undefined, name: 'Only first' }));
  expect(output(tree)).toContain('Synthetic class');
  await press(tree, 'Edit first occurrence (memory only)');
  expect(tree.root.findByType(SportActivityForm).props.activity.name).toBe('Only first');
  expect(tree.root.findByType(SportActivityForm).props.activity.occurrence.seriesId).toBe(original.occurrence.seriesId);
  await act(async () => tree.root.findByType(SportActivityForm).props.onCancel());
  await press(tree, 'Preview recurring activity (memory only)');
  await act(async () => tree.root.findByType(SportActivityForm).props.onCancel());
  expect('save' in mockSports).toBe(false); expect(mockBlocks.save).not.toHaveBeenCalled(); expect(mockWorkouts.save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('exercises native shared-capacity acceptance through the production panel without invoking account saves', async () => {
  let tree: any; await act(async () => { tree = create(<CardioCheck />); });
  await press(tree, 'Preview shared capacity (memory only)');
  expect(tree.root.findByType(CardioActivationPanel)).toBeDefined();
  await press(tree, 'cardioTraining.reviewDates');
  expect(tree.root.findByType(HybridCapacityPanel).props.review.fits).toBe(false);
  expect(output(tree)).not.toContain('hybridCapacity.scope');
  await press(tree, 'hybridCapacity.info'); expect(output(tree)).toContain('hybridCapacity.scope');
  await press(tree, 'hybridCapacity.info'); expect(output(tree)).not.toContain('hybridCapacity.scope');
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  expect(button(tree, 'cardioTraining.activate').props.disabled).toBe(true);
  await press(tree, 'Remove synthetic reservation');
  expect(tree.root.findByType(Switch).props.value).toBe(false);
  expect(tree.root.findByType(HybridCapacityPanel).props.review.fits).toBe(true);
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  await press(tree, 'cardioTraining.activate'); expect(output(tree)).toContain('cardioTraining.saveFailed');
  await press(tree, 'cardioTraining.activate'); expect(output(tree)).toContain('Synthetic activation accepted in memory only');
  expect(mockBlocks.save).not.toHaveBeenCalled(); expect(mockWorkouts.save).not.toHaveBeenCalled();
  await press(tree, 'Exit capacity check (memory only)'); expect(output(tree)).toContain('CARDIO CHECK');
  await act(async () => tree.unmount());
});

it('keeps an adjusted occurrence in its own cardio tab even when its date crosses the nominal cycle boundary', async () => {
  const { block: weekly, workouts } = weeklyCardioAgendaFixture();
  const second = weekly.slots[1];
  const edited = changeCardioSlot(weekly, second.id, '2026-11-15', 'CARDIO', null, workouts, Date.UTC(2026, 10, 15, 17));
  const onEdit = jest.fn();
  let tree: any;
  await act(async () => { tree = create(<CardioTimeline block={edited} sports={[]} strength={[]} workouts={workouts} onEdit={onEdit} initialCycle={1} />); });
  expect(output(tree)).toContain('2026-11-15');
  expect(output(tree)).not.toContain('30:00 ✓');
  await press(tree, 'cardioTraining.adjust');
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: second.id, cycle: 1, date: '2026-11-15' }));
  const firstTab = tree.root.findAll((node: any) => node.props.accessibilityRole === 'tab' && node.props.onPress)[0];
  await act(async () => firstTab.props.onPress());
  expect(output(tree)).toContain('30:00 ✓');
  expect(button(tree, 'cardioTraining.adjust')).toBeUndefined();
  await act(async () => tree.unmount());
});
