import React from 'react';
import { Switch } from 'react-native';
import { BioNightSettings } from '../BioNightSettings';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner', mockEnabled = false, mockBase = true, mockReady = true, mockBusy = false;
const mockAuthorize = jest.fn(), mockChange = jest.fn(), mockAvailable = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ ready: mockReady, busy: mockBusy,
  settings: { bioHealthEnabled: mockBase, bioNightEnabled: mockEnabled }, change: mockChange }) }));
jest.mock('@/services/health/bioHealthClient', () => ({ bioNightBridge: { available: () => mockAvailable(), authorize: () => mockAuthorize() } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockEnabled = false; mockBase = true; mockReady = true; mockBusy = false;
  mockAuthorize.mockResolvedValue(undefined); mockChange.mockResolvedValue(true); mockAvailable.mockResolvedValue(true); });
it('prompts only on explicit opt-in and serializes repeated actions; disabling makes no permission request', async () => {
  let tree: any; await act(async () => { tree = create(<BioNightSettings />); });
  expect(mockAuthorize).not.toHaveBeenCalled(); expect(mockChange).not.toHaveBeenCalled();
  await act(async () => { tree.root.findByType(Switch).props.onValueChange(true); tree.root.findByType(Switch).props.onValueChange(true); });
  expect(mockAuthorize).toHaveBeenCalledTimes(1); expect(mockChange).toHaveBeenCalledWith({ bioNightEnabled: true });
  mockEnabled = true; await act(async () => tree.update(<BioNightSettings />));
  const review = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'bioNight.permissions' && typeof node.props.onPress === 'function')[0];
  await act(async () => review.props.onPress()); expect(mockAuthorize).toHaveBeenCalledTimes(2);
  await act(async () => tree.root.findByType(Switch).props.onValueChange(false));
  expect(mockAuthorize).toHaveBeenCalledTimes(2); expect(mockChange).toHaveBeenLastCalledWith({ bioNightEnabled: false });
  await act(async () => tree.unmount());
});
it('retains error/retry behavior and does not enable after a rejected permission or save', async () => {
  mockAuthorize.mockRejectedValueOnce(Error('cancelled')); let tree: any;
  await act(async () => { tree = create(<BioNightSettings />); });
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true)); expect(mockChange).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('bioHealth.error');
  mockChange.mockResolvedValue(false); await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  expect(JSON.stringify(tree.toJSON())).toContain('bioHealth.error'); await act(async () => tree.unmount());
});
it('rejects obsolete permission completions and unavailable/unready/unsigned interactions', async () => {
  let release!: () => void; mockAuthorize.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<BioNightSettings />); });
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  mockUid = 'other'; await act(async () => tree.update(<BioNightSettings />));
  mockUid = 'owner'; await act(async () => tree.update(<BioNightSettings />));
  await act(async () => release()); expect(mockChange).not.toHaveBeenCalled();
  for (const kind of ['signedOut', 'unready', 'baseOff', 'busy']) {
    mockUid = kind === 'signedOut' ? null : 'owner'; mockReady = kind !== 'unready'; mockBase = kind !== 'baseOff'; mockBusy = kind === 'busy';
    await act(async () => tree.update(<BioNightSettings />));
    await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  }
  expect(mockAuthorize).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
  mockAvailable.mockRejectedValue(Error('missing')); mockUid = 'owner'; mockReady = true; mockBase = true; mockBusy = false;
  await act(async () => { tree = create(<BioNightSettings />); });
  expect(tree.root.findByType(Switch).props.disabled).toBe(true); expect(JSON.stringify(tree.toJSON())).toContain('bioNight.updateRequired');
  await act(async () => tree.unmount());
});
it('never persists a permission completion after unmount', async () => {
  let release!: () => void; mockAuthorize.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<BioNightSettings />); });
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  await act(async () => tree.unmount()); await act(async () => release()); expect(mockChange).not.toHaveBeenCalled();
});
