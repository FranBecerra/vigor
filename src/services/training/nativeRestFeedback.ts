/** Non-iOS platforms retain the Expo audio/haptics fallback. */
export async function scheduleNativeRestFeedback(_deadline: number | null): Promise<boolean> { return false; }
import type { RestFeedbackStatus } from './restFeedbackStatus';
export async function nativeRestFeedbackStatus(): Promise<RestFeedbackStatus> { return { phase: 'unavailable' }; }
