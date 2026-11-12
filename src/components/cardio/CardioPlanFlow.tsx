import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { CardioPlanBuilder } from './CardioPlanBuilder';
import { useAuth } from '@/hooks/useAuth';
import { useRoutines } from '@/hooks/useRoutines';
import { useCardioPlans } from '@/hooks/useCardioPlans';
import { backToTraining } from '@/services/training/backNavigation';
import { cardioInputForSave, cardioPlanPolicy, cardioStrengthSource, saveCardioProposal } from '@/services/cardio/savedCardioPlan';
import { freshReviewedCardioStart, type ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';

/** Shared new-plan flow; cancellation may return directly to its caller's review. */
export function CardioPlanFlow({ initialBaseline, onCancel }: { initialBaseline?: ReviewedCardioStart; onCancel?: () => void }) {
  const { uid } = useAuth();
  const seed = useRef({ owner: uid, baseline: initialBaseline });
  if (seed.current.owner !== uid) seed.current = { owner: uid, baseline: undefined };
  return <OwnedCardioPlanner key={uid ?? 'signed-out'} owner={uid} initialBaseline={seed.current.baseline} onCancel={onCancel} />;
}
function OwnedCardioPlanner({ owner, initialBaseline, onCancel }: { owner: string | null; initialBaseline?: ReviewedCardioStart; onCancel?: () => void }) {
  const router = useRouter(), { routines, status, reload } = useRoutines(), plans = useCardioPlans();
  const live = useRef(false), id = useRef<string | null>(null), createdAt = useRef<number | null>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const routine = routines.find(item => item.isActive && item.domain === 'STRENGTH');
  return <CardioPlanBuilder routine={routine} initialBaseline={initialBaseline} ready={!!owner && status === 'ready' && plans.ready} error={status === 'error' || plans.error}
    onRetry={() => { reload(); plans.reload(); }} onCancel={onCancel ?? (() => backToTraining(router))} onSave={async (name, input) => {
      if (!owner || !live.current || input.healthBaseline && !freshReviewedCardioStart(input.healthBaseline, Date.now())) throw Error('staleCardioOwner');
      id.current ??= plans.newId(); createdAt.current ??= Date.now();
      const authored = cardioInputForSave(input, Date.now());
      const plan = saveCardioProposal(id.current, owner, name, authored, cardioStrengthSource(routine, cardioPlanPolicy(authored)), createdAt.current);
      await plans.save(plan);
      if (live.current) router.replace({ pathname: '/cardio-cycle', params: { id: plan.id } });
    }} />;
}
