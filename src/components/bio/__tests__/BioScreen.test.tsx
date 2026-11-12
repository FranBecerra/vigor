import React from 'react';
import { FlatList, Modal } from 'react-native';
import BioScreen from '@/app/(tabs)/bio';
import { MicrocycleReviewSheet } from '../MicrocycleReviewSheet';
import { MicrocycleReviewPrompt } from '../MicrocycleReviewPrompt';
import { MicrocycleReviewDialog } from '../MicrocycleReviewDialog';
import { BioNightDetailsSheet } from '../BioNightDetailsSheet';
import { BioNightCard } from '../BioNightCard';
import { buildBioCycles, createMicrocycleReview } from '@/services/bio/microcycleReview';
const { create, act } = require('react-test-renderer');
const mockSave = jest.fn(), mockNavigate = jest.fn(), mockReload = jest.fn();
let mockUid: string | null = 'owner', mockParams: any = {};
let mockData: any, mockReviews: any, mockNightState = 'OFF';
const mockCatalogue = new Map();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ navigate: mockNavigate, push: mockNavigate }),
  useFocusEffect: (callback: () => unknown) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/hooks/useDailyCheckIn', () => ({ useDailyCheckIn: () => ({ owner: mockUid, date: '2026-10-26', ready: true, error: false, pending: false, save: jest.fn() }) }));
jest.mock('@/hooks/useBioHealth', () => ({ useBioHealth: () => ({ state: 'OFF', trends: [] }) }));
jest.mock('@/hooks/useBioNight', () => ({ useBioNight: () => ({ state: mockNightState, analysis: { status: 'EMPTY' }, reload: jest.fn() }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ ready: true, settings: {} }) }));
jest.mock('@/hooks/useBioDailyHistory', () => ({ useBioDailyHistory: () => ({ ready: true, error: false, entries: [] }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useBioHistory', () => ({ useBioHistory: () => mockData }));
jest.mock('@/hooks/useMicrocycleReviews', () => ({ useMicrocycleReviews: () => mockReviews }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockCatalogue }) }));
const plan: any = { id: 'plan', userId: 'owner', routineId: 'routine', status: 'ACTIVE', prescriptionMode: 'MANUAL', currentMicrocycleIndex: 1,
  startedAt: 10, plannedSessions: [{ index: 0, exercises: [] }], skippedSessions: { '0:0': 100 } };
const cycle = buildBioCycles('owner', [plan], [], 200).find((item) => item.index === 0)!;
const routine: any = { isActive: true, name: 'Personal plan', mesocycleId: 'plan', microcycles: [{ number: 1, sessions: [{ skippedOn: '2026-10-26' }] }] };
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = (tree: any) => tree.root.findAll((node: any) => typeof node.props.children === 'string').map((node: any) => node.props.children).join(' ');
beforeEach(() => {
  jest.clearAllMocks(); mockUid = 'owner'; mockParams = {}; mockNightState = 'OFF';
  mockData = { owner: mockUid, ready: true, error: false, plans: [plan], routines: [{ id: 'routine', name: 'Personal plan' }], history: [{ id: 'observed', userId: 'owner', mesocycleId: 'plan', microcycleIndex: 0,
    plannedSessionIndex: 0, performedAt: 20, completedAt: 60, exercises: [] }], reload: mockReload };
  mockReviews = { ready: true, error: false, entries: [], save: mockSave }; mockSave.mockResolvedValue(undefined);
});
it('shows no invented readiness and lets the athlete review actual cycles without touching prescriptions', async () => {
  let tree: any; await act(async () => { tree = create(<BioScreen />); });
  expect(text(tree)).toContain('bioSummary.UNKNOWN'); expect(mockSave).not.toHaveBeenCalled();
  await act(async () => button(tree, 'bio.review').props.onPress());
  expect(tree.root.findByType(MicrocycleReviewSheet).props.initial).toEqual({});
  await act(async () => tree.root.findByType(MicrocycleReviewSheet).props.onSave({ recovery: 'USUAL' }));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan:m0' }), { recovery: 'USUAL' });
  await act(async () => tree.root.findByType(MicrocycleReviewSheet).props.onClose());
  expect(button(tree, 'bio.today')).toBeUndefined(); expect(button(tree, 'bio.response')).toBeUndefined();
  await act(async () => button(tree, 'bio.seeResponse').props.onPress());
  expect(text(tree)).toContain('bio.workingSets');
  expect(plan.currentMicrocycleIndex).toBe(1); await act(async () => tree.unmount());
});
it('preserves reviewed answers, permits editing and never presents retrospective feedback as today’s score', async () => {
  mockReviews.entries = [createMicrocycleReview('owner', cycle, { recovery: 'WORSE', discomfort: 'PRESENT', sustainability: 'TIGHT', unrecoveredMuscles: [], context: ['STRESS'] }, 'SUBMITTED', undefined, 200)];
  mockParams = { mesocycleId: 'plan' }; let tree: any; await act(async () => { tree = create(<BioScreen />); });
  expect(text(tree)).toContain('bio.yourReview');
  await act(async () => button(tree, 'bio.editReview').props.onPress());
  expect(tree.root.findByType(MicrocycleReviewSheet).props.initial.recovery).toBe('WORSE');
  await act(async () => tree.root.findByType(MicrocycleReviewSheet).props.onClose());
  await act(async () => button(tree, 'bio.today').props.onPress());
  expect(text(tree)).toContain('bioSummary.UNKNOWN');
  expect(text(tree)).not.toContain('bio.yourReview'); await act(async () => tree.unmount());
});
it('handles read failures, empty states, skipped reviews and saves that fail without silently dropping errors', async () => {
  mockParams = { mesocycleId: 'plan' }; mockSave.mockRejectedValue(Error('offline'));
  let tree: any; await act(async () => { tree = create(<BioScreen />); });
  await act(async () => button(tree, 'bio.skip').props.onPress()); expect(text(tree)).toContain('bio.loadError');
  mockData = { ...mockData, error: true }; await act(async () => tree.update(<BioScreen />));
  await act(async () => button(tree, 'bio.retry').props.onPress()); expect(mockReload).toHaveBeenCalled();
  mockData = { ...mockData, error: false, plans: [], routines: [], history: [] }; await act(async () => tree.update(<BioScreen />));
  expect(text(tree)).toContain('bio.empty'); await act(async () => tree.unmount());
});
it('uses an inline invitation only for closed, unreviewed cycles; dismissed feedback stays dismissed', async () => {
  let tree: any; await act(async () => { tree = create(<MicrocycleReviewPrompt routines={[routine]} />); });
  await act(async () => button(tree, 'bio.review').props.onPress());
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(tree.root.findByType(MicrocycleReviewSheet).props.cycleNumber).toBe(1);
  await act(async () => tree.root.findByType(MicrocycleReviewSheet).props.onClose());
  mockReviews.entries = [createMicrocycleReview('owner', { ...cycle, id: 'plan:m1', index: 1 }, {}, 'DISMISSED', undefined, 200)];
  const withBacklog = { ...routine, microcycles: [...routine.microcycles, { number: 2, sessions: [{ completedOn: '2026-10-26' }] }] };
  await act(async () => tree.update(<MicrocycleReviewPrompt routines={[withBacklog]} />)); expect(tree.toJSON()).toBeNull();
  mockReviews.entries = []; mockReviews.error = true;
  await act(async () => tree.update(<MicrocycleReviewPrompt routines={[routine]} />)); expect(tree.toJSON()).toBeNull();
  mockReviews.error = false; await act(async () => tree.update(<MicrocycleReviewPrompt routines={[]} />)); expect(tree.toJSON()).toBeNull();
  await act(async () => tree.unmount());
});

it('keeps one native Modal alive when the Training invitation loads the questionnaire asynchronously', async () => {
  mockData = { ...mockData, ready: false, plans: [], history: [] };
  let tree: any;
  const render = () => <MicrocycleReviewPrompt routines={[routine]} />;
  await act(async () => { tree = create(render()); });
  await act(async () => button(tree, 'bio.review').props.onPress());
  const host = tree.root.findByType(Modal);
  expect(tree.root.findAllByType(MicrocycleReviewSheet)).toHaveLength(0);
  mockData = { ...mockData, ready: true, plans: [plan], history: [] };
  await act(async () => tree.update(render()));
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(Modal)).toBe(host);
  expect(tree.root.findByType(MicrocycleReviewSheet).props.embedded).toBe(true);
  await act(async () => button(tree, 'bio.recovery.USUAL').props.onPress());
  mockSave.mockRejectedValueOnce(Error('offline'));
  await act(async () => button(tree, 'bio.save').props.onPress());
  expect(text(tree)).toContain('bio.saveError');
  expect(tree.root.findByType(Modal)).toBe(host);
  await act(async () => button(tree, 'bio.save').props.onPress());
  expect(mockSave).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'plan:m0' }), { recovery: 'USUAL' });
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('opens the survey locally, preserves its draft through an error, and closes across an owner round trip', async () => {
  let tree: any; await act(async () => { tree = create(<MicrocycleReviewPrompt routines={[routine]} />); });
  await act(async () => button(tree, 'bio.review').props.onPress());
  const original = tree.root.findByType(MicrocycleReviewSheet);
  await act(async () => button(tree, 'bio.recovery.BETTER').props.onPress());
  mockReviews.error = true;
  await act(async () => tree.update(<MicrocycleReviewPrompt routines={[routine]} />));
  expect(tree.root.findByType(MicrocycleReviewSheet)).toBe(original);
  expect(button(tree, 'bio.recovery.BETTER').props.accessibilityState.selected).toBe(true);
  mockUid = 'other'; await act(async () => tree.update(<MicrocycleReviewPrompt routines={[routine]} />));
  expect(tree.root.findAllByType(MicrocycleReviewSheet)).toHaveLength(0);
  mockUid = 'owner'; mockReviews.error = false; await act(async () => tree.update(<MicrocycleReviewPrompt routines={[routine]} />));
  expect(tree.root.findAllByType(MicrocycleReviewSheet)).toHaveLength(0); expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('keeps the initial local review loading/error states dismissible and retries only the read', async () => {
  mockData.ready = false; let tree: any;
  await act(async () => { tree = create(<MicrocycleReviewDialog id="plan:m0" onClose={mockNavigate} />); });
  expect(text(tree)).toContain('bioMetricsRefreshing'); expect(mockSave).not.toHaveBeenCalled();
  mockData.ready = true; mockData.error = true;
  await act(async () => tree.update(<MicrocycleReviewDialog id="plan:m0" onClose={mockNavigate} />));
  await act(async () => button(tree, 'bio.retry').props.onPress()); expect(mockReload).toHaveBeenCalled();
  await act(async () => button(tree, 'bio.close').props.onPress()); expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('never leaves a private review editor visible after the owner changes', async () => {
  let tree: any; await act(async () => { tree = create(<BioScreen />); });
  await act(async () => button(tree, 'bio.review').props.onPress());
  mockUid = 'other'; mockData = { ...mockData, plans: [], routines: [], history: [] }; mockReviews.entries = [];
  await act(async () => tree.update(<BioScreen />)); expect(tree.root.findAllByType(MicrocycleReviewSheet)).toHaveLength(0);
  expect(text(tree)).not.toContain('Personal plan'); await act(async () => tree.unmount());
});
it('keeps a legacy block with a missing start date usable rather than crashing the selector', async () => {
  mockData.plans = [{ ...plan, startedAt: undefined }]; mockParams = { mesocycleId: 'plan' };
  let tree: any; await act(async () => { tree = create(<BioScreen />); });
  expect(text(tree)).toContain('Personal plan · —'); await act(async () => tree.unmount());
});

it('omits unstarted, discarded-only, foreign and future-only plans and removes upcoming plan/volume and raw workout panels', async () => {
  mockParams = { mesocycleId: 'never' };
  mockData.plans.push({ ...plan, id: 'never', routineId: 'never' }, { ...plan, id: 'discarded' }, { ...plan, id: 'foreign' }, { ...plan, id: 'future' });
  mockData.routines.push({ id: 'never', name: 'Never started' });
  const record = mockData.history[0];
  mockData.history.push({ ...record, id: 'discarded', mesocycleId: 'discarded', discardedAt: 100 },
    { ...record, id: 'foreign', mesocycleId: 'foreign', userId: 'other' }, { ...record, id: 'future', mesocycleId: 'future', completedAt: Date.now() + 100000 });
  let tree: any; await act(async () => { tree = create(<BioScreen />); });
  expect(text(tree)).not.toContain('Never started'); expect(text(tree)).toContain('bio.workingSets');
  expect(text(tree)).not.toContain('bioDose.title'); expect(text(tree)).not.toContain('bioSession.title');
  expect(button(tree, 'bioEvolution.performance')).toBeUndefined();
  await act(async () => tree.unmount());
});
it('opens overnight measurements outside the scrolling layout, with spacing and an unchanged overview', async () => {
  mockNightState = 'READY'; let tree: any;
  await act(async () => { tree = create(<BioScreen />); });
  expect(text(tree)).not.toContain('bioNight.title');
  const list = tree.root.findByType(FlatList), instance = list.instance;
  const beforeStyle = list.props.contentContainerStyle;
  const overviewText = () => list.findAll((node: any) => typeof node.props.children === 'string').map((node: any) => node.props.children).join(' ');
  const beforeText = overviewText();
  expect(tree.root.findByProps({ testID: 'bio-night-details-trigger' }).props.style.marginBottom).toBe(16);
  const scroll = jest.spyOn(instance, 'scrollToOffset');
  await act(async () => button(tree, 'bioSummary.nightDetails').props.onPress()); expect(text(tree)).toContain('bioNight.title');
  expect(tree.root.findAllByType(BioNightDetailsSheet)).toHaveLength(1);
  expect(list.findAllByType(BioNightCard)).toHaveLength(0);
  expect(tree.root.findByType(FlatList)).toBe(list);
  expect(list.props.contentContainerStyle).toEqual(beforeStyle); expect(overviewText()).toBe(beforeText);
  await act(async () => tree.root.findByType(BioNightDetailsSheet).props.onClose()); expect(text(tree)).not.toContain('bioNight.title');
  expect(overviewText()).toBe(beforeText); expect(scroll).not.toHaveBeenCalled();scroll.mockRestore();
  await act(async () => tree.unmount());
});
it('closes overnight details across account, disconnect and response-tab changes without reopening them', async () => {
  mockNightState = 'READY'; let tree: any;
  await act(async () => { tree = create(<BioScreen />); });
  await act(async () => button(tree, 'bioSummary.nightDetails').props.onPress());
  mockUid = 'other'; await act(async () => tree.update(<BioScreen />)); expect(text(tree)).not.toContain('bioNight.title');
  mockUid = 'owner'; await act(async () => tree.update(<BioScreen />)); expect(text(tree)).not.toContain('bioNight.title');
  await act(async () => button(tree, 'bioSummary.nightDetails').props.onPress());
  mockNightState = 'OFF'; await act(async () => tree.update(<BioScreen />));expect(tree.root.findAllByType(BioNightDetailsSheet)).toHaveLength(0);
  expect(button(tree, 'bioSummary.nightDetails')).toBeUndefined();
  mockNightState = 'READY';await act(async () => tree.update(<BioScreen />));expect(tree.root.findAllByType(BioNightDetailsSheet)).toHaveLength(0);
  await act(async () => button(tree, 'bioSummary.nightDetails').props.onPress());
  await act(async () => button(tree, 'bio.seeResponse').props.onPress());expect(tree.root.findAllByType(BioNightDetailsSheet)).toHaveLength(0);
  await act(async () => button(tree, 'bio.today').props.onPress());expect(tree.root.findAllByType(BioNightDetailsSheet)).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('keeps overnight details usable during loading, missing and error states without changing the home layout', async () => {
  let tree: any;
  for (const state of ['LOADING', 'ERROR', 'UNAVAILABLE', 'READY']) {
    mockNightState = state;
    await act(async () => { tree = create(<BioScreen />); });
    await act(async () => button(tree, 'bioSummary.nightDetails').props.onPress());
    expect(tree.root.findByType(FlatList).findAllByType(BioNightCard)).toHaveLength(0);
    expect(tree.root.findAllByType(BioNightDetailsSheet)).toHaveLength(1);
    await act(async () => tree.unmount());
  }
});
