import React from 'react';
import { CardioSelectRow } from '../CardioSelectRow';
import { CardioPlanningHistoryContext, type CardioPlanningHistory } from '../CardioPlanningHistoryContext';
import { CardioPlanningHistoryPrompt } from '../CardioPlanningHistoryPrompt';
import { CardioPlanBuilder } from '../CardioPlanBuilder';
import { CardioStartingPointPanel } from '../CardioStartingPointPanel';
import { NumericField } from '@/components/train/NumericField';
import { Stepper } from '@/components/train/generate/GenerateControls';
import { planningHistoryFixture } from '@/test-support/planningHistoryFixture';
import { hybridFixture } from '@/test-support/hybridFixture';
import { planningHistoryContext, vigorPlanningHistory } from '@/services/cardio/planningHistory';
import { acceptReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';
import type { CardioPreviewInput } from '@/services/cardio/cardioPreview';
import { readCardioPlanningPreference, writeCardioPlanningPreference } from '@/services/health/cardioPlanningPreference';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, p?: any) => key === 'cardioPlan.day' ? `${key}:${p.day}` : key }) }));
jest.mock('@/services/health/cardioPlanningPreference', () => ({ readCardioPlanningPreference: jest.fn(() => ({})), writeCardioPlanningPreference: jest.fn(() => true) }));
const now = Date.UTC(2026, 10, 3, 12), entries = planningHistoryFixture(now);
const history: CardioPlanningHistory = { owner: 'owner', ready: true, error: false, entries, reload: jest.fn() };
const input = (): CardioPreviewInput => ({ ...hybridFixture().input, cycleDays: 8, modalities: ['RUNNING'], sessions: 2, sessionMinutes: 60, cardioMinutes: 120,
  profile: { schemaVersion: 1, modalities: { RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 40 } } } });
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const output = (tree: any) => JSON.stringify(tree.toJSON());
const estimate = (i: CardioPreviewInput) => acceptReviewedCardioStart(vigorPlanningHistory(entries, 'owner', now), now, now,
  { ...planningHistoryContext(i, 'RUNNING'), representative: true, response: 'RECOVERED' });
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Date, 'now').mockReturnValue(now); });
afterEach(() => jest.restoreAllMocks());
it('distinguishes missing access/loading/error/empty/incomplete/records without automatic Health access or acceptance', async () => {
  let tree: any; const onApply = jest.fn(), renderHealth = jest.fn(() => null), i = input();
  const render = (h: CardioPlanningHistory | null) => <CardioPlanningHistoryContext.Provider value={h}><CardioPlanningHistoryPrompt input={i} onApply={onApply} /></CardioPlanningHistoryContext.Provider>;
  await act(async () => { tree = create(render(null)); }); expect(tree.toJSON()).toBeNull();
  for (const [patch, expected] of [[{ owner: null }, 'unavailable'], [{ ready: false }, 'loading'], [{ error: true }, 'error'],
    [{ entries: [] }, 'empty'], [{ entries: [{ ...entries[0], revision: 0 }] }, 'error'], [{ entries: [entries[0], { ...entries[0], id: 'duplicate' }] }, 'incomplete'], [{}, 'found']] as const) {
    await act(async () => tree.update(render({ ...history, renderHealth, ...patch } as CardioPlanningHistory)));
    expect(output(tree)).toContain(`planningHistory.${expected}`);
    if (expected === 'error') await press(tree, 'planningHistory.retry');
  }
  expect(history.reload).toHaveBeenCalledTimes(2); expect(renderHealth).not.toHaveBeenCalled(); expect(onApply).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('reuses existing limits, infers a duration and applies selected Vigor practice without Health provenance', async () => {
  const onApply = jest.fn(), i = input(); let tree: any;
  await act(async () => { tree = create(<CardioPlanningHistoryContext.Provider value={history}><CardioPlanningHistoryPrompt input={i} onApply={onApply} /></CardioPlanningHistoryContext.Provider>); });
  await press(tree, 'planningHistory.reviewVigor');
  expect(tree.root.findAllByType(NumericField).map((n: any) => n.props.accessibilityLabel)).toEqual([]);
  expect(button(tree, 'cardioPlan.CYCLING')).toBeUndefined(); expect(output(tree)).toContain('planningHistory.monthlyContext');
  expect(output(tree)).not.toContain('planningHistory.localScope');
  await press(tree, 'cardioStart.info'); expect(output(tree)).toContain('planningHistory.localScope');
  expect(onApply).not.toHaveBeenCalled(); await press(tree, 'planningHistory.apply');
  expect(onApply.mock.calls[0][0]).toMatchObject({ sessions: 2, sessionMinutes: 40, cardioMinutes: 80, healthBaseline: undefined });
  expect(tree.root.findAllByType(CardioStartingPointPanel)).toHaveLength(0); await act(async () => tree.unmount());
});
it('keeps an ordinary draft when returning from history, then preserves a reviewed 40-minute dose through profile/back/availability', async () => {
  let tree: any;
  await act(async () => { tree = create(<CardioPlanningHistoryContext.Provider value={history}><CardioPlanBuilder ready error={false} onRetry={jest.fn()} onCancel={jest.fn()} /></CardioPlanningHistoryContext.Provider>); });
  await press(tree, 'cardioPlan.RUNNING');  await press(tree, 'cardioSections.experience'); await press(tree, 'cardioPlan.NEW');
  await press(tree, 'planningHistory.reviewVigor'); await press(tree, 'planningHistory.close');
  expect(tree.root.findByType(CardioSelectRow).props.value).toBe('NEW');
  await press(tree, 'cardioGuidance.suggest');
  await press(tree, 'planningHistory.reviewVigor');
  await press(tree, 'planningHistory.apply');

  const limit = () => tree.root.findAllByType(Stepper).find((n: any) => n.props.label === 'cardioPlan.sessionLimit');
  expect(limit().props.value).toBe(40); await press(tree, 'generate.back');  expect(limit().props.value).toBe(40);
  expect(output(tree)).not.toContain('healthPlanning.saveConsent'); await act(async () => tree.unmount());
});
it('keeps Health separate, preserves availability and rejects retained callbacks after configuration/owner/close/unmount changes', async () => {
  let captured: any, tree: any; const onApply = jest.fn(), renderHealth = (p: unknown) => { captured = p; return null; }, i = input();
  const render = (h = history, next = i) => <CardioPlanningHistoryContext.Provider value={{ ...h, renderHealth }}><CardioPlanningHistoryPrompt input={next} onApply={onApply} /></CardioPlanningHistoryContext.Provider>;
  await act(async () => { tree = create(render()); }); await press(tree, 'planningHistory.reviewHealth'); const old = captured.onApply;
  await act(async () => captured.onApply(estimate(i))); expect(onApply.mock.calls[0][0]).toMatchObject({ sessionMinutes: 40, cardioMinutes: 80, healthBaseline: estimate(i) });
  expect(onApply.mock.calls[0][0].availableDays).toEqual(i.availableDays); onApply.mockClear(); await act(async () => old(estimate(i))); expect(onApply).not.toHaveBeenCalled();
  await press(tree, 'planningHistory.reviewHealth'); const closed = captured.onApply; await act(async () => captured.onClose()); await act(async () => closed(estimate(i))); expect(onApply).not.toHaveBeenCalled();
  await press(tree, 'planningHistory.reviewHealth'); const stale = captured.onApply;
  await act(async () => tree.update(render(history, { ...i, cycleDays: 7 }))); await act(async () => stale(estimate(i))); expect(onApply).not.toHaveBeenCalled();
  const foreign = captured.onApply; await act(async () => tree.update(render({ ...history, owner: 'other' }))); await act(async () => foreign(estimate(i))); expect(onApply).not.toHaveBeenCalled();
  await press(tree, 'planningHistory.reviewHealth'); const unmounted = captured.onApply; await act(async () => tree.unmount()); await act(async () => unmounted(estimate(i))); expect(onApply).not.toHaveBeenCalled();
});
it('leaves machines and mixed-modality planning manual, without discarding selected activities', async () => {
  const i = input(); let tree: any;
  const render = (modalities: CardioPreviewInput['modalities']) => <CardioPlanningHistoryContext.Provider value={history}><CardioPlanningHistoryPrompt input={{ ...i, modalities }} onApply={jest.fn()} /></CardioPlanningHistoryContext.Provider>;
  await act(async () => { tree = create(render(['MACHINE'])); }); expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(render(['RUNNING', 'CYCLING']))); expect(output(tree)).toContain('planningHistory.singleModality');
  expect(button(tree, 'planningHistory.reviewHealth')).toBeUndefined(); await act(async () => tree.unmount());
});

it('remembers explicit consent and applies a fresh estimate on the next draft without asking again', async () => {
  let tree: any, captured: any;
  const i = input(), onApply = jest.fn(), read = jest.fn(), clear = jest.fn();
  const data = vigorPlanningHistory(entries, 'owner', now);
  const render = (automaticHealth: CardioPlanningHistory['automaticHealth'], allowAutomatic = true) =>
    <CardioPlanningHistoryContext.Provider value={{ ...history, automaticHealth, renderHealth: props => { captured = props; return null; } }}>
      <CardioPlanningHistoryPrompt input={i} allowAutomatic={allowAutomatic} onApply={onApply} />
    </CardioPlanningHistoryContext.Provider>;
  const idle = { owner: 'owner', state: 'IDLE' as const, epoch: 0, read, clear, focused: true };
  await act(async () => { tree = create(render(idle)); });
  expect(read).not.toHaveBeenCalled();
  await press(tree, 'planningHistory.reviewHealth');
  await act(async () => captured.onApply(estimate(i), true));
  expect(writeCardioPlanningPreference).toHaveBeenCalledWith('owner', 'RUNNING', 40);
  await act(async () => tree.unmount());
  jest.mocked(readCardioPlanningPreference).mockReturnValueOnce({ RUNNING: 35 });
  onApply.mockClear();
  await act(async () => { tree = create(render({ ...idle, focused: false })); });
  expect(read).not.toHaveBeenCalled();
  await act(async () => tree.update(render(idle)));
  expect(read).toHaveBeenCalledWith(false);
  await act(async () => tree.update(render({ ...idle, state: 'READY', data, observedAt: now }, false)));
  expect(onApply).not.toHaveBeenCalled();
  await act(async () => tree.update(render({ ...idle, state: 'READY', data, observedAt: now })));
  expect(onApply).toHaveBeenCalledTimes(1);
  expect(onApply.mock.calls[0][0]).toMatchObject({ sessionMinutes: 40, availableDays: i.availableDays, healthBaseline: { comfortableMinutes: 40 } });
  await press(tree, 'planningHistory.forget');
  expect(writeCardioPlanningPreference).toHaveBeenLastCalledWith('owner', 'RUNNING', undefined);
  await act(async () => tree.unmount());
});
