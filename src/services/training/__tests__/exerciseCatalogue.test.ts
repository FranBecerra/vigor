import {
  Equipment,
  ExerciseGenerationTier,
  ExerciseProfile,
  MovementVector,
  MuscleGroup,
  type Exercise,
} from '@/models';
import {
  CatalogueValidationError,
  CRITERIA_KEYS,
  DEFAULT_CRITERIA,
  FATIGUE_WEIGHTS,
  STIMULUS_WEIGHTS,
  EXERCISE_CATALOGUE,
  criteriaOf,
  fatigueCost,
  isTopTierStimulus,
  stimulusQuality,
  exercisesForMuscle,
  filterCatalogue,
  parseCatalogue,
  parseExercise,
} from '@/services/training/exerciseCatalogue';

/** Entrada cruda válida, para mutar un campo por test. */
function rawExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'press-banca',
    name: 'Press de banca',
    primaryMuscle: 'CHEST',
    secondaryMuscles: ['TRICEPS'],
    movementVector: 'PUSH_HORIZONTAL',
    profile: 'COMPOUND_PRIMARY',
    equipment: 'BARBELL',
    // Deliberately different from DEFAULT_CRITERIA so a test can tell the audited
    // values apart from the fallback.
    criteria: {
      stretchedPositionLoading: 4,
      rangeOfMotion: 4,
      resistanceProfileMatch: 2,
      stabilityCost: 4,
      loadProgressability: 5,
      systemicFatigueCost: 1,
    },
    ...overrides,
  };
}

describe('parseExercise', () => {
  it('convierte una entrada válida', () => {
    const exercise = parseExercise(rawExercise());
    expect(exercise).toEqual({
      id: 'press-banca',
      name: 'Press de banca',
      primaryMuscle: MuscleGroup.CHEST,
      secondaryMuscles: [MuscleGroup.TRICEPS],
      movementVector: MovementVector.PUSH_HORIZONTAL,
      profile: ExerciseProfile.COMPOUND_PRIMARY,
      equipment: Equipment.BARBELL,
      generationTier: ExerciseGenerationTier.STANDARD,
      criteria: {
        stretchedPositionLoading: 4,
        rangeOfMotion: 4,
        resistanceProfileMatch: 2,
        stabilityCost: 4,
        loadProgressability: 5,
        systemicFatigueCost: 1,
      },
      isCustom: false,
    });
  });

  it.each([
    ['primaryMuscle', 'PECTORAL'],
    ['movementVector', 'EMPUJE'],
    ['profile', 'COMPUESTO'],
    ['equipment', 'BARRA'],
    ['generationTier', 'PREFERRED'],
  ])('rechaza un %s desconocido', (field, value) => {
    expect(() => parseExercise(rawExercise({ [field]: value }))).toThrow(CatalogueValidationError);
  });

  it('accepts validated stimulus tags and rejects malformed or duplicate tags', () => {
    expect(
      parseExercise(rawExercise({ stimulusTags: ['SHOULDER:EXTENDED', 'GRIP:SUPINATED'] }))
        .stimulusTags,
    ).toEqual(['SHOULDER:EXTENDED', 'GRIP:SUPINATED']);
    expect(() => parseExercise(rawExercise({ stimulusTags: 'SHOULDER:EXTENDED' }))).toThrow(
      CatalogueValidationError,
    );
    expect(() => parseExercise(rawExercise({ stimulusTags: ['not-valid'] }))).toThrow(
      CatalogueValidationError,
    );
    expect(() =>
      parseExercise(rawExercise({ stimulusTags: ['GRIP:NEUTRAL', 'GRIP:NEUTRAL'] })),
    ).toThrow(CatalogueValidationError);
  });

  it('rechaza una entrada que no es un objeto', () => {
    expect(() => parseExercise('press de banca')).toThrow(CatalogueValidationError);
    expect(() => parseExercise(null)).toThrow(CatalogueValidationError);
  });

  it.each([[undefined], [''], [42]])('rechaza un id inválido (%p)', (id) => {
    expect(() => parseExercise(rawExercise({ id }))).toThrow(CatalogueValidationError);
  });

  it.each([[undefined], [''], [7]])('rechaza un nombre inválido (%p)', (name) => {
    expect(() => parseExercise(rawExercise({ name }))).toThrow(CatalogueValidationError);
  });

  it('rechaza secondaryMuscles que no sea un array', () => {
    expect(() => parseExercise(rawExercise({ secondaryMuscles: 'TRICEPS' }))).toThrow(
      CatalogueValidationError,
    );
  });

  it('rechaza un secundario desconocido', () => {
    expect(() => parseExercise(rawExercise({ secondaryMuscles: ['TRICEPITO'] }))).toThrow(
      CatalogueValidationError,
    );
  });

  it('RECHAZA que el principal aparezca también como secundario', () => {
    // Acreditaría 1,5 series por serie ejecutada, inflando el volumen en silencio.
    expect(() =>
      parseExercise(rawExercise({ secondaryMuscles: ['CHEST'] })),
    ).toThrow(CatalogueValidationError);
  });

  it.each(CRITERIA_KEYS)('rejects an out-of-range %s', (key) => {
    expect(() =>
      parseExercise(rawExercise({ criteria: { ...rawExercise().criteria as object, [key]: 6 } })),
    ).toThrow(CatalogueValidationError);
  });

  it.each(CRITERIA_KEYS)('rejects a missing %s', (key) => {
    const criteria = { ...(rawExercise().criteria as Record<string, unknown>) };
    delete criteria[key];
    expect(() => parseExercise(rawExercise({ criteria }))).toThrow(CatalogueValidationError);
  });

  it.each([[0], [6], [3.5], ['4'], [null]])('rejects a non-integer score (%p)', (score) => {
    expect(() =>
      parseExercise(
        rawExercise({
          criteria: { ...(rawExercise().criteria as object), stretchedPositionLoading: score },
        }),
      ),
    ).toThrow(CatalogueValidationError);
  });

  it.each([[undefined], ['good'], [null], [42]])('rejects invalid criteria (%p)', (criteria) => {
    expect(() => parseExercise(rawExercise({ criteria }))).toThrow(CatalogueValidationError);
  });

  it('el mensaje de error nombra el ejercicio y el campo', () => {
    try {
      parseExercise(rawExercise({ primaryMuscle: 'PECTORAL' }));
      throw new Error('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogueValidationError);
      const validationError = error as CatalogueValidationError;
      expect(validationError.exerciseId).toBe('press-banca');
      expect(validationError.field).toBe('primaryMuscle');
      expect(validationError.message).toContain('press-banca');
      expect(validationError.message).toContain('primaryMuscle');
    }
  });
});

describe('parseCatalogue', () => {
  it('rechaza un catálogo sin array de ejercicios', () => {
    expect(() => parseCatalogue({})).toThrow('"exercises" array');
    expect(() => parseCatalogue(null)).toThrow('"exercises" array');
  });

  it('acepta un catálogo vacío', () => {
    expect(parseCatalogue({ exercises: [] })).toEqual([]);
  });

  it('RECHAZA ids duplicados', () => {
    expect(() => parseCatalogue({ exercises: [rawExercise(), rawExercise()] })).toThrow(
      CatalogueValidationError,
    );
  });
});

describe('EXERCISE_CATALOGUE', () => {
  it('el catálogo real carga y valida', () => {
    expect(EXERCISE_CATALOGUE.length).toBeGreaterThan(50);
  });

  it('all automatic entries carry criteria; explicitly unscored entries remain manual-only', () => {
    EXERCISE_CATALOGUE.forEach((exercise) => {
      if (!exercise.criteria) {
        expect(exercise.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
        expect(() => criteriaOf(exercise)).toThrow('no scoring rubric');
        return;
      }
      expect(exercise.criteria).toBeDefined();
      CRITERIA_KEYS.forEach((key) => {
        expect(exercise.criteria?.[key]).toBeGreaterThanOrEqual(1);
        expect(exercise.criteria?.[key]).toBeLessThanOrEqual(5);
      });
    });
  });

  it('classifies the upright row as shoulder abduction, not a vertical pull', () => {
    // It does not train the lats, and as a vertical pull it satisfied the
    // foundational-pattern floor on its own.
    expect(EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'remo-al-menton')?.movementVector).toBe(
      MovementVector.SHOULDER_ABDUCTION,
    );
  });

  it('holds the strength variants the program prescribes, tagged as such', () => {
    ['sentadilla-pausa', 'press-banca-pausa', 'peso-muerto-deficit', 'peso-muerto-bloques'].forEach((id) => {
      expect(EXERCISE_CATALOGUE.find((exercise) => exercise.id === id)?.generationTier).toBe(
        ExerciseGenerationTier.STRENGTH_VARIANT,
      );
    });
  });

  it('does NOT credit hamstrings on the back squat', () => {
    // Lombard's paradox: the biarticular hamstrings contract almost isometrically
    // during a squat, so they take no stretch stimulus and do not hypertrophy.
    // Crediting them inflated hamstring attributed volume.
    const squat = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'sentadilla-libre');
    expect(squat).toBeDefined();
    expect(squat?.secondaryMuscles).not.toContain(MuscleGroup.HAMSTRINGS);
  });

  it('cada grupo muscular tiene al menos un ejercicio como principal', () => {
    Object.values(MuscleGroup).forEach((muscle) => {
      expect(exercisesForMuscle(EXERCISE_CATALOGUE, muscle).length).toBeGreaterThan(0);
    });
  });

  it('ningún ejercicio del catálogo es personalizado', () => {
    EXERCISE_CATALOGUE.forEach((exercise) => {
      expect(exercise.isCustom).toBe(false);
    });
  });
});

it('adds distinct JM and Kaz implements without invented ratings or collateral muscle credit', () => {
  const jm = EXERCISE_CATALOGUE.find((e) => e.id === 'guide-211')!;
  const kaz = EXERCISE_CATALOGUE.find((e) => e.id === 'guide-210')!;
  expect(jm.equipment).toBe(Equipment.BARBELL);
  expect(kaz.equipment).toBe(Equipment.SMITH_MACHINE);
  for (const exercise of [jm, kaz]) {
    expect(exercise.primaryMuscle).toBe(MuscleGroup.TRICEPS);
    expect(exercise.movementVector).toBe(MovementVector.ELBOW_EXTENSION);
    expect(exercise.criteria).toBeUndefined();
    expect(exercise.secondaryMuscles).toEqual([]);
    expect(exercise.generationTier).toBe(ExerciseGenerationTier.MANUAL_ONLY);
    expect(fatigueCost(exercise)).toBe(5);
    expect(() => stimulusQuality(exercise)).toThrow('no scoring rubric');
  }
});

describe('criteriaOf', () => {
  it('returns the audited criteria when present', () => {
    expect(criteriaOf(parseExercise(rawExercise()))).not.toEqual(DEFAULT_CRITERIA);
    expect(criteriaOf(parseExercise(rawExercise())).stretchedPositionLoading).toBe(4);
    expect(criteriaOf(parseExercise(rawExercise())).systemicFatigueCost).toBe(1);
  });

  it('falls back to a NEUTRAL profile for a user-created exercise', () => {
    // Neither assumed good nor bad: there is no audit for it.
    const custom: Exercise = {
      id: 'my-exercise',
      name: 'My exercise',
      primaryMuscle: MuscleGroup.BICEPS,
      secondaryMuscles: [],
      movementVector: MovementVector.ELBOW_FLEXION,
      profile: ExerciseProfile.ISOLATION,
      equipment: Equipment.DUMBBELL,
      isCustom: true,
    };
    expect(criteriaOf(custom)).toEqual(DEFAULT_CRITERIA);
    expect(new Set(Object.values(DEFAULT_CRITERIA)).size).toBe(1);
  });
});

describe('stimulusQuality', () => {
  function withCriteria(overrides: Partial<Record<string, number>>) {
    return parseExercise(
      rawExercise({ criteria: { ...DEFAULT_CRITERIA, ...overrides } }),
    );
  }

  it('stays on the 1-5 scale of the criteria it comes from', () => {
    EXERCISE_CATALOGUE.filter(
      (exercise) => exercise.generationTier !== ExerciseGenerationTier.MANUAL_ONLY,
    ).forEach((exercise) => {
      expect(stimulusQuality(exercise)).toBeGreaterThanOrEqual(1);
      expect(stimulusQuality(exercise)).toBeLessThanOrEqual(5);
    });
    expect(stimulusQuality(withCriteria({}))).toBeCloseTo(3, 5);
  });

  it('weights STRETCHED-POSITION loading above everything else', () => {
    // Stretch-mediated hypertrophy is the strongest mechanical driver.
    const stretch = stimulusQuality(withCriteria({ stretchedPositionLoading: 5 }));
    const rom = stimulusQuality(withCriteria({ rangeOfMotion: 5 }));
    const progression = stimulusQuality(withCriteria({ loadProgressability: 5 }));
    expect(stretch).toBeGreaterThan(rom);
    expect(rom).toBeGreaterThan(progression);
  });

  it('IGNORES systemic fatigue: a cost is not a stimulus', () => {
    expect(stimulusQuality(withCriteria({ systemicFatigueCost: 1 }))).toBe(
      stimulusQuality(withCriteria({ systemicFatigueCost: 5 })),
    );
  });

  it('ranks the seated leg curl above the dumbbell fly', () => {
    // Both target a muscle at length, but the fly's resistance vanishes at the top.
    const find = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
    expect(stimulusQuality(find('curl-femoral-sentado'))).toBeGreaterThan(
      stimulusQuality(find('aperturas-mancuernas')),
    );
  });

  it('ranks the STANDING calf raise above the seated one', () => {
    // The audit measured 12.4% vs 1.7% gastrocnemius hypertrophy. The hand-assigned
    // score had this backwards.
    const find = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
    expect(stimulusQuality(find('gemelos-de-pie'))).toBeGreaterThan(
      stimulusQuality(find('gemelos-sentado')),
    );
  });
});

describe('fatigueCost', () => {
  function withCriteria(overrides: Partial<Record<string, number>>) {
    return parseExercise(rawExercise({ criteria: { ...DEFAULT_CRITERIA, ...overrides } }));
  }

  it('INVERTS the criteria: a low fatigue score means an expensive exercise', () => {
    expect(fatigueCost(withCriteria({ systemicFatigueCost: 1 }))).toBeGreaterThan(
      fatigueCost(withCriteria({ systemicFatigueCost: 5 })),
    );
  });

  it('weights systemic fatigue above stability', () => {
    expect(fatigueCost(withCriteria({ systemicFatigueCost: 1 }))).toBeGreaterThan(
      fatigueCost(withCriteria({ stabilityCost: 1 })),
    );
  });

  it('separates two exercises that share a PROFILE but not a cost', () => {
    // The reason one effectiveness score could not work. Both are
    // COMPOUND_PRIMARY, yet the audit scores the barbell squat's systemic fatigue
    // at 1 and the dumbbell bench press at 4.
    const find = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
    const squat = find('sentadilla-libre');
    const dumbbellPress = find('press-banca-mancuernas');
    expect(squat.profile).toBe(dumbbellPress.profile);
    expect(fatigueCost(squat)).toBeGreaterThan(fatigueCost(dumbbellPress));
  });

  it('costs the free squat more than the hack squat', () => {
    // Guided work is where the audit says to send volume when recovery is the
    // constraint, and this is the number that makes the engine do it.
    const find = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
    expect(fatigueCost(find('sentadilla-libre'))).toBeGreaterThan(
      fatigueCost(find('sentadilla-hack')),
    );
  });
});

describe('isTopTierStimulus', () => {
  it("applies the audit's own rule: 4 or more on stretch AND resistance profile", () => {
    const find = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
    expect(isTopTierStimulus(find('curl-femoral-sentado'))).toBe(true);
    expect(isTopTierStimulus(find('extension-sobre-cabeza-polea'))).toBe(true);
    expect(isTopTierStimulus(find('aperturas-mancuernas'))).toBe(false);
    expect(isTopTierStimulus(find('hip-thrust'))).toBe(false);
  });
});

describe('filterCatalogue', () => {
  it('sin filtros devuelve el catálogo completo', () => {
    expect(filterCatalogue(EXERCISE_CATALOGUE, {})).toHaveLength(EXERCISE_CATALOGUE.length);
  });

  it('EXCLUYE los ejercicios vetados', () => {
    const victim = EXERCISE_CATALOGUE[0];
    const filtered = filterCatalogue(EXERCISE_CATALOGUE, { vetoedExerciseIds: [victim.id] });
    expect(filtered).toHaveLength(EXERCISE_CATALOGUE.length - 1);
    expect(filtered.some((e) => e.id === victim.id)).toBe(false);
  });

  it('deja solo el material disponible', () => {
    const filtered = filterCatalogue(EXERCISE_CATALOGUE, {
      availableEquipment: [Equipment.BODYWEIGHT],
    });
    expect(filtered.length).toBeGreaterThan(0);
    filtered.forEach((e) => {
      expect(
        e.equipment === Equipment.BODYWEIGHT ||
          (e.generationTier === ExerciseGenerationTier.MANUAL_ONLY && e.equipment === Equipment.UNSPECIFIED),
      ).toBe(true);
    });
  });

  it('combina material y vetos', () => {
    const bodyweight = filterCatalogue(EXERCISE_CATALOGUE, {
      availableEquipment: [Equipment.BODYWEIGHT],
    });
    const filtered = filterCatalogue(EXERCISE_CATALOGUE, {
      availableEquipment: [Equipment.BODYWEIGHT],
      vetoedExerciseIds: [bodyweight[0].id],
    });
    expect(filtered).toHaveLength(bodyweight.length - 1);
  });
});

describe('exercisesForMuscle', () => {
  it('filtra por músculo PRINCIPAL, no por secundario', () => {
    const triceps = exercisesForMuscle(EXERCISE_CATALOGUE, MuscleGroup.TRICEPS);
    triceps.forEach((e) => expect(e.primaryMuscle).toBe(MuscleGroup.TRICEPS));
    // El press de banca tiene el tríceps como secundario y no debe aparecer.
    expect(triceps.some((e) => e.id === 'press-banca')).toBe(false);
  });
});

describe('fatigue never influences selection', () => {
  it('assigns each criterion to exactly ONE derived quantity', () => {
    // No criterion feeds both stimulus and fatigue. Counting stability in both
    // double-counted it and let cost decide selection, which penalised free
    // weights: a back squat scores 2 on stability and a hack squat 5.
    const inStimulus = CRITERIA_KEYS.filter((key) => STIMULUS_WEIGHTS[key] > 0);
    expect(inStimulus).not.toContain('stabilityCost');
    expect(inStimulus).not.toContain('systemicFatigueCost');
    expect(inStimulus).toHaveLength(4);
  });

  it('weights sum to 1, so the score stays on the criteria scale', () => {
    const total = CRITERIA_KEYS.reduce((sum, key) => sum + STIMULUS_WEIGHTS[key], 0);
    expect(total).toBeCloseTo(1, 5);
    expect(FATIGUE_WEIGHTS.systemic + FATIGUE_WEIGHTS.stability).toBeCloseTo(1, 5);
  });

  it('two exercises differing ONLY in cost score the same stimulus', () => {
    const cheap = parseExercise(
      rawExercise({ criteria: { ...DEFAULT_CRITERIA, systemicFatigueCost: 5, stabilityCost: 5 } }),
    );
    const expensive = parseExercise(
      rawExercise({ criteria: { ...DEFAULT_CRITERIA, systemicFatigueCost: 1, stabilityCost: 1 } }),
    );
    expect(stimulusQuality(cheap)).toBe(stimulusQuality(expensive));
    expect(fatigueCost(expensive)).toBeGreaterThan(fatigueCost(cheap));
  });

  it('no longer penalises the barbell squat for being expensive', () => {
    // The failure the athlete named: always inserting quad extensions because they
    // are cheaper. With cost removed from the score the squat is not suppressed,
    // and the counterfactual shows what cost was doing: counting stability would put
    // the squat below the machine on a hypertrophy score, which is not a
    // hypertrophy claim at all.
    const find = (id: string) => EXERCISE_CATALOGUE.find((e) => e.id === id)!;
    const squat = find('sentadilla-libre');
    const extension = find('extension-cuadriceps');
    expect(stimulusQuality(squat)).toBeGreaterThan(stimulusQuality(extension));

    const withStability = (id: string) => {
      const criteria = EXERCISE_CATALOGUE.find((e) => e.id === id)!.criteria!;
      return stimulusQuality(find(id)) * 0.9 + criteria.stabilityCost * 0.1;
    };
    expect(withStability('sentadilla-libre')).toBeLessThan(withStability('extension-cuadriceps'));

    // And the squat pattern appears regardless, because the floor guarantees it.
    expect(fatigueCost(squat)).toBeGreaterThan(fatigueCost(extension));
  });
});
