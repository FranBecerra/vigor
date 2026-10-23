import React from 'react';
import { Text } from 'react-native';
import { TrainingCalendarCard } from '../TrainingCalendarCard';
import { RoutineDayList } from '../RoutineDayList';
import { SwipeableSet } from '../SwipeableSet';
import type { Mesocycle } from '@/models';
const { create, act } = require('react-test-renderer');
const mockGet = jest.fn(), mockUpdate = jest.fn(); let mockUid: string | null = 'owner';
const mockCatalogue = new Map();
const mockSessions = [{ index: 0, name: 'Upper', exercises: [] }, { index: 1, name: 'Lower', exercises: [] }];
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useExerciseCatalogue: () => ({ exercisesById: mockCatalogue }) }));
jest.mock('@/services/training/mesocycleEditing', () => ({ sessionsForMicrocycle: () => mockSessions }));
jest.mock('@/services/repositories', () => ({ mesocycleRepository: { get: (...args: unknown[]) => mockGet(...args), updateLocally: (...args: unknown[]) => mockUpdate(...args) } }));
const meso: Mesocycle = { id: 'm', userId: 'owner', status: 'ACTIVE', sessionsPerMicrocycle: 2,
  currentMicrocycleIndex: 0, startedAt: 1, updatedAt: 1, targetVolumePerGroup: {},
  restDays: [{ id: 'r', afterSessionIndex: 0 }], restDayChecks: { '0:r': true } };
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockGet.mockResolvedValue(meso); mockUpdate.mockResolvedValue('pending'); });
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
it('checks rest independently in the requested microcycle using an offline-safe merge', async () => {
  let tree: any; await act(async () => { tree = create(<TrainingCalendarCard mesocycleId="m" microcycleIndex={1} goal="HYPERTROPHY" />); });
  expect(button(tree, 'calendar.rest').props.accessibilityState.checked).toBe(false);
  expect(tree.root.findByType(SwipeableSet).props.backgroundColor).toBe(button(tree, 'calendar.rest').props.style.backgroundColor);
  await act(async () => button(tree, 'calendar.rest').props.onPress());
  expect(mockUpdate).toHaveBeenCalledWith('m', expect.objectContaining({ restDayChecks: { '0:r': true, '1:r': true },
    scheduleTemplate: { days: 3, slots: [{ kind: 'workout', sessionIndex: 0 }, { kind: 'rest' }, { kind: 'workout', sessionIndex: 1 }] } }), expect.any(Function));
  expect(button(tree, 'calendar.rest').props.accessibilityState.checked).toBe(true);
  expect(mockUpdate.mock.calls[0][1].currentMicrocycleIndex).toBeUndefined(); await act(async () => tree.unmount());
});
it('retains the current marker after a failed write and permits retry', async () => {
  mockUpdate.mockRejectedValueOnce(Error('failed')); let tree: any;
  await act(async () => { tree = create(<TrainingCalendarCard mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  await act(async () => button(tree, 'calendar.rest').props.onPress());
  expect(button(tree, 'calendar.rest').props.accessibilityState.checked).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('calendar.saveFailed');
  await act(async () => button(tree, 'calendar.rest').props.onPress()); expect(button(tree, 'calendar.rest').props.accessibilityState.checked).toBe(false);
  await act(async () => tree.unmount());
});
it('hides another owner and rejects malformed rest data instead of crashing the routine', async () => {
  mockGet.mockResolvedValueOnce({ ...meso, userId: 'other' }); let tree: any;
  await act(async () => { tree = create(<TrainingCalendarCard mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  expect(button(tree, 'calendar.rest')).toBeUndefined(); await act(async () => tree.unmount());
  mockGet.mockResolvedValueOnce({ ...meso, restDays: [{ id: 'bad/id', afterSessionIndex: 0 }] });
  await act(async () => { tree = create(<TrainingCalendarCard mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  expect(JSON.stringify(tree.toJSON())).toContain('calendar.saveFailed'); await act(async () => tree.unmount());
});

it('does not let an old accepted write replace a newly selected microcycle or owner', async () => {
  let accept!: (value: string) => void; mockUpdate.mockImplementationOnce(() => new Promise((resolve) => { accept = resolve; })); let tree: any;
  const render = (index: number) => <TrainingCalendarCard mesocycleId="m" microcycleIndex={index} goal="HYPERTROPHY" />;
  await act(async () => { tree = create(render(0)); });
  act(() => button(tree, 'calendar.rest').props.onPress());
  await act(async () => tree.update(render(1)));
  await act(async () => accept('pending'));
  expect(button(tree, 'calendar.rest').props.accessibilityState.checked).toBe(false);
  mockUid = 'other'; mockGet.mockResolvedValueOnce({ ...meso, userId: 'other', restDays: [] });
  await act(async () => tree.update(render(1))); expect(button(tree, 'calendar.rest')).toBeUndefined();
  await act(async () => tree.unmount());
});

const sessionRows = [{ index: 0, content: <Text testID="session-0">Upper</Text> }, { index: 1, content: <Text testID="session-1">Lower</Text> }];
const renderedOrder = (tree: any) => {
  const found: string[] = [];
  const walk = (node: any) => { if (Array.isArray(node)) { node.forEach(walk); return; } if (!node || typeof node !== 'object') return;
    if (node.props?.testID) found.push(node.props.testID); node.children?.forEach(walk); };
  walk(tree.toJSON()); return found;
};
it('interleaves rests before, between and after sessions in anchor order, including consecutive rests', async () => {
  mockGet.mockResolvedValueOnce({ ...meso, restDays: [
    { id: 'last', afterSessionIndex: 1 }, { id: 'between', afterSessionIndex: 0 },
    { id: 'first', afterSessionIndex: null }, { id: 'consecutive', afterSessionIndex: 0 },
  ] }); let tree: any;
  await act(async () => { tree = create(<TrainingCalendarCard sessionRows={sessionRows} mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  expect(renderedOrder(tree)).toEqual(['rest-day-first', 'session-0', 'rest-day-between', 'rest-day-consecutive', 'session-1', 'rest-day-last']);
  expect(mockUpdate).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('does not paint an incomplete timeline while initial metadata is unknown', async () => {
  let reject!: (error: Error) => void; mockGet.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })); let tree: any;
  await act(async () => { tree = create(<TrainingCalendarCard sessionRows={sessionRows} mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  expect(renderedOrder(tree)).toEqual([]);
  await act(async () => reject(Error('offline')));
  expect(renderedOrder(tree)).toEqual([]); expect(JSON.stringify(tree.toJSON())).toContain('calendar.saveFailed');
  await act(async () => tree.unmount());
});
it('does not move or hide workouts when no rest markers exist', async () => {
  mockGet.mockResolvedValueOnce({ ...meso, restDays: [] }); let tree: any;
  await act(async () => { tree = create(<TrainingCalendarCard sessionRows={sessionRows} mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  expect(renderedOrder(tree)).toEqual(['session-0', 'session-1']);
  expect(button(tree, 'calendar.rest')).toBeUndefined(); await act(async () => tree.unmount());
});
it('uses the already-loaded home snapshot on the first render and appends a new rest without a placement menu', async () => {
  let tree: any;
  act(() => { tree = create(<TrainingCalendarCard initialMesocycle={meso as Mesocycle} sessionRows={sessionRows} mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  expect(renderedOrder(tree)).toEqual(['session-0', 'rest-day-r', 'session-1']);
  expect(mockGet).not.toHaveBeenCalled();
  await act(async () => button(tree, 'restDays.add').props.onPress());
  expect(mockUpdate.mock.calls.at(-1)[1].restDays.at(-1).afterSessionIndex).toBe(1);
  expect(renderedOrder(tree).at(-1)).toMatch(/^rest-day-rest-/);
  await act(async () => tree.unmount());
});
it('saves a reordered workout/rest timeline by stable IDs and exposes a hold action for workouts', async () => {
  const hold = jest.fn(); let tree: any;
  await act(async () => { tree = create(<TrainingCalendarCard onSessionHold={hold} sessionRows={sessionRows} mesocycleId="m" microcycleIndex={0} goal="HYPERTROPHY" />); });
  await act(async () => tree.root.findByType(RoutineDayList).props.onHold({ kind: 'workout', sessionIndex: 1 })); expect(hold).toHaveBeenCalledWith(1);
  await act(async () => tree.root.findByType(RoutineDayList).props.onReorder(2, 0));
  expect(mockUpdate.mock.calls.at(-1)[1].sessionOrder).toEqual([1, 0]);
  expect(renderedOrder(tree)).toEqual(['session-1', 'session-0', 'rest-day-r']);
  await act(async () => button(tree, 'restDays.remove').props.onPress());
  expect(renderedOrder(tree)).toEqual(['session-1', 'session-0']);
  await act(async () => tree.unmount());
});
