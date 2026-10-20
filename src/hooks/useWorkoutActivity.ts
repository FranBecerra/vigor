import type { SessionContext, SessionSetsByExercise } from '@/services/training/sessionMapper';
import type { Exercise } from '@/models';
/** Lock-screen Live Activities are iOS-only. */
export function useWorkoutActivity(_context: SessionContext | null, _exercises: readonly Exercise[], _sets: SessionSetsByExercise, _finished: boolean) { return false; }
export function useWorkoutActivityOwner(_owner: string | null, _loading: boolean) {}
