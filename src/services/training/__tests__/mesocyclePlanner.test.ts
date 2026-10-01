import { Equipment, ExerciseGenerationTier, ExerciseProfile, MovementVector, MuscleGroup, SplitStructure } from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import {
  EXERCISE_CATALOGUE,
  filterCatalogue,
} from '@/services/training/exerciseCatalogue';
import { DEFAULT_GENERATOR_EQUIPMENT } from '@/services/training/generatorDefaults';
import { planMesocycle } from '@/services/training/mesocyclePlanner';
import { MIN_HYPERTROPHY_SESSION_SETS } from '@/services/training/sessionDistribution';
import {
  MAX_SQUEEZE,
  PROTECTED_REGIONS,
  TrainingGoal,
  VOLUME_REGIONS,
  VolumeRegion,
  buildVolumePlan,
  squeezePlan,
  squeezedMeav,
  totalAttributedSets,
} from '@/services/training/volumePlan';
import type { TrainingCapacity } from '@/services/training/trainingCapacity';

const base = {
  level: ExperienceLevel.INTERMEDIATE,
  goal: TrainingGoal.HYPERTROPHY,
  catalogue: EXERCISE_CATALOGUE,
  seed: 1,
};

it('separates hip-dominant compounds without losing sets in the PPL priority-quad regression', () => {
  const result = planMesocycle({ ...base, seed: 38, split: SplitStructure.PUSH_PULL_LEGS,
    priorityRegions: [VolumeRegion.QUADS], capacity: { sessionsPerMicrocycle: 5, minutesPerSession: 55 } });
  expect(result.selection.performedSets).toBe(70);
  expect(result.distribution.sessions.every((s) => s.exercises.filter((e) =>
    e.exercise.movementVector === MovementVector.HIP_DOMINANT).length <= 1)).toBe(true);
  expect(result.distribution.sessions.every((s) => s.estimatedWorkMinutes <= 49)).toBe(true);
});

it('rejects non-finite inputs explicitly and labels an empty eligible catalogue', () => {
  expect(() => planMesocycle({ ...base, capacity: { sessionsPerMicrocycle: NaN, minutesPerSession: 60 } })).toThrow(RangeError);
  expect(() => planMesocycle({ ...base, capacity: { sessionsPerMicrocycle: 4, minutesPerSession: Infinity } })).toThrow(RangeError);
  expect(() => planMesocycle({ ...base, seed: NaN, capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 } })).toThrow(RangeError);
  expect(planMesocycle({ ...base, catalogue: [], capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 } }).limitedBy).toBe('catalogue');
});

it('retains priority triceps work when a tiny time overflow activates capacity search', () => {
  const totals: number[] = [];
  for (let seed = 123; seed < 133; seed += 1) {
    const result = planMesocycle({ ...base, seed,
      capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 65 },
      priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS],
      deprioritizedRegions: [VolumeRegion.QUADS, VolumeRegion.CHEST] });
    totals.push(result.selection.performedSets);
    expect(result.selection.unmet.some((m) => m.muscle === MuscleGroup.TRICEPS && m.target - m.attributed >= 3)).toBe(false);
    expect(result.distribution.sessions.every((s) => s.estimatedWorkMinutes <= 59)).toBe(true);
  }
  expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(10);
});

it('selects every supported equipment type in the generator default', () => {
  expect(new Set(DEFAULT_GENERATOR_EQUIPMENT)).toEqual(
    new Set(Object.values(Equipment).filter((equipment) => equipment !== Equipment.UNSPECIFIED)),
  );
});

function capacity(sessions: number, minutes: number): TrainingCapacity {
  return { sessionsPerMicrocycle: sessions, minutesPerSession: minutes };
}

const uncapped = buildVolumePlan({
  level: ExperienceLevel.INTERMEDIATE,
  goal: TrainingGoal.HYPERTROPHY,
});

describe('minimum useful session distribution', () => {
  it('moves compatible upper work onto a lower day when four sessions can each hold 12 sets', () => {
    const result = planMesocycle({
      ...base,
      level: ExperienceLevel.BEGINNER,
      seed: 51,
      split: SplitStructure.AUTO,
      capacity: capacity(4, 70),
      priorityRegions: [VolumeRegion.HAMSTRINGS],
    });
    const counts = result.distribution.sessions.map((session) =>
      session.exercises.reduce((sum, entry) => sum + entry.sets, 0));
    expect(counts.every((sets) => sets >= MIN_HYPERTROPHY_SESSION_SETS)).toBe(true);
    expect(result.distribution.sessions.some((session) =>
      session.focus === 'LOWER' && session.exercises.some((entry) =>
        entry.exercise.primaryMuscle === MuscleGroup.CHEST ||
        entry.exercise.primaryMuscle === MuscleGroup.DELTS_REAR))).toBe(true);
    expect(counts.reduce((sum, sets) => sum + sets, 0)).toBe(result.selection.performedSets);
    expect(result.distribution.structureWarnings.some((warning) =>
      warning.kind === 'underfilled-session')).toBe(false);
    expect(result.distribution.sessions.every((session) =>
      session.estimatedWorkMinutes <= result.availableWorkMinutesPerSession)).toBe(true);
  });

  it('uses whole-exercise swaps to resolve an 11/13 split without duplicating a lift', () => {
    const result = planMesocycle({
      ...base,
      level: ExperienceLevel.BEGINNER,
      seed: 8,
      split: SplitStructure.UPPER_LOWER,
      capacity: capacity(4, 55),
    });
    expect(result.distribution.sessions.every((session) =>
      session.exercises.reduce((sum, entry) => sum + entry.sets, 0) >= 12)).toBe(true);
    const ids = result.distribution.sessions.flatMap((session) =>
      session.exercises.map((entry) => entry.exercise.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports rather than inventing sets when five beginner sessions cannot each reach 12', () => {
    const result = planMesocycle({
      ...base,
      level: ExperienceLevel.BEGINNER,
      seed: 74,
      split: SplitStructure.AUTO,
      capacity: capacity(5, 50),
      priorityRegions: [VolumeRegion.GLUTES],
    });
    expect(result.selection.performedSets).toBeLessThan(5 * MIN_HYPERTROPHY_SESSION_SETS);
    expect(result.distribution.structureWarnings.some((warning) =>
      warning.kind === 'underfilled-session')).toBe(true);
    expect(result.distribution.sessions.flatMap((session) => session.exercises)
      .reduce((sum, entry) => sum + entry.sets, 0)).toBe(result.selection.performedSets);
  });

  it('resolves a 12/11/13 full-body split through a valid exchange', () => {
    const result = planMesocycle({
      ...base,
      seed: 6,
      split: SplitStructure.FULL_BODY,
      capacity: capacity(3, 45),
    });
    expect(result.selection.performedSets).toBeGreaterThanOrEqual(36);
    expect(result.distribution.sessions.every((session) =>
      session.exercises.reduce((sum, entry) => sum + entry.sets, 0) >= 12)).toBe(true);
  });

  it('does not impose a hypertrophy set floor on the specific strength plan', () => {
    const result = planMesocycle({
      ...base,
      goal: TrainingGoal.STRENGTH,
      seed: 9,
      capacity: capacity(4, 75),
    });
    expect(result.distribution.structureWarnings.some((warning) =>
      warning.kind === 'underfilled-session')).toBe(false);
  });
});

it('keeps meaningful direct biceps work across sessions when indirect pulls meet the attributed target', () => {
  for (const seed of [1, 2, 3, 8, 13, 21]) {
    const result = planMesocycle({
      ...base, seed, split: SplitStructure.AUTO,
      capacity: capacity(4, 75),
      priorityRegions: [VolumeRegion.BACK, VolumeRegion.TRICEPS],
      deprioritizedRegions: [VolumeRegion.QUADS],
    });
    const direct = result.selection.selected
      .filter((entry) => entry.exercise.primaryMuscle === MuscleGroup.BICEPS);
    expect(direct.reduce((sum, entry) => sum + entry.sets, 0)).toBeGreaterThanOrEqual(6);
    expect(direct).toHaveLength(2);
    expect(result.distribution.frequencyByMuscle[MuscleGroup.BICEPS]).toBeGreaterThanOrEqual(2);
    expect(result.distribution.frequencyByMuscle[MuscleGroup.HAMSTRINGS]).toBeGreaterThanOrEqual(2);
  }
});

describe('squeezedMeav — escalera de dos tramos', () => {
  const protectedRegion = uncapped.regions.find((r) => r.region === VolumeRegion.BACK)!;
  const unprotectedRegion = uncapped.regions.find((r) => r.region === VolumeRegion.BICEPS)!;

  it('sin recorte nada cambia', () => {
    expect(squeezedMeav(protectedRegion, 0)).toBe(protectedRegion.meav);
    expect(squeezedMeav(unprotectedRegion, 0)).toBe(unprotectedRegion.meav);
  });

  it('en el PRIMER tramo la no protegida cae a mantenimiento', () => {
    expect(squeezedMeav(unprotectedRegion, 1)).toBe(unprotectedRegion.landmarks.mv);
  });

  it('en el PRIMER tramo la protegida solo cae al mínimo efectivo', () => {
    // Es el requisito: los grupos grandes se quedan en rango de adaptación
    // efectiva mientras haya algo más que recortar.
    expect(squeezedMeav(protectedRegion, 1)).toBe(protectedRegion.landmarks.mev);
    expect(squeezedMeav(protectedRegion, 1)).toBeGreaterThan(protectedRegion.landmarks.mv);
  });

  it('en el SEGUNDO tramo la protegida baja también a mantenimiento', () => {
    expect(squeezedMeav(protectedRegion, MAX_SQUEEZE)).toBe(protectedRegion.landmarks.mv);
  });

  it('la no protegida ya no baja más en el segundo tramo', () => {
    expect(squeezedMeav(unprotectedRegion, MAX_SQUEEZE)).toBe(
      squeezedMeav(unprotectedRegion, 1),
    );
  });

  it('el recorte es monótono: más recorte, nunca más volumen', () => {
    [protectedRegion, unprotectedRegion].forEach((region) => {
      let previous = Number.POSITIVE_INFINITY;
      for (let squeeze = 0; squeeze <= MAX_SQUEEZE; squeeze += 0.1) {
        const value = squeezedMeav(region, squeeze);
        expect(value).toBeLessThanOrEqual(previous);
        previous = value;
      }
    });
  });

  it('una región desprioriorizada, ya por debajo del MEV, no SUBE al recortar', () => {
    const plan = buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      deprioritizedMuscles: [MuscleGroup.CHEST],
    });
    const chest = plan.regions.find((r) => r.region === VolumeRegion.CHEST)!;
    expect(chest.meav).toBeLessThan(chest.landmarks.mev);
    expect(squeezedMeav(chest, 1)).toBeLessThanOrEqual(chest.meav);
  });

  it('un recorte negativo se trata como cero', () => {
    expect(squeezedMeav(protectedRegion, -5)).toBe(protectedRegion.meav);
  });
});

describe('PROTECTED_REGIONS', () => {
  it('protege las regiones grandes movidas por multiarticulares', () => {
    [VolumeRegion.CHEST, VolumeRegion.BACK, VolumeRegion.QUADS, VolumeRegion.HAMSTRINGS].forEach(
      (region) => expect(PROTECTED_REGIONS).toContain(region),
    );
  });

  it('NO protege las que se entrenan con aislamiento', () => {
    [VolumeRegion.BICEPS, VolumeRegion.TRICEPS, VolumeRegion.CALVES, VolumeRegion.CORE].forEach(
      (region) => expect(PROTECTED_REGIONS).not.toContain(region),
    );
  });

  it('toda región protegida existe en el catálogo de regiones', () => {
    PROTECTED_REGIONS.forEach((region) => expect(VOLUME_REGIONS[region]).toBeDefined());
  });
});

describe('squeezePlan', () => {
  it('sin recorte devuelve el mismo plan', () => {
    expect(squeezePlan(uncapped, 0)).toBe(uncapped);
  });

  it('marca el plan como recortado por capacidad', () => {
    expect(uncapped.capacityCapped).toBe(false);
    expect(squeezePlan(uncapped, 1).capacityCapped).toBe(true);
  });

  it('reduce el volumen total', () => {
    expect(totalAttributedSets(squeezePlan(uncapped, 1))).toBeLessThan(
      totalAttributedSets(uncapped),
    );
    expect(totalAttributedSets(squeezePlan(uncapped, MAX_SQUEEZE))).toBeLessThan(
      totalAttributedSets(squeezePlan(uncapped, 1)),
    );
  });

  it('las partes de cada región siguen sumando su presupuesto recortado', () => {
    const plan = squeezePlan(uncapped, 0.7);
    plan.regions.forEach((region) => {
      const sum = plan.muscles
        .filter((m) => m.region === region.region)
        .reduce((total, m) => total + m.meav, 0);
      expect(Math.abs(sum - region.meav)).toBeLessThanOrEqual(1);
    });
  });
});

describe('planMesocycle — cuál de los dos techos manda', () => {
  it('con tiempo de sobra limita la RECUPERACIÓN y no se recorta nada', () => {
    const result = planMesocycle({ ...base, capacity: capacity(8, 90) });
    expect(result.limitedBy).toBe('recovery');
    expect(result.squeeze).toBe(0);
    expect(result.plan).toBe(result.uncappedPlan);
    expect(result.plan.capacityCapped).toBe(false);
  });

  it('con tres sesiones de una hora limita el TIEMPO', () => {
    const result = planMesocycle({ ...base, capacity: capacity(3, 60) });
    expect(result.limitedBy).toBe('time');
    expect(result.squeeze).toBeGreaterThan(0);
    expect(totalAttributedSets(result.plan)).toBeLessThan(totalAttributedSets(result.uncappedPlan));
  });

  it('el plan ajustado CABE en el tiempo disponible', () => {
    [
      capacity(3, 30),
      capacity(3, 60),
      capacity(4, 45),
      capacity(5, 60),
    ].forEach((c) => {
      const result = planMesocycle({ ...base, capacity: c });
      if (result.limitedBy === 'insufficient-time') return;
      expect(result.estimatedWorkMinutes).toBeLessThanOrEqual(result.availableWorkMinutes);
    });
  });

  it('uses the busiest session rather than leaving practical capacity unused', () => {
    // The smallest viable squeeze is found per session, not against the
    // microcycle aggregate: spare minutes in another day cannot make an already
    // full leg session fit.
    const result = planMesocycle({ ...base, capacity: capacity(4, 45) });
    expect(result.maxSessionWorkMinutes).toBeGreaterThan(
      result.availableWorkMinutesPerSession * 0.85,
    );
    expect(result.maxSessionWorkMinutes).toBeLessThanOrEqual(result.availableWorkMinutesPerSession);
  });

  it('más tiempo produce MÁS volumen, de forma monótona', () => {
    const volumes = [2, 3, 4, 5, 6].map((sessions) =>
      totalAttributedSets(
        planMesocycle({ ...base, capacity: capacity(sessions, 60) }).plan,
      ),
    );
    for (let index = 1; index < volumes.length; index += 1) {
      expect(volumes[index]).toBeGreaterThanOrEqual(volumes[index - 1]);
    }
  });

  it('uses the upper end of the intermediate range and all five 65-minute sessions', () => {
    const screenCatalogue = filterCatalogue(EXERCISE_CATALOGUE, {
      availableEquipment: DEFAULT_GENERATOR_EQUIPMENT,
    });

    Array.from({ length: 20 }, (_, seed) => seed + 1).forEach((seed) => {
      const result = planMesocycle({
        ...base,
        catalogue: screenCatalogue,
        seed,
        capacity: capacity(5, 65),
      });
      const sessionSets = result.distribution.sessions.map((session) =>
        session.exercises.reduce((sum, entry) => sum + entry.sets, 0),
      );

      expect(result.selection.performedSets).toBeGreaterThanOrEqual(80);
      expect(result.selection.performedSets).toBeLessThanOrEqual(90);
      expect(Math.min(...sessionSets)).toBeGreaterThanOrEqual(10);
      expect(
        result.distribution.maxSessionWorkMinutes -
          result.distribution.minSessionWorkMinutes,
      // Canonical PPLU keeps the movement sequence stable; that hard structure
      // can be a little less even in minutes than a freely rebalanced split.
      ).toBeLessThanOrEqual(30);
    });
  });

  it('avisa cuando NI en mantenimiento cabe el plan', () => {
    const result = planMesocycle({ ...base, capacity: capacity(1, 30) });
    expect(result.limitedBy).toBe('insufficient-time');
    expect(result.squeeze).toBe(MAX_SQUEEZE);
    expect(result.estimatedWorkMinutes).toBeGreaterThan(result.availableWorkMinutes);
  });

  it('un plan limitado por tiempo no se juzga contra el rango de recuperación', () => {
    const result = planMesocycle({ ...base, capacity: capacity(3, 60) });
    expect(result.selection.totalVerdict).toBe('not-applicable');
  });
});

describe('planMesocycle — efficient compounds come before isolation', () => {
  const tight = planMesocycle({ ...base, capacity: capacity(3, 45) });
  const roomy = planMesocycle({ ...base, capacity: capacity(8, 90) });

  it('under time pressure, isolation only complements an existing compound pattern', () => {
    // A muscle may use isolation after its non-redundant compound family is
    // already present. This prevents two near-identical compound variants while
    // preserving the stronger rule: isolation never replaces the base pattern.
    const withCompounds = new Set(
      EXERCISE_CATALOGUE.filter((e) => e.profile !== ExerciseProfile.ISOLATION &&
        e.generationTier !== ExerciseGenerationTier.MANUAL_ONLY &&
        e.generationTier !== ExerciseGenerationTier.STRENGTH_VARIANT).map(
        (e) => e.primaryMuscle,
      ),
    );
    tight.selection.selected.forEach((entry) => {
      if (
        entry.exercise.profile !== ExerciseProfile.ISOLATION ||
        !withCompounds.has(entry.exercise.primaryMuscle)
      ) return;
      expect(
        tight.selection.selected.some(
          (candidate) =>
            candidate.exercise.primaryMuscle === entry.exercise.primaryMuscle &&
            candidate.exercise.profile !== ExerciseProfile.ISOLATION,
        ),
      ).toBe(true);
    });
  });

  it('un músculo SIN multiarticulares sigue recibiendo su aislamiento', () => {
    // Bíceps, deltoides lateral, gemelos y core no tienen alternativa.
    const lateral = tight.selection.selected.filter(
      (e) => e.exercise.primaryMuscle === MuscleGroup.DELTS_LATERAL,
    );
    expect(lateral.length).toBeGreaterThan(0);
  });

  it('con tiempo de sobra SÍ entra aislamiento, que es lo normal', () => {
    const isolation = roomy.selection.selected.filter(
      (e) => e.exercise.profile === ExerciseProfile.ISOLATION,
    );
    expect(isolation.length).toBeGreaterThan(0);
  });

  it('el plan apretado rinde MÁS volumen atribuido por serie ejecutada', () => {
    // Es la consecuencia medible de preferir multiarticulares: más músculos
    // acreditados por cada serie que el atleta ejecuta.
    const tightRatio = tight.selection.attributedSets / tight.selection.performedSets;
    const roomyRatio = roomy.selection.attributedSets / roomy.selection.performedSets;
    expect(tightRatio).toBeGreaterThan(roomyRatio);
  });

  it('las regiones protegidas conservan más volumen relativo que las demás', () => {
    const relative = (region: VolumeRegion): number => {
      const after = tight.plan.regions.find((r) => r.region === region)?.meav ?? 0;
      const before = tight.uncappedPlan.regions.find((r) => r.region === region)?.meav ?? 1;
      return after / before;
    };
    expect(relative(VolumeRegion.BACK)).toBeGreaterThan(relative(VolumeRegion.BICEPS));
    expect(relative(VolumeRegion.QUADS)).toBeGreaterThan(relative(VolumeRegion.CORE));
  });
});

describe('planMesocycle — distribution wiring', () => {
  it('passes DEPRIORITIZED muscles through, so they are exempt from the frequency report', () => {
    const withDeprioritized = planMesocycle({
      ...base,
      capacity: capacity(4, 60),
      deprioritizedMuscles: [MuscleGroup.CORE, MuscleGroup.BICEPS],
    });
    const reported = withDeprioritized.distribution.structureWarnings
      .filter((warning) => warning.kind === 'single-frequency')
      .map((warning) => warning.muscle);
    expect(reported).not.toContain(MuscleGroup.CORE);
    expect(reported).not.toContain(MuscleGroup.BICEPS);
  });

  it('never leaves a session empty at any realistic capacity', () => {
    [3, 4, 5, 6].forEach((sessions) => {
      const result = planMesocycle({ ...base, capacity: capacity(sessions, 60) });
      result.distribution.sessions.forEach((session) =>
        expect(session.exercises.length).toBeGreaterThan(0),
      );
    });
  });

  it('keeps every session inside its own time budget', () => {
    [3, 4, 5, 6].forEach((sessions) => {
      const result = planMesocycle({ ...base, capacity: capacity(sessions, 60) });
      if (result.limitedBy === 'insufficient-time') return;
      result.distribution.sessions.forEach((session) =>
        expect(session.estimatedWorkMinutes).toBeLessThanOrEqual(
          result.availableWorkMinutesPerSession,
        ),
      );
    });
  });
});

/**
 * Many short sessions used to CRASH the distributor.
 *
 * The anchor-repair pass ran on every session with no anchor, which includes an EMPTY
 * one, then asserted that such a session had an isolation exercise to trade back. It
 * did not, so `undefined` was spliced into the donor's list and the next minute count
 * threw. 15 of 684 level/goal/capacity combinations died this way, `6x45` for an
 * intermediate among them, which is an ordinary thing for someone to pick.
 */
describe('planMesocycle — capacities of many short sessions', () => {
  const crashing: [ExperienceLevel, TrainingGoal, number, number][] = [
    [ExperienceLevel.BEGINNER, TrainingGoal.HYPERTROPHY, 5, 30],
    [ExperienceLevel.BEGINNER, TrainingGoal.HYPERTROPHY, 6, 30],
    [ExperienceLevel.INTERMEDIATE, TrainingGoal.HYPERTROPHY, 6, 45],
    [ExperienceLevel.INTERMEDIATE, TrainingGoal.HYPERTROPHY, 7, 40],
    [ExperienceLevel.INTERMEDIATE, TrainingGoal.STRENGTH, 6, 30],
    [ExperienceLevel.ADVANCED, TrainingGoal.STRENGTH, 6, 50],
    [ExperienceLevel.ADVANCED, TrainingGoal.STRENGTH, 7, 35],
  ];

  it.each(crashing)('plans %s %s at %ix%i without corrupting a session', (
    level,
    goal,
    sessions,
    minutes,
  ) => {
    const plan = planMesocycle({
      level,
      goal,
      catalogue: EXERCISE_CATALOGUE,
      seed: 7,
      capacity: capacity(sessions, minutes),
    });
    expect(plan.distribution.sessions).toHaveLength(sessions);
    plan.distribution.sessions.forEach((session) => {
      expect(session.exercises.every((entry) => entry?.exercise !== undefined)).toBe(true);
      expect(Number.isFinite(session.estimatedWorkMinutes)).toBe(true);
      expect(session.estimatedWorkMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  // The repair may still leave a session empty when the selection has fewer exercise
  // appearances than sessions. That is reported, not hidden, and must not throw.
  it('reports an unavoidable empty session instead of crashing', () => {
    const plan = planMesocycle({
      level: ExperienceLevel.BEGINNER,
      goal: TrainingGoal.STRENGTH,
      catalogue: EXERCISE_CATALOGUE,
      seed: 3,
      capacity: capacity(7, 30),
    });
    const empty = plan.distribution.sessions.filter(
      (session) => session.exercises.length === 0,
    );
    if (empty.length > 0) {
      expect(
        plan.distribution.structureWarnings.some(
          (warning) => warning.kind === 'empty-session',
        ),
      ).toBe(true);
    }
    expect(plan.distribution.sessions).toHaveLength(7);
  });
});
