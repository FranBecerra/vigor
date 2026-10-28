import { requireOptionalNativeModule } from 'expo-modules-core';
import type { RestFeedbackStatus } from './restFeedbackStatus';
const native = requireOptionalNativeModule<{ scheduleRestFeedback?: (deadline: number | null) => Promise<boolean>;
  restFeedbackStatus?: () => Promise<RestFeedbackStatus>;
  recordRestDeliverySnapshot?: (count: number) => Promise<void> }>('VigorHealth');
/** An absolute native deadline survives JS stalls; no permission is granted here. */
export async function scheduleNativeRestFeedback(deadline: number | null): Promise<boolean> {
  return native?.scheduleRestFeedback ? native.scheduleRestFeedback(deadline) : false;
}
export async function nativeRestFeedbackStatus(): Promise<RestFeedbackStatus> {
  return native?.restFeedbackStatus ? native.restFeedbackStatus() : { phase: 'unavailable' };
}
/** Retains only the count/time of this app's delivered rest alerts on-device. */
export async function recordRestDeliverySnapshot(count: number): Promise<void> {
  if (native?.recordRestDeliverySnapshot) await native.recordRestDeliverySnapshot(count);
}
