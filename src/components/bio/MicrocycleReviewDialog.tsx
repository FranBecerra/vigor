import { useAuth } from '@/hooks/useAuth';
import { useBioHistory } from '@/hooks/useBioHistory';
import { useMicrocycleReviews } from '@/hooks/useMicrocycleReviews';
import { MicrocycleReviewDialogContent } from './MicrocycleReviewDialogContent';

/** Load only after an explicit invitation tap. Never navigate away from Training. */
export function MicrocycleReviewDialog({ id, onClose }: { id: string; onClose(): void }) {
  const { uid } = useAuth(), data = useBioHistory(), reviews = useMicrocycleReviews();
  return <MicrocycleReviewDialogContent id={id} uid={uid} data={data} reviews={reviews} onClose={onClose} />;
}
