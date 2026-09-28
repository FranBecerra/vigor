import { MuscleGroup, SetType } from '@/models';
import {
  SECONDARY_MUSCLE_WEIGHT,
  WORK_SECONDS_PER_SET,
  countWorkingSets,
  estimateSessionMinutes,
  formatSetVolume,
  muscleSetVolume,
  rankedMuscleVolume,
  totalSets,
  totalWorkingSets,
  type PlannedExercise,
} from '@/services/training/sessionSummary';

/** Atajo: n series de trabajo. */
function working(n: number) {
  return Array.from({ length: n }, () => ({ setType: SetType.NORMAL }));
}

function exercise(overrides: Partial<PlannedExercise> = {}): PlannedExercise {
  return {
    exerciseId: 'bench',
    primaryMuscle: MuscleGroup.CHEST,
    secondaryMuscles: [MuscleGroup.TRICEPS],
    sets: working(3),
    restSeconds: 180,
    targetRIR: 2,
    ...overrides,
  };
}

describe('countWorkingSets', () => {
  it('cuenta las series normales', () => {
    expect(countWorkingSets(working(4))).toBe(4);
  });

  it('EXCLUYE los calentamientos', () => {
    const sets = [{ setType: SetType.WARMUP }, ...working(3)];
    expect(countWorkingSets(sets)).toBe(3);
  });

  it('cuenta las series avanzadas como trabajo', () => {
    const sets = [
      { setType: SetType.DROP_SET },
      { setType: SetType.REST_PAUSE },
      { setType: SetType.MYO_REP },
      { setType: SetType.FAILURE },
    ];
    expect(countWorkingSets(sets)).toBe(4);
  });

  it('es 0 con lista vacía', () => {
    expect(countWorkingSets([])).toBe(0);
  });
});

describe('muscleSetVolume', () => {
  it('atribuye la serie completa al músculo principal', () => {
    const volume = muscleSetVolume([
      exercise({ sets: working(3), secondaryMuscles: [] }),
    ]);
    expect(volume[MuscleGroup.CHEST]).toBe(3);
  });

  it('atribuye una fracción a cada secundario', () => {
    const volume = muscleSetVolume([
      exercise({ sets: working(4), secondaryMuscles: [MuscleGroup.TRICEPS] }),
    ]);
    expect(volume[MuscleGroup.CHEST]).toBe(4);
    expect(volume[MuscleGroup.TRICEPS]).toBe(4 * SECONDARY_MUSCLE_WEIGHT);
  });

  it('acumula un músculo que es principal en uno y secundario en otro', () => {
    const volume = muscleSetVolume([
      exercise({ exerciseId: 'bench', sets: working(4), secondaryMuscles: [MuscleGroup.TRICEPS] }),
      exercise({
        exerciseId: 'rope',
        primaryMuscle: MuscleGroup.TRICEPS,
        secondaryMuscles: [],
        sets: working(3),
      }),
    ]);
    // 3 como principal + 4×0.5 como secundario
    expect(volume[MuscleGroup.TRICEPS]).toBe(5);
  });

  it('no cuenta dos veces un secundario duplicado del mismo ejercicio', () => {
    const volume = muscleSetVolume([
      exercise({
        sets: working(4),
        secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.TRICEPS],
      }),
    ]);
    expect(volume[MuscleGroup.TRICEPS]).toBe(2);
  });

  it('nunca cuenta el principal además como secundario', () => {
    const volume = muscleSetVolume([
      exercise({
        primaryMuscle: MuscleGroup.CHEST,
        secondaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS],
        sets: working(4),
      }),
    ]);
    expect(volume[MuscleGroup.CHEST]).toBe(4);
    expect(volume[MuscleGroup.TRICEPS]).toBe(2);
  });

  it('ignora los ejercicios que solo tienen calentamiento', () => {
    const volume = muscleSetVolume([
      exercise({ sets: [{ setType: SetType.WARMUP }] }),
    ]);
    expect(volume).toEqual({});
  });

  it('devuelve objeto vacío sin ejercicios', () => {
    expect(muscleSetVolume([])).toEqual({});
  });

  it('descuenta los calentamientos del volumen atribuido', () => {
    const volume = muscleSetVolume([
      exercise({ sets: [{ setType: SetType.WARMUP }, ...working(3)], secondaryMuscles: [] }),
    ]);
    expect(volume[MuscleGroup.CHEST]).toBe(3);
  });
});

describe('rankedMuscleVolume', () => {
  it('ordena por volumen descendente', () => {
    const ranked = rankedMuscleVolume([
      exercise({ sets: working(4), secondaryMuscles: [MuscleGroup.TRICEPS] }),
    ]);
    expect(ranked[0]).toEqual({ muscle: MuscleGroup.CHEST, sets: 4 });
    expect(ranked[1]).toEqual({ muscle: MuscleGroup.TRICEPS, sets: 2 });
  });

  it('desempata alfabéticamente para que el orden sea estable', () => {
    const ranked = rankedMuscleVolume([
      exercise({ primaryMuscle: MuscleGroup.TRICEPS, secondaryMuscles: [], sets: working(3) }),
      exercise({
        exerciseId: 'b',
        primaryMuscle: MuscleGroup.BICEPS,
        secondaryMuscles: [],
        sets: working(3),
      }),
    ]);
    expect(ranked.map((e) => e.muscle)).toEqual([MuscleGroup.BICEPS, MuscleGroup.TRICEPS]);
  });

  it('recorta al límite pedido', () => {
    const ranked = rankedMuscleVolume(
      [exercise({ sets: working(4), secondaryMuscles: [MuscleGroup.TRICEPS] })],
      1,
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0].muscle).toBe(MuscleGroup.CHEST);
  });

  it('sin límite devuelve todos', () => {
    const ranked = rankedMuscleVolume([
      exercise({ sets: working(4), secondaryMuscles: [MuscleGroup.TRICEPS] }),
    ]);
    expect(ranked).toHaveLength(2);
  });

  it('devuelve lista vacía sin ejercicios', () => {
    expect(rankedMuscleVolume([])).toEqual([]);
  });
});

describe('totalSets / totalWorkingSets', () => {
  it('totalSets incluye los calentamientos', () => {
    const plans = [exercise({ sets: [{ setType: SetType.WARMUP }, ...working(3)] })];
    expect(totalSets(plans)).toBe(4);
  });

  it('totalWorkingSets los excluye', () => {
    const plans = [exercise({ sets: [{ setType: SetType.WARMUP }, ...working(3)] })];
    expect(totalWorkingSets(plans)).toBe(3);
  });

  it('suma varios ejercicios', () => {
    const plans = [
      exercise({ sets: working(3) }),
      exercise({ exerciseId: 'b', sets: working(4) }),
    ];
    expect(totalSets(plans)).toBe(7);
    expect(totalWorkingSets(plans)).toBe(7);
  });

  it('es 0 sin ejercicios', () => {
    expect(totalSets([])).toBe(0);
    expect(totalWorkingSets([])).toBe(0);
  });
});

describe('estimateSessionMinutes', () => {
  it('cuenta trabajo más descansos, sin descanso tras la última serie', () => {
    // 3 series × 40 s + 2 descansos × 180 s = 120 + 360 = 480 s = 8 min
    const plans = [exercise({ sets: working(3), restSeconds: 180 })];
    expect(estimateSessionMinutes(plans)).toBe(8);
  });

  it('una sola serie no acumula ningún descanso', () => {
    const plans = [exercise({ sets: working(1), restSeconds: 180 })];
    expect(estimateSessionMinutes(plans)).toBe(Math.round(WORK_SECONDS_PER_SET / 60));
  });

  it('suma varios ejercicios con descansos distintos', () => {
    const plans = [
      exercise({ sets: working(3), restSeconds: 180 }), // 480 s
      exercise({ exerciseId: 'b', sets: working(3), restSeconds: 120 }), // 120 + 240 = 360 s
    ];
    expect(estimateSessionMinutes(plans)).toBe(Math.round(840 / 60));
  });

  it('ignora los ejercicios sin series', () => {
    const plans = [exercise({ sets: [] }), exercise({ exerciseId: 'b', sets: working(3) })];
    expect(estimateSessionMinutes(plans)).toBe(8);
  });

  it('es 0 sin ejercicios', () => {
    expect(estimateSessionMinutes([])).toBe(0);
  });
});

describe('formatSetVolume', () => {
  it('muestra los enteros sin decimales', () => {
    expect(formatSetVolume(12)).toBe('12');
    expect(formatSetVolume(0)).toBe('0');
  });

  it('muestra un decimal en los fraccionados', () => {
    expect(formatSetVolume(12.5)).toBe('12.5');
    expect(formatSetVolume(14.05)).toBe('14.1');
  });
});
