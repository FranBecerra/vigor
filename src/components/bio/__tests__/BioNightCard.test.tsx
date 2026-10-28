import React from 'react';
import { BioNightCard } from '../BioNightCard';
import { buildNightObservations } from '@/services/bio/nightObservations';
import { BIO_NIGHT_METRICS, type BioNightRead } from '@/models/bioNight';
const { create, act } = require('react-test-renderer');
const mockPush = jest.fn(), mockReload = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, args?: any) => args ? `${key}:${JSON.stringify(args)}` : key,
  i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = (tree: any) => JSON.stringify(tree.toJSON());
const night = (patch = {}): any => ({ state: 'OFF', reload: mockReload, ...patch });
it('routes consent to settings and distinguishes loading, errors, empty and unsupported binaries', async () => {
  let tree: any; await act(async () => { tree = create(<BioNightCard night={night()} />); });
  await act(async () => button(tree, 'bioNight.connect').props.onPress()); expect(mockPush).toHaveBeenCalledWith('/settings');
  for (const state of ['LOADING', 'ERROR', 'UNAVAILABLE', 'READY']) {
    await act(async () => tree.update(<BioNightCard night={night({ state, analysis: { status: 'EMPTY' } })} />));
    expect(text(tree)).not.toContain('bioNight.samples');
    if (state === 'ERROR') expect(text(tree)).toContain('bioHealth.error');
    if (state === 'UNAVAILABLE') expect(text(tree)).toContain('bioNight.updateRequired');
    if (state === 'READY') expect(text(tree)).toContain('bioHealth.noData');
  }
  await act(async () => button(tree, 'bioNight.refresh').props.onPress()); expect(mockReload).toHaveBeenCalled();
  for (const status of ['ERROR', 'TRUNCATED']) {
    await act(async () => tree.update(<BioNightCard night={night({ state: 'READY', analysis: { status } })} />)); expect(text(tree)).toContain('bioHealth.error');
  }
  await act(async () => tree.unmount());
});
it('shows method-specific observations and expandable quality details without claiming a recovery score', async () => {
  const now = Date.now(), end = now - 3600000, start = end - 8 * 3600000;
  const read: BioNightRead = { version: 1, metrics: Object.fromEntries(BIO_NIGHT_METRICS.map((metric) => [metric,
    { error: false, truncated: false, samples: [{ metric, id: metric, sourceId: 's', sourceName: 'Synthetic Watch', manuallyEntered: false,
      start: metric === 'SLEEP' ? start : start + 3600000, end: metric === 'SLEEP' ? end : start + 3600000, value: metric === 'SLEEP' ? 480 : 55,
      ...(metric === 'SLEEP' ? { sleepState: 'ASLEEP' } : {}) }] }])) as BioNightRead['metrics'] };
  read.metrics.HRV_RMSSD = { samples: [], error: false, truncated: false, unsupported: true };
  const analysis = buildNightObservations(read, now);
  let tree: any; await act(async () => { tree = create(<BioNightCard night={night({ state: 'READY', analysis })} />); });
  expect(text(tree)).toContain('55 bpm'); expect(text(tree)).toContain('55 ms'); expect(text(tree)).not.toContain('bioNight.unsupported');
  expect(text(tree)).not.toContain('bioNight.limit'); expect(text(tree)).not.toContain('score');
  await act(async () => button(tree, 'bioNight.details').props.onPress());
  expect(text(tree)).toContain('bioNight.unsupported'); expect(text(tree)).toContain('bioSummary.permissionPrivacy');
  expect(text(tree)).toContain('Synthetic Watch'); expect(text(tree)).toContain('bioNight.coverage'); expect(text(tree)).toContain('bioNight.buildingReference');
  analysis.references.HEART_RATE = { median: 50, days: 14 }; analysis.fresh = false;
  await act(async () => tree.update(<BioNightCard night={night({ state: 'READY', analysis })} />));
  expect(text(tree)).toContain('bioHealth.reference'); expect(text(tree)).toContain('bioHealth.stale');
  await act(async () => button(tree, 'bioNight.hideDetails').props.onPress()); expect(text(tree)).not.toContain('bioNight.limit');
  await act(async () => tree.unmount());
});
it('does not fill the main card with empty optional methods and explains exact exclusions behind details', async () => {
  const cardiac = ['HEART_RATE', 'HRV_SDNN', 'HRV_RMSSD'].map((metric, index) => ({ metric, status: 'EMPTY', samples: 0,
    missingReason: ['NO_READABLE_SAMPLES', 'SOURCE_MISMATCH', 'OUTSIDE_SLEEP'][index] }));
  const analysis = { status: 'AVAILABLE', latest: { asleepMinutes: 480, date: '2026-10-27', start: 1, end: 2, cardiac }, references: {} };
  let tree: any; await act(async () => { tree = create(<BioNightCard night={night({ state: 'READY', analysis })} />); });
  expect(text(tree)).toContain('bioSummary.noNightSignals'); expect(text(tree)).not.toContain('bioNight.HRV_RMSSD');
  await act(async () => button(tree, 'bioNight.details').props.onPress());
  for (const entry of cardiac) expect(text(tree)).toContain(`bioSummary.missing.${entry.missingReason}`);
  expect(text(tree)).not.toContain('bioHealth.missing');
  await act(async () => tree.unmount());
});
