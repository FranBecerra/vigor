import { requireOptionalNativeModule } from 'expo-modules-core';
import type { RestFeedbackStatus } from './restFeedbackStatus';
const native = requireOptionalNativeModule<{ scheduleRestFeedback?: (deadline: number | null) => Promise<boolean>;
  restFeedbackStatus?: () => Promise<RestFeedbackStatus> }>('VigorHealth');
/** An absolute native deadline survives JS stalls; no permission is granted here. */
export async function scheduleNativeRestFeedback(deadline: number | null): Promise<boolean> {
  return native?.scheduleRestFeedback ? native.scheduleRestFeedback(deadline) : false;
}
export async function nativeRestFeedbackStatus(): Promise<RestFeedbackStatus> {
  return native?.restFeedbackStatus ? native.restFeedbackStatus() : { phase: 'unavailable' };
}
