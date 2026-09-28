import { MuscleGroup, type Exercise } from '@/models';

/**
 * Search vocabulary is deliberately multilingual and domain-based. Exercise
 * names alone cannot make queries such as "delt" or "espalda" useful because
 * neither word has to appear in a Spanish catalogue name.
 */
const MUSCLE_SEARCH_ALIASES: Record<MuscleGroup, readonly string[]> = {
  [MuscleGroup.DELTS_FRONT]: ['deltoide', 'deltoides', 'delt', 'hombro', 'shoulder', 'front delt'],
  [MuscleGroup.DELTS_LATERAL]: ['deltoide', 'deltoides', 'delt', 'hombro', 'shoulder', 'side delt'],
  [MuscleGroup.DELTS_REAR]: ['deltoide', 'deltoides', 'delt', 'hombro', 'shoulder', 'rear delt'],
  [MuscleGroup.NECK]: ['cuello', 'cervical', 'trapecio', 'traps', 'neck', 'shrug', 'encogimiento'],
  [MuscleGroup.MID_BACK]: [
    'espalda',
    'espalda media',
    'espalda alta',
    'remo',
    'romboide',
    'romboides',
    'trapecio medio',
    'mid back',
    'upper back',
    'rhomboid',
    'row',
  ],
  [MuscleGroup.CHEST]: ['pecho', 'pectoral', 'pectorales', 'chest', 'pec'],
  [MuscleGroup.LATS]: ['espalda', 'dorsal', 'dorsales', 'lat', 'lats', 'back'],
  [MuscleGroup.ERECTORS]: ['espalda', 'lumbar', 'lumbares', 'erector', 'erectores', 'lower back'],
  [MuscleGroup.QUADS]: ['cuadriceps', 'quad', 'quads', 'muslo anterior'],
  [MuscleGroup.HAMSTRINGS]: ['isquio', 'isquios', 'femoral', 'hamstring', 'hamstrings'],
  [MuscleGroup.GLUTES]: ['gluteo', 'gluteos', 'glute', 'glutes', 'butt'],
  [MuscleGroup.ADDUCTORS]: ['aductor', 'aductores', 'adductor', 'adductors', 'ingle'],
  [MuscleGroup.CALVES]: ['gemelo', 'gemelos', 'pantorrilla', 'calf', 'calves'],
  [MuscleGroup.TIBIALIS]: ['tibial', 'tibialis', 'espinilla', 'shin'],
  [MuscleGroup.BICEPS]: ['biceps', 'bíceps', 'brazo', 'curl'],
  [MuscleGroup.TRICEPS]: ['triceps', 'tríceps', 'brazo', 'extension de codo'],
  [MuscleGroup.CORE]: ['core', 'abdomen', 'abdominal', 'abdominales', 'abs'],
};

export function normalizeExerciseSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function searchExercises(
  query: string,
  exercises: readonly Exercise[],
  muscleLabel: (muscle: MuscleGroup) => string,
): Exercise[] {
  const tokens = normalizeExerciseSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...exercises];

  return exercises.filter((exercise) => {
    const muscles = [exercise.primaryMuscle, ...exercise.secondaryMuscles];
    const haystack = normalizeExerciseSearch(
      [
        exercise.name,
        exercise.primaryMuscle,
        ...muscles.map(muscleLabel),
        ...muscles.flatMap((muscle) => MUSCLE_SEARCH_ALIASES[muscle]),
      ].join(' '),
    );
    return tokens.every((token) => haystack.includes(token));
  });
}

export function partitionSwapCandidates(
  current: Exercise,
  candidates: readonly Exercise[],
): { related: Exercise[]; other: Exercise[] } {
  const related: Exercise[] = [];
  const other: Exercise[] = [];
  candidates.forEach((candidate) => {
    (candidate.primaryMuscle === current.primaryMuscle ? related : other).push(candidate);
  });
  return { related, other };
}
