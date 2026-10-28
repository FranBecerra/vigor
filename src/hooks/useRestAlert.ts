import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import type { RestTimerState } from '@/services/training/restTimer';
import { restFeedbackDeadline } from '@/services/training/restTimer';
import { recordRestDeliverySnapshot, scheduleNativeRestFeedback } from '@/services/training/nativeRestFeedback';
import { enqueueRestAlert, REST_ALARM_ID as ALARM_ID } from '@/services/training/restAlerts';
export { clearWorkoutRestAlerts } from '@/services/training/restAlerts';

// Strength stays mounted underneath pre-workout rehab. Its idle clock must not
// cancel the rehab alarm (or overwrite the shared native player).
const mountedClocks = new Set<symbol>();
let activeClock: symbol | null = null;

/** One replaceable OS alarm; foreground feedback is audio + haptics, not a banner. */
export function useRestAlert(state: RestTimerState) {
  const { t } = useTranslation();
  const [unavailable, setUnavailable] = useState(false);
  const previous = useRef<RestTimerState | null>(null);
  const owner = useRef(Symbol('rest-clock')).current;
  useEffect(() => { mountedClocks.add(owner); return () => { mountedClocks.delete(owner); }; }, [owner]);
  const player = useAudioPlayer(require('../../assets/audio/rest-chime.wav'));
  useEffect(() => {
    let disposed = false;
    if (state.startedAt === null && activeClock !== owner && activeClock !== null && mountedClocks.has(activeClock)) return;
    activeClock = owner;
    const deadline = restFeedbackDeadline(previous.current, state, Date.now());
    previous.current = state;
    let nativeReady = false;
    // Native and OS scheduling must share the same ordered queue. A delayed
    // cleanup from a previous clock must not cancel the next completed set.
    void enqueueRestAlert(async () => {
      if (!disposed) nativeReady = await scheduleNativeRestFeedback(deadline);
    }).catch(() => { nativeReady = false; });
    const clearDelivered = async () => {
      const api = notifications;
      const delivered = await api.getPresentedNotificationsAsync();
      const restDelivered = delivered.filter((item) => item.request.identifier === ALARM_ID || item.request.content.data?.kind === 'rest');
      // Preserve the OS-visible result locally before cleanup. This lets the
      // device diagnostic distinguish a delivered notification from a miss.
      await recordRestDeliverySnapshot(restDelivered.length).catch(() => undefined);
      await Promise.all(restDelivered
        .map((item) => api.dismissNotificationAsync(item.request.identifier)));
    };
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active') void clearDelivered().catch(() => undefined);
    });
    // Expired rests must not replay after restoring a workout.
    const haptic = deadline !== null && deadline > Date.now() ? setTimeout(() => {
      if (disposed || AppState.currentState !== 'active' || nativeReady) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => setUnavailable(true));
      // Idle/hidden clocks must not reconfigure the shared audio session while
      // another app is playing. Configure only when the fallback actually rings.
      void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' })
        .then(() => disposed ? undefined : player.seekTo(0))
        .then(() => { if (!disposed) player.play(); }).catch(() => setUnavailable(true));
    }, deadline - Date.now()) : undefined;
    void enqueueRestAlert(async () => {
      notifications.setNotificationHandler({ handleNotification: async (notification) => {
        const rest = notification.request.identifier === ALARM_ID || notification.request.content.data?.kind === 'rest';
        return { shouldPlaySound: !rest || AppState.currentState !== 'active', shouldSetBadge: false,
          shouldShowBanner: !rest || AppState.currentState !== 'active', shouldShowList: false };
      } });
      const pending = await notifications.getAllScheduledNotificationsAsync();
      await Promise.all(pending.filter((item) => item.identifier === ALARM_ID || item.content.data?.kind === 'rest')
        .map((item) => notifications.cancelScheduledNotificationAsync(item.identifier)));
      await clearDelivered();
      if (disposed || deadline === null || deadline <= Date.now()) return;
      if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('rest', {
        name: t('workout.restFinished'), importance: notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 300, 150, 300],
      });
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
      if (disposed) return;
      setUnavailable(!permission.granted || permission.ios?.allowsSound === false);
      if (!permission.granted || deadline <= Date.now()) return;
      await notifications.scheduleNotificationAsync({ identifier: ALARM_ID, content: { title: t('workout.restFinished'), body: t('workout.nextSet'), sound: Platform.OS === 'ios' ? 'rest-chime.wav' : 'default', data: { kind: 'rest' } },
        trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: new Date(deadline), channelId: 'rest' } });
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true; if (haptic !== undefined) clearTimeout(haptic); foreground.remove();
      // Leave an accepted OS alarm in place on screen unmount (pause/navigation).
      // The next state setup clears/replaces it; an explicit idle state cancels it.
    };
  }, [state.startedAt, state.durationSeconds, state.anchorSetId, t, player, owner]);
  return unavailable;
}
