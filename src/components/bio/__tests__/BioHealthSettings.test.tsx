import React from 'react';
import { Switch } from 'react-native';
import { BioHealthSettings } from '../BioHealthSettings';
import { HealthAccessReview } from '../HealthAccessReview';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; let mockEnabled = false; const mockAuthorize = jest.fn(), mockChange = jest.fn(), mockAvailable = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ uid: mockUid }) }));
jest.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ ready: true, busy: false, settings: { bioHealthEnabled: mockEnabled }, change: mockChange }) }));
jest.mock('@/services/health/bioHealthClient', () => ({ bioHealthBridge: { bioAvailable: () => mockAvailable(), authorizeBio: () => mockAuthorize() } }));
jest.mock('../BioNightSettings', () => ({ BioNightSettings: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockEnabled = false; mockAuthorize.mockResolvedValue(undefined); mockChange.mockResolvedValue(true); mockAvailable.mockResolvedValue(true); });
it('opens a visible review even if iOS has no new authorization prompt, and closes it on account changes', async () => {
  mockEnabled = true; let tree: any; await act(async () => { tree = create(<BioHealthSettings />); });
  const review = tree.root.findAll((n: any) => n.props.accessibilityLabel === 'bioHealth.permissions' && typeof n.props.onPress === 'function')[0];
  await act(async () => review.props.onPress()); expect(mockAuthorize).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(HealthAccessReview).props.onRequest()); expect(mockAuthorize).toHaveBeenCalledTimes(1);
  mockUid = 'other'; await act(async () => tree.update(<BioHealthSettings />)); expect(tree.root.findAllByType(HealthAccessReview)).toHaveLength(0);
  await act(async () => tree.unmount());
});
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
