import React from 'react';
import { CardioHealthReviewPanel, type CardioHealthPanelProps } from '../CardioHealthReviewPanel';
import type { CardioHealthWorkout } from '@/models/cardioHealth';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: any) => key === 'cardioHealth.include' ? `${key}:${values.source}` : key }) }));
const onRead = jest.fn(), onClear = jest.fn(), onClose = jest.fn();
const props: CardioHealthPanelProps = { state: 'IDLE', onRead, onClear, onClose };
const now = Date.UTC(2026, 9, 30, 12), start = now - 86400000;
const a: CardioHealthWorkout = { id: 'a', kind: 'RUNNING', start, end: start + 3600000, durationSeconds: 1800,
  sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, ownExport: false, mixedActivities: false };
const ready: CardioHealthPanelProps = { ...props, state: 'READY', observedAt: now,
  data: { version: 1, truncated: false, workouts: [a, { ...a, id: 'b', sourceId: 'partner', sourceName: 'Partner' }] } };
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const out = (tree: any) => JSON.stringify(tree.toJSON());
beforeEach(() => jest.clearAllMocks());
it('only requests reads explicitly and offers back/clear/retry in every lifecycle state', async () => {
  let tree: any; await act(async () => { tree = create(<CardioHealthReviewPanel {...props} />); });
  expect(onRead).not.toHaveBeenCalled(); await press(tree, 'cardioHealth.connect'); expect(onRead).toHaveBeenCalledTimes(1);
  for (const state of ['AUTHORIZING', 'LOADING'] as const) {
    await act(async () => tree.update(<CardioHealthReviewPanel {...props} state={state} />));
    await press(tree, 'cardioHealth.clear');
  }
  for (const state of ['ERROR', 'UNAVAILABLE'] as const) {
    await act(async () => tree.update(<CardioHealthReviewPanel {...props} state={state} />));
    expect(out(tree)).toContain(`cardioHealth.${state}`); await press(tree, 'home.retry');
  }
  await press(tree, 'generate.back'); expect(onClose).toHaveBeenCalledTimes(1); expect(onClear).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
it('requires source review or exclusions for ambiguous overlaps and does not persist confirmation', async () => {
  let tree: any; await act(async () => { tree = create(<CardioHealthReviewPanel {...ready} />); });
  expect(out(tree)).toContain('cardioHealth.overlap'); expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(true);
  await press(tree, 'Watch'); expect(out(tree)).not.toContain('cardioHealth.overlapRow');
  expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(false); await press(tree, 'cardioHealth.confirm'); expect(out(tree)).toContain('cardioHealth.confirmed');
  await press(tree, 'cardioHealth.allSources'); expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(true); expect(out(tree)).not.toContain('cardioHealth.confirmed');
  await press(tree, 'cardioHealth.include:Partner'); expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(false);
  await press(tree, 'cardioHealth.refresh'); expect(onRead).toHaveBeenCalledTimes(1); await press(tree, 'cardioHealth.clear'); expect(onClear).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('shows empty, truncated, partial and manual/mixed records without inventing a baseline', async () => {
  let tree: any; await act(async () => { tree = create(<CardioHealthReviewPanel {...ready} data={{ version: 1, truncated: false, workouts: [] }} />); });
  expect(out(tree)).toContain('cardioHealth.empty');
  await act(async () => tree.update(<CardioHealthReviewPanel {...ready} data={{ version: 1, truncated: true, workouts: [] }} />));
  expect(out(tree)).toContain('cardioHealth.truncated'); expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(true);
  await act(async () => tree.update(<CardioHealthReviewPanel {...ready} data={{ version: 1, truncated: false, earliestAllowedStart: now - 86400000,
    workouts: [{ ...a, manuallyEntered: true }, { ...a, id: 'mixed', mixedActivities: true }, { ...a, id: 'invalid', durationSeconds: 0 }] }} />));
  expect(out(tree)).toContain('cardioHealth.manualRow'); expect(out(tree)).toContain('cardioHealth.mixedRow'); expect(out(tree)).toContain('cardioHealth.invalid');
  expect(out(tree)).toContain('cardioHealth.limited'); expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});
it('renders a bounded initial row batch while summarizing the entire validated window', async () => {
  const workouts = Array.from({ length: 21 }, (_, index) => ({ ...a, id: `run-${index}`, start: now - (index + 1) * 86400000, end: now - (index + 1) * 86400000 + 3600000 }));
  let tree: any; await act(async () => { tree = create(<CardioHealthReviewPanel {...ready} data={{ version: 1, truncated: false, workouts }} />); });
  const checkboxes = () => tree.root.findAll((n: any) => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function');
  expect(checkboxes()).toHaveLength(20); expect(button(tree, 'cardioHealth.confirm').props.disabled).toBe(false);
  await press(tree, 'cardioHealth.more'); expect(checkboxes()).toHaveLength(21); expect(button(tree, 'cardioHealth.more')).toBeUndefined();
  await act(async () => tree.unmount());
});
