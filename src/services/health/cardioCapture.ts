import type { CardioWorkout } from '@/models/cardioTraining';
import type { CardioPlanningModality } from '@/models/cardio';

export interface CardioCaptureBridge {
  startCardioCapture(key: string, activity: CardioPlanningModality, startedAt: number): Promise<void>;
  setCardioCaptureState(key: string, state: 'RUNNING' | 'PAUSED' | 'DISCARDED'): Promise<void>;
  discardCardioCapture(): Promise<void>;
}

export function cardioCaptureKey(owner: string, id: string) {
  return JSON.stringify([owner, id]);
}

/** Capturing metrics is optional and must never delay or fail the Vigor timer. */
export function syncCardioCapture(bridge: Partial<CardioCaptureBridge> | null, workout: CardioWorkout, enabled: boolean, begin = false) {
  if (!enabled || workout.source !== 'TIMER_TIME_EFFORT_V1') return;
  const key = cardioCaptureKey(workout.userId, workout.id);
  if (begin && workout.status === 'RUNNING' && workout.revision === 1) {
    void bridge?.startCardioCapture?.(key, workout.prescription.modality, workout.startedAt).catch(() => undefined);
  } else if (!begin && (workout.status === 'PAUSED' || workout.status === 'RUNNING' || workout.status === 'DISCARDED')) {
    void bridge?.setCardioCaptureState?.(key, workout.status).catch(() => undefined);
  }
}
