import { createContext, useContext, type ReactNode } from 'react';
import type { CardioWorkout } from '@/models/cardioTraining';
import type { CardioPreviewInput } from '@/services/cardio/cardioPreview';
import type { ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';
import type { useCardioHealthReview } from '@/hooks/useCardioHealthReview';

export interface PlanningHealthProps { input: CardioPreviewInput; onClose(): void; onApply(baseline: ReviewedCardioStart, remember?: boolean): void; canRemember?: boolean }

export interface CardioPlanningHistory {
  owner: string | null; entries: readonly CardioWorkout[]; ready: boolean; error: boolean; reload(): void;
  renderHealth?: (props: PlanningHealthProps) => ReactNode;
  automaticHealth?: ReturnType<typeof useCardioHealthReview>;
}
export const CardioPlanningHistoryContext = createContext<CardioPlanningHistory | null>(null);
export const useCardioPlanningHistory = () => useContext(CardioPlanningHistoryContext);
