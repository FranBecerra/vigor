import { MuscleGroup, type Exercise } from '@/models';
import { primaryMusclesOf } from './exerciseMuscles';
import { EXERCISE_NAME_ALIASES } from './exerciseIdentity';
import englishNames from '@/data/exercise-names-en.json';
import { rankSwapCandidates } from './swapEngine';

/**
 * Search vocabulary is deliberately multilingual and domain-based. Exercise
 * names alone cannot make queries such as "delt" or "espalda" useful because
 * neither word has to appear in a Spanish catalogue name.
 */
const MUSCLE_SEARCH_ALIASES: Record<MuscleGroup, readonly string[]> = {
  [MuscleGroup.UNCLASSIFIED]: ['unclassified', 'rehab', 'mobility'],
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
  [MuscleGroup.FOREARMS]: ['antebrazo', 'antebrazos', 'forearm', 'forearms', 'muñeca', 'agarre', 'grip'],
  [MuscleGroup.TRICEPS]: ['triceps', 'tríceps', 'brazo', 'extension de codo'],
  [MuscleGroup.CORE]: ['core', 'abdomen', 'abdominal', 'abdominales', 'abs'],
};

export function normalizeExerciseSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .toLocaleLowerCase()
    .trim();
}

/** Execution-name aliases, not aliases for every exercise using the same muscle. */
const EXERCISE_KEYWORDS: readonly [RegExp, string][] = [
  [/jalon|pull[ -]?down/, 'pulldown pull down lat pulldown'],
  [/dominada|chin[ -]?up|pull[ -]?up/, 'pullup pull up chinup chin up'],
  [/remo|\brow\b/, 'row rowing remo'],
  [/press.*banca|bench press/, 'bench press banca'],
  [/peso muerto|deadlift/, 'deadlift peso muerto'],
  [/rumano|romanian/, 'romanian rdl rumano'],
  [/sentadilla|squat/, 'squat sentadilla'],
  [/elevacion lateral|lateral raise/, 'lateral raise side raise'],
  [/apertura|contractor|pec deck|fly/, 'fly flyes pec deck'],
  [/inclinad|incline/, 'incline inclined'],
  [/declinad|decline/, 'decline declined'],
  [/mancuerna|dumbbell/, 'dumbbell dumbbells'],
  [/polea|cable/, 'cable pulley'],
  [/maquina|machine/, 'machine maquina'],
  [/multipower|smith/, 'smith machine multipower'],
];

export function searchExercises(
  query: string,
  exercises: readonly Exercise[],
  muscleLabel: (muscle: MuscleGroup) => string,
): Exercise[] {
  const tokens = normalizeExerciseSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...exercises];

  return exercises.filter((exercise) => {
    const normalizedName = normalizeExerciseSearch(exercise.name);
    const muscles = [exercise.primaryMuscle, ...primaryMusclesOf(exercise), ...exercise.secondaryMuscles];
    const haystack = normalizeExerciseSearch(
      [
        exercise.name,
        ...(EXERCISE_NAME_ALIASES[exercise.id] ?? []),
        (englishNames as Record<string, string>)[exercise.id] ?? '',
        exercise.primaryMuscle,
        ...EXERCISE_KEYWORDS.filter(([pattern]) => pattern.test(normalizedName)).map(([, words]) => words),
        exercise.equipment,
        ...(exercise.movementVectors ?? [exercise.movementVector]).map((value) => value.replace(/_/g, ' ')),
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
  rankSwapCandidates(current, [...candidates]).forEach((candidate) => {
    (primaryMusclesOf(candidate).some((muscle) => primaryMusclesOf(current).includes(muscle))
      || candidate.primaryMuscle === current.primaryMuscle ? related : other).push(candidate);
  });
  return { related, other };
}
