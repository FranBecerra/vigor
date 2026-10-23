import { useRouter } from 'expo-router';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { backToTraining } from '@/services/training/backNavigation';

/** One searchable library; personal exercises are a filter, not a separate destination. */
export default function ExercisesScreen() {
  const router = useRouter(); const { catalogue, ready, error } = useExerciseCatalogue();
  return <ExerciseSwapSheet open embedded mode="browse" current={null} candidates={catalogue.filter((exercise) => !exercise.archivedAt)}
    catalogueStatus={error ? 'error' : !ready ? 'loading' : undefined}
    onSelect={(exercise) => router.push({ pathname: '/exercise-details', params: { id: exercise.id } })}
    onClose={() => backToTraining(router)} />;
}
