import React from 'react';
import { AppState } from 'react-native';
import { clearWorkoutRestAlerts, useRestAlert } from '../useRestAlert';
import type { RestTimerState } from '@/services/training/restTimer';
const { create, act } = require('react-test-renderer');
const mockPlayer = { seekTo: jest.fn().mockResolvedValue(undefined), play: jest.fn() };
const mockNativeFeedback = jest.fn().mockResolvedValue(false);
const mockDeliverySnapshot = jest.fn().mockResolvedValue(undefined);
jest.mock('@/services/training/nativeRestFeedback', () => ({ scheduleNativeRestFeedback: (...args: unknown[]) => mockNativeFeedback(...args), recordRestDeliverySnapshot: (...args: unknown[]) => mockDeliverySnapshot(...args) }));
const mockMode = jest.fn().mockResolvedValue(undefined);
const mockHaptic = jest.fn().mockResolvedValue(undefined);
const mockSchedule = jest.fn().mockResolvedValue('vigor-rest');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockDismiss = jest.fn().mockResolvedValue(undefined);
const mockHandler = jest.fn();
const mockPermission = jest.fn().mockResolvedValue({ granted: true, ios: { allowsSound: true } });
const mockPending = jest.fn().mockResolvedValue([{ identifier: 'legacy', content: { data: { kind: 'rest' } } }, { identifier: 'other', content: { data: {} } }]);
jest.mock('expo-audio', () => ({ useAudioPlayer: () => mockPlayer, setAudioModeAsync: (...args: unknown[]) => mockMode(...args) }));
jest.mock('expo-haptics', () => ({ NotificationFeedbackType: { Success: 'success' }, notificationAsync: (...args: unknown[]) => mockHaptic(...args) }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: (...args: unknown[]) => mockHandler(...args),
  getAllScheduledNotificationsAsync: () => mockPending(),
  getPresentedNotificationsAsync: async () => [{ request: { identifier: 'old', content: { data: { kind: 'rest' } } } }],
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismiss(...args),
  getPermissionsAsync: () => mockPermission(),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 }, setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
const mockTranslate = (key: string) => key;
let unavailable: boolean;
function Probe({ state }: { state: RestTimerState }) { unavailable = useRestAlert(state); return null; }
const drain = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(10000); jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  mockPermission.mockResolvedValue({ granted: true, ios: { allowsSound: true } });
  mockNativeFeedback.mockResolvedValue(false);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('uses the native absolute deadline without duplicate Expo feedback and falls back if native preparation fails', async () => {
  mockNativeFeedback.mockResolvedValue(true); let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 2, anchorSetId: 'native' }} />); await drain(); });
  expect(mockNativeFeedback).toHaveBeenCalledWith(12000);
  await act(async () => { jest.advanceTimersByTime(2000); await drain(); });
  expect(mockPlayer.play).not.toHaveBeenCalled(); expect(mockHaptic).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  mockNativeFeedback.mockRejectedValue(Error('audio unavailable'));
  await act(async () => { tree = create(<Probe state={{ startedAt: 12000, durationSeconds: 2, anchorSetId: 'fallback' }} />); await drain(); });
  await act(async () => { jest.advanceTimersByTime(2000); await drain(); });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1); expect(mockHaptic).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('plays one foreground chime and haptic, suppresses its banner and removes only rest notifications', async () => {
  let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 2, anchorSetId: 's' }} />); await drain(); });
  await act(drain);
  expect(mockMode).not.toHaveBeenCalled();
  expect({ handler: mockHandler.mock.calls.length, pending: mockPending.mock.calls.length, cancel: mockCancel.mock.calls.length,
    dismiss: mockDismiss.mock.calls.length, permission: mockPermission.mock.calls.length, unavailable }).toEqual({ handler: 1, pending: 1, cancel: 1, dismiss: 1, permission: 1, unavailable: false });
  expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'vigor-rest' }));
  expect(mockCancel).toHaveBeenCalledWith('legacy'); expect(mockCancel).not.toHaveBeenCalledWith('other');
  expect(mockDismiss).toHaveBeenCalledWith('old');
  expect(mockDeliverySnapshot).toHaveBeenCalledWith(1);
  const handler = mockHandler.mock.calls.at(-1)[0].handleNotification;
  expect(await handler({ request: { identifier: 'vigor-rest', content: { data: { kind: 'rest' } } } })).toMatchObject({ shouldShowBanner: false, shouldPlaySound: false });
  await act(async () => { jest.advanceTimersByTime(2000); await drain(); });
  expect(mockMode).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }));
  expect(mockHaptic).toHaveBeenCalledTimes(1); expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(5000); await drain(); });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); await drain(); });
});

it('hands each locked/background rest to the OS with sound, even when native foreground feedback was accepted', async () => {
  mockNativeFeedback.mockResolvedValue(true); let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 3, anchorSetId: 'locked-1' }} />); await drain(); });
  const handler = mockHandler.mock.calls.at(-1)[0].handleNotification;
  for (const state of ['inactive', 'background']) {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
    expect(await handler({ request: { identifier: 'vigor-rest', content: { data: { kind: 'rest' } } } })).toMatchObject({ shouldShowBanner: true, shouldPlaySound: true });
  }
  await act(async () => { jest.advanceTimersByTime(3000); await drain(); });
  expect(mockPlayer.play).not.toHaveBeenCalled(); expect(mockHaptic).not.toHaveBeenCalled();
  for (let index = 2; index <= 4; index++) {
    await act(async () => { tree.update(<Probe state={{ startedAt: Date.now(), durationSeconds: 3, anchorSetId: `locked-${index}` }} />); await drain(); });
    const request = mockSchedule.mock.calls.at(-1)[0];
    expect(request).toMatchObject({ identifier: 'vigor-rest', content: { sound: 'rest-chime.wav', data: { kind: 'rest' } } });
    expect(request.trigger.date.getTime()).toBe(Date.now() + 3000);
    await act(async () => { jest.advanceTimersByTime(3000); await drain(); });
  }
  expect(mockSchedule).toHaveBeenCalledTimes(4);
  expect(mockMode).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('warns when iOS allows notifications but disables their sound, without suppressing foreground haptics', async () => {
  mockPermission.mockResolvedValue({ granted: true, ios: { allowsSound: false } }); let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 3, anchorSetId: 'quiet' }} />); await drain(); });
  expect(unavailable).toBe(true);
  await act(async () => { jest.advanceTimersByTime(3000); await drain(); });
  expect(mockHaptic).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

it('rings on every completed set and ignores an idle strength clock beneath active rehabilitation', async () => {
  const idle = { startedAt: null, durationSeconds: 0, anchorSetId: null };
  let tree: any; let hidden: any;
  await act(async () => { hidden = create(<Probe state={idle} />); await drain(); });
  for (let index = 0; index < 5; index++) {
    const state = { startedAt: Date.now(), durationSeconds: 3, anchorSetId: `set-${index}` };
    await act(async () => { if (tree) tree.update(<Probe state={state} />); else tree = create(<Probe state={state} />); await drain(); });
    const calls = mockNativeFeedback.mock.calls.length;
    // A remounted idle clock used to erase the singleton native deadline.
    await act(async () => { hidden.unmount(); hidden = create(<Probe state={idle} />); await drain(); });
    expect(mockNativeFeedback).toHaveBeenCalledTimes(calls);
    expect(mockNativeFeedback).toHaveBeenLastCalledWith(state.startedAt + 3000);
    await act(async () => { jest.advanceTimersByTime(3000); await drain(); });
    expect(mockPlayer.play).toHaveBeenCalledTimes(index + 1);
    expect(mockHaptic).toHaveBeenCalledTimes(index + 1);
    expect(mockSchedule.mock.calls.at(-1)[0].trigger.date.getTime()).toBe(state.startedAt + 3000);
  }
  await act(async () => { tree.unmount(); hidden.unmount(); await drain(); });
});

it('replaces a rest, cancels its previous deadline and does not replay an expired restored rest', async () => {
  let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 2, anchorSetId: 's' }} />); await drain(); });
  await act(drain);
  await act(async () => { tree.update(<Probe state={{ startedAt: 10000, durationSeconds: 4, anchorSetId: 'new' }} />); await drain(); });
  await act(async () => { jest.advanceTimersByTime(2000); await drain(); });
  expect(mockPlayer.play).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(2000); await drain(); });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); await drain(); });
  mockPlayer.play.mockClear();
  await act(async () => { tree = create(<Probe state={{ startedAt: 1000, durationSeconds: 1, anchorSetId: 'old' }} />); await drain(); jest.advanceTimersByTime(1000); });
  expect(mockPlayer.play).not.toHaveBeenCalled();
  await act(async () => { tree.unmount(); await drain(); });
});

it('keeps an accepted OS alarm on navigation but cancels it on explicit idle', async () => {
  let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 120, anchorSetId: 's' }} />); }); await act(drain);
  const cancels = mockCancel.mock.calls.length;
  await act(async () => tree.unmount()); await act(drain);
  expect(mockCancel).toHaveBeenCalledTimes(cancels);
  mockPending.mockResolvedValueOnce([{ identifier: 'vigor-rest', content: { data: { kind: 'rest' } } }]);
  await act(async () => { tree = create(<Probe state={{ startedAt: null, durationSeconds: 0, anchorSetId: null }} />); }); await act(drain);
  expect(mockCancel).toHaveBeenCalledWith('vigor-rest');
  await act(async () => tree.unmount());
});
it('replaces the alert after editing rest, including an edit that moves its deadline into the past', async () => {
  let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 120, anchorSetId: 's' }} />); await drain(); });
  await act(async () => { jest.advanceTimersByTime(10000); await drain(); });
  await act(async () => { tree.update(<Probe state={{ startedAt: 10000, durationSeconds: 5, anchorSetId: 's' }} />); await drain(); });
  expect(mockNativeFeedback).toHaveBeenLastCalledWith(20100);
  await act(async () => { jest.advanceTimersByTime(100); await drain(); });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => { tree.update(<Probe state={{ startedAt: 20100, durationSeconds: 5, anchorSetId: 'next' }} />); await drain(); });
  await act(async () => { jest.advanceTimersByTime(5000); await drain(); });
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
it('explicit discard cancels only rest alarms and clears their delivered notifications', async () => {
  await clearWorkoutRestAlerts(); expect(mockCancel).toHaveBeenCalledWith('legacy');
  expect(mockCancel).not.toHaveBeenCalledWith('other'); expect(mockDismiss).toHaveBeenCalledWith('old');
});
it('recovers the alert queue after a failed clear instead of blocking later workout alerts', async () => {
  mockNativeFeedback.mockRejectedValueOnce(Error('temporary native failure'));
  await expect(clearWorkoutRestAlerts()).rejects.toThrow('temporary native failure');
  await expect(clearWorkoutRestAlerts()).resolves.toBeUndefined();
  expect(mockCancel).toHaveBeenCalledWith('legacy');
});

it('keeps foreground feedback when notification permission is denied and warns about background alerts', async () => {
  mockPermission.mockResolvedValue({ granted: false, canAskAgain: false }); let tree: any;
  await act(async () => { tree = create(<Probe state={{ startedAt: 10000, durationSeconds: 2, anchorSetId: 's' }} />); await drain(); });
  await act(drain);
  expect(unavailable).toBe(true); expect(mockSchedule).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(2000); await drain(); });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  await act(async () => { tree.unmount(); await drain(); });
});
