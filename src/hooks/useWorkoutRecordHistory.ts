import { useEffect, useState } from 'react';
import type { WorkoutSession } from '@/models';
import { workoutSessionRepository } from '@/services/repositories';

/** Load every exercise's baseline at workout entry, not only when reviewing completion. */
export function useWorkoutRecordHistory(uid: string | null) {
  const [value, setValue] = useState<{ owner: string | null; history: WorkoutSession[]; ready: boolean }>({ owner: null, history: [], ready: false });
  useEffect(() => {
    let active = true;
    setValue({ owner: uid, history: [], ready: false });
    if (uid) workoutSessionRepository.listByUser(uid).then((history) => {
      if (active) setValue({ owner: uid, history, ready: true });
    }).catch(() => { if (active) setValue({ owner: uid, history: [], ready: false }); });
    return () => { active = false; };
  }, [uid]);
  return value.owner === uid ? value : { owner: uid, history: [], ready: false };
}
