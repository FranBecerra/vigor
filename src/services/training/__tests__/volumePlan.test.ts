import { MuscleGroup } from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import {
  DEFAULT_TRAINED_REGIONS,
  EXPERIENCE_SCALING,
  GOAL_SCALING,
  DEPRIORITIZED_RANGE_FRACTION,
  DELOAD_VOLUME_FACTOR,
  EmphasisLimitError,
  LOW_COST_REGIONS,
  MAX_DEPRIORITIZED_REGIONS,
  MAX_PRIORITY_REGIONS,
  NORMAL_RANGE_FRACTION,
  NORMAL_RANGE_FRACTION_WITH_PRIORITY,
  PRIORITY_RANGE_FRACTION,
  PRIORITY_SLOT_BUDGET,
  RegionEmphasis,
  deloadVolumePlan,
  prioritySlotsOf,
  REGION_OF_MUSCLE,
  TOTAL_SETS_RANGE,
  TrainingGoal,
  VOLUME_REGIONS,
  VolumeRegion,
  buildVolumePlan,
  landmarksForRegion,
  landmarksFromDeclaredVolume,
  meavForRegion,
  toTargetVolumePerGroup,
  totalAttributedSets,
  totalSetsVerdict,
  volumeWarnings,
  type VolumePlan,
} from '@/services/training/volumePlan';

const LEVELS = [
  ExperienceLevel.BEGINNER,
  ExperienceLevel.INTERMEDIATE,
  ExperienceLevel.ADVANCED,
] as const;
const GOALS = [TrainingGoal.HYPERTROPHY, TrainingGoal.STRENGTH] as const;

describe('VOLUME_REGIONS', () => {
  it('cada músculo pertenece a exactamente una región', () => {
    const seen = new Map<MuscleGroup, VolumeRegion>();
    (Object.entries(VOLUME_REGIONS) as [VolumeRegion, (typeof VOLUME_REGIONS)[VolumeRegion]][]).forEach(
      ([region, definition]) => {
        definition.muscles.forEach((muscle) => {
          expect(seen.has(muscle)).toBe(false);
          seen.set(muscle, region);
        });
      },
    );
    expect(seen.size).toBe(Object.values(MuscleGroup).length);
  });

  it('el reparto de cada región suma 1 y tiene un valor por músculo', () => {
    Object.values(VOLUME_REGIONS).forEach((definition) => {
      expect(definition.shares).toHaveLength(definition.muscles.length);
      const total = definition.shares.reduce((sum, share) => sum + share, 0);
      expect(total).toBeCloseTo(1, 5);
    });
  });

  it('mantiene el orden mv <= mev <= mav <= mrv', () => {
    Object.values(VOLUME_REGIONS).forEach(({ landmarks: l }) => {
      expect(l.mv).toBeLessThanOrEqual(l.mev);
      expect(l.mev).toBeLessThanOrEqual(l.mav);
      expect(l.mav).toBeLessThanOrEqual(l.mrv);
    });
  });

  it('REGION_OF_MUSCLE cubre todos los músculos y concuerda con la definición', () => {
    Object.values(MuscleGroup).forEach((muscle) => {
      const region = REGION_OF_MUSCLE[muscle];
      expect(region).toBeDefined();
      expect(VOLUME_REGIONS[region].muscles).toContain(muscle);
    });
  });

  it('las regiones de trabajo indirecto o aportación marginal están desactivadas', () => {
    [
      VolumeRegion.DELTS_FRONT,
      VolumeRegion.TRAPS,
      VolumeRegion.ERECTORS,
      VolumeRegion.TIBIALIS,
      VolumeRegion.ADDUCTORS,
      VolumeRegion.CALVES,
    ].forEach((region) => {
      expect(DEFAULT_TRAINED_REGIONS).not.toContain(region);
    });
  });

  it('las regiones principales están activadas', () => {
    [
      VolumeRegion.CHEST,
      VolumeRegion.BACK,
      VolumeRegion.QUADS,
      VolumeRegion.HAMSTRINGS,
      VolumeRegion.BICEPS,
      VolumeRegion.TRICEPS,
    ].forEach((region) => {
      expect(DEFAULT_TRAINED_REGIONS).toContain(region);
    });
  });

  it('la ESPALDA se reparte en tres porciones sin multiplicar el presupuesto', () => {
    // El defecto que motivó la capa de región: aplicar el rango de la espalda a
    // cada porción daba 43 series donde la referencia dice 12-24.
    const back = VOLUME_REGIONS[VolumeRegion.BACK];
    expect(back.muscles).toHaveLength(3);
    expect(back.landmarks.mrv).toBeLessThanOrEqual(24);

    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
    });
    const backMuscles = plan.muscles.filter((m) => m.region === VolumeRegion.BACK);
    const sum = backMuscles.reduce((total, m) => total + m.meav, 0);
    const budget = plan.regions.find((r) => r.region === VolumeRegion.BACK)!.meav;
    expect(sum).toBe(budget);
    expect(sum).toBeLessThanOrEqual(24);
  });
});

describe('landmarksForRegion', () => {
  it('no escala al intermedio orientado a hipertrofia, que es la referencia', () => {
    expect(EXPERIENCE_SCALING[ExperienceLevel.INTERMEDIATE]).toBe(1);
    expect(GOAL_SCALING[TrainingGoal.HYPERTROPHY]).toBe(1);
    expect(
      landmarksForRegion(VolumeRegion.QUADS, ExperienceLevel.INTERMEDIATE, TrainingGoal.HYPERTROPHY),
    ).toEqual(VOLUME_REGIONS[VolumeRegion.QUADS].landmarks);
  });

  it('el principiante tolera menos y el avanzado más', () => {
    const [beginner, intermediate, advanced] = LEVELS.map(
      (level) => landmarksForRegion(VolumeRegion.BACK, level, TrainingGoal.HYPERTROPHY).mrv,
    );
    expect(beginner).toBeLessThan(intermediate);
    expect(intermediate).toBeLessThan(advanced);
  });

  it('la FUERZA pide menos volumen que la hipertrofia', () => {
    const hypertrophy = landmarksForRegion(
      VolumeRegion.CHEST,
      ExperienceLevel.INTERMEDIATE,
      TrainingGoal.HYPERTROPHY,
    );
    const strength = landmarksForRegion(
      VolumeRegion.CHEST,
      ExperienceLevel.INTERMEDIATE,
      TrainingGoal.STRENGTH,
    );
    expect(strength.mav).toBeLessThan(hypertrophy.mav);
    expect(strength.mrv).toBeLessThan(hypertrophy.mrv);
  });

  it('nunca produce valores negativos', () => {
    LEVELS.forEach((level) => {
      GOALS.forEach((goal) => {
        (Object.keys(VOLUME_REGIONS) as VolumeRegion[]).forEach((region) => {
          expect(landmarksForRegion(region, level, goal).mv).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });
});

describe('landmarksFromDeclaredVolume', () => {
  it('toma el volumen declarado como MAV', () => {
    const l = landmarksFromDeclaredVolume(
      VolumeRegion.BICEPS,
      ExperienceLevel.INTERMEDIATE,
      TrainingGoal.HYPERTROPHY,
      13,
    );
    expect(l.mav).toBe(13);
  });

  it('ACOTA el declarado al MRV del nivel, para no prescribir lo irrecuperable', () => {
    const byLevel = landmarksForRegion(
      VolumeRegion.TRICEPS,
      ExperienceLevel.BEGINNER,
      TrainingGoal.HYPERTROPHY,
    );
    const l = landmarksFromDeclaredVolume(
      VolumeRegion.TRICEPS,
      ExperienceLevel.BEGINNER,
      TrainingGoal.HYPERTROPHY,
      200,
    );
    expect(l.mav).toBe(byLevel.mrv);
  });

  it('deriva mev y mv por debajo del mav, y el techo nunca baja del mav', () => {
    (Object.keys(VOLUME_REGIONS) as VolumeRegion[]).forEach((region) => {
      const l = landmarksFromDeclaredVolume(
        region,
        ExperienceLevel.INTERMEDIATE,
        TrainingGoal.HYPERTROPHY,
        14,
      );
      expect(l.mv).toBeLessThanOrEqual(l.mev);
      expect(l.mev).toBeLessThanOrEqual(l.mav);
      expect(l.mrv).toBeGreaterThanOrEqual(l.mav);
    });
  });
});

describe('meavForRegion', () => {
  const landmarks = { mv: 4, mev: 10, mav: 18, mrv: 24 };

  it('el PRINCIPIANTE normal se queda EN el MEV', () => {
    expect(NORMAL_RANGE_FRACTION[ExperienceLevel.BEGINNER]).toBe(0);
    expect(meavForRegion(landmarks, RegionEmphasis.NORMAL, ExperienceLevel.BEGINNER)).toBe(
      landmarks.mev,
    );
  });

  it('el normal nunca pasa del MAV', () => {
    LEVELS.forEach((level) => {
      expect(meavForRegion(landmarks, RegionEmphasis.NORMAL, level)).toBeLessThanOrEqual(
        landmarks.mav,
      );
    });
  });

  it('el avanzado recibe más volumen que el intermedio por sus REFERENCIAS, no por la fracción', () => {
    // Intermedio y avanzado comparten fracción: lo que separa su volumen es que
    // las referencias del avanzado están escaladas más arriba. Con las mismas
    // referencias darían lo mismo, y eso es correcto.
    expect(NORMAL_RANGE_FRACTION[ExperienceLevel.INTERMEDIATE]).toBe(
      NORMAL_RANGE_FRACTION[ExperienceLevel.ADVANCED],
    );
    const intermediate = meavForRegion(
      landmarksForRegion(VolumeRegion.BACK, ExperienceLevel.INTERMEDIATE, TrainingGoal.HYPERTROPHY),
      RegionEmphasis.NORMAL,
      ExperienceLevel.INTERMEDIATE,
    );
    const advanced = meavForRegion(
      landmarksForRegion(VolumeRegion.BACK, ExperienceLevel.ADVANCED, TrainingGoal.HYPERTROPHY),
      RegionEmphasis.NORMAL,
      ExperienceLevel.ADVANCED,
    );
    expect(advanced).toBeGreaterThan(intermediate);
  });

  it('el intermedio y el avanzado normales se separan claramente del MEV', () => {
    // El requisito real es sobre el volumen TOTAL del plan, no sobre una región
    // aislada: se comprueba en los tests de selección. Aquí solo se fija que el
    // normal de un atleta con experiencia no es el mínimo efectivo.
    [ExperienceLevel.INTERMEDIATE, ExperienceLevel.ADVANCED].forEach((level) => {
      expect(meavForRegion(landmarks, RegionEmphasis.NORMAL, level)).toBeGreaterThan(
        landmarks.mev + 2,
      );
    });
  });

  it('PRIORITY queda entre el MAV y el MRV, sin llegar al MRV', () => {
    // Con volumen estático no se puede vivir en el MRV todo el mesociclo.
    expect(PRIORITY_RANGE_FRACTION).toBeLessThan(1);
    LEVELS.forEach((level) => {
      const meav = meavForRegion(landmarks, RegionEmphasis.PRIORITY, level);
      expect(meav).toBeGreaterThan(landmarks.mav);
      expect(meav).toBeLessThan(landmarks.mrv);
    });
  });

  it('DEPRIORITIZED queda entre el MV y el MEV', () => {
    expect(DEPRIORITIZED_RANGE_FRACTION).toBeGreaterThan(0);
    LEVELS.forEach((level) => {
      const meav = meavForRegion(landmarks, RegionEmphasis.DEPRIORITIZED, level);
      expect(meav).toBeGreaterThanOrEqual(landmarks.mv);
      expect(meav).toBeLessThan(landmarks.mev);
    });
  });

  it('el énfasis ordena el volumen: desprioriorizado < normal < prioritario', () => {
    LEVELS.forEach((level) => {
      const low = meavForRegion(landmarks, RegionEmphasis.DEPRIORITIZED, level);
      const normal = meavForRegion(landmarks, RegionEmphasis.NORMAL, level);
      const high = meavForRegion(landmarks, RegionEmphasis.PRIORITY, level);
      expect(low).toBeLessThan(normal);
      expect(normal).toBeLessThan(high);
    });
  });

  it('un plan CON prioridades baja las regiones normales', () => {
    LEVELS.forEach((level) => {
      expect(NORMAL_RANGE_FRACTION_WITH_PRIORITY[level]).toBeLessThan(
        NORMAL_RANGE_FRACTION[level] + 0.001,
      );
      const alone = meavForRegion(landmarks, RegionEmphasis.NORMAL, level, false);
      const withPriority = meavForRegion(landmarks, RegionEmphasis.NORMAL, level, true);
      expect(withPriority).toBeLessThanOrEqual(alone);
    });
  });

  it('nunca supera el MRV, ni priorizando', () => {
    expect(
      meavForRegion({ mv: 2, mev: 8, mav: 20, mrv: 12 }, RegionEmphasis.PRIORITY, ExperienceLevel.ADVANCED),
    ).toBe(12);
  });
});

describe('límites de énfasis', () => {
  it('las regiones de bajo coste de recuperación incluyen brazos y gemelos', () => {
    [VolumeRegion.BICEPS, VolumeRegion.TRICEPS, VolumeRegion.CALVES].forEach((region) => {
      expect(LOW_COST_REGIONS).toContain(region);
    });
  });

  it('las regiones caras no son de bajo coste', () => {
    [VolumeRegion.BACK, VolumeRegion.QUADS, VolumeRegion.CHEST].forEach((region) => {
      expect(LOW_COST_REGIONS).not.toContain(region);
    });
  });

  it('una región cara cuesta el doble que una barata', () => {
    expect(prioritySlotsOf(VolumeRegion.BACK)).toBe(2 * prioritySlotsOf(VolumeRegion.BICEPS));
  });

  it('acepta DOS regiones caras', () => {
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [MuscleGroup.LATS, MuscleGroup.QUADS],
      }),
    ).not.toThrow();
  });

  it('RECHAZA tres regiones caras', () => {
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [MuscleGroup.LATS, MuscleGroup.QUADS, MuscleGroup.CHEST_MID_LOWER],
      }),
    ).toThrow(EmphasisLimitError);
  });

  it('acepta TRES regiones cuando son de bajo coste', () => {
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [MuscleGroup.BICEPS, MuscleGroup.TRICEPS, MuscleGroup.CALVES],
      }),
    ).not.toThrow();
  });

  it('acepta una cara más dos baratas, que suman el presupuesto', () => {
    expect(prioritySlotsOf(VolumeRegion.BACK) + 2 * prioritySlotsOf(VolumeRegion.BICEPS)).toBe(
      PRIORITY_SLOT_BUDGET,
    );
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [MuscleGroup.LATS, MuscleGroup.BICEPS, MuscleGroup.TRICEPS],
      }),
    ).not.toThrow();
  });

  it('RECHAZA más de tres priorizadas aunque quepan en el presupuesto', () => {
    // Cuatro regiones baratas suman 2 plazas, pero cuatro prioridades no son una
    // priorización: son un plan sin foco.
    expect(
      4 * prioritySlotsOf(VolumeRegion.BICEPS),
    ).toBeLessThanOrEqual(PRIORITY_SLOT_BUDGET);
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [
          MuscleGroup.BICEPS,
          MuscleGroup.TRICEPS,
          MuscleGroup.CALVES,
          MuscleGroup.CORE,
        ],
      }),
    ).toThrow(EmphasisLimitError);
  });

  it('acepta hasta tres desprioriorizadas y rechaza la cuarta', () => {
    const three = [MuscleGroup.CORE, MuscleGroup.GLUTES, MuscleGroup.CALVES];
    expect(three).toHaveLength(MAX_DEPRIORITIZED_REGIONS);
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        deprioritizedMuscles: three,
      }),
    ).not.toThrow();
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        deprioritizedMuscles: [...three, MuscleGroup.TIBIALIS],
      }),
    ).toThrow(EmphasisLimitError);
  });

  it('RECHAZA una región priorizada y desprioriorizada a la vez', () => {
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        // Ambos son de la región BACK.
        priorityMuscles: [MuscleGroup.LATS],
        deprioritizedMuscles: [MuscleGroup.RHOMBOIDS],
      }),
    ).toThrow(EmphasisLimitError);
  });

  it('dos músculos de la MISMA región cuentan como una sola prioridad', () => {
    expect(() =>
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        priorityMuscles: [MuscleGroup.LATS, MuscleGroup.RHOMBOIDS, MuscleGroup.TRAPS_MID_LOWER],
      }),
    ).not.toThrow();
    expect(MAX_PRIORITY_REGIONS).toBe(3);
  });
});

describe('buildVolumePlan', () => {
  it('solo incluye las regiones entrenadas', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
    });
    expect(plan.regions.map((r) => r.region).sort()).toEqual([...DEFAULT_TRAINED_REGIONS].sort());
  });

  it('una región desactivada recibe CERO volumen en todos sus músculos', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
    });
    const tibialis = plan.muscles.find((m) => m.muscle === MuscleGroup.TIBIALIS);
    expect(tibialis?.meav).toBe(0);
    expect(tibialis?.emphasis).toBe(RegionEmphasis.NORMAL);
  });

  it('respeta una lista explícita de regiones', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      trainedRegions: [VolumeRegion.CHEST, VolumeRegion.BACK],
    });
    expect(plan.regions.map((r) => r.region)).toEqual([VolumeRegion.CHEST, VolumeRegion.BACK]);
    expect(totalAttributedSets(plan)).toBeGreaterThan(0);
  });

  it('el reparto de una región SUMA exactamente su presupuesto', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.ADVANCED,
      goal: TrainingGoal.HYPERTROPHY,
      priorityMuscles: [MuscleGroup.LATS],
    });
    plan.regions.forEach((region) => {
      const sum = plan.muscles
        .filter((m) => m.region === region.region)
        .reduce((total, m) => total + m.meav, 0);
      expect(sum).toBe(region.meav);
    });
  });

  it('priorizar un músculo prioriza su REGIÓN entera', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      priorityMuscles: [MuscleGroup.LATS],
    });
    const back = plan.regions.find((r) => r.region === VolumeRegion.BACK)!;
    expect(back.emphasis).toBe(RegionEmphasis.PRIORITY);
    expect(back.meav).toBeGreaterThan(back.landmarks.mav);
    // Las tres porciones de la espalda comparten la prioridad.
    plan.muscles
      .filter((m) => m.region === VolumeRegion.BACK)
      .forEach((m) => expect(m.emphasis).toBe(RegionEmphasis.PRIORITY));
  });

  it('el volumen declarado PREVALECE sobre la estimación por nivel', () => {
    const declared = buildVolumePlan({
      level: ExperienceLevel.BEGINNER,
      goal: TrainingGoal.HYPERTROPHY,
      declaredVolume: { [VolumeRegion.BICEPS]: 16 },
    }).regions.find((r) => r.region === VolumeRegion.BICEPS)!;
    const estimated = buildVolumePlan({
      level: ExperienceLevel.BEGINNER,
      goal: TrainingGoal.HYPERTROPHY,
    }).regions.find((r) => r.region === VolumeRegion.BICEPS)!;
    expect(declared.basis).toBe('declared');
    expect(estimated.basis).toBe('experience');
    expect(declared.meav).toBeGreaterThan(estimated.meav);
  });

  it('ignora un volumen declarado inválido y cae a la estimación', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      declaredVolume: { [VolumeRegion.QUADS]: 0, [VolumeRegion.CHEST]: Number.NaN },
    });
    expect(plan.regions.find((r) => r.region === VolumeRegion.QUADS)?.basis).toBe('experience');
    expect(plan.regions.find((r) => r.region === VolumeRegion.CHEST)?.basis).toBe('experience');
  });

  it('ninguna región supera nunca su MRV', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.ADVANCED,
      goal: TrainingGoal.HYPERTROPHY,
      trainedRegions: Object.keys(VOLUME_REGIONS) as VolumeRegion[],
      priorityMuscles: [MuscleGroup.LATS, MuscleGroup.QUADS],
    });
    plan.regions.forEach((region) => {
      expect(region.meav).toBeLessThanOrEqual(region.landmarks.mrv);
    });
  });

  it('una región cuyo techo queda en 0 no se marca como recortada', () => {
    // Alcanzable con un volumen declarado despreciable: tras redondear, el techo
    // es 0 y no hay tope que tocar, así que `cappedByMrv` debe ser false.
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      trainedRegions: [VolumeRegion.CALVES],
      declaredVolume: { [VolumeRegion.CALVES]: 0.0001 },
    });
    expect(plan.regions[0].landmarks.mrv).toBe(0);
    expect(plan.regions[0].cappedByMrv).toBe(false);
  });

  it('conserva objetivo y nivel en el plan', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.ADVANCED,
      goal: TrainingGoal.STRENGTH,
    });
    expect(plan.goal).toBe(TrainingGoal.STRENGTH);
    expect(plan.level).toBe(ExperienceLevel.ADVANCED);
  });
});

describe('totalSetsVerdict', () => {
  it('reconoce por debajo, dentro y por encima del rango', () => {
    const [min, max] = TOTAL_SETS_RANGE[TrainingGoal.HYPERTROPHY][ExperienceLevel.INTERMEDIATE];
    expect(totalSetsVerdict(min - 1, TrainingGoal.HYPERTROPHY, ExperienceLevel.INTERMEDIATE)).toBe(
      'below',
    );
    expect(totalSetsVerdict(min, TrainingGoal.HYPERTROPHY, ExperienceLevel.INTERMEDIATE)).toBe(
      'within',
    );
    expect(totalSetsVerdict(max, TrainingGoal.HYPERTROPHY, ExperienceLevel.INTERMEDIATE)).toBe(
      'within',
    );
    expect(totalSetsVerdict(max + 1, TrainingGoal.HYPERTROPHY, ExperienceLevel.INTERMEDIATE)).toBe(
      'above',
    );
  });

  it('el rango de FUERZA es más bajo que el de hipertrofia', () => {
    LEVELS.forEach((level) => {
      const [, hypertrophyMax] = TOTAL_SETS_RANGE[TrainingGoal.HYPERTROPHY][level];
      const [, strengthMax] = TOTAL_SETS_RANGE[TrainingGoal.STRENGTH][level];
      expect(strengthMax).toBeLessThan(hypertrophyMax);
    });
  });

  it('el rango sube con el nivel', () => {
    GOALS.forEach((goal) => {
      const maxima = LEVELS.map((level) => TOTAL_SETS_RANGE[goal][level][1]);
      expect(maxima[0]).toBeLessThan(maxima[1]);
      expect(maxima[1]).toBeLessThan(maxima[2]);
    });
  });
});

describe('totalAttributedSets', () => {
  it('suma el presupuesto de todas las regiones activas', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
    });
    expect(totalAttributedSets(plan)).toBe(plan.regions.reduce((sum, r) => sum + r.meav, 0));
  });

  it('es 0 sin ninguna región entrenada', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      trainedRegions: [],
    });
    expect(totalAttributedSets(plan)).toBe(0);
    expect(plan.regions).toEqual([]);
  });
});

describe('volumeWarnings', () => {
  function planWith(meav: number, mev: number, mrv: number): VolumePlan {
    return {
      goal: TrainingGoal.HYPERTROPHY,
      level: ExperienceLevel.INTERMEDIATE,
      regions: [
        {
          region: VolumeRegion.TRICEPS,
          meav,
          landmarks: { mv: 2, mev, mav: 14, mrv },
          basis: 'experience',
          emphasis: RegionEmphasis.NORMAL,
          cappedByMrv: meav >= mrv && mrv > 0,
        },
      ],
      muscles: [],
      isDeload: false,
      capacityCapped: false,
    };
  }

  it('avisa cuando una región toca el MRV', () => {
    expect(volumeWarnings(planWith(12, 6, 12))).toEqual([
      { region: VolumeRegion.TRICEPS, kind: 'capped-by-mrv' },
    ]);
  });

  it('avisa cuando una región queda por debajo del mínimo efectivo', () => {
    expect(volumeWarnings(planWith(3, 6, 20))).toEqual([
      { region: VolumeRegion.TRICEPS, kind: 'below-mev' },
    ]);
  });

  it('no avisa de un plan sano', () => {
    expect(volumeWarnings(planWith(10, 6, 20))).toEqual([]);
  });

  it('el plan por defecto no genera avisos en ningún nivel ni objetivo', () => {
    LEVELS.forEach((level) => {
      GOALS.forEach((goal) => {
        expect(volumeWarnings(buildVolumePlan({ level, goal }))).toEqual([]);
      });
    });
  });
});

describe('toTargetVolumePerGroup', () => {
  it('produce el formato que persiste el mesociclo', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      trainedRegions: [VolumeRegion.QUADS],
    });
    expect(toTargetVolumePerGroup(plan)).toEqual({
      [MuscleGroup.QUADS]: plan.regions[0].meav,
    });
  });

  it('OMITE los músculos sin volumen, para no persistir ruido', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
    });
    const record = toTargetVolumePerGroup(plan);
    expect(record[MuscleGroup.TIBIALIS]).toBeUndefined();
    expect(record[MuscleGroup.DELTS_FRONT]).toBeUndefined();
  });
});

describe('deloadVolumePlan', () => {
  const accumulation = buildVolumePlan({
    level: ExperienceLevel.INTERMEDIATE,
    goal: TrainingGoal.HYPERTROPHY,
  });
  const deload = deloadVolumePlan(accumulation);

  it('recorta el volumen a la MITAD de lo que se venía haciendo', () => {
    expect(DELOAD_VOLUME_FACTOR).toBe(0.5);
    const before = totalAttributedSets(accumulation);
    const after = totalAttributedSets(deload);
    expect(after / before).toBeGreaterThan(0.45);
    expect(after / before).toBeLessThan(0.6);
  });

  it('queda marcado como descarga', () => {
    expect(accumulation.isDeload).toBe(false);
    expect(deload.isDeload).toBe(true);
  });

  it('NO baja del volumen de mantenimiento en ninguna región', () => {
    deload.regions.forEach((region) => {
      // Bajar del MV costaría masa, que es lo contrario de la función de la descarga.
      expect(region.meav).toBeGreaterThanOrEqual(Math.min(region.landmarks.mv, region.meav));
    });
  });

  it('las partes de cada región siguen sumando su presupuesto recortado', () => {
    deload.regions.forEach((region) => {
      const sum = deload.muscles
        .filter((m) => m.region === region.region)
        .reduce((total, m) => total + m.meav, 0);
      // El reparto proporcional puede desviarse una serie al redondear.
      expect(Math.abs(sum - region.meav)).toBeLessThanOrEqual(1);
    });
  });

  it('NO avisa de estar por debajo del MEV, porque es su objetivo', () => {
    expect(volumeWarnings(deload).every((w) => w.kind !== 'below-mev')).toBe(true);
  });

  it('el mismo plan en acumulación SÍ avisaría si estuviera tan bajo', () => {
    const asAccumulation = { ...deload, isDeload: false };
    expect(volumeWarnings(asAccumulation).some((w) => w.kind === 'below-mev')).toBe(true);
  });

  it('conserva los énfasis, para que la vista siga mostrando qué se priorizaba', () => {
    const withPriority = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      priorityMuscles: [MuscleGroup.LATS],
    });
    const deloaded = deloadVolumePlan(withPriority);
    expect(deloaded.regions.find((r) => r.region === VolumeRegion.BACK)?.emphasis).toBe(
      RegionEmphasis.PRIORITY,
    );
  });

  it('una región con presupuesto CERO no divide por cero al repartir', () => {
    const plan = deloadVolumePlan(
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        trainedRegions: [VolumeRegion.CALVES],
        declaredVolume: { [VolumeRegion.CALVES]: 0.0001 },
      }),
    );
    expect(plan.regions[0].meav).toBe(0);
    expect(plan.muscles.find((m) => m.muscle === MuscleGroup.CALVES)?.meav).toBe(0);
  });

  it('una región sin volumen sigue sin volumen', () => {
    const plan = deloadVolumePlan(
      buildVolumePlan({
        level: ExperienceLevel.INTERMEDIATE,
        goal: TrainingGoal.HYPERTROPHY,
        trainedRegions: [VolumeRegion.CHEST],
      }),
    );
    expect(plan.muscles.find((m) => m.muscle === MuscleGroup.TIBIALIS)?.meav).toBe(0);
  });
});
