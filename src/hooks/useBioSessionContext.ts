import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { Exercise } from '@/models';
import { useAuth } from './useAuth';
import type { useBioHistory } from './useBioHistory';
import type { useMicrocycleReviews } from './useMicrocycleReviews';
import type { BioReadinessView } from './useBioReadiness';
import { buildBioSessionContext } from '@/services/bio/sessionContext';
import type { BioSessionContext } from '@/models/bioSessionContext';
import type { RoutineViewLabels } from '@/services/training/routineView';

export interface BioSessionContextView {
  state: 'LOADING' | 'ERROR' | 'READY'; context?: BioSessionContext;
  select(index: number): void;
}
/** Existing snapshots only. No extra repository/Health reads and no writes or training launch. */
export function useBioSessionContext(data: ReturnType<typeof useBioHistory>, reviews: ReturnType<typeof useMicrocycleReviews>,
  catalogue: ReadonlyMap<string, Exercise>, readiness: BioReadinessView, labels: RoutineViewLabels): BioSessionContextView {
  const { uid } = useAuth();
  const generation = useRef({ uid, epoch: 0 });
  if (generation.current.uid !== uid) generation.current = { uid, epoch: generation.current.epoch + 1 };
  const epoch = generation.current.epoch;
  const [choice, setChoice] = useState<{ uid: string; epoch: number; planId: string; index: number } | null>(null);
  const [clock, setClock] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') setClock(Date.now()); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []));
  const state = data.owner !== uid || !data.ready ? 'LOADING' : data.error ? 'ERROR' : 'READY';
  const context = useMemo(() => {
    if (state !== 'READY' || !uid) return undefined;
    const currentPlan = data.routines.find((routine) => routine.userId === uid && routine.isActive)?.activeMesocycleId;
    return buildBioSessionContext({ owner: uid, plans: data.plans, routines: data.routines, history: data.history,
      reviews: reviews.entries, reviewsAvailable: reviews.ready && !reviews.error, catalogue, labels,
      readiness: readiness.state === 'READY' ? readiness.index : undefined,
      selectedSessionIndex: choice?.uid === uid && choice.epoch === epoch && choice.planId === currentPlan ? choice.index : undefined,
      now: Math.max(clock, Date.now()) });
  }, [state, uid, epoch, data.plans, data.routines, data.history, reviews.entries, reviews.ready, reviews.error,
    catalogue, labels, readiness.state, readiness.index, choice, clock]);
  return { state, context, select: (index) => {
    if (!uid || generation.current.uid !== uid || generation.current.epoch !== epoch || !context?.target
      || !context.choices.some((item) => item.index === index)) return;
    setChoice({ uid, epoch, planId: context.target.mesocycleId, index });
  } };
}
