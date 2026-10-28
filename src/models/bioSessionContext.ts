import type { MuscleGroup, PlannedSession } from '@/models';
import type { MicrocycleReviewAnswers } from './microcycleReview';
import type { BioDoseReview } from '@/services/bio/volumeResponse';

/** Advisory, memory-only context. No clearance, recovery time or prescription mutation. */
export interface BioSessionContext {
  policy: 'SESSION_CONTEXT_V1';
  status: 'NO_ACTIVE_ROUTINE' | 'AMBIGUOUS' | 'UNAVAILABLE' | 'COMPLETE' | 'AVAILABLE';
  target?: {
    routineName: string; mesocycleId: string; microcycleIndex: number; goal: string;
    name: string; session: PlannedSession; restBefore: boolean;
  };
  choices: { index: number; name: string }[];
  general: {
    coverage: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'; date?: string;
    signals: ('SLEEP_SHORTFALL' | 'CARDIAC_DEPARTURE' | 'UNUSUAL_SIGNAL')[];
  };
  exposure: { muscle: MuscleGroup; plannedSets: number; recentSets: number; lastAt?: number }[];
  unknownPlannedExercises: number;
  unknownRecentExercises: number;
  reviewStatus: 'AVAILABLE' | 'MISSING' | 'UNAVAILABLE';
  review?: { microcycleIndex: number; updatedAt: number; observedTo: number; answers: MicrocycleReviewAnswers };
  dose: BioDoseReview[];
  prompts: ('GENERAL_CHANGE' | 'DATED_DISCOMFORT' | 'DATED_LOCAL_RECOVERY' | 'DOSE_REVIEW')[];
}
