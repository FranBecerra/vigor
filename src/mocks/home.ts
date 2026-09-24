/**
 * Datos de ejemplo para la pantalla Inicio/Hoy de Entrenamiento (E1, PRD §8.5).
 * Se sustituirán por los repositorios reales (src/services/repositories).
 *
 * Refleja el modelo acordado: los microciclos NO tienen duración en días; se
 * definen por sus sesiones, y todos los del mesociclo tienen el mismo número.
 * Las sesiones completadas guardan su FECHA real; las pendientes no tienen día.
 */
import { MuscleGroup, SetType } from '@/models';
import type { RoutineIconKey } from '@/components/icons';

/** Dominio de entrenamiento que se muestra en la pantalla. */
export type TrainingDomain = 'STRENGTH' | 'CARDIO';

/** Ejercicio dentro de una sesión planificada. */
export interface MockPlannedExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  sets: { setType: SetType }[];
  restSeconds: number;
  /** Rango de repeticiones previsto, para la previsualización. */
  repRange: string;
  /** RIR objetivo del ejercicio; el RIR por serie se DERIVA (services/training/setIntensity). */
  targetRIR: number;
}

/** Sesión del microciclo. */
export interface MockSession {
  id: string;
  name: string;
  exercises: MockPlannedExercise[];
  /**
   * Fecha de realización en ISO (`2026-09-16`). `undefined` = pendiente.
   * Las pendientes NO muestran día: el microciclo no está anclado al calendario.
   */
  completedOn?: string;
}

/** Microciclo: conjunto fijo de sesiones, sin duración en días. */
export interface MockMicrocycle {
  id: string;
  /** Posición dentro del mesociclo (1-based para mostrar). */
  number: number;
  sessions: MockSession[];
  /** true si es un microciclo de descarga. */
  isDeload: boolean;
  /** true si aún no ha ocurrido: se pinta con transparencia (proyección). */
  isProjected: boolean;
  /** Variación de series frente a la sesión base; positivo = más volumen. */
  volumeAdjustmentSets: number;
  /** Variación de RIR; negativo = más intensidad. */
  intensityAdjustmentRIR: number;
}

/** Rutina registrada (un macrociclo con su identidad visual). */
export interface MockRoutine {
  id: string;
  name: string;
  objective: string;
  icon: RoutineIconKey;
  color: string;
  domain: TrainingDomain;
  /** true = rutina activa; el acordeón la muestra expandida. */
  isActive: boolean;
  microcycles: MockMicrocycle[];
  /** Índice (0-based) del microciclo en curso dentro de `microcycles`. */
  currentMicrocycleIndex: number;
}

/** Atajo: n series del tipo dado. */
function sets(count: number, setType: SetType = SetType.NORMAL) {
  return Array.from({ length: count }, () => ({ setType }));
}

function warmupPlus(count: number) {
  return [{ setType: SetType.WARMUP }, ...sets(count)];
}

/** Ejercicios de la sesión Push. */
const pushExercises: MockPlannedExercise[] = [
  {
    exerciseId: 'bench',
    name: 'Press banca',
    primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
    secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT],
    sets: warmupPlus(3),
    restSeconds: 180,
    repRange: '8-10',
    targetRIR: 2,
  },
  {
    exerciseId: 'incline-db',
    name: 'Press inclinado con mancuernas',
    primaryMuscle: MuscleGroup.CHEST_UPPER,
    secondaryMuscles: [MuscleGroup.DELTS_FRONT],
    sets: sets(3),
    restSeconds: 180,
    repRange: '10-12',
    targetRIR: 2,
  },
  {
    exerciseId: 'ohp',
    name: 'Press militar',
    primaryMuscle: MuscleGroup.DELTS_FRONT,
    secondaryMuscles: [MuscleGroup.TRICEPS],
    sets: sets(3),
    restSeconds: 180,
    repRange: '8-10',
    targetRIR: 2,
  },
  {
    exerciseId: 'lat-raise',
    name: 'Elevaciones laterales',
    primaryMuscle: MuscleGroup.DELTS_LATERAL,
    secondaryMuscles: [],
    sets: sets(4),
    restSeconds: 120,
    repRange: '12-15',
    targetRIR: 1,
  },
  {
    exerciseId: 'cable-fly',
    name: 'Cruces en polea',
    primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
    secondaryMuscles: [],
    sets: sets(3),
    restSeconds: 120,
    repRange: '12-15',
    targetRIR: 1,
  },
  {
    exerciseId: 'triceps-rope',
    name: 'Extensión de tríceps en cuerda',
    primaryMuscle: MuscleGroup.TRICEPS,
    secondaryMuscles: [],
    sets: sets(3, SetType.REST_PAUSE),
    restSeconds: 120,
    repRange: '12-15',
    targetRIR: 0,
  },
];

const pullExercises: MockPlannedExercise[] = [
  {
    exerciseId: 'row',
    name: 'Remo con barra',
    primaryMuscle: MuscleGroup.LATS,
    secondaryMuscles: [MuscleGroup.BICEPS, MuscleGroup.TRAPS_MID_LOWER],
    sets: warmupPlus(3),
    restSeconds: 180,
    repRange: '8-10',
    targetRIR: 2,
  },
  {
    exerciseId: 'pulldown',
    name: 'Jalón al pecho',
    primaryMuscle: MuscleGroup.LATS,
    secondaryMuscles: [MuscleGroup.BICEPS],
    sets: sets(3),
    restSeconds: 180,
    repRange: '10-12',
    targetRIR: 2,
  },
  {
    exerciseId: 'curl',
    name: 'Curl con barra',
    primaryMuscle: MuscleGroup.BICEPS,
    secondaryMuscles: [],
    sets: sets(3),
    restSeconds: 120,
    repRange: '10-12',
    targetRIR: 1,
  },
];

const upperExercises: MockPlannedExercise[] = [
  {
    exerciseId: 'machine-row',
    name: 'Remo en máquina',
    primaryMuscle: MuscleGroup.TRAPS_MID_LOWER,
    secondaryMuscles: [MuscleGroup.LATS, MuscleGroup.BICEPS],
    sets: warmupPlus(3),
    restSeconds: 180,
    repRange: '10-12',
    targetRIR: 2,
  },
  {
    exerciseId: 'inc-press',
    name: 'Press inclinado en máquina',
    primaryMuscle: MuscleGroup.CHEST_UPPER,
    secondaryMuscles: [MuscleGroup.DELTS_FRONT, MuscleGroup.TRICEPS],
    sets: sets(3),
    restSeconds: 180,
    repRange: '8-10',
    targetRIR: 2,
  },
  {
    exerciseId: 'rear-delt',
    name: 'Pájaros en polea',
    primaryMuscle: MuscleGroup.DELTS_REAR,
    secondaryMuscles: [],
    sets: sets(4),
    restSeconds: 120,
    repRange: '12-15',
    targetRIR: 1,
  },
  {
    exerciseId: 'hammer-curl',
    name: 'Curl martillo',
    primaryMuscle: MuscleGroup.BICEPS,
    secondaryMuscles: [],
    sets: sets(3),
    restSeconds: 120,
    repRange: '10-12',
    targetRIR: 1,
  },
];

const lowerExercises: MockPlannedExercise[] = [
  {
    exerciseId: 'squat',
    name: 'Sentadilla',
    primaryMuscle: MuscleGroup.QUADS,
    secondaryMuscles: [MuscleGroup.GLUTES, MuscleGroup.ERECTORS],
    sets: warmupPlus(3),
    restSeconds: 180,
    repRange: '6-8',
    targetRIR: 2,
  },
  {
    exerciseId: 'rdl',
    name: 'Peso muerto rumano',
    primaryMuscle: MuscleGroup.HAMSTRINGS,
    secondaryMuscles: [MuscleGroup.GLUTES, MuscleGroup.ERECTORS],
    sets: sets(3),
    restSeconds: 180,
    repRange: '8-10',
    targetRIR: 2,
  },
  {
    exerciseId: 'leg-curl',
    name: 'Curl femoral',
    primaryMuscle: MuscleGroup.HAMSTRINGS,
    secondaryMuscles: [],
    sets: sets(3),
    restSeconds: 120,
    repRange: '12-15',
    targetRIR: 1,
  },
  {
    exerciseId: 'calf',
    name: 'Elevación de gemelos',
    primaryMuscle: MuscleGroup.CALVES,
    secondaryMuscles: [],
    sets: sets(4),
    restSeconds: 90,
    repRange: '12-15',
    targetRIR: 0,
  },
];

/** Construye un microciclo con las cuatro sesiones de la rutina. */
function microcycle(
  number: number,
  options: {
    completed?: Partial<Record<'push' | 'pull' | 'upper' | 'lower', string>>;
    isDeload?: boolean;
    isProjected?: boolean;
    volumeAdjustmentSets?: number;
    intensityAdjustmentRIR?: number;
  } = {},
): MockMicrocycle {
  const {
    completed = {},
    isDeload = false,
    isProjected = false,
    volumeAdjustmentSets = 0,
    intensityAdjustmentRIR = 0,
  } = options;
  return {
    id: `micro-${number}`,
    number,
    isDeload,
    isProjected,
    volumeAdjustmentSets,
    intensityAdjustmentRIR,
    sessions: [
      {
        id: `m${number}-push`,
        name: 'Push',
        exercises: pushExercises,
        completedOn: completed.push,
      },
      {
        id: `m${number}-pull`,
        name: 'Pull',
        exercises: pullExercises,
        completedOn: completed.pull,
      },
      {
        id: `m${number}-upper`,
        name: 'Upper',
        exercises: upperExercises,
        completedOn: completed.upper,
      },
      {
        id: `m${number}-lower`,
        name: 'Lower',
        exercises: lowerExercises,
        completedOn: completed.lower,
      },
    ],
  };
}

export const mockRoutines: MockRoutine[] = [
  {
    id: 'pplu',
    name: 'Push Pull Legs Upper',
    objective: 'Hipertrofia',
    icon: 'dumbbell',
    color: '#9BE317',
    domain: 'STRENGTH',
    isActive: true,
    currentMicrocycleIndex: 2,
    microcycles: [
      microcycle(1, {
        completed: { push: '2026-09-02', pull: '2026-09-04', upper: '2026-09-06', lower: '2026-09-08' },
        intensityAdjustmentRIR: 1,
      }),
      microcycle(2, {
        completed: { push: '2026-09-09', pull: '2026-09-11', upper: '2026-09-13', lower: '2026-09-15' },
        volumeAdjustmentSets: 1,
        intensityAdjustmentRIR: 0.5,
      }),
      // Microciclo en curso: Push y Pull hechos, Upper es hoy, Lower pendiente.
      microcycle(3, { completed: { push: '2026-09-16', pull: '2026-09-18' } }),
      // Proyección: más volumen y algo más de intensidad cada microciclo.
      microcycle(4, { isProjected: true, volumeAdjustmentSets: 2, intensityAdjustmentRIR: -0.5 }),
      microcycle(5, { isProjected: true, volumeAdjustmentSets: 3, intensityAdjustmentRIR: -1 }),
      microcycle(6, {
        isDeload: true,
        isProjected: true,
        volumeAdjustmentSets: -8,
        intensityAdjustmentRIR: 2,
      }),
    ],
  },
  {
    id: 'strength-max',
    name: 'Fuerza Máxima',
    objective: 'Fuerza',
    icon: 'barbell',
    color: '#3FE0A9',
    domain: 'STRENGTH',
    isActive: false,
    currentMicrocycleIndex: 0,
    microcycles: [microcycle(1), microcycle(2, { isProjected: true })],
  },
];

/** Rutina activa y sesión de hoy, resueltas para la tarjeta principal. */
export const mockActiveRoutine = mockRoutines[0];
export const mockCurrentMicrocycle =
  mockActiveRoutine.microcycles[mockActiveRoutine.currentMicrocycleIndex];
/** Sesión de hoy: la primera pendiente del microciclo en curso. */
export const mockTodaySessionId =
  mockCurrentMicrocycle.sessions.find((s) => s.completedOn === undefined)?.id ?? '';
