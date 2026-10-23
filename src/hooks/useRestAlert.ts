import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import type { RestTimerState } from '@/services/training/restTimer';
import { scheduleNativeRestFeedback } from '@/services/training/nativeRestFeedback';

const ALARM_ID = 'vigor-rest';
let alarmQueue: Promise<unknown> = Promise.resolve();
export function clearWorkoutRestAlerts(): Promise<void> {
  const clearing = alarmQueue.catch(() => undefined).then(async () => {
    await scheduleNativeRestFeedback(null);
    const pending = await notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter((item) => item.identifier === ALARM_ID || item.content.data?.kind === 'rest')
      .map((item) => notifications.cancelScheduledNotificationAsync(item.identifier)));
    const delivered = await notifications.getPresentedNotificationsAsync();
    await Promise.all(delivered.filter((item) => item.request.identifier === ALARM_ID || item.request.content.data?.kind === 'rest')
      .map((item) => notifications.dismissNotificationAsync(item.request.identifier)));
  });
  alarmQueue = clearing; return clearing;
}

/** One replaceable OS alarm; foreground feedback is audio + haptics, not a banner. */
export function useRestAlert(state: RestTimerState) {
  const { t } = useTranslation();
  const [unavailable, setUnavailable] = useState(false);
  const player = useAudioPlayer(require('../../assets/audio/rest-chime.wav'));
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => setUnavailable(true));
  }, []);
  useEffect(() => {
    let disposed = false;
    const deadline = state.startedAt === null ? null : state.startedAt + state.durationSeconds * 1000;
    let nativeReady = false;
    void scheduleNativeRestFeedback(deadline).then((ready) => { nativeReady = ready; }).catch(() => { nativeReady = false; });
    const clearDelivered = async () => {
      const api = notifications;
      const delivered = await api.getPresentedNotificationsAsync();
      await Promise.all(delivered.filter((item) => item.request.identifier === ALARM_ID || item.request.content.data?.kind === 'rest')
        .map((item) => api.dismissNotificationAsync(item.request.identifier)));
    };
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active') void clearDelivered().catch(() => undefined);
    });
    // Expired rests must not replay after restoring a workout.
    const haptic = deadline !== null && deadline > Date.now() ? setTimeout(() => {
      if (disposed || AppState.currentState !== 'active' || nativeReady) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => setUnavailable(true));
      void player.seekTo(0).then(() => { if (!disposed) player.play(); }).catch(() => setUnavailable(true));
    }, deadline - Date.now()) : undefined;
    alarmQueue = alarmQueue.catch(() => undefined).then(async () => {
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
  }, [state.startedAt, state.durationSeconds, state.anchorSetId, t, player]);
  return unavailable;
}
