import type { CardioHealthRead } from '@/models/cardioHealth';
import type { CardioStartContext } from '@/services/cardio/cardioStartingPoint';
import { acceptReviewedCardioStart, reviewedCardioDefaults } from '@/services/cardio/reviewedCardioStart';
import type { CardioPreviewInput } from '@/services/cardio/cardioPreview';
export const reviewedNow = Date.UTC(2026, 9, 30, 12);
export const reviewedContext: CardioStartContext = { modality: 'RUNNING', representative: true, response: 'RECOVERED', comfortableMinutes: 40,
  cycleDays: 7, maxSessions: 2, maxSessionMinutes: 40, totalMinutes: 80 };
export function reviewedRecords(now = reviewedNow): CardioHealthRead {
  return { version: 1, truncated: false, workouts: [1, 4, 8, 11, 15, 18, 22, 25].map(days => ({
    id: `private-workout-${days}`, kind: 'RUNNING', start: now - days * 86400000, end: now - days * 86400000 + 1800000,
    durationSeconds: 1800, sourceId: 'private-source-id', sourceName: 'Private source name', manuallyEntered: false, mixedActivities: false, ownExport: false })) };
}
export const reviewedStart = (now = reviewedNow) => acceptReviewedCardioStart(reviewedRecords(now), now, now, reviewedContext);
export const reviewedInput = (now = reviewedNow): CardioPreviewInput => ({ placementPolicy: 'BALANCED_V2',
  ...reviewedCardioDefaults(reviewedStart(now), { schemaVersion: 1, modalities: {} }), maxActiveDays: 4, allowDoubles: false, strength: [] });
