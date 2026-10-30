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
import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';
import { saveSportDraft } from '@/services/cardio/sportActivities';
import { withCardioProgression } from '@/services/cardio/cardioProgression';
import { CardioProgressionReview } from '../CardioProgressionReview';
const { create, act } = require('react-test-renderer');
let mockUid = 'owner', mockParams: any = { id: 'block' };
const mockRouter = { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true), back: jest.fn() };
const mockBlocks = { entries: [] as any[], ready: true, error: false, pending: false, reload: jest.fn(), newId: jest.fn(() => 'block-new'), save: jest.fn() };
const mockWorkouts = { entries: [] as any[], ready: true, error: false, pending: false, reload: jest.fn(), newId: jest.fn(() => 'run-new'), save: jest.fn() };
const mockSports = { entries: [] as any[], ready: true, error: false, reload: jest.fn() };
const mockStrength = { routines: [] as any[], status: 'ready', reload: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useCardioTraining', () => ({ useCardioBlocks: () => mockBlocks, useCardioWorkouts: () => mockWorkouts }));
jest.mock('@/hooks/useSportActivities', () => ({ useSportActivities: () => mockSports }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => mockStrength }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
  await act(async () => tree.root.findByType(NumericField).props.onChangeValue(4)); await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(7));
  await press(tree, 'cardioTraining.saveResult'); expect(mockWorkouts.entries[0]).toMatchObject({ status: 'FINISHED', actualSeconds: 240, feedback: { effort: 7 } });
  expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/(tabs)/(train)'); const finishedAt = mockWorkouts.entries[0].finishedAt;
  mockRouter.dismissTo.mockClear();
  await press(tree, 'cardioTraining.editResult'); await act(async () => tree.root.findByType(NumericField).props.onChangeValue(3.5));
  await act(async () => tree.root.findByType(SessionEffortInput).props.onChange(6)); await act(async () => jest.advanceTimersByTime(1000)); await press(tree, 'cardioTraining.saveResult');
  expect(mockWorkouts.entries[0]).toMatchObject({ actualSeconds: 210, finishedAt, feedback: { effort: 6, timing: 'HISTORY_EDIT' } });
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
  expect(output(tree)).not.toContain('cardioProgression.smallStep');
  await press(tree, 'cardioProgression.about'); expect(output(tree)).toContain('cardioProgression.smallStep');
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(true);
  for (const key of ['easy_YES', 'recovered_YES', 'symptoms_NONE']) await press(tree, `cardioProgression.answer_${key}`);
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(false);
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

it('stages the memory-only completed-cycle fixture by civil days across the autumn DST change', async () => {
  jest.setSystemTime(Date.UTC(2026, 9, 29, 22, 30));
  let tree: any; await act(async () => { tree = create(<CardioCheck />); });
  await press(tree, 'Preview completed cycle (fixture)'); await press(tree, 'cardioProgression.review');
  for (const key of ['easy_YES', 'recovered_YES', 'symptoms_NONE']) await press(tree, `cardioProgression.answer_${key}`);
  expect(button(tree, 'cardioProgression.increase').props.disabled).toBe(false);
  await press(tree, 'cardioProgression.increase'); expect(mockBlocks.save).not.toHaveBeenCalled(); expect(mockWorkouts.save).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
