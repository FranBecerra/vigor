import React from 'react';
import { BioReadinessCard } from '../BioReadinessCard';
import { buildReadinessIndex } from '@/services/bio/readinessIndex';
import { readinessFixture, READINESS_FIXTURE_NOW as now } from '@/test-support/readinessFixture';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, args?: any) => args ? `${key}:${JSON.stringify(args)}` : key,
  i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = (tree: any) => JSON.stringify(tree.toJSON());
it('keeps a structured loading card without displaying a stale score', async () => {
  let tree: any;
  await act(async () => { tree = create(<BioReadinessCard view={{ state: 'LOADING', index: buildReadinessIndex(readinessFixture(), 480, now) }} />); });
  expect(tree.root.findByProps({ testID: 'readiness-placeholder' })).toBeDefined();
  for (const title of ['bioReadiness.sleep', 'bioNight.HEART_RATE', 'bioSummary.hrv']) expect(text(tree)).toContain(title);
  expect(text(tree)).toContain('bioMetricsRefreshing'); expect(text(tree)).not.toContain('/ 100');
  await act(async () => tree.unmount());
});
it('shows an explicitly experimental total with expandable components, method and coverage, never a prescription', async () => {
  const index = buildReadinessIndex(readinessFixture(), 480, now); let tree: any;
  await act(async () => { tree = create(<BioReadinessCard view={{ state: 'READY', index }} />); });
  expect(text(tree)).toContain('bioReadiness.experimental'); expect(text(tree)).not.toContain('bioReadiness.boundary');
  expect(text(tree)).toContain('bioSummary.GREEN'); expect(text(tree)).not.toContain('bioReadiness.formula');
  expect(tree.root.findAll((node: any) => node.props.testID === 'readiness-score')[0].props.children).toBe(100);
  expect(text(tree)).not.toContain('RECOVERY_CONTEXT_V1');
  await act(async () => button(tree, 'bioReadiness.details').props.onPress());
  expect(text(tree)).toContain('bioReadiness.boundary'); expect(text(tree)).toContain('bioSummary.legend');
  expect(text(tree)).toContain('bioNight.HRV_RMSSD'); expect(text(tree)).toContain('bioReadiness.signalCoverage');
  expect(text(tree)).toContain('RECOVERY_CONTEXT_V1'); expect(text(tree)).toContain('bioReadiness.formula');
  await act(async () => button(tree, 'bioReadiness.hideDetails').props.onPress()); expect(text(tree)).not.toContain('RECOVERY_CONTEXT_V1');
  await act(async () => tree.unmount());
});
it('does not retain visible totals in off/error/loading/missing/stale states and routes deliberate setup to Settings', async () => {
  let tree: any; await act(async () => { tree = create(<BioReadinessCard view={{ state: 'OFF' }} />); });
  await act(async () => button(tree, 'bioNight.connect').props.onPress()); expect(mockPush).toHaveBeenCalledWith('/settings');
  for (const state of ['ERROR', 'UNAVAILABLE', 'LOADING'] as const) {
    await act(async () => tree.update(<BioReadinessCard view={{ state }} />)); expect(text(tree)).not.toContain('/ 100');
  }
  for (const index of [buildReadinessIndex(readinessFixture(), undefined, now), buildReadinessIndex(undefined, 480, now),
    buildReadinessIndex(readinessFixture(), 480, now + 40 * 3600000)]) {
    await act(async () => tree.update(<BioReadinessCard view={{ state: 'READY', index }} />));
    expect(text(tree)).not.toContain('/ 100'); expect(text(tree)).toContain('bioSummary.UNKNOWN');
    expect(text(tree)).not.toContain('bioReadiness.coverage.INSUFFICIENT');
    if (index.reasons.includes('SLEEP_GOAL')) {
      expect(text(tree)).toContain('bioSummary.goalMissing');
      await act(async () => button(tree, 'bioReadiness.setGoal').props.onPress());
    }
    await act(async () => button(tree, 'bioReadiness.details').props.onPress());
    expect(text(tree)).toContain('bioReadiness.coverage.INSUFFICIENT');
    expect(text(tree)).toContain('bioReadiness.sleepDetails');
    await act(async () => button(tree, 'bioReadiness.hideDetails').props.onPress());
  }
  await act(async () => tree.unmount());
});
it('keeps immature and unusual cardiac readings neutral and labels coloured departures', async () => {
  const index = buildReadinessIndex(readinessFixture(), 480, now); let tree: any;
  index.score = 70; index.sleep.score = 90; index.cardiac.pulse!.score = undefined;
  index.cardiac.hrv!.score = undefined; index.cardiac.hrv!.unusual = true;
  await act(async () => { tree = create(<BioReadinessCard view={{ state: 'READY', index }} />); });
  expect(text(tree)).toContain('bioSummary.ORANGE'); expect(text(tree)).toContain('bioSummary.YELLOW');
  expect(text(tree)).toContain('bioSummary.building'); expect(text(tree)).toContain('bioSummary.unusual');
  expect(text(tree)).not.toContain('bioSummary.GREEN');
  await act(async () => tree.update(<BioReadinessCard view={{ state: 'OFF' }} />));
  await act(async () => button(tree, 'bioReadiness.details').props.onPress());
  expect(text(tree)).toContain('bioReadiness.intro');
  expect(tree.root.findAll((node: any) => node.props.testID === 'readiness-score')[0].props.children).toBe('—');
  await act(async () => tree.unmount());
});
