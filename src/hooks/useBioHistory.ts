import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Mesocycle, Routine, WorkoutSession } from '@/models';
import { mesocycleRepository, routineRepository, workoutSessionRepository } from '@/services/repositories';
import { useAuth } from './useAuth';
import { loadAudit } from '@/services/performance/loadAudit';

interface Snapshot { owner: string | null; plans: Mesocycle[]; routines: Routine[]; history: WorkoutSession[]; ready: boolean; error: boolean }
const empty = (owner: string | null): Snapshot => ({ owner, plans: [], routines: [], history: [], ready: false, error: false });

/** Focus-scoped reads with warm rendering and immediate account isolation. */
export function useBioHistory() {
  const { uid } = useAuth();
  const [state, setState] = useState<Snapshot>(() => empty(uid));
  const request = useRef(0);
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    const id = ++request.current;
    if (!uid) { setState({ ...empty(uid), ready: true }); return; }
    loadAudit.measure('bio.history', () => Promise.all([mesocycleRepository.listWhere('userId', uid), routineRepository.listByUser(uid), workoutSessionRepository.listByUser(uid)]))
      .then(([plans, routines, history]) => {
        if (request.current === id) setState({ owner: uid,
          plans: plans.filter((item) => item.userId === uid), routines: routines.filter((item) => item.userId === uid),
          history: history.filter((item) => item.userId === uid), ready: true, error: false });
      }).catch(() => {
        if (request.current === id) setState({ ...empty(uid), ready: true, error: true });
      });
    return () => { request.current++; };
  }, [uid, revision]));
  return { ...(state.owner === uid ? state : empty(uid)), reload: () => setRevision((value) => value + 1) };
}
