import React from 'react';
import { CardioStartingPointPanel } from '../CardioStartingPointPanel';
import { CardioHealthReviewPanel } from '../CardioHealthReviewPanel';
import { NumericField } from '@/components/train/NumericField';
import type { CardioHealthRead } from '@/models/cardioHealth';
import { reviewedStart } from '@/testing/cardioReviewFixture';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, params?: unknown) => params ? `${key}:${JSON.stringify(params)}` : key }) }));
const now = Date.UTC(2026, 9, 30, 12), day = 86400000;
const data: CardioHealthRead = { version: 1, truncated: false, workouts: [1, 4, 8, 11, 15, 18, 22, 25].map(d => ({
  id: `run-${d}`, kind: 'RUNNING', start: now - d * day, end: now - d * day + 1800000,
  durationSeconds: 1800, sourceId: 'watch', sourceName: 'Watch', manuallyEntered: false, mixedActivities: false, ownExport: false })) };
const find = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => find(tree, label).props.onPress());
const out = (tree: any) => JSON.stringify(tree.toJSON());
const field = async (tree: any, key: string, value?: number) => act(async () => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === `cardioStart.${key}`).props.onChangeValue(value));
beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(now));
afterEach(() => jest.restoreAllMocks());
it('requires reviewed history, explicit expansion, current answers and calculation; edits remove stale output', async () => {
  const onRead = jest.fn(); let tree: any;
  await act(async () => { tree = create(<CardioHealthReviewPanel state="READY" data={data} observedAt={now} onRead={onRead} onClear={jest.fn()} onClose={jest.fn()} />); });
  expect(find(tree, 'cardioStart.open')).toBeUndefined();
  await press(tree, 'cardioHealth.confirm'); await press(tree, 'cardioStart.open');
  expect(out(tree)).not.toContain('cardioStart.proposal');
  await press(tree, 'cardioStart.calculate'); expect(out(tree)).toContain('cardioStart.issue_CONTEXT_REQUIRED');
  await press(tree, 'cardioStart.representative'); await press(tree, 'cardioStart.response_RECOVERED'); await field(tree, 'comfortableMinutes', 40);
  await press(tree, 'cardioStart.calculate'); expect(out(tree)).toContain(JSON.stringify('cardioStart.proposal:{"sessions":2,"minutes":30,"days":7}'));
  await field(tree, 'maxSessionMinutes', 20); expect(out(tree)).not.toContain('cardioStart.proposal');
  await press(tree, 'cardioStart.calculate'); expect(out(tree)).toContain('cardioStart.cap_SESSION_TIME');
  await press(tree, 'cardioStart.info'); expect(out(tree)).toContain('cardioStart.method');
  await press(tree, 'cardioStart.info'); expect(out(tree)).not.toContain('cardioStart.method');
  await press(tree, 'cardioStart.close'); expect(find(tree, 'cardioStart.open')).toBeDefined(); expect(onRead).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('resets current-tolerance answers across modalities and blocks discomfort without a numeric proposal', async () => {
  let tree: any; await act(async () => { tree = create(<CardioStartingPointPanel data={data} observedAt={now} excludedIds={[]} />); });
  await press(tree, 'cardioStart.open'); await press(tree, 'cardioStart.representative');
  await press(tree, 'cardioStart.response_RECOVERED'); await field(tree, 'comfortableMinutes', 40); await press(tree, 'cardioStart.calculate');
  expect(out(tree)).toContain('cardioStart.proposal');
  await press(tree, 'cardioPlan.CYCLING'); expect(out(tree)).not.toContain('cardioStart.proposal');
  expect(find(tree, 'cardioStart.representative').props.accessibilityState.checked).toBe(false);
  await press(tree, 'cardioStart.calculate'); expect(out(tree)).toContain('cardioStart.issue_CONTEXT_REQUIRED');
  await press(tree, 'cardioStart.response_DISCOMFORT'); await press(tree, 'cardioStart.calculate');
  expect(out(tree)).toContain('cardioStart.issue_DISCOMFORT'); expect(out(tree)).not.toContain('cardioStart.proposal');
  await field(tree, 'cycleDays', undefined); await press(tree, 'cardioStart.calculate'); expect(out(tree)).toContain('cardioStart.issue_INVALID_CONTEXT');
  await act(async () => tree.unmount());
});
it('unmounts the whole estimate when an exclusion invalidates review confirmation', async () => {
  let tree: any; await act(async () => { tree = create(<CardioHealthReviewPanel state="READY" data={data} observedAt={now} onRead={jest.fn()} onClear={jest.fn()} onClose={jest.fn()} />); });
  await press(tree, 'cardioHealth.confirm'); await press(tree, 'cardioStart.open');
  expect(tree.root.findAllByType(CardioStartingPointPanel)).toHaveLength(1);
  const checkbox = tree.root.findAll((n: any) => n.props.accessibilityRole === 'checkbox' && n.props.accessibilityLabel.startsWith('cardioHealth.include:') && typeof n.props.onPress === 'function')[0];
  await act(async () => checkbox.props.onPress()); expect(tree.root.findAllByType(CardioStartingPointPanel)).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('hands off only freshly recalculated numeric provenance after explicit Use, never original records', async () => {
  const onPlan = jest.fn(); let tree: any;
  await act(async () => { tree = create(<CardioStartingPointPanel data={data} observedAt={now} excludedIds={[]} onPlan={onPlan} />); });
  await press(tree, 'cardioStart.open'); expect(out(tree)).toContain('healthPlanning.previewOnly');
  await press(tree, 'cardioStart.representative'); await press(tree, 'cardioStart.response_RECOVERED'); await field(tree, 'comfortableMinutes', 40);
  await press(tree, 'cardioStart.calculate'); expect(onPlan).not.toHaveBeenCalled();
  expect(out(tree)).toContain('healthPlanning.handoff'); await press(tree, 'healthPlanning.use');
  expect(onPlan).toHaveBeenCalledWith(reviewedStart());
  jest.spyOn(Date, 'now').mockReturnValue(now + 86400001); onPlan.mockClear();
  await press(tree, 'healthPlanning.use'); expect(onPlan).not.toHaveBeenCalled(); expect(out(tree)).toContain('healthPlanning.expired');
  await act(async () => tree.unmount());
});
