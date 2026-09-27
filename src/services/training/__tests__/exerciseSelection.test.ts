import {
  Equipment,
  ExerciseGenerationTier,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
} from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import { EXERCISE_CATALOGUE, filterCatalogue } from '@/services/training/exerciseCatalogue';
import {
  DEFAULT_SELECTION_CONFIG,
  FOUNDATIONAL_PATTERNS,
  SECONDARY_CREDIT,
  createRandom,
  equipmentFamily,
  goalSelectionScore,
  selectExercises,
  weightedPick,
} from '@/services/training/exerciseSelection';
import { planMesocycle } from '@/services/training/mesocyclePlanner';
import {
  RegionEmphasis,
  TOTAL_SETS_RANGE,
  TrainingGoal,
  VolumeRegion,
  buildVolumePlan,
  deloadVolumePlan,
  type VolumePlan,
} from '@/services/training/volumePlan';

const plan = buildVolumePlan({
  level: ExperienceLevel.INTERMEDIATE,
  goal: TrainingGoal.HYPERTROPHY,
});

/** Plan mínimo de un solo músculo, para aislar un caso límite. */
function planFor(entries: readonly [MuscleGroup, number][]): VolumePlan {
  return {
    goal: TrainingGoal.HYPERTROPHY,
    level: ExperienceLevel.INTERMEDIATE,
    regions: [],
    muscles: entries.map(([muscle, meav]) => ({
      muscle,
      region: VolumeRegion.CORE,
      meav,
      share: 1,
      emphasis: RegionEmphasis.NORMAL,
    })),
    isDeload: false,
    capacityCapped: false,
  };
}

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ejercicio',
    name: 'Ejercicio',
    primaryMuscle: MuscleGroup.BICEPS,
    secondaryMuscles: [],
    movementVector: MovementVector.ELBOW_FLEXION,
    profile: ExerciseProfile.ISOLATION,
    equipment: Equipment.DUMBBELL,
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

describe('createRandom', () => {
  it('la misma semilla produce la misma secuencia', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('semillas distintas producen secuencias distintas', () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a()).not.toBe(b());
  });

  it('siempre devuelve valores en [0, 1)', () => {
    const random = createRandom(7);
    for (let index = 0; index < 500; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('weightedPick', () => {
  it('devuelve undefined con una lista vacía', () => {
    expect(weightedPick([], () => 1, createRandom(1))).toBeUndefined();
  });

  it('respeta los pesos: un peso muy alto sale casi siempre', () => {
    const random = createRandom(3);
    const counts = { a: 0, b: 0 };
    for (let index = 0; index < 400; index += 1) {
      const pick = weightedPick(
        ['a', 'b'] as const,
        (item) => (item === 'a' ? 20 : 1),
        random,
      )!;
      counts[pick] += 1;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 5);
  });

  it('nunca elige un elemento con peso cero si otro tiene peso', () => {
    const random = createRandom(5);
    for (let index = 0; index < 100; index += 1) {
      expect(weightedPick(['si', 'no'], (item) => (item === 'si' ? 1 : 0), random)).toBe('si');
    }
  });

  it('con TODOS los pesos a cero elige uniformemente en lugar de no devolver nada', () => {
    const pick = weightedPick(['a', 'b'], () => 0, createRandom(9));
    expect(['a', 'b']).toContain(pick);
  });

  it('trata un peso negativo como cero', () => {
    expect(weightedPick(['a', 'b'], (item) => (item === 'a' ? -5 : 1), createRandom(2))).toBe('b');
  });

  it('con una fuente de azar en su cota superior devuelve el último, no undefined', () => {
    // `Math.random` nunca devuelve 1, pero la acumulación en coma flotante puede
    // dejar el umbral justo en el total. El guardián existe para que en ese caso
    // salga un ejercicio en lugar de dejar el músculo sin cubrir.
    expect(weightedPick(['a', 'b', 'c'], () => 1, () => 1)).toBe('c');
  });
});

describe('goal-specific selection policy', () => {
  it('strength rewards a loadable compound more than an otherwise equal isolation', () => {
    const compound = exercise({
      id: 'compound',
      profile: ExerciseProfile.COMPOUND_PRIMARY,
      equipment: Equipment.BARBELL,
    });
    const isolation = exercise({ id: 'isolation', profile: ExerciseProfile.ISOLATION });
    expect(goalSelectionScore(compound, TrainingGoal.STRENGTH)).toBeGreaterThan(
      goalSelectionScore(isolation, TrainingGoal.STRENGTH),
    );
    expect(goalSelectionScore(compound, TrainingGoal.HYPERTROPHY)).toBe(
      goalSelectionScore(isolation, TrainingGoal.HYPERTROPHY),
    );
  });

  it('classifies equipment into the diversity families', () => {
    expect(equipmentFamily(exercise({ equipment: Equipment.BARBELL }))).toBe('FREE_WEIGHT');
    expect(equipmentFamily(exercise({ equipment: Equipment.MACHINE }))).toBe('GUIDED');
    expect(equipmentFamily(exercise({ equipment: Equipment.BODYWEIGHT }))).toBe('BODYWEIGHT');
    expect(equipmentFamily(exercise({ equipment: Equipment.BANDS }))).toBe('OTHER');
  });

  it('uses a fallback only when no standard alternative exists', () => {
    const fallback = exercise({
      id: 'fallback',
      primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
      movementVector: MovementVector.PUSH_HORIZONTAL,
      profile: ExerciseProfile.COMPOUND_PRIMARY,
      generationTier: ExerciseGenerationTier.FALLBACK,
    });
    const standard = exercise({
      id: 'standard',
      primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
      movementVector: MovementVector.PUSH_HORIZONTAL,
      profile: ExerciseProfile.COMPOUND_PRIMARY,
    });
    const chest = planFor([[MuscleGroup.CHEST_MID_LOWER, 3]]);

    expect(
      selectExercises({ volumePlan: chest, catalogue: [fallback, standard], seed: 1 }).selected[0]
        .exercise.id,
    ).toBe('standard');
    expect(
      selectExercises({ volumePlan: chest, catalogue: [fallback], seed: 1 }).selected[0].exercise.id,
    ).toBe('fallback');
  });

  it('does not auto-select either dip when standard gym alternatives exist', () => {
    Array.from({ length: 100 }, (_, seed) => seed + 1).forEach((seed) => {
      const ids = selectExercises({
        volumePlan: plan,
        catalogue: EXERCISE_CATALOGUE,
        seed,
      }).selected.map((entry) => entry.exercise.id);
      expect(ids).not.toContain('fondos-paralelas');
      expect(ids).not.toContain('fondos-banco');
    });
  });

  it.each([MuscleGroup.BICEPS, MuscleGroup.TRICEPS])(
    'does not select two %s variants with the same stimulus signature',
    (muscle) => {
      Array.from({ length: 50 }, (_, seed) => seed + 1).forEach((seed) => {
        const selected = selectExercises({
          volumePlan: planFor([[muscle, 12]]),
          catalogue: EXERCISE_CATALOGUE,
          seed,
        }).selected;
        const signatures = selected.map((entry) =>
          entry.exercise.stimulusTags?.slice().sort().join('|'),
        );
        expect(new Set(signatures).size).toBe(signatures.length);
      });
    },
  );
});

describe('selectExercises — invariantes deterministas', () => {
  it('la misma semilla produce exactamente la misma propuesta', () => {
    const a = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 11 });
    const b = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 11 });
    expect(a.selected.map((e) => [e.exercise.id, e.sets])).toEqual(
      b.selected.map((e) => [e.exercise.id, e.sets]),
    );
  });

  it('el VOLUMEN se mantiene estable entre semillas aunque cambien los ejercicios', () => {
    const results = [1, 2, 3, 4, 5, 6].map((seed) =>
      selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed }),
    );
    const performed = results.map((r) => r.performedSets);
    const spread = Math.max(...performed) - Math.min(...performed);
    // El volumen es la invariante; la variación entre semillas debe ser pequeña.
    expect(spread).toBeLessThan(Math.min(...performed) * 0.25);
  });

  it('los EJERCICIOS sí varían entre semillas', () => {
    const a = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 1 });
    const b = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 99 });
    const idsA = a.selected.map((e) => e.exercise.id).sort();
    const idsB = b.selected.map((e) => e.exercise.id).sort();
    expect(idsA).not.toEqual(idsB);
  });

  it('las series atribuidas son las ejecutadas más el crédito de los secundarios', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 4 });
    const expected = result.selected.reduce(
      (sum, entry) =>
        sum + entry.sets * (1 + entry.exercise.secondaryMuscles.length * SECONDARY_CREDIT),
      0,
    );
    expect(result.attributedSets).toBeCloseTo(expected, 5);
  });

  it('las atribuidas SUPERAN a las ejecutadas: es el efecto de los multiarticulares', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 4 });
    expect(result.attributedSets).toBeGreaterThan(result.performedSets);
  });

  it('las ejecutadas son la suma de las series de cada ejercicio', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 8 });
    expect(result.performedSets).toBe(result.selected.reduce((sum, e) => sum + e.sets, 0));
  });

  it('el volumen atribuido por músculo cuadra con la suma de créditos', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 6 });
    const recomputed = new Map<MuscleGroup, number>();
    result.selected.forEach((entry) => {
      const { primaryMuscle, secondaryMuscles } = entry.exercise;
      recomputed.set(primaryMuscle, (recomputed.get(primaryMuscle) ?? 0) + entry.sets);
      secondaryMuscles.forEach((muscle) => {
        recomputed.set(muscle, (recomputed.get(muscle) ?? 0) + entry.sets * SECONDARY_CREDIT);
      });
    });
    recomputed.forEach((value, muscle) => {
      expect(result.attributedByMuscle[muscle]).toBeCloseTo(value, 5);
    });
  });
});

describe('selectExercises — topes', () => {
  it('ningún ejercicio pasa del tope de series', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 2 });
    result.selected.forEach((entry) => {
      expect(entry.sets).toBeLessThanOrEqual(DEFAULT_SELECTION_CONFIG.maxSetsPerExercise);
      expect(entry.sets).toBeGreaterThanOrEqual(DEFAULT_SELECTION_CONFIG.minSetsPerExercise);
    });
  });

  it('ningún músculo recibe más ejercicios que el tope', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 3 });
    const counts = new Map<MuscleGroup, number>();
    result.selected.forEach((entry) => {
      const muscle = entry.exercise.primaryMuscle;
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    });
    counts.forEach((count) => {
      expect(count).toBeLessThanOrEqual(DEFAULT_SELECTION_CONFIG.maxExercisesPerMuscle);
    });
  });

  it('nunca repite el mismo ejercicio', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 5 });
    const ids = result.selected.map((e) => e.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never selects two compound variants of the same biomechanical pattern', () => {
    Array.from({ length: 40 }, (_, seed) => seed + 1).forEach((seed) => {
      const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed });
      const compoundFamilies = result.selected
        .filter((entry) => entry.exercise.profile !== ExerciseProfile.ISOLATION)
        .map(
          (entry) =>
            `${entry.exercise.primaryMuscle}:${entry.exercise.movementVector}`,
        );

      expect(new Set(compoundFamilies).size).toBe(compoundFamilies.length);
    });
  });

  it('never selects two primary compounds for the same movement vector', () => {
    Array.from({ length: 100 }, (_, seed) => seed + 1).forEach((seed) => {
      const vectors = selectExercises({
        volumePlan: plan,
        catalogue: EXERCISE_CATALOGUE,
        seed,
      }).selected
        .filter((entry) => entry.exercise.profile === ExerciseProfile.COMPOUND_PRIMARY)
        .map((entry) => entry.exercise.movementVector);
      expect(new Set(vectors).size).toBe(vectors.length);
    });
  });

  it('does not combine the duplicate squat and RDL variants from the reported plan', () => {
    Array.from({ length: 40 }, (_, seed) => seed + 1).forEach((seed) => {
      const ids = new Set(
        selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed }).selected.map(
          (entry) => entry.exercise.id,
        ),
      );
      expect(ids.has('sentadilla-libre') && ids.has('sentadilla-hack')).toBe(false);
      expect(
        ids.has('peso-muerto-rumano') && ids.has('peso-muerto-rumano-mancuernas'),
      ).toBe(false);
    });
  });

  it('respeta una configuración a medida', () => {
    const result = selectExercises({
      volumePlan: plan,
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
      config: { maxExercisesPerMuscle: 1, maxSetsPerExercise: 3, minSetsPerExercise: 3 },
    });
    result.selected.forEach((entry) => expect(entry.sets).toBe(3));
    const counts = new Map<MuscleGroup, number>();
    result.selected.forEach((entry) => {
      const muscle = entry.exercise.primaryMuscle;
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    });
    counts.forEach((count) => expect(count).toBe(1));
  });
});

describe('selectExercises — vetos y material', () => {
  it('NUNCA propone un ejercicio vetado', () => {
    const vetoed = ['press-banca', 'sentadilla-libre', 'dominadas'];
    const result = selectExercises({
      volumePlan: plan,
      catalogue: filterCatalogue(EXERCISE_CATALOGUE, { vetoedExerciseIds: vetoed }),
      seed: 1,
    });
    result.selected.forEach((entry) => expect(vetoed).not.toContain(entry.exercise.id));
  });

  it('NUNCA propone material que el atleta no tiene', () => {
    const available = [Equipment.DUMBBELL, Equipment.BODYWEIGHT];
    const result = selectExercises({
      volumePlan: plan,
      catalogue: filterCatalogue(EXERCISE_CATALOGUE, { availableEquipment: available }),
      seed: 1,
    });
    result.selected.forEach((entry) => expect(available).toContain(entry.exercise.equipment));
  });

  it('informa del volumen sin cubrir cuando el material no alcanza', () => {
    const result = selectExercises({
      volumePlan: plan,
      catalogue: filterCatalogue(EXERCISE_CATALOGUE, {
        availableEquipment: [Equipment.KETTLEBELL],
      }),
      seed: 1,
    });
    expect(result.unmet.length).toBeGreaterThan(0);
    expect(result.unmet.some((u) => !u.uncloseable)).toBe(true);
  });
});

describe('selectExercises — volumen total dentro del rango de referencia', () => {
  // La invariante que faltaba y que dejó pasar un plan de 124 series ejecutadas
  // para un intermedio, cuando el rango de referencia es 40-90.
  const levels = [
    ExperienceLevel.BEGINNER,
    ExperienceLevel.INTERMEDIATE,
    ExperienceLevel.ADVANCED,
  ] as const;
  const goals = [TrainingGoal.HYPERTROPHY, TrainingGoal.STRENGTH] as const;

  it.each(levels.flatMap((level) => goals.map((goal) => [level, goal] as const)))(
    'el plan por defecto de %s / %s cae dentro del rango',
    (level, goal) => {
      const result = selectExercises({
        volumePlan: buildVolumePlan({ level, goal }),
        catalogue: EXERCISE_CATALOGUE,
        seed: 1,
      });
      expect(result.totalVerdict).toBe('within');
    },
  );

  it('el volumen se acerca al LÍMITE SUPERIOR del rango, no al mínimo', () => {
    // Requisito explícito: el plan por defecto debe aprovechar el rango del nivel.
    levels.forEach((level) => {
      const [min, max] = TOTAL_SETS_RANGE[TrainingGoal.HYPERTROPHY][level];
      const result = selectExercises({
        volumePlan: buildVolumePlan({ level, goal: TrainingGoal.HYPERTROPHY }),
        catalogue: EXERCISE_CATALOGUE,
        seed: 1,
      });
      const position = (result.performedSets - min) / (max - min);
      expect(position).toBeGreaterThan(0.7);
      expect(position).toBeLessThanOrEqual(1);
    });
  });

  it('sigue dentro del rango con VEINTE semillas', () => {
    // La aleatoriedad cambia cuántas series EJECUTADAS hacen falta para el mismo
    // volumen atribuido, porque un plan con más multiarticulares necesita menos.
    // Con el volumen apuntando al 98 % del techo, seis de cada ocho semillas se
    // salían: por eso la calibración deja margen.
    Array.from({ length: 20 }, (_, index) => index + 1).forEach((seed) => {
      const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed });
      expect(result.totalVerdict).toBe('within');
    });
  });

  it('activar TODAS las regiones sale POR ENCIMA del rango', () => {
    // Es la prueba de que el veredicto detecta un plan desmedido en lugar de
    // aceptarlo en silencio, que es lo que ocurría antes.
    const result = selectExercises({
      volumePlan: buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        trainedRegions: Object.values(VolumeRegion),
      }),
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    expect(result.totalVerdict).toBe('above');
  });

  it('priorizar DOS regiones caras se mantiene dentro del rango', () => {
    // El trade es automático: las regiones normales bajan al mínimo efectivo para
    // pagar el volumen extra de las priorizadas.
    const result = selectExercises({
      volumePlan: buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [MuscleGroup.LATS, MuscleGroup.QUADS],
      }),
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    expect(result.totalVerdict).toBe('within');
  });

  it('la DESCARGA no se juzga contra el rango de acumulación', () => {
    const accumulation = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
    });
    const deload = selectExercises({
      volumePlan: deloadVolumePlan(accumulation),
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    const full = selectExercises({
      volumePlan: accumulation,
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    // Estaría por debajo del rango de acumulación, y eso es su objetivo: la
    // pregunta no aplica.
    expect(deload.totalVerdict).toBe('not-applicable');
    expect(deload.performedSets).toBeLessThan(full.performedSets * 0.6);
    expect(deload.performedSets).toBeGreaterThan(full.performedSets * 0.35);
  });

  it('un plan casi vacío sale POR DEBAJO del rango', () => {
    const result = selectExercises({
      volumePlan: buildVolumePlan({
        level: ExperienceLevel.ADVANCED,
        goal: TrainingGoal.HYPERTROPHY,
        trainedRegions: [VolumeRegion.BICEPS],
      }),
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    expect(result.totalVerdict).toBe('below');
  });
});

describe('selectExercises — casos límite', () => {
  it('un plan sin volumen no propone nada', () => {
    const result = selectExercises({
      volumePlan: planFor([[MuscleGroup.BICEPS, 0]]),
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    expect(result.selected).toEqual([]);
    expect(result.performedSets).toBe(0);
    expect(result.attributedSets).toBe(0);
    expect(result.unmet).toEqual([]);
  });

  it('un catálogo vacío deja todo el volumen sin cubrir', () => {
    const result = selectExercises({
      volumePlan: planFor([[MuscleGroup.BICEPS, 12]]),
      catalogue: [],
      seed: 1,
    });
    expect(result.selected).toEqual([]);
    expect(result.unmet).toEqual([
      { muscle: MuscleGroup.BICEPS, target: 12, attributed: 0, uncloseable: false },
    ]);
  });

  it('un objetivo por debajo del mínimo de series se marca como resto, no como hueco', () => {
    const result = selectExercises({
      volumePlan: planFor([[MuscleGroup.BICEPS, 2]]),
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    expect(result.selected).toEqual([]);
    expect(result.unmet).toEqual([
      { muscle: MuscleGroup.BICEPS, target: 2, attributed: 0, uncloseable: true },
    ]);
  });

  it('un déficit mayor que un ejercicio NO es un resto', () => {
    const result = selectExercises({
      volumePlan: planFor([[MuscleGroup.BICEPS, 30]]),
      catalogue: [exercise({ id: 'curl', primaryMuscle: MuscleGroup.BICEPS })],
      seed: 1,
    });
    expect(result.unmet[0].uncloseable).toBe(false);
  });

  it('tolera medio punto de déficit sin considerarlo un hueco', () => {
    // 5 series de un ejercicio cubren un objetivo de 5,5 dentro de la tolerancia.
    const result = selectExercises({
      volumePlan: planFor([[MuscleGroup.BICEPS, 5.5]]),
      catalogue: [exercise({ id: 'curl', primaryMuscle: MuscleGroup.BICEPS })],
      seed: 1,
      config: { maxSetsPerExercise: 5 },
    });
    expect(result.selected[0].sets).toBe(5);
    expect(result.unmet).toEqual([]);
  });

  it('un músculo puede quedar cubierto SOLO con crédito indirecto', () => {
    const result = selectExercises({
      volumePlan: planFor([[MuscleGroup.CHEST_MID_LOWER, 6], [MuscleGroup.TRICEPS, 3]]),
      catalogue: [
        exercise({
          id: 'press',
          primaryMuscle: MuscleGroup.CHEST_MID_LOWER,
          secondaryMuscles: [MuscleGroup.TRICEPS],
          movementVector: MovementVector.PUSH_HORIZONTAL,
          profile: ExerciseProfile.COMPOUND_PRIMARY,
        }),
      ],
      seed: 1,
    });
    // 6 series de press dan 3 atribuidas al tríceps: objetivo cubierto sin
    // ningún ejercicio de tríceps.
    expect(result.selected).toHaveLength(1);
    expect(result.attributedByMuscle[MuscleGroup.TRICEPS]).toBe(3);
    expect(result.unmet).toEqual([]);
  });

  it('cuenta los vectores usados', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 1 });
    const total = Object.values(result.vectorCounts).reduce((sum, count) => sum + (count ?? 0), 0);
    expect(total).toBe(result.selected.length);
  });

  it('usa varios vectores distintos en un plan de cuerpo completo', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 1 });
    expect(Object.keys(result.vectorCounts).length).toBeGreaterThan(8);
  });
});

describe('selectExercises — foundational patterns are never skipped', () => {
  const FOUNDATIONAL = FOUNDATIONAL_PATTERNS.map((pattern) => pattern.vector);

  it('includes EVERY foundational pattern across twenty seeds', () => {
    // Measured before the floor existed: KNEE_DOMINANT was absent from 1 in 10
    // plans, because a squat had to win a weighted draw to appear at all.
    Array.from({ length: 20 }, (_, index) => index + 1).forEach((seed) => {
      const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed });
      const vectors = new Set(result.selected.map((entry) => entry.exercise.movementVector));
      FOUNDATIONAL.forEach((vector) => expect(vectors.has(vector)).toBe(true));
      expect(result.missingFoundationalPatterns).toEqual([]);
    });
  });

  it('keeps them even when the plan is squeezed hard by time', () => {
    const squeezed = planMesocycle({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
      capacity: { sessionsPerMicrocycle: 3, minutesPerSession: 45 },
    });
    const vectors = new Set(
      squeezed.selection.selected.map((entry) => entry.exercise.movementVector),
    );
    FOUNDATIONAL.forEach((vector) => expect(vectors.has(vector)).toBe(true));
  });

  it('uses a COMPOUND for the pattern, never an isolation substitute', () => {
    const result = selectExercises({ volumePlan: plan, catalogue: EXERCISE_CATALOGUE, seed: 1 });
    FOUNDATIONAL.forEach((vector) => {
      const forPattern = result.selected.filter(
        (entry) => entry.exercise.movementVector === vector,
      );
      expect(forPattern.some((entry) => entry.exercise.profile !== ExerciseProfile.ISOLATION)).toBe(
        true,
      );
    });
  });

  it('REPORTS a pattern the athlete has no equipment for, instead of hiding it', () => {
    const cableOnly = filterCatalogue(EXERCISE_CATALOGUE, {
      availableEquipment: [Equipment.CABLE],
    });
    const result = selectExercises({ volumePlan: plan, catalogue: cableOnly, seed: 1 });
    expect(result.missingFoundationalPatterns).toContain(MovementVector.KNEE_DOMINANT);
  });

  it('does NOT demand a pattern whose muscles the plan does not train', () => {
    // A plan with no leg volume is not forced to include a squat.
    const armsOnly = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      trainedRegions: [VolumeRegion.BICEPS, VolumeRegion.TRICEPS],
    });
    const result = selectExercises({
      volumePlan: armsOnly,
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
    });
    const vectors = new Set(result.selected.map((entry) => entry.exercise.movementVector));
    expect(vectors.has(MovementVector.KNEE_DOMINANT)).toBe(false);
    expect(result.missingFoundationalPatterns).toEqual([]);
  });

  it('a home gym of dumbbells and bodyweight still gets a squat pattern', () => {
    const home = filterCatalogue(EXERCISE_CATALOGUE, {
      availableEquipment: [Equipment.DUMBBELL, Equipment.BODYWEIGHT],
    });
    const result = selectExercises({ volumePlan: plan, catalogue: home, seed: 1 });
    expect(result.missingFoundationalPatterns).not.toContain(MovementVector.KNEE_DOMINANT);
  });
});
