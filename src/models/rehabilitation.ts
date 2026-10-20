/** User-authored scheduling and logging, not a clinical treatment engine. */
import type { Exercise, ExerciseRecording } from './biomechanics';
export interface RehabPrescription {
  id: string;
  exerciseId: string;
  exerciseSnapshot: Exercise;
  sets: number;
  min: number;
  max: number;
  load?: number;
  restSeconds: number;
  notes: string;
}
export interface RehabBlock {
  id: string;
  userId: string;
  version: 1;
  name: string;
  items: RehabPrescription[];
  schedule: { kind: 'WEEKLY'; target: number } | { kind: 'DAYS'; days: number[] }
    | { kind: 'ROUTINE'; routineId: string; sessionIndexes: number[] };
  injuryId?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}
export interface RehabSetLog {
  itemId: string;
  index: number;
  recording: ExerciseRecording;
  actual?: number;
  load?: number;
  completed: boolean;
}
export interface RehabLog {
  id: string;
  userId: string;
  blockId: string;
  date: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  blockSnapshot: RehabBlock;
  sets: RehabSetLog[];
  workoutKey?: string;
  completedAt?: number;
  updatedAt: number;
}
