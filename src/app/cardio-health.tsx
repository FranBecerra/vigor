import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CardioPlanFlow } from '@/components/cardio/CardioPlanFlow';
import type { ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';
import { useCardioHealthReview } from '@/hooks/useCardioHealthReview';
import { CardioHealthReviewPanel } from '@/components/cardio/CardioHealthReviewPanel';

export default function CardioHealthScreen() {
  const { uid, isLoading } = useAuth();
  return <OwnedCardioHealthScreen key={`${uid ?? 'signed-out'}:${isLoading}`} />;
}
function OwnedCardioHealthScreen() {
  const router = useRouter(), review = useCardioHealthReview();
  const [baseline, setBaseline] = useState<ReviewedCardioStart | null>(null);
  if (baseline) return <CardioPlanFlow initialBaseline={baseline} onCancel={() => setBaseline(null)} />;
  return <CardioHealthReviewPanel state={review.state} data={review.data} observedAt={review.observedAt}
    onPlan={value => { review.clear(); setBaseline(value); }}
    onRead={() => { void review.read(); }} onClear={review.clear} onClose={() => { review.clear(); if (router.canGoBack()) router.back(); else router.replace('/settings'); }} />;
}
