import type { MuscleGroup } from './biomechanics';

/** Subjective retrospective feedback, never a daily readiness measurement. */
export interface MicrocycleReviewAnswers {
  recovery?: 'WORSE' | 'USUAL' | 'BETTER';
  /** An explicit empty array means no muscle was reported as unrecovered. */
  unrecoveredMuscles?: MuscleGroup[];
  discomfort?: 'NONE' | 'PRESENT';
  discomfortMuscles?: MuscleGroup[];
  sustainability?: 'YES' | 'TIGHT' | 'NO';
  context?: ('SLEEP' | 'STRESS' | 'ILLNESS' | 'NUTRITION' | 'OTHER_ACTIVITY' | 'TIME')[];
}

export interface MicrocycleReview {
  id: string;
  userId: string;
  mesocycleId: string;
  microcycleIndex: number;
  questionnaireVersion: 1;
  status: 'SUBMITTED' | 'DISMISSED';
  answers: MicrocycleReviewAnswers;
  /** Bounds of observed workout/skip events, not an assumed seven-day cycle. */
  observedFrom: number;
  observedTo: number;
  createdAt: number;
  updatedAt: number;
}
