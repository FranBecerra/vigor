import React from 'react';
import { Switch } from 'react-native';
import { BioHealthSettings } from '../BioHealthSettings';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; let mockEnabled = false; const mockAuthorize = jest.fn(), mockChange = jest.fn(), mockAvailable = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ ready: true, busy: false, settings: { bioHealthEnabled: mockEnabled }, change: mockChange }) }));
jest.mock('@/services/health/bioHealthClient', () => ({ bioHealthBridge: { bioAvailable: () => mockAvailable(), authorizeBio: () => mockAuthorize() } }));
jest.mock('../BioNightSettings', () => ({ BioNightSettings: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockEnabled = false; mockAuthorize.mockResolvedValue(undefined); mockChange.mockResolvedValue(true); mockAvailable.mockResolvedValue(true); });
it('prompts only on explicit connection, serializes taps, and disconnects without a permission request', async () => {
  let tree: any; await act(async () => { tree = create(<BioHealthSettings />); }); expect(mockAuthorize).not.toHaveBeenCalled(); expect(mockChange).not.toHaveBeenCalled();
  await act(async () => { tree.root.findByType(Switch).props.onValueChange(true); tree.root.findByType(Switch).props.onValueChange(true); });
  expect(mockAuthorize).toHaveBeenCalledTimes(1); expect(mockChange).toHaveBeenCalledWith({ bioHealthEnabled: true });
  mockEnabled = true; await act(async () => tree.update(<BioHealthSettings />));
  await act(async () => tree.root.findByType(Switch).props.onValueChange(false));
  expect(mockAuthorize).toHaveBeenCalledTimes(1); expect(mockChange).toHaveBeenLastCalledWith({ bioHealthEnabled: false });
  await act(async () => tree.unmount());
});
it('does not opt in after a failed permission flow or persistence write', async () => {
  mockAuthorize.mockRejectedValueOnce(Error('cancelled')); let tree: any;
  await act(async () => { tree = create(<BioHealthSettings />); });
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  expect(mockChange).not.toHaveBeenCalled(); expect(JSON.stringify(tree.toJSON())).toContain('bioHealth.error');
  mockChange.mockResolvedValue(false); await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  expect(JSON.stringify(tree.toJSON())).toContain('bioHealth.error'); await act(async () => tree.unmount());
});
it('never saves an old connection approval into another account or an account round trip', async () => {
  let release!: () => void; mockAuthorize.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
  let tree: any; await act(async () => { tree = create(<BioHealthSettings />); });
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true));
  mockUid = 'other'; await act(async () => tree.update(<BioHealthSettings />));
  mockUid = 'owner'; await act(async () => tree.update(<BioHealthSettings />));
  await act(async () => release()); expect(mockChange).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
