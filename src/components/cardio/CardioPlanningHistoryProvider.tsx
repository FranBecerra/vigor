import type { ReactNode } from 'react';
import { useCardioWorkouts } from '@/hooks/useCardioTraining';
import { CardioPlanningHistoryContext } from './CardioPlanningHistoryContext';
import { useCardioHealthReview } from '@/hooks/useCardioHealthReview';
import { CardioPlanningHealthReview, CardioPlanningHealthSession } from './CardioPlanningHealthReview';

export function CardioPlanningHistoryProvider({ children }: { children: ReactNode }) {
  const history = useCardioWorkouts();
  const health = useCardioHealthReview();
  return <CardioPlanningHealthSession.Provider value={health}><CardioPlanningHistoryContext.Provider value={{ ...history, automaticHealth: health, renderHealth: props => <CardioPlanningHealthReview {...props} /> }}>{children}</CardioPlanningHistoryContext.Provider></CardioPlanningHealthSession.Provider>;
}
