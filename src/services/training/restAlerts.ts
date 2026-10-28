import * as notifications from 'expo-notifications';
import { scheduleNativeRestFeedback } from './nativeRestFeedback';

export const REST_ALARM_ID = 'vigor-rest';
let queue: Promise<unknown> = Promise.resolve();
export function enqueueRestAlert(task: () => Promise<void>): Promise<void> {
  const result = queue.catch(() => undefined).then(task);
  queue = result;
  return result;
}

/** Ending/discarding must clear alerts even when the runner unmounts before an idle render. */
export function clearWorkoutRestAlerts(): Promise<void> {
  return enqueueRestAlert(async () => {
    await scheduleNativeRestFeedback(null);
    const pending = await notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter((item) => item.identifier === REST_ALARM_ID || item.content.data?.kind === 'rest')
      .map((item) => notifications.cancelScheduledNotificationAsync(item.identifier)));
    const delivered = await notifications.getPresentedNotificationsAsync();
    await Promise.all(delivered.filter((item) => item.request.identifier === REST_ALARM_ID || item.request.content.data?.kind === 'rest')
      .map((item) => notifications.dismissNotificationAsync(item.request.identifier)));
  });
}
