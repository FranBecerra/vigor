import React from 'react';
import { Switch } from 'react-native';
import { HealthExportSettings, WorkoutHealthExport } from '../WorkoutHealthExport';
import { SetType, type WorkoutSession } from '@/models';
const { create, act } = require('react-test-renderer');
const mockEnable = jest.fn(async () => true); const mockExport = jest.fn(async () => true); const mockActivate = jest.fn(async () => undefined);
let mockHealth: any;
jest.mock('@/hooks/useHealthExport', () => ({ useHealthExport: () => mockHealth }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const session: WorkoutSession = { id: 'session', userId: 'owner', performedAt: 1000, completedAt: 5000,
  mesocycleId: 'meso', microcycleId: 'micro', microcycleIndex: 0,
  exercises: [{ id: 'ex', exerciseId: 'ex', order: 0, isSwap: false, sets: [{ id: 's', setType: SetType.NORMAL,
    targetReps: 10, targetWeight: 20, targetRIR: 2, actualReps: 10, actualWeight: 20, isAutoFilled: false }] }] };
beforeEach(() => { jest.clearAllMocks(); mockHealth = { owner: 'owner', ready: true, available: true, enabled: false, error: false, entries: {},
  service: { setEnabled: mockEnable, export: mockExport, activate: mockActivate } }; });
const press = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button'
  && node.findAll((child: any) => child.props.children === label).length && typeof node.props.onPress === 'function')[0];

it('requests opt-in only from an explicit switch interaction and keeps the disclosure visible', async () => {
  let tree: any; await act(async () => { tree = create(<HealthExportSettings />); });
  expect(JSON.stringify(tree.toJSON())).toContain('health.consent'); expect(mockEnable).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(Switch).props.onValueChange(true)); expect(mockEnable).toHaveBeenCalledWith('owner', true);
  await act(async () => tree.unmount());
});
it('disables settings on unsupported/unready platforms and provides an error retry', async () => {
  mockHealth.available = false; mockHealth.error = true; let tree: any;
  await act(async () => { tree = create(<HealthExportSettings />); });
  expect(tree.root.findByType(Switch).props.disabled).toBe(true); expect(JSON.stringify(tree.toJSON())).toContain('health.unavailable');
  await act(async () => press(tree, 'health.retrySettings').props.onPress()); expect(mockActivate).toHaveBeenCalledWith('owner');
  await act(async () => tree.unmount());
});
it('offers explicit historical export only after opt-in and does not resend saved workouts', async () => {
  let tree: any; await act(async () => { tree = create(<WorkoutHealthExport session={session} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('health.enableInProfile'); expect(mockExport).not.toHaveBeenCalled();
  mockHealth.enabled = true; await act(async () => tree.update(<WorkoutHealthExport session={session} />));
  await act(async () => press(tree, 'health.export').props.onPress()); expect(mockExport).toHaveBeenCalledWith(session);
  mockHealth.entries['["owner","session",5000]'] = { status: 'saved', action: 'save' };
  await act(async () => tree.update(<WorkoutHealthExport session={session} />));
  expect(JSON.stringify(tree.toJSON())).toContain('health.saved'); expect(press(tree, 'health.export')).toBeUndefined();
  await act(async () => tree.unmount());
});
it('shows denied/failure states without offering export for unfinished/foreign sessions', async () => {
  mockHealth.enabled = true; mockExport.mockResolvedValueOnce(false); let tree: any;
  await act(async () => { tree = create(<WorkoutHealthExport session={session} />); });
  await act(async () => press(tree, 'health.export').props.onPress()); expect(JSON.stringify(tree.toJSON())).toContain('health.failed');
  mockHealth.entries['["owner","session",5000]'] = { status: 'denied', action: 'save' };
  await act(async () => tree.update(<WorkoutHealthExport session={session} />)); expect(JSON.stringify(tree.toJSON())).toContain('health.denied');
  await act(async () => tree.update(<WorkoutHealthExport session={{ ...session, completedAt: undefined }} />)); expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(<WorkoutHealthExport session={{ ...session, userId: 'other' }} />)); expect(tree.toJSON()).toBeNull();
  await act(async () => tree.unmount());
});
