import React from 'react';
import { AppState } from 'react-native';
import { HealthExportProvider, useHealthExport } from '../useHealthExport';
const { create, act } = require('react-test-renderer');
let mockUid: string | null = 'owner'; let mockLoading = false;
let mockState: any = { owner: 'owner', ready: true, enabled: true, available: true, error: false, entries: { private: { status: 'saved' } } };
const mockActivate = jest.fn(async (_owner: string | null) => undefined); const mockRetry = jest.fn(async (_owner: string) => undefined);
jest.mock('../useAuth', () => ({ useAuth: () => ({ uid: mockUid, isLoading: mockLoading }) }));
jest.mock('@/services/health/healthClient', () => ({ workoutHealth: {
  subscribe: () => () => undefined, getSnapshot: () => mockState,
  activate: (owner: string | null) => mockActivate(owner), retryPending: (owner: string) => mockRetry(owner),
} }));
let result: ReturnType<typeof useHealthExport>;
function Probe() { result = useHealthExport(); return null; }
beforeEach(() => { jest.clearAllMocks(); mockUid = 'owner'; mockLoading = false;
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  mockState = { owner: 'owner', ready: true, enabled: true, available: true, error: false, entries: { private: { status: 'saved' } } }; });
afterEach(() => jest.restoreAllMocks());

it('restores only the authenticated owner and retries pending work on foreground without prompting', async () => {
  let change!: (state: any) => void; const remove = jest.fn();
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { change = listener; return { remove }; });
  let tree: any; await act(async () => { tree = create(<HealthExportProvider><Probe /></HealthExportProvider>); });
  expect(mockActivate).toHaveBeenCalledWith('owner'); expect(result.entries.private.status).toBe('saved');
  await act(async () => change('background')); expect(mockRetry).not.toHaveBeenCalled();
  await act(async () => change('active')); expect(mockRetry).toHaveBeenCalledWith('owner');
  await act(async () => tree.unmount()); expect(remove).toHaveBeenCalled(); spy.mockRestore();
});
it('hides previous-owner state immediately and deactivates on sign-out', async () => {
  let tree: any; await act(async () => { tree = create(<HealthExportProvider><Probe /></HealthExportProvider>); });
  mockUid = 'other'; await act(async () => tree.update(<HealthExportProvider><Probe /></HealthExportProvider>));
  expect(result).toMatchObject({ owner: 'other', enabled: false, ready: false, entries: {} });
  expect(mockActivate).toHaveBeenLastCalledWith('other');
  mockUid = null; await act(async () => tree.update(<HealthExportProvider><Probe /></HealthExportProvider>));
  expect(mockActivate).toHaveBeenLastCalledWith(null); expect(result.entries).toEqual({});
  await act(async () => tree.unmount());
});
it('does not treat an unresolved auth restore as permission to process an outbox', async () => {
  mockLoading = true; let tree: any;
  await act(async () => { tree = create(<HealthExportProvider><Probe /></HealthExportProvider>); });
  expect(mockActivate).not.toHaveBeenCalled(); expect(result.entries).toEqual({});
  mockLoading = false; await act(async () => tree.update(<HealthExportProvider><Probe /></HealthExportProvider>));
  expect(mockActivate).toHaveBeenCalledWith('owner'); await act(async () => tree.unmount());
});
