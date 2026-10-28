import React from 'react';
import { StyleSheet } from 'react-native';
import { RoutineDayIndicator } from '../RoutineDayIndicator';
import { RoutineCard } from '../RoutineCard';
import { DumbbellIcon } from '@/components/icons';
import { CheckIcon, MoonIcon } from '@/components/icons/ActionIcons';
import { palette } from '@/theme/tokens';
import { MuscleGroup, SetType } from '@/models';
const { create, act } = require('react-test-renderer');

it.each([
  ['workout', false, DumbbellIcon], ['workout', true, CheckIcon],
  ['rest', false, MoonIcon], ['rest', true, CheckIcon],
] as const)('uses a decorative %s status icon (completed=%s) without creating another touch target', async (kind, completed, Icon) => {
  let tree: any;
  await act(async () => { tree = create(<RoutineDayIndicator kind={kind} completed={completed} />); });
  expect(tree.root.findByType(Icon).props.size).toBe(19);
  const wrapper = tree.root.findAll((node: any) => node.props.pointerEvents === 'none')[0];
  expect(wrapper.props.accessible).toBe(false);
  expect(wrapper.props.accessibilityElementsHidden).toBe(true);
  expect(StyleSheet.flatten(wrapper.props.style)).toMatchObject({ width: 32, height: 32, flexShrink: 0 });
  expect(tree.root.findAll((node: any) => node.props.onPress)).toHaveLength(0);
  await act(async () => tree.unmount());
});

const exercises = (working: number) => [{ exerciseId: 'bench', name: 'Bench', primaryMuscle: MuscleGroup.CHEST,
  secondaryMuscles: [], restSeconds: 120, targetRIR: 2, repRange: '8–10', sets: [
    { setType: SetType.WARMUP }, ...Array.from({ length: working }, () => ({ setType: SetType.NORMAL })),
  ] }];
const base = { id: 'pending', plannedSessionIndex: 0, name: 'Upper with a deliberately long name', exercises: exercises(3) };
const routine: any = { id: 'r', name: 'Routine', icon: 'dumbbell', color: '#9BE317', objective: 'Hypertrophy', isActive: true,
  currentMicrocycleIndex: 0, microcycles: [{ number: 1, sessions: [base,
    { ...base, id: 'done', plannedSessionIndex: 1, name: 'Done', completedOn: '2026-10-25', performedExercises: exercises(2) },
    { ...base, id: 'skipped', plannedSessionIndex: 2, name: 'Skipped', skippedOn: '2026-10-25' },
  ] }] };
const labels = { sessions: 'sessions', sets: 'sets', today: 'Today', viewMesocycle: 'View', microcycleOf: 'Microcycle',
  activate: 'Activate', rename: 'Rename', remove: 'Remove', active: 'Active', skipped: 'Skipped' };

it('puts statuses before names and working-set totals after them, preserving dates and row actions', async () => {
  const select = jest.fn(), hold = jest.fn(); let tree: any;
  await act(async () => { tree = create(<RoutineCard routine={routine} expanded selectedSessionId="pending" locale="en"
    muscleLabel={(muscle) => muscle} labels={labels} onToggle={() => {}} onPressDetail={() => {}}
    onSelectSession={select} onLongPressSession={hold} onPressMesocycle={() => {}} onRename={() => {}} onRemove={() => {}} />); });
  const rows = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button'
    && /, \d+ sets$/.test(node.props.accessibilityLabel ?? '') && typeof node.props.onPress === 'function');
  expect(rows).toHaveLength(3);
  expect(rows[0].props.accessibilityLabel).toContain('Today');
  expect(rows[0].props.accessibilityLabel).toMatch(/, 3 sets$/);
  expect(rows[1].props.accessibilityLabel).toContain('25 OCT');
  expect(rows[1].props.accessibilityLabel).toMatch(/, 2 sets$/);
  expect(rows[2].props.accessibilityLabel).toContain('Skipped');
  expect(rows.map((row: any) => row.findByType(RoutineDayIndicator).props.completed)).toEqual([false, true, true]);
  expect(Object.values(palette).map((colors) => [colors.accentTint, colors.bgElevated, colors.bgElevated]))
    .toContainEqual(rows.map((row: any) => StyleSheet.flatten(row.props.style).backgroundColor));
  await act(async () => rows[0].props.onPress()); expect(select).toHaveBeenCalledWith('pending');
  await act(async () => rows[0].props.onLongPress()); expect(hold).toHaveBeenCalledWith(0);
  expect(rows[1].props.onLongPress).toBeUndefined(); expect(rows[2].props.onLongPress).toBeUndefined();
  expect(rows[0].findAll((node: any) => node.props.numberOfLines === 1).length).toBeGreaterThanOrEqual(2);
  await act(async () => tree.unmount());
});

it('keeps inactive sessions disabled while exposing a zero total and no fictional date', async () => {
  let tree: any; const empty = { ...routine, isActive: false, microcycles: [{ number: 1, sessions: [{ ...base, exercises: [] }] }] };
  await act(async () => { tree = create(<RoutineCard routine={empty} expanded selectedSessionId="" locale="en"
    muscleLabel={(muscle) => muscle} labels={labels} onToggle={() => {}} onPressDetail={() => {}}
    onPressMesocycle={() => {}} onRename={() => {}} onRemove={() => {}} />); });
  const row = tree.root.findAll((node: any) => node.props.accessibilityRole === 'button' && /, 0 sets$/.test(node.props.accessibilityLabel ?? ''))[0];
  expect(row.props.disabled).toBe(true); expect(row.props.onPress).toBeUndefined();
  expect(row.props.accessibilityLabel).not.toContain('Today');
  await act(async () => tree.unmount());
});
