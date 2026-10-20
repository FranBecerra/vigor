import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import type { RestTimerState } from '@/services/training/restTimer';

/** A local OS alarm survives screen locking; no push token or remote service is used. */
export function useRestAlert(state: RestTimerState) {
  const { t } = useTranslation();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (state.startedAt === null) return;
    let disposed = false; let id: string | undefined;
    const deadline = state.startedAt + state.durationSeconds * 1000;
    const haptic = setTimeout(() => {
      if (AppState.currentState === 'active') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, Math.max(0, deadline - Date.now()));
    const setup = async () => {
      const notifications = await import('expo-notifications');
      notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: false }) });
      if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('rest', {
        name: t('workout.restFinished'), importance: notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 300, 150, 300],
      });
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
      if (disposed) return;
      setUnavailable(!permission.granted);
      if (!permission.granted || deadline <= Date.now()) return;
      id = await notifications.scheduleNotificationAsync({ content: { title: t('workout.restFinished'), body: t('workout.nextSet'), sound: 'default', data: { kind: 'rest' } },
        trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: new Date(deadline), channelId: 'rest' } });
      if (disposed) await notifications.cancelScheduledNotificationAsync(id);
    };
    void setup().catch(() => { if (!disposed) setUnavailable(true); });
    return () => {
      disposed = true; clearTimeout(haptic);
      if (id) void import('expo-notifications').then((api) => api.cancelScheduledNotificationAsync(id!)).catch(() => undefined);
    };
  }, [state.startedAt, state.durationSeconds, state.anchorSetId, t]);
  return unavailable;
}
