/** Non-iOS platforms retain the Expo audio/haptics fallback. */
export async function scheduleNativeRestFeedback(_deadline: number | null): Promise<boolean> { return false; }
import type { RestFeedbackStatus } from './restFeedbackStatus';
export async function nativeRestFeedbackStatus(): Promise<RestFeedbackStatus> { return { phase: 'unavailable' }; }
/** Non-iOS platforms do not expose the native diagnostic snapshot bridge. */
export async function recordRestDeliverySnapshot(_count: number): Promise<void> {}
