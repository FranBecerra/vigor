import {
  Equipment,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
} from '@/models';
import { WORK_SECONDS_PER_SET } from '@/services/training/sessionSummary';
import { restDurationFor } from '@/services/training/restTimer';
import {
  EXERCISE_SETUP_SECONDS,
  ISOLATION_VOLUME_PER_MINUTE,
  SESSION_OVERHEAD_MINUTES,
  MAX_SETS_PER_EXERCISE_APPEARANCE,
  appearancesOf,
  approximateSetCapacity,
  attributedVolumePerMinute,
  exerciseMinutes,
  selectionMinutes,
  workMinutesAvailable,
} from '@/services/training/trainingCapacity';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ejercicio',
    name: 'Ejercicio',
    primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
    secondaryMuscles: [],
    movementVector: MovementVector.PUSH_HORIZONTAL,
    profile: ExerciseProfile.ISOLATION,
    equipment: Equipment.CABLE,
    criteria: {
      stretchedPositionLoading: 3,
      rangeOfMotion: 3,
      resistanceProfileMatch: 3,
      stabilityCost: 3,
      loadProgressability: 3,
      systemicFatigueCost: 3,
    },
    isCustom: false,
    ...overrides,
  };
}

const compound = exercise({
  id: 'press',
  profile: ExerciseProfile.COMPOUND_PRIMARY,
  secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.DELTS_FRONT],
});

describe('minutos por sesión', () => {
  it('el tiempo lo escribe el atleta, sin tramos ni extremos que elegir', () => {
    // Un tramo obligaba a decidir con qué extremo planificar. Con el dato exacto
    // esa decisión no existe.
    expect(workMinutesAvailable({ sessionsPerMicrocycle: 1, minutesPerSession: 47 })).toBe(
      47 - SESSION_OVERHEAD_MINUTES,
    );
  });

  it('un tiempo por debajo de la puesta en marcha no deja minutos de trabajo', () => {
    // No se corrige en silencio: el planificador responderá `insufficient-time`.
    expect(
      workMinutesAvailable({
        sessionsPerMicrocycle: 3,
        minutesPerSession: SESSION_OVERHEAD_MINUTES - 1,
      }),
    ).toBe(0);
  });

  it('un tiempo absurdamente alto no se recorta aquí', () => {
    // Lo acota el techo de recuperación, no la capacidad.
    expect(
      workMinutesAvailable({ sessionsPerMicrocycle: 1, minutesPerSession: 600 }),
    ).toBe(600 - SESSION_OVERHEAD_MINUTES);
  });
});

describe('workMinutesAvailable', () => {
  it('descuenta la puesta en marcha de CADA sesión', () => {
    expect(workMinutesAvailable({ sessionsPerMicrocycle: 3, minutesPerSession: 60 })).toBe(
      (60 - SESSION_OVERHEAD_MINUTES) * 3,
    );
  });

  it('crece con las sesiones y con la banda', () => {
    const short = workMinutesAvailable({
      sessionsPerMicrocycle: 3,
      minutesPerSession: 30,
    });
    const moreSessions = workMinutesAvailable({
      sessionsPerMicrocycle: 5,
      minutesPerSession: 30,
    });
    const longerSessions = workMinutesAvailable({
      sessionsPerMicrocycle: 3,
      minutesPerSession: 90,
    });
    expect(moreSessions).toBeGreaterThan(short);
    expect(longerSessions).toBeGreaterThan(short);
  });

  it('nunca es negativo, ni sin sesiones ni con un número negativo', () => {
    expect(workMinutesAvailable({ sessionsPerMicrocycle: 0, minutesPerSession: 60 })).toBe(0);
    expect(workMinutesAvailable({ sessionsPerMicrocycle: -2, minutesPerSession: 60 })).toBe(0);
  });
});

describe('appearancesOf', () => {
  it('reparte las series en apariciones de como mucho el máximo por sesión', () => {
    expect(appearancesOf(MAX_SETS_PER_EXERCISE_APPEARANCE)).toBe(1);
    expect(appearancesOf(MAX_SETS_PER_EXERCISE_APPEARANCE + 1)).toBe(2);
    expect(appearancesOf(MAX_SETS_PER_EXERCISE_APPEARANCE * 3)).toBe(3);
  });

  it('un ejercicio aparece al menos una vez', () => {
    expect(appearancesOf(0)).toBe(1);
    expect(appearancesOf(1)).toBe(1);
  });
});

describe('exerciseMinutes', () => {
  it('cuenta montaje, trabajo y descanso', () => {
    const sets = 3;
    const expected =
      (EXERCISE_SETUP_SECONDS +
        sets * (WORK_SECONDS_PER_SET + restDurationFor(ExerciseProfile.ISOLATION))) /
      60;
    expect(exerciseMinutes(exercise(), sets)).toBeCloseTo(expected, 5);
  });

  it('un multiarticular cuesta MÁS por serie, porque descansa más', () => {
    expect(exerciseMinutes(compound, 3)).toBeGreaterThan(exerciseMinutes(exercise(), 3));
  });

  it('sin series no cuesta nada', () => {
    expect(exerciseMinutes(exercise(), 0)).toBe(0);
    expect(exerciseMinutes(exercise(), -1)).toBe(0);
  });

  it('crece con las series', () => {
    expect(exerciseMinutes(exercise(), 6)).toBeGreaterThan(exerciseMinutes(exercise(), 3));
  });

  it('usa los MISMOS descansos que el cronómetro de la sesión', () => {
    // Dos modelos de tiempo distintos acabarían contradiciéndose: el atleta vería
    // una estimación en la pantalla que no cuadra con la que usó el generador.
    const isolation = exerciseMinutes(exercise(), 1) * 60;
    expect(isolation).toBeCloseTo(
      EXERCISE_SETUP_SECONDS + WORK_SECONDS_PER_SET + restDurationFor(ExerciseProfile.ISOLATION),
      5,
    );
  });
});

describe('selectionMinutes', () => {
  it('suma el coste de todos los ejercicios', () => {
    const selected = [
      { exercise: compound, sets: 4 },
      { exercise: exercise({ id: 'cruces' }), sets: 3 },
    ];
    expect(selectionMinutes(selected)).toBeCloseTo(
      exerciseMinutes(compound, 4) + exerciseMinutes(exercise({ id: 'cruces' }), 3),
      5,
    );
  });

  it('una selección vacía no cuesta nada', () => {
    expect(selectionMinutes([])).toBe(0);
  });
});

describe('attributedVolumePerMinute', () => {
  it('un multiarticular con secundarios rinde MÁS por minuto que un aislamiento', () => {
    // Es el cálculo que hace que el aislamiento sea lo primero que sobra cuando el
    // techo es el tiempo.
    expect(attributedVolumePerMinute(compound)).toBeGreaterThan(
      attributedVolumePerMinute(exercise()),
    );
  });

  it('un aislamiento sin secundarios marca la referencia', () => {
    expect(attributedVolumePerMinute(exercise())).toBeCloseTo(ISOLATION_VOLUME_PER_MINUTE, 5);
  });

  it('más secundarios rinden más por minuto con el mismo descanso', () => {
    const one = exercise({
      profile: ExerciseProfile.COMPOUND_PRIMARY,
      secondaryMuscles: [MuscleGroup.TRICEPS],
    });
    const four = exercise({
      profile: ExerciseProfile.COMPOUND_PRIMARY,
      secondaryMuscles: [
        MuscleGroup.TRICEPS,
        MuscleGroup.DELTS_FRONT,
        MuscleGroup.RHOMBOIDS,
        MuscleGroup.BICEPS,
      ],
    });
    expect(attributedVolumePerMinute(four)).toBeGreaterThan(attributedVolumePerMinute(one));
  });
});

describe('approximateSetCapacity', () => {
  it('una hora de trabajo da del orden de quince series', () => {
    // Referencia del usuario: una hora da para unos seis ejercicios, menos si son
    // pesados. Con los descansos reales de la app eso son 15-16 series.
    const capacity = approximateSetCapacity({ sessionsPerMicrocycle: 1, minutesPerSession: 60 });
    expect(capacity).toBeGreaterThanOrEqual(12);
    expect(capacity).toBeLessThanOrEqual(18);
  });

  it('escala con las sesiones', () => {
    const one = approximateSetCapacity({
      sessionsPerMicrocycle: 1,
      minutesPerSession: 60,
    });
    const four = approximateSetCapacity({
      sessionsPerMicrocycle: 4,
      minutesPerSession: 60,
    });
    expect(four).toBeGreaterThan(one * 3);
  });

  it('es 0 sin sesiones', () => {
    expect(
      approximateSetCapacity({
        sessionsPerMicrocycle: 0,
        minutesPerSession: 60,
      }),
    ).toBe(0);
  });
});
