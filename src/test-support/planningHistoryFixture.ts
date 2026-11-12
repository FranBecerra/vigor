import { cardioFixture } from './cardioFixture';
import { startCardioWorkout, transitionCardioWorkout } from '@/services/cardio/cardioWorkout';

/** Eight fabricated 40-minute timer workouts; never an athlete/account write. */
export function planningHistoryFixture(now: number, modality: 'RUNNING' | 'CYCLING' = 'RUNNING') {
  const block = cardioFixture({ modalities: [modality] }, now - 43 * 86400000);
  return [1, 4, 8, 11, 15, 18, 22, 25].map(day => {
    const start = now - day * 86400000, workout = startCardioWorkout(block, block.slots[0].id, start, `history-${day}`);
    return transitionCardioWorkout(workout, 'FINISH', start + 40 * 60000, 40 * 60);
  });
}
