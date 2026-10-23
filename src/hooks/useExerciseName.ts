import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/models';
import { exerciseName } from '@/services/training/exerciseName';
export function useExerciseName() {
  const { i18n } = useTranslation(); const language = i18n?.language ?? 'es';
  return useCallback((exercise: Pick<Exercise, 'id' | 'name'> | undefined | null) => exerciseName(exercise, language), [language]);
}
