import React from 'react';
import { AppState, Appearance } from 'react-native';
import { AppSettingsProvider, useAppSettings } from '../useAppSettings';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; let mockLoading = false;
const mockGet = jest.fn(); const mockUpdate = jest.fn(); const mockName = jest.fn(); const mockLanguage = jest.fn(async (_language: string) => undefined);
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid, isLoading: mockLoading, user: { displayName: 'Google name' } }) }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { changeLanguage: (language: string) => mockLanguage(language) }, getSystemLanguage: () => 'es' }));
jest.mock('@/services/settings/settingsClient', () => ({ appSettingsRepository: { get: (...args: any[]) => mockGet(...args), update: (...args: any[]) => mockUpdate(...args) } }));
jest.mock('@/services/settings/profileName', () => ({ updateDisplayName: (...args: any[]) => mockName(...args) }));
let result: ReturnType<typeof useAppSettings>;
function Probe() { result = useAppSettings(); return null; }
beforeEach(() => {
  jest.clearAllMocks(); mockUid = 'owner'; mockLoading = false;
  mockGet.mockResolvedValue({ appearance: 'system', language: 'system' }); mockUpdate.mockResolvedValue({ appearance: 'dark', language: 'en' }); mockName.mockResolvedValue('Fran');
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() }); jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());
it('restores and applies actual appearance/language and updates the visible username only after success', async () => {
  let tree: any; await act(async () => { tree = create(<AppSettingsProvider><Probe /></AppSettingsProvider>); });
  expect(result.ready).toBe(true); expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('unspecified'); expect(mockLanguage).toHaveBeenCalledWith('es');
  await act(async () => { expect(await result.change({ appearance: 'dark' })).toBe(true); });
  expect(mockUpdate).toHaveBeenCalledWith('owner', { appearance: 'dark' }); expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');
  await act(async () => { expect(await result.saveName('Fran')).toBe(true); }); expect(result.displayName).toBe('Fran');
  mockName.mockRejectedValueOnce(Error('offline')); await act(async () => { expect(await result.saveName('Different')).toBe(false); });
  expect(result.displayName).toBe('Fran'); expect(result.error).toBe(true); await act(async () => tree.unmount());
});
it('keeps prior preferences and supports reload after file failure, without saving before auth/load is ready', async () => {
  mockLoading = true; let tree: any; await act(async () => { tree = create(<AppSettingsProvider><Probe /></AppSettingsProvider>); });
  expect(mockGet).not.toHaveBeenCalled(); await act(async () => { expect(await result.change({ language: 'fr' })).toBe(false); });
  mockLoading = false; mockGet.mockRejectedValueOnce(Error('file')); await act(async () => tree.update(<AppSettingsProvider><Probe /></AppSettingsProvider>));
  expect(result.error).toBe(true); expect(result.ready).toBe(false);
  await act(async () => result.reload()); expect(result.ready).toBe(true);
  mockUpdate.mockRejectedValueOnce(Error('disk')); await act(async () => { expect(await result.change({ language: 'en' })).toBe(false); });
  expect(result.settings).toEqual({ appearance: 'system', language: 'system' }); await act(async () => tree.unmount());
});
it('ignores a previous owner load/save and restores system defaults on logout', async () => {
  let resolve!: (value: any) => void; mockGet.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  let tree: any; await act(async () => { tree = create(<AppSettingsProvider><Probe /></AppSettingsProvider>); });
  mockUid = 'other'; await act(async () => tree.update(<AppSettingsProvider><Probe /></AppSettingsProvider>));
  await act(async () => resolve({ appearance: 'dark', language: 'ja' })); expect(result.settings).toEqual({ appearance: 'system', language: 'system' });
  let resolveName!: (value: string) => void; mockName.mockImplementationOnce(() => new Promise((done) => { resolveName = done; }));
  let pending!: Promise<boolean>; await act(async () => { pending = result.saveName('Old account'); });
  mockUid = 'new'; await act(async () => tree.update(<AppSettingsProvider><Probe /></AppSettingsProvider>));
  await act(async () => resolveName('Old account')); expect(await pending).toBe(false); expect(result.displayName).toBe('Google name');
  mockUid = null; await act(async () => tree.update(<AppSettingsProvider><Probe /></AppSettingsProvider>));
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('unspecified'); await act(async () => tree.unmount());
});
