import Screen from '@/app/(tabs)/(train)/index';
import { DomainPills, MesoRail } from '@/components/home/HomeHeader';
import { SavedCardioPlans } from '@/components/cardio/SavedCardioPlans';
import { TodayCard } from '@/components/home/TodayCard';
import { mockRoutines } from '@/mocks/home';
import { CardioRoutineCard } from '@/components/cardio/CardioRoutineCard';
import { ActionMenuSheet } from '@/components/train/ActionMenuSheet';
import { AgendaActionSheet } from '@/components/train/AgendaActionSheet';
import { TrainingAgenda } from '@/components/train/TrainingAgenda';
import { RoutineCard } from '@/components/home/RoutineCard';
import { cardioFixture } from '@/test-support/cardioFixture';
import { cardioHomeFixture } from '@/test-support/cardioHomeFixture';
import type { AgendaPreference } from '@/services/training/agendaOrderPreference';
import type { CardioBlock } from '@/models/cardioTraining';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn();
const mockHealth = { owner: 'owner', state: 'READY', clear: jest.fn(), read: jest.fn(), data: undefined as import('@/models/cardioHealth').CardioHealthRead | undefined };
const mockLink = jest.fn();
const mockGetMesocycle = jest.fn();
const mockUpdateMesocycle = jest.fn();
jest.mock('@/hooks/useCardioHealthReview', () => ({ useCardioHealthReview: () => mockHealth }));
jest.mock('@/services/cardio/cardioHealthLinkRepository', () => ({ saveCardioHealthLink: (...args: unknown[]) => mockLink(...args) }));
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
let mockWorkout: any = null;
const mockPlans = mockRoutines.slice(0, 1);
const mockCardio = { entries: [] as CardioBlock[], ready: true, error: false, reload: jest.fn(), save: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockWriteOrder = jest.fn((_owner: string, preference: AgendaPreference) => preference);
jest.mock('@/services/training/agendaOrderPreference', () => ({ ...jest.requireActual('@/services/training/agendaOrderPreference'), readAgendaPreference: () => ({ moves: [], rests: [] }), writeAgendaPreference: (...args: [string, AgendaPreference]) => mockWriteOrder(...args) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: 'owner' }) }));
jest.mock('@/hooks/useRoutines', () => ({ useRoutines: () => ({ status: 'ready', routines: mockPlans, reload: () => {} }) }));
jest.mock('@/hooks/useActiveWorkout', () => ({ useActiveWorkout: () => mockWorkout }));
jest.mock('@/hooks/useCardioTraining', () => ({ useCardioBlocks: () => mockCardio, useCardioWorkouts: () => ({ entries: [], ready: true, newId: () => 'linked' }) }));
jest.mock('@/hooks/useSportActivities', () => ({ useSportActivities: () => ({ entries: [], ready: true }) }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: {
  get: (...args: unknown[]) => mockGetMesocycle(...args), updateLocally: (...args: unknown[]) => mockUpdateMesocycle(...args),
}, workoutSessionRepository: {} }));
jest.mock('@/components/home/RoutineCard', () => ({ ...jest.requireActual('@/components/home/RoutineCard'), RoutineCard: () => null }));
jest.mock('@/components/home/RenameRoutineSheet', () => ({ RenameRoutineSheet: () => null }));
jest.mock('@/components/bio/MicrocycleReviewPrompt', () => ({ MicrocycleReviewPrompt: () => null }));
jest.mock('@/components/cardio/SavedCardioPlans', () => ({ SavedCardioPlans: () => null }));
jest.mock('@/components/train/TrainingCalendarCard', () => ({ TrainingCalendarCard: () => null }));
jest.mock('@/test-support/LocalChecksEntry', () => ({ LocalChecksEntry: () => null }));

beforeEach(() => { jest.clearAllMocks(); mockWorkout = null; mockHealth.data = undefined; mockCardio.entries = []; mockPlans.splice(0, mockPlans.length, ...mockRoutines.slice(0, 1)); });
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

it('shows a single agenda, compact active routine shortcuts and only the owned ended card', async () => {
  const block = cardioFixture();
  const date = block.slots[0].date;
  mockPlans[0] = { ...mockPlans[0], microcycles: mockPlans[0].microcycles.map((c, i) => i !== mockPlans[0].currentMicrocycleIndex ? c : {
    ...c, sessions: c.sessions.map((session, j) => j ? session : { ...session, completedOn: undefined, scheduledOn: date }),
  }) };
  mockCardio.entries = [block, { ...block, id: 'ended', endedAt: block.updatedAt }, { ...block, id: 'foreign', userId: 'foreign' }];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findAllByType(CardioRoutineCard).map((item: any) => item.props.block.id)).toEqual(['ended']);
  expect(tree.root.findAllByType(DomainPills)).toHaveLength(0);
  expect(tree.root.findAllByType(SavedCardioPlans)).toHaveLength(1);
  expect(tree.root.findAllByType(TodayCard)).toHaveLength(1);
  const agenda = tree.root.findByType(TrainingAgenda);
  const cardioRow = agenda.props.agenda.rows.find((row: any) => row.kind === 'cardio');
  expect(agenda.props.agenda.rows.map((row: any) => row.kind)).toEqual(expect.arrayContaining(['strength', 'cardio']));
  expect(JSON.stringify(tree.toJSON())).not.toContain('trainingAgenda.unscheduled');
  const [strengthProgress, cardioProgress] = tree.root.findAllByType(MesoRail);
  expect(strengthProgress.props.microcycles).toBe(mockPlans[0].microcycles);
  expect(strengthProgress.props.currentIndex).toBe(mockPlans[0].currentMicrocycleIndex);
  expect(cardioProgress.props.microcycles).toHaveLength(block.cycles);
  expect(cardioProgress.props.microcycles.map((cycle: { isProjected: boolean }) => cycle.isProjected)).toEqual([false, true]);
  await act(async () => button(tree, `home.viewMesocycle · ${mockPlans[0].name}`).props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/mesocycle', params: { mesocycleId: mockPlans[0].mesocycleId } });
  await act(async () => button(tree, `home.viewMesocycle · ${block.proposal.name}`).props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/cardio-block', params: { id: block.id, cycle: '0' } });
  expect(tree.root.findAllByType(TrainingAgenda)).toHaveLength(1);
  await act(async () => agenda.props.onOpen(cardioRow));
  expect(tree.root.findByType(AgendaActionSheet).props.mode).toBe('session');
  expect(button(tree, 'routine.startSession')).toBeDefined();
  expect(button(tree, 'routine.skipSession')).toBeDefined();
  await act(async () => button(tree, mockPlans[0].name).props.onLongPress());
  expect(tree.root.findByType(RoutineCard).props.expanded).toBe(true);
  await act(async () => tree.unmount());
});

it('moves a pending cardio occurrence relative to another row without changing the plan dates', async () => {
  const block = cardioFixture();
  mockCardio.entries = [block];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const agenda = tree.root.findByType(TrainingAgenda);
  const entry = agenda.props.agenda.rows.find((row: any) => row.kind === 'cardio');
  const original = agenda.props.agenda.rows.findIndex((row: any) => row.id === entry.id);
  const destination = agenda.props.agenda.rows.findIndex((row: any, index: number) => index > original && agenda.props.canMove(row));
  expect(destination).toBeGreaterThan(original);
  await act(async () => agenda.props.onReorder(original, destination));
  expect(mockWriteOrder).toHaveBeenCalledWith('owner', { moves: [expect.objectContaining({ id: entry.id, direction: 1 })], rests: [] });
  expect(agenda.props.agenda.rows.findIndex((row: any) => row.id === entry.id)).toBeGreaterThan(original);
  expect(mockCardio.save).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(AgendaActionSheet)).toHaveLength(0);
  const rows = agenda.props.agenda.rows;
  const moved = rows.findIndex((row: any) => row.id === entry.id);
  const next = rows.findIndex((row: any) => row.id === agenda.props.agenda.nextId);
  await act(async () => agenda.props.onReorder(moved, next));
  expect(mockWriteOrder).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('reads Health on demand and links only the explicitly chosen workout even before the block', async () => {
  const block = cardioFixture();
  const start = new Date('2026-10-30T10:00:00+01:00').getTime();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(start + 3_600_000);
  const runStart = start - 4 * 86400000;
  const record = { id: 'watch', kind: 'RUNNING' as const, start: runStart, end: runStart + 2_040_000, durationSeconds: 2040, distanceMetres: 4300,
    sourceId: 'watch', sourceName: 'Apple Watch', ownExport: false, manuallyEntered: false, mixedActivities: false, linkKey: 'a'.repeat(64) };
  mockHealth.data = { version: 1, truncated: false, workouts: [record] };
  mockCardio.entries = [block];
  let tree: any;
  try {
    await act(async () => { tree = create(<Screen />); });
    expect(mockHealth.read).not.toHaveBeenCalled();
    const agenda = tree.root.findByType(TrainingAgenda);
    const entry = agenda.props.agenda.rows.find((row: any) => row.kind === 'cardio');
    await act(async () => agenda.props.onLink(entry));
    expect(mockHealth.read).toHaveBeenCalledWith(false, 'week');
    expect(button(tree, 'trainingAgenda.confirmLink').props.disabled).toBe(true);
    const select = tree.root.findAll((n: any) => n.props.accessibilityRole === 'radio' && n.props.onPress)[0];
    await act(async () => select.props.onPress());
    await act(async () => button(tree, 'trainingAgenda.confirmLink').props.onPress());
    expect(mockLink).toHaveBeenCalledWith(expect.objectContaining({ id: 'linked', status: 'FINISHED', actualSeconds: 2040,
      slotId: entry.session.slot.id, source: 'APPLE_HEALTH_LINK_V1', startedAt: runStart }), block, expect.any(Function));
    expect(mockLink.mock.calls[0][0]).not.toHaveProperty('distanceMetres');
    expect(mockHealth.clear).toHaveBeenCalledTimes(1);
  } finally { if (tree) await act(async () => tree.unmount()); clock.mockRestore(); }
});

it('leads with active cardio when strength is inactive, without an irrelevant no-session message', async () => {
  mockPlans[0] = { ...mockPlans[0], isActive: false }; mockCardio.entries = [cardioFixture()];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(button(tree, mockCardio.entries[0].proposal.name)).toBeDefined();
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
  expect(button(tree, mockCardio.entries[0].proposal.name)).toBeDefined();
  const { Pressable } = require('react-native');
  for (const [label, route] of [['cardioHealth.title', '/cardio-health'], ['sportActivities.title', '/activities'], ['home.newRoutine', '/create-routine']]) {
    const button = tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
    expect({ label, found: Boolean(button) }).toEqual({ label, found: true });
    await act(async () => button.props.onPress()); expect(mockPush).toHaveBeenLastCalledWith(route);
  }
  await act(async () => tree.unmount());
});

it('keeps an inactive saved routine under Other routines without claiming there are no routines', async () => {
  mockPlans[0] = { ...mockPlans[0], isActive: false };
  let tree: any; await act(async () => { tree = create(<Screen />); });
  expect(tree.root.findByType(RoutineCard).props.routine.id).toBe(mockPlans[0].id);
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain('home.otherRoutines');
  expect(output).not.toContain('home.noRoutines');
  await act(async () => tree.unmount());
});

it('checks and unchecks rest in the displayed microcycle when its stored index lags behind', async () => {
  const { routine } = cardioHomeFixture();
  mockPlans[0] = { ...routine, currentMicrocycleIndex: 1 };
  mockGetMesocycle.mockResolvedValue(routine.mesocycleSnapshot);
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const rest = () => button(tree, 'calendar.rest');
  const agenda = tree.root.findByType(TrainingAgenda);
  const next = agenda.props.agenda.nextId;
  const row = agenda.props.agenda.rows.find((entry: any) => entry.kind === 'rest');
  expect(row.cycle).toBe(1);
  expect(rest().props.accessibilityState.checked).toBe(false);
  await act(async () => rest().props.onPress());
  expect(rest().props.accessibilityState.checked).toBe(true);
  expect(mockUpdateMesocycle).toHaveBeenCalledWith(routine.mesocycleId, expect.objectContaining({
    restDayChecks: { [`${row.cycle}:${row.restDayId}`]: true },
  }), expect.any(Function));
  await act(async () => rest().props.onPress());
  expect(rest().props.accessibilityState.checked).toBe(false);
  expect(agenda.props.agenda.nextId).toBe(next);
  await act(async () => tree.unmount());
});

it('rolls back the check and shows a rest-specific alert when the rest no longer exists', async () => {
  const { routine } = cardioHomeFixture();
  mockPlans[0] = routine;
  mockGetMesocycle.mockResolvedValueOnce({ ...routine.mesocycleSnapshot, restDays: [] });
  const { Alert } = require('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let tree: any;
  try {
    await act(async () => { tree = create(<Screen />); });
    await act(async () => button(tree, 'calendar.rest').props.onPress());
    expect(button(tree, 'calendar.rest').props.accessibilityState.checked).toBe(false);
    expect(mockUpdateMesocycle).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('restDays.saveFailed');
  } finally {
    if (tree) await act(async () => tree.unmount());
    alert.mockRestore();
  }
});

it('adds and checks a rest at the end without creating or changing a strength plan record', async () => {
  mockPlans[0] = cardioHomeFixture().routine;
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const agenda = tree.root.findByType(TrainingAgenda);
  const { restScope, nextId } = agenda.props.agenda;
  await act(async () => agenda.props.onAddRest());
  const extra = agenda.props.agenda.rows.at(-1);
  expect(extra).toMatchObject({ kind: 'rest', extra: true, scope: restScope, checked: false });
  await act(async () => agenda.props.onToggleRest(extra));
  expect(agenda.props.agenda.rows.at(-1)).toMatchObject({ id: extra.id, checked: true });
  expect(mockWriteOrder).toHaveBeenLastCalledWith('owner', {
    moves: [], rests: [{ id: extra.id, scope: restScope, checked: true }],
  });
  expect(agenda.props.agenda.nextId).toBe(nextId);
  expect(mockUpdateMesocycle).not.toHaveBeenCalled();
  await act(async () => agenda.props.onRemoveRest(extra));
  expect(agenda.props.agenda.rows.some((entry: any) => entry.id === extra.id)).toBe(false);
  expect(mockWriteOrder).toHaveBeenLastCalledWith('owner', { moves: [], rests: [] });
  await act(async () => tree.unmount());
});

it('skips the tapped cardio session and closes its preview after saving', async () => {
  const block = cardioFixture();
  mockCardio.entries = [block];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  const agenda = tree.root.findByType(TrainingAgenda);
  const entry = agenda.props.agenda.rows.find((row: any) => row.kind === 'cardio');
  await act(async () => agenda.props.onOpen(entry));
  await act(async () => button(tree, 'routine.skipSession').props.onPress());
  const [saved, previous] = mockCardio.save.mock.calls[0];
  expect(previous).toBe(block);
  expect(saved.slots.find((slot: any) => slot.id === entry.session.slot.id).disposition).toBe('SKIPPED');
  expect(saved.slots.filter((slot: any) => slot.disposition === 'SKIPPED')).toHaveLength(1);
  expect(tree.root.findAllByType(AgendaActionSheet)).toHaveLength(0);
  await act(async () => tree.unmount());
});

it('offers common routine actions, with activation disabled on an active routine', async () => {
  const block = cardioFixture();
  const ended = { ...block, id: 'ended', endedAt: block.updatedAt };
  mockCardio.entries = [block, ended, { ...ended, id: 'archived', archivedAt: ended.endedAt }];
  let tree: any; await act(async () => { tree = create(<Screen />); });
  await act(async () => button(tree, 'trainingAgenda.manage').props.onPress());
  const actions = () => tree.root.findAllByType(ActionMenuSheet).find((sheet: any) => sheet.props.title)?.props.actions;
  expect(actions().map((action: any) => action.label)).toEqual(['home.activateRoutine · home.activeRoutine', 'routineEdit', 'home.removeRoutine']);
  expect(actions()[0].disabled).toBe(true);
  await act(async () => actions()[1].onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/routine', params: expect.objectContaining({ edit: '1', mesocycleId: mockPlans[0].mesocycleId }) });
  const [card] = tree.root.findAllByType(CardioRoutineCard);
  expect(card.props.block.id).toBe('ended');
  await act(async () => card.props.onActions());
  expect(actions()[0]).toMatchObject({ label: 'home.activateRoutine', disabled: false });
  await act(async () => actions()[0].onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/cardio-block', params: { id: 'ended', activate: '1' } });
  await act(async () => tree.unmount());
});
