import { createContext, useContext, useRef } from 'react';
import { useCardioHealthReview } from '@/hooks/useCardioHealthReview';
import type { CardioHealthBridge } from '@/models/cardioHealth';
import { planningHistoryContext } from '@/services/cardio/planningHistory';
import type { PlanningHealthProps } from './CardioPlanningHistoryContext';
import { CardioHealthReviewPanel } from './CardioHealthReviewPanel';

/** Read state is owned by the creation route, so closing its sheet retains the review. */
export const CardioPlanningHealthSession = createContext<ReturnType<typeof useCardioHealthReview> | null>(null);
export function CardioPlanningHealthReview(props: PlanningHealthProps & { bridge?: CardioHealthBridge }) {
  const shared = useContext(CardioPlanningHealthSession);
  return shared ? <PlanningReview {...props} review={shared} /> : <OwnedPlanningReview {...props} />;
}
function OwnedPlanningReview(props: PlanningHealthProps & { bridge?: CardioHealthBridge }) {
  const review = useCardioHealthReview(props.bridge);
  return <PlanningReview {...props} review={review} />;
}
function PlanningReview({ input, onClose, onApply, canRemember, review }: PlanningHealthProps & { review: ReturnType<typeof useCardioHealthReview> }) {
  const current = useRef(review); current.current = review;
  return <CardioHealthReviewPanel {...review} onRead={() => void review.read()} onClear={review.clear} onClose={onClose}
    canRemember={canRemember} planningContext={planningHistoryContext(input, input.modalities[0] as 'RUNNING' | 'CYCLING')} onPlan={(baseline, remember) => {
      if (current.current === review && review.state === 'READY' && review.observedAt === baseline.observedAt) {
        if (remember) onApply(baseline, true); else onApply(baseline);
      }
    }} />;
}
