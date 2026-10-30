import React from 'react';
import { AthleteIntakeForm } from '../AthleteIntakeForm';
import { CardioPlanBuilder } from '@/components/cardio/CardioPlanBuilder';
import { AthleteIntakeContext } from '@/hooks/AthleteIntakeContext';
import { GenerationChoice } from '@/components/train/generate/GenerationChoice';
import { NumericField } from '@/components/train/NumericField';
import { Stepper } from '@/components/train/generate/GenerateControls';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: any) => values?.modality ? `${key}:${values.modality}` : values?.day ? `${key}:${values.day}` : key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const save = jest.fn(), cancel = jest.fn();
const button = (tree: any, label: string) => tree.root.findAll((n: any) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const press = async (tree: any, label: string) => act(async () => button(tree, label).props.onPress());
const out = (tree: any) => JSON.stringify(tree.toJSON());
beforeEach(() => { jest.clearAllMocks(); save.mockResolvedValue(true); });
it('offers retry and a direct exit when profile defaults cannot load', async () => {
  const reload = jest.fn(); let tree: any;
  await act(async () => { tree = create(<AthleteIntakeContext.Provider value={{ ready: false, error: true, reload }}>
    <CardioPlanBuilder ready error={false} onRetry={() => undefined} onCancel={cancel} /></AthleteIntakeContext.Provider>); });
  expect(out(tree)).toContain('settings.error'); await press(tree, 'settings.retry'); expect(reload).toHaveBeenCalledTimes(1);
  await press(tree, 'generate.cancel'); expect(cancel).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
it('does not write while browsing, supports unknown answers, and defers explicitly only once', async () => {
  let tree: any; await act(async () => { tree = create(<AthleteIntakeForm welcome onSave={save} onCancel={cancel} />); });
  expect(save).not.toHaveBeenCalled();
  await press(tree, 'athleteIntake.later'); expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'DEFERRED' }));
  expect(cancel).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('saves independent modality answers and capacity without changing an existing plan', async () => {
  let tree: any; await act(async () => { tree = create(<AthleteIntakeForm onSave={save} onCancel={cancel} />); });
  await act(async () => tree.root.findAllByType(GenerationChoice).find((n: any) => n.props.title === 'athleteIntake.goal_HYBRID').props.onPress());
  await press(tree, 'exerciseWizard.next'); await press(tree, 'exerciseWizard.next');
  await press(tree, 'cardioPlan.RUNNING: cardioPlan.NEW');
  const field = (label: string) => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === label);
  await act(async () => field('cardioPlan.durationFor:cardioPlan.RUNNING').props.onChangeValue(40));
  await press(tree, 'exerciseWizard.next');
  await act(async () => field('athleteIntake.strengthFrequency').props.onChangeValue(4));
  await act(async () => field('athleteIntake.strengthDuration').props.onChangeValue(75));
  await press(tree, 'athleteIntake.save');
  expect(save).toHaveBeenCalledTimes(1); expect(save.mock.calls[0][0]).toMatchObject({ goal: 'HYBRID', strengthSessionsPerWeek: 4,
    strengthMinutesPerSession: 75, cardio: { modalities: { RUNNING: { status: 'NEW', typicalSessionMinutes: 40, qualityExposure: 'UNKNOWN' } } } });
  await act(async () => tree.unmount());
});
it('retains invalid or failed answers, blocks duplicate submissions and cancels without writing', async () => {
  let resolve!: (value: boolean) => void;
  save.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  let tree: any; await act(async () => { tree = create(<AthleteIntakeForm onSave={save} onCancel={cancel} />); });
  for (let i = 0; i < 3; i++) await press(tree, 'exerciseWizard.next');
  await act(async () => { button(tree, 'athleteIntake.save').props.onPress(); button(tree, 'athleteIntake.save').props.onPress(); });
  expect(save).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(NumericField).every((n: any) => n.props.editable === false)).toBe(true);
  await act(async () => resolve(false)); expect(out(tree)).toContain('athleteIntake.failed');
  const field = tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === 'athleteIntake.strengthFrequency');
  await act(async () => field.props.onChangeValue(99)); await press(tree, 'athleteIntake.save'); expect(save).toHaveBeenCalledTimes(1);
  await press(tree, 'generate.cancel'); expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('retries a rejected save with the same draft and removes an explicitly cleared modality', async () => {
  save.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  let tree: any; await act(async () => { tree = create(<AthleteIntakeForm onSave={save} onCancel={cancel} />); });
  await press(tree, 'exerciseWizard.next'); await press(tree, 'experienceGuide.open');
  const guide = tree.root.findByType(require('@/components/train/generate/ExperienceLevelGuide').ExperienceLevelGuide);
  await act(async () => { guide.props.onSelect('INTERMEDIATE'); guide.props.onClose(); });
  await press(tree, 'exerciseWizard.next');
  await press(tree, 'cardioPlan.RUNNING: cardioPlan.NEW'); await press(tree, 'cardioPlan.RUNNING: cardioPlan.NEW');
  await press(tree, 'exerciseWizard.next'); await press(tree, 'athleteIntake.save');
  expect(out(tree)).toContain('athleteIntake.failed'); await press(tree, 'athleteIntake.save');
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[1][0]).toMatchObject({ strengthExperience: 'INTERMEDIATE', cardio: { schemaVersion: 1, modalities: {} } });
  await act(async () => tree.unmount());
});
it('seeds cardio once after settings are ready and preserves manual edits across profile refreshes', async () => {
  const intake = { version: 1 as const, status: 'COMPLETED' as const, updatedAt: 10,
    cardio: { schemaVersion: 1 as const, modalities: { RUNNING: { status: 'NEW' as const, qualityExposure: 'UNKNOWN' as const, typicalSessionMinutes: 40 } } } };
  const planner = (ready: boolean, record = intake) => <AthleteIntakeContext.Provider value={{ ready, intake: record }}>
    <CardioPlanBuilder ready error={false} onRetry={() => undefined} onCancel={cancel} /></AthleteIntakeContext.Provider>;
  let tree: any; await act(async () => { tree = create(planner(false)); });
  expect(out(tree)).toContain('cardioPlan.loading'); expect(button(tree, 'exerciseWizard.next')).toBeUndefined();
  await act(async () => tree.update(planner(true))); expect(button(tree, 'exerciseWizard.next').props.disabled).toBe(false);
  await press(tree, 'exerciseWizard.next');
  const duration = () => tree.root.findAllByType(NumericField).find((n: any) => n.props.accessibilityLabel === 'cardioPlan.durationFor:cardioPlan.RUNNING');
  expect(duration().props.value).toBe(40); await act(async () => duration().props.onChangeValue(35));
  await act(async () => tree.update(planner(true, { ...intake, updatedAt: 20 })));
  expect(duration().props.value).toBe(35);
  await press(tree, 'exerciseWizard.next'); expect(tree.root.findAllByType(Stepper).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
});
