/**
 * Datos de ejemplo para desarrollar la UI antes de conectar Firestore.
 * Se sustituirán por los repositorios reales (src/services/repositories).
 *
 * Cada ejercicio tiene SUS PROPIAS series (no compartidas).
 */
import {
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  SetType,
  Equipment,
  type Exercise,
  type WorkoutSet,
} from '@/models';

/** Nombre de la sesión, mostrado en grande en la cabecera. */
export const mockSessionName = 'Push';

export const mockExercises: Exercise[] = [
  {
    id: 'bench',
    name: 'Press banca',
    primaryMuscle: MuscleGroup.CHEST,
    secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT],
    movementVector: MovementVector.PUSH_HORIZONTAL,
    profile: ExerciseProfile.COMPOUND_PRIMARY,
    equipment: Equipment.BARBELL,
    isCustom: false,
  },
  {
    id: 'incline-db',
    name: 'Press inclinado con mancuernas',
    primaryMuscle: MuscleGroup.CHEST,
    secondaryMuscles: [MuscleGroup.DELTS_FRONT],
    movementVector: MovementVector.PUSH_HORIZONTAL,
    profile: ExerciseProfile.COMPOUND_SECONDARY,
    equipment: Equipment.DUMBBELL,
    isCustom: false,
  },
  {
    id: 'ohp',
    name: 'Press militar',
    primaryMuscle: MuscleGroup.DELTS_FRONT,
    secondaryMuscles: [MuscleGroup.TRICEPS],
    movementVector: MovementVector.PUSH_VERTICAL,
    profile: ExerciseProfile.COMPOUND_PRIMARY,
    equipment: Equipment.BARBELL,
    isCustom: false,
  },
  {
    id: 'cable-fly',
    name: 'Cruces en polea',
    primaryMuscle: MuscleGroup.CHEST,
    secondaryMuscles: [],
    movementVector: MovementVector.SHOULDER_HORIZONTAL_ADDUCTION,
    profile: ExerciseProfile.ISOLATION,
    equipment: Equipment.CABLE,
    isCustom: false,
  },
  {
    id: 'triceps-rope',
    name: 'Extensión de tríceps en cuerda',
    primaryMuscle: MuscleGroup.TRICEPS,
    secondaryMuscles: [],
    movementVector: MovementVector.ELBOW_EXTENSION,
    profile: ExerciseProfile.ISOLATION,
    equipment: Equipment.CABLE,
    isCustom: false,
  },
];

/** Serie con el registro "anterior" para la columna PREVIOUS. */
export interface MockSetRow extends WorkoutSet {
  previous?: { weight: number; reps: number; rir: number };
  isCompleted: boolean;
}

function set(
  id: string,
  setType: SetType,
  weight: number,
  reps: number,
  rir: number,
  opts: {
    completed?: boolean;
    autoFilled?: boolean;
    prev?: [number, number, number];
    extensions?: { reps?: number; weight?: number }[];
  } = {},
): MockSetRow {
  return {
    id,
    setType,
    targetWeight: weight,
    targetReps: reps,
    targetRIR: rir,
    actualWeight: opts.completed ? weight : undefined,
    actualReps: opts.completed ? reps : undefined,
    actualRIR: opts.completed ? rir : undefined,
    extensions: opts.extensions,
    isAutoFilled: opts.autoFilled ?? false,
    isCompleted: opts.completed ?? false,
    previous: opts.prev ? { weight: opts.prev[0], reps: opts.prev[1], rir: opts.prev[2] } : undefined,
  };
}

/** Series iniciales por ejercicio (exerciseId -> series). */
export const mockSetsByExercise: Record<string, MockSetRow[]> = {
  bench: [
    set('bench-w', SetType.WARMUP, 40, 7, 5, { completed: true, prev: [40, 7, 5] }),
    set('bench-1', SetType.NORMAL, 80, 8, 2, { completed: true, prev: [80, 8, 2] }),
    set('bench-2', SetType.NORMAL, 80, 8, 2, { prev: [80, 8, 2] }),
    set('bench-3', SetType.NORMAL, 77.5, 8, 2, { autoFilled: true, prev: [80, 8, 2] }),
  ],
  'incline-db': [
    set('incline-1', SetType.NORMAL, 28, 10, 2, { completed: true, prev: [26, 10, 2] }),
    set('incline-2', SetType.NORMAL, 28, 10, 2, { prev: [28, 10, 2] }),
    set('incline-3', SetType.NORMAL, 28, 9, 1, { prev: [28, 9, 1] }),
  ],
  ohp: [
    set('ohp-w', SetType.WARMUP, 20, 8, 5, { completed: true, prev: [20, 8, 5] }),
    set('ohp-1', SetType.NORMAL, 45, 6, 2, { prev: [45, 6, 2] }),
    set('ohp-2', SetType.NORMAL, 45, 6, 2, { prev: [42.5, 6, 2] }),
  ],
  'cable-fly': [
    set('fly-1', SetType.NORMAL, 15, 12, 1, { prev: [15, 12, 1] }),
    set('fly-2', SetType.NORMAL, 15, 12, 0, { prev: [15, 11, 0] }),
    set('fly-3', SetType.FAILURE, 12.5, 12, 0, { prev: [12.5, 12, 0] }),
  ],
  'triceps-rope': [
    set('tri-1', SetType.NORMAL, 25, 12, 1, { prev: [25, 12, 1] }),
    set('tri-2', SetType.NORMAL, 25, 12, 0, { prev: [25, 12, 1] }),
    set(
      'tri-3',
      SetType.DROP_SET,
      17.5,
      15,
      0,
      {
        prev: [17.5, 14, 0],
        extensions: [
          { reps: 8, weight: 12.5 },
          { reps: 6, weight: 10 },
        ],
      },
    ),
  ],
};
