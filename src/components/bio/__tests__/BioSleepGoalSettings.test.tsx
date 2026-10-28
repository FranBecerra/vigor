import React from 'react';
import { BioSleepGoalSettings } from '../BioSleepGoalSettings';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner', mockReady = true, mockEnabled = true, mockBase = true, mockBusy = false, mockGoal: number | undefined;
const mockChange = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ ready: mockReady, busy: mockBusy,
  settings: { bioHealthEnabled: mockBase, bioNightEnabled: mockEnabled, bioSleepGoalMinutes: mockGoal }, change: mockChange }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, args?: any) => {
  const value = key.split('.').reduce((entry: any, part: string) => entry?.[part], require('@/i18n/locales/en.json'));
  if (typeof value !== 'string') throw Error(`Missing translation: ${key}`);
  return args ? `${key}:${JSON.stringify(args)}` : key;
} }) }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith(label) && typeof node.props.onPress === 'function')[0];
const text = (tree: any) => JSON.stringify(tree.toJSON());
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockReady = true; mockEnabled = true; mockBase = true; mockBusy = false; mockGoal = undefined; mockChange.mockResolvedValue(true); });
it('requires an explicit save, offers compact 15-minute controls and preserves drafts after failed saves', async () => {
  let tree: any; await act(async () => { tree = create(<BioSleepGoalSettings />); });
  expect(mockChange).not.toHaveBeenCalled(); await act(async () => button(tree, 'bioReadiness.setGoal').props.onPress());
  await act(async () => button(tree, 'bioReadiness.moreSleep').props.onPress());
  await act(async () => button(tree, 'bioReadiness.lessSleep').props.onPress());
  await act(async () => button(tree, 'bioReadiness.moreSleep').props.onPress());
  mockChange.mockResolvedValueOnce(false); await act(async () => button(tree, 'bioReadiness.saveGoal').props.onPress());
  expect(mockChange).toHaveBeenLastCalledWith({ bioSleepGoalMinutes: 495 }); expect(text(tree)).toContain('bioHealth.error');
  expect(button(tree, 'bioReadiness.saveGoal')).toBeDefined(); mockChange.mockRejectedValueOnce(Error('disk'));
  await act(async () => button(tree, 'bioReadiness.saveGoal').props.onPress()); expect(button(tree, 'bioReadiness.saveGoal')).toBeDefined();
  await act(async () => button(tree, 'bioReadiness.saveGoal').props.onPress()); expect(button(tree, 'bioReadiness.saveGoal')).toBeUndefined();
  await act(async () => button(tree, 'bioReadiness.setGoal').props.onPress());
  await act(async () => button(tree, 'bioReadiness.cancelGoal').props.onPress()); expect(button(tree, 'bioReadiness.saveGoal')).toBeUndefined();
  expect(mockChange).toHaveBeenCalledTimes(3); await act(async () => tree.unmount());
});
it('enforces bounds, disables unavailable saves and never fabricates a saved target', async () => {
  let tree: any; mockGoal = 240; await act(async () => { tree = create(<BioSleepGoalSettings />); });
  await act(async () => button(tree, 'bioReadiness.editGoal').props.onPress()); expect(button(tree, 'bioReadiness.lessSleep').props.disabled).toBe(true);
  await act(async () => button(tree, 'bioReadiness.lessSleep').props.onPress());
  await act(async () => button(tree, 'bioReadiness.saveGoal').props.onPress()); expect(mockChange).toHaveBeenLastCalledWith({ bioSleepGoalMinutes: 240 });
  mockGoal = 720; await act(async () => tree.update(<BioSleepGoalSettings />));
  await act(async () => button(tree, 'bioReadiness.editGoal').props.onPress()); expect(button(tree, 'bioReadiness.moreSleep').props.disabled).toBe(true);
  await act(async () => button(tree, 'bioReadiness.moreSleep').props.onPress());
  mockBusy = true; await act(async () => tree.update(<BioSleepGoalSettings />));
  await act(async () => button(tree, 'bioReadiness.saveGoal').props.onPress()); expect(mockChange).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  for (const kind of ['signedOut', 'unready', 'baseOff', 'nightOff']) {
    mockUid = kind === 'signedOut' ? null : 'owner'; mockReady = kind !== 'unready'; mockBase = kind !== 'baseOff'; mockEnabled = kind !== 'nightOff';
    await act(async () => { tree = create(<BioSleepGoalSettings />); }); expect(tree.toJSON()).toBeNull(); await act(async () => tree.unmount());
  }
});
it('serializes repeated saves and discards editor state across account changes and after unmount', async () => {
  let release!: (value: boolean) => void; mockChange.mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<BioSleepGoalSettings />); });
  await act(async () => button(tree, 'bioReadiness.setGoal').props.onPress());
  await act(async () => { button(tree, 'bioReadiness.saveGoal').props.onPress(); button(tree, 'bioReadiness.saveGoal').props.onPress(); });
  expect(mockChange).toHaveBeenCalledTimes(1); mockUid = 'other'; await act(async () => tree.update(<BioSleepGoalSettings />));
  mockUid = 'owner'; await act(async () => tree.update(<BioSleepGoalSettings />));
  await act(async () => release(false)); expect(text(tree)).not.toContain('bioHealth.error'); expect(button(tree, 'bioReadiness.saveGoal')).toBeUndefined();
  mockChange.mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = resolve; }));
  await act(async () => button(tree, 'bioReadiness.setGoal').props.onPress());
  await act(async () => button(tree, 'bioReadiness.saveGoal').props.onPress());
  await act(async () => tree.unmount()); await act(async () => release(true));
});
