/** Private, user-scoped preferences that affect future automatic exercise selection. */
export interface ExercisePreference {
  id: string;
  userId: string;
  exerciseId: string;
  notRecommended: boolean;
  updatedAt: number;
}

export function isValidExercisePreference(value: unknown, userId: string): value is ExercisePreference {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ExercisePreference>;
  return entry.userId === userId && typeof entry.id === 'string' && entry.id.length > 0
    && entry.id === entry.exerciseId && typeof entry.notRecommended === 'boolean'
    && typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt);
}

export function recommendedExerciseIds(entries: readonly ExercisePreference[]): Set<string> {
  return new Set(entries.filter((entry) => entry.notRecommended).map((entry) => entry.exerciseId));
}

export function exercisePreference(exerciseId: string, userId: string, notRecommended: boolean, updatedAt: number): ExercisePreference {
  return { id: exerciseId, exerciseId, userId, notRecommended, updatedAt };
}
