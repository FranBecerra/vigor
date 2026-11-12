import Screen from '@/app/(tabs)/(train)/index';
import { DomainPills } from '@/components/home/HomeHeader';
import { SavedCardioPlans } from '@/components/cardio/SavedCardioPlans';
import { TodayCard } from '@/components/home/TodayCard';
import { mockRoutines } from '@/mocks/home';
import { CardioRoutineCard } from '@/components/cardio/CardioRoutineCard';
import { RoutineCard } from '@/components/home/RoutineCard';
import { cardioFixture } from '@/test-support/cardioFixture';
import type { CardioBlock } from '@/models/cardioTraining';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn();
let mockWorkout: any = null;
const mockPlans = mockRoutines.slice(0, 1);
const mockCardio = { entries: [] as CardioBlock[], ready: true, error: false, reload: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => ({ status: 'ready', routines: mockPlans }) }));
jest.mock('@/hooks/useActiveWorkout', () => ({ useActiveWorkout: () => mockWorkout }));
jest.mock('@/hooks/useCardioTraining', () => ({ useCardioBlocks: () => mockCardio, useCardioWorkouts: () => ({ entries: [], ready: true }) }));
jest.mock('@/hooks/useSportActivities', () => ({ useSportActivities: () => ({ entries: [], ready: true }) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: {}, workoutSessionRepository: {} }));
jest.mock('@/components/home/RoutineCard', () => ({ ...jest.requireActual('@/components/home/RoutineCard'), RoutineCard: () => null }));
jest.mock('@/components/home/RenameRoutineSheet', () => ({ RenameRoutineSheet: () => null }));
jest.mock('@/components/bio/MicrocycleReviewPrompt', () => ({ MicrocycleReviewPrompt: () => null }));
jest.mock('@/components/cardio/SavedCardioPlans', () => ({ SavedCardioPlans: () => null }));
jest.mock('@/components/train/TrainingCalendarCard', () => ({ TrainingCalendarCard: () => null }));
jest.mock('@/test-support/LocalChecksEntry', () => ({ LocalChecksEntry: () => null }));

beforeEach(() => { jest.clearAllMocks(); mockWorkout = null; mockCardio.entries = []; mockPlans.splice(0, mockPlans.length, ...mockRoutines.slice(0, 1)); });
it('uses one Today card to resume the exact earlier microcycle and session, then returns to Start when the draft clears', async () => {
  const routine = mockPlans[0];
  const session = routine.microcycles[0].sessions.at(-1)!;
  mockWorkout = { mesocycleId: routine.mesocycleId, microcycleIndex: 0, plannedSessionIndex: session.plannedSessionIndex,
    sessionName: 'My unfinished session', trainingGoal: routine.generationGoal };
  let tree: any;
  await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findAllByType(TodayCard)).toHaveLength(1);
  const card = tree.root.findByType(TodayCard);
  expect(card.props.labels.start).toBe('workout.resume');
  expect(card.props.session.name).toBe('My unfinished session');
  expect(JSON.stringify(tree.toJSON())).not.toContain('workout.inProgress');
  await act(async () => card.props.onPressStart());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/session', params: { mesocycleId: routine.mesocycleId,
    goal: routine.generationGoal, microcycleIndex: '0', plannedSessionIndex: String(session.plannedSessionIndex) } });
  mockWorkout = null;
  await act(async () => tree.update(<Screen />));
  expect(tree.root.findByType(TodayCard).props.labels.start).toBe('home.startWorkout');
  await act(async () => tree.unmount());
});

it('adds only owned active cardio under the existing strength home and previews its exact cycle without activation', async () => {
  const block = cardioFixture();
  mockCardio.entries = [block, { ...block, id: 'ended', endedAt: block.updatedAt }, { ...block, id: 'foreign', userId: 'foreign' }];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findAllByType(CardioRoutineCard)).toHaveLength(2);
  expect(tree.root.findAllByType(DomainPills)).toHaveLength(0);
  expect(tree.root.findAllByType(SavedCardioPlans)).toHaveLength(1);
  expect(tree.root.findAllByType(TodayCard)).toHaveLength(1);
  const card = tree.root.findAllByType(CardioRoutineCard).find((item: any) => item.props.block.id === block.id);
  expect(card.props.expanded).toBe(false);
  await act(async () => card.props.onToggle());
  expect(tree.root.findAllByType(CardioRoutineCard).find((item: any) => item.props.block.id === block.id).props.expanded).toBe(true);
  expect(tree.root.findByType(RoutineCard).props.expanded).toBe(false);
  await act(async () => card.props.onOpenBlock(1));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/cardio-block', params: { id: block.id, cycle: '1' } });
  await act(async () => card.props.onOpen({ block, slot: block.slots[0], workout: { id: 'finished-cardio' } }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/cardio-workout', params: { id: 'finished-cardio' } });
  await act(async () => tree.unmount());
});

it('leads with active cardio when strength is inactive, without an irrelevant no-session message', async () => {
  mockPlans[0] = { ...mockPlans[0], isActive: false }; mockCardio.entries = [cardioFixture()];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findByType(CardioRoutineCard).props.expanded).toBe(true);
  expect(tree.root.findByType(RoutineCard).props.expanded).toBe(false);
  const output = JSON.stringify(tree.toJSON());
  expect(output).not.toContain('home.noSession');
  expect(output.indexOf(mockCardio.entries[0].proposal.name)).toBeLessThan(output.indexOf('home.otherRoutines'));
  await act(async () => tree.unmount());
});

it('shows cardio alone without a discipline switch and preserves health and activity navigation', async () => {
  mockPlans.splice(0); mockCardio.entries = [cardioFixture()];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findAllByType(DomainPills)).toHaveLength(0);
  expect(tree.root.findAllByType(RoutineCard)).toHaveLength(0);
  expect(tree.root.findByType(CardioRoutineCard).props.expanded).toBe(true);
  const { Pressable } = require('react-native');
  for (const [label, route] of [['cardioHealth.title', '/cardio-health'], ['sportActivities.title', '/activities'], ['home.newRoutine', '/create-routine']]) {
    const button = tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    expect({ label, found: Boolean(button) }).toEqual({ label, found: true });
    await act(async () => button.props.onPress()); expect(mockPush).toHaveBeenLastCalledWith(route);
  }
  await act(async () => tree.unmount());
});
