import { Equipment, MovementVector, MuscleGroup, SetType, SplitStructure, type Exercise } from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlan } from '@/services/training/mesocyclePlanner';
import { toPlannedSessions } from '@/services/training/routineMapper';
import {
  COMPLEMENTARY_LIFTS,
  HINGE_ACCESSORY_IDS,
  MAIN_LIFTS,
  MIN_MAIN_LIFT_SHARE,
  SLOT_PRIORITY,
  applyMainLiftShare,
  slotsToSelection,
  strengthSlots,
  type StrengthSlot,
} from '@/services/training/strengthProgram';
import { TrainingGoal, VolumeRegion, buildVolumePlan } from '@/services/training/volumePlan';

const byId = (id: string): Exercise => EXERCISE_CATALOGUE.find((exercise) => exercise.id === id)!;

function plan(
  sessions: number,
  minutes: number,
  options: {
    level?: ExperienceLevel;
    catalogue?: readonly Exercise[];
    seed?: number;
    priorityRegions?: VolumeRegion[];
    deprioritizedRegions?: VolumeRegion[];
  } = {},
): MesocyclePlan {
  return planMesocycle({
    level: options.level ?? ExperienceLevel.INTERMEDIATE,
    goal: TrainingGoal.STRENGTH,
    catalogue: options.catalogue ?? EXERCISE_CATALOGUE,
    seed: options.seed ?? 1,
    split: SplitStructure.AUTO,
    capacity: { sessionsPerMicrocycle: sessions, minutesPerSession: minutes },
    priorityRegions: options.priorityRegions,
    deprioritizedRegions: options.deprioritizedRegions,
  });
}

/** Sessions in which a pattern's main lift or variant is trained. */
function mainFrequency(result: MesocyclePlan, vector: MovementVector): number {
  return result.distribution.sessions.filter((session) =>
    session.exercises.some(
      (entry) =>
        (entry.strength?.role === 'MAIN' || entry.strength?.role === 'VARIANT') &&
        entry.exercise.movementVector === vector,
    ),
  ).length;
}

const roleOf = (result: MesocyclePlan, id: string) =>
  result.selection.selected.find((entry) => entry.exercise.id === id)?.strength?.role;

describe('planStrengthMesocycle — the main lifts are prescribed, not drawn', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('keeps squat, bench and conventional deadlift with seed %i', (seed) => {
    const result = plan(4, 75, { seed });
    MAIN_LIFTS.forEach((spec) => expect(roleOf(result, spec.exerciseId)).toBe('MAIN'));
    COMPLEMENTARY_LIFTS.forEach((spec) => expect(roleOf(result, spec.exerciseId)).toBe('COMPLEMENTARY'));
    expect(result.strength?.mainLifts.every((lift) => !lift.substituted)).toBe(true);
    expect(result.strength?.missingBarbell).toBe(false);
  });

  it('draws variants by seed, so another combination changes them', () => {
    const variants = new Set<string>();
    for (let seed = 1; seed <= 20; seed += 1) {
      plan(4, 75, { seed })
        .selection.selected.filter((entry) => entry.strength?.role === 'VARIANT')
        .forEach((entry) => variants.add(entry.exercise.id));
    }
    expect(variants.size).toBeGreaterThan(3);
  });

  it('defaults to an automatic split', () => {
    const result = planMesocycle({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.STRENGTH,
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
      capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 75 },
    });
    expect(result.distribution.requestedSplit).toBe(SplitStructure.AUTO);
  });

  it('is reproducible for the same seed', () => {
    const ids = (result: MesocyclePlan) => result.selection.selected.map((entry) => entry.exercise.id);
    expect(ids(plan(4, 75, { seed: 7 }))).toEqual(ids(plan(4, 75, { seed: 7 })));
  });
});

describe('frequency by session count', () => {
  it.each([
    [2, 2, 2, 1],
    [3, 2, 2, 1],
    [4, 2, 3, 2],
    [5, 3, 3, 2],
  ])('%i sessions: squat %i, bench %i, deadlift %i', (sessions, squat, bench, deadlift) => {
    const result = plan(sessions, 120);
    expect(result.limitedBy).toBe('recovery');
    expect(mainFrequency(result, MovementVector.KNEE_DOMINANT)).toBe(squat);
    expect(mainFrequency(result, MovementVector.PUSH_HORIZONTAL)).toBe(bench);
    expect(mainFrequency(result, MovementVector.HIP_DOMINANT)).toBe(deadlift);
  });

  it('never trains the same main pattern twice in one session', () => {
    for (let sessions = 2; sessions <= 6; sessions += 1) {
      for (const minutes of [45, 60, 75, 90]) {
        plan(sessions, minutes).distribution.sessions.forEach((session) => {
          const vectors = session.exercises
            .filter((entry) => entry.strength?.role === 'MAIN' || entry.strength?.role === 'VARIANT')
            .map((entry) => entry.exercise.movementVector);
          expect(new Set(vectors).size).toBe(vectors.length);
        });
      }
    }
  });

  it('gives complementary lifts a second exposure only from five sessions', () => {
    const exposures = (result: MesocyclePlan) =>
      result.selection.selected.find((entry) => entry.exercise.id === 'press-militar-barra')?.strength
        ?.exposures.length;
    expect(exposures(plan(4, 120))).toBe(1);
    expect(exposures(plan(5, 120))).toBe(2);
  });
});

describe('the 60 % rule', () => {
  it('holds for every level, session count and duration that fits', () => {
    Object.values(ExperienceLevel).forEach((level) => {
      for (let sessions = 1; sessions <= 7; sessions += 1) {
        for (const minutes of [45, 60, 75, 90, 120]) {
          const result = plan(sessions, minutes, { level });
          if (result.limitedBy === 'insufficient-time') continue;
          expect(result.strength!.mainLiftShare).toBeGreaterThanOrEqual(MIN_MAIN_LIFT_SHARE);
        }
      }
    });
  });

  it('keeps every main slot and drops the extra that would dilute it', () => {
    const slot = (id: string, role: StrengthSlot['role'], sets: number): StrengthSlot => ({
      exercise: byId(id),
      role,
      sets,
      topSingle: false,
      priority: 1,
    });
    const kept = applyMainLiftShare([
      slot('sentadilla-libre', 'MAIN', 6),
      slot('remo-con-barra', 'COMPLEMENTARY', 3),
      slot('plancha', 'ACCESSORY', 3),
      slot('press-banca', 'MAIN', 0),
    ]);
    expect(kept.map((entry) => entry.exercise.id)).toEqual(['sentadilla-libre', 'remo-con-barra', 'press-banca']);
  });
});

describe('prescription', () => {
  const result = plan(4, 75);
  const mapped = toPlannedSessions(result).flatMap((session) => session.exercises);

  it('rests 4 min on main lifts and variants, 3 on complementary, 90-120 s on accessories', () => {
    result.selection.selected.forEach((entry) => {
      const rest = entry.strength!.restSeconds;
      const role = entry.strength!.role;
      if (role === 'MAIN' || role === 'VARIANT') expect(rest).toBe(240);
      else if (role === 'COMPLEMENTARY') expect(rest).toBe(180);
      else expect([90, 120]).toContain(rest);
    });
  });

  it('puts one heavy single only on the first exposure of each main lift', () => {
    const singles = mapped.filter((entry) => entry.sets.some((set) => set.setType === SetType.TOP_SINGLE));
    expect(singles.map((entry) => entry.exerciseId).sort()).toEqual(
      MAIN_LIFTS.map((spec) => spec.exerciseId).sort(),
    );
    singles.forEach((entry) => {
      expect(entry.sets[0].setType).toBe(SetType.TOP_SINGLE);
      expect(entry.sets.filter((set) => set.setType === SetType.TOP_SINGLE)).toHaveLength(1);
    });
  });

  it('never prescribes spinal flexion as core work', () => {
    result.selection.selected
      .filter((entry) => entry.exercise.primaryMuscle === MuscleGroup.CORE)
      .forEach((entry) => expect(entry.exercise.movementVector).not.toBe(MovementVector.SPINAL_FLEXION));
  });

  it('draws the hinge accessory from the named pool, never a second pull from the floor', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      plan(4, 75, { seed })
        .selection.selected.filter(
          (entry) => entry.strength?.role === 'ACCESSORY' && entry.exercise.movementVector === MovementVector.HIP_DOMINANT,
        )
        .forEach((entry) => expect(HINGE_ACCESSORY_IDS).toContain(entry.exercise.id));
    }
  });

  it('counts pattern sets over main, variant and complementary work only', () => {
    expect(result.strength!.patternSets[MovementVector.KNEE_DOMINANT]).toBe(8);
    expect(result.strength!.patternSets[MovementVector.PUSH_HORIZONTAL]).toBe(12);
    expect(result.strength!.patternSets[MovementVector.HIP_DOMINANT]).toBe(8);
  });

  it('drops the per-muscle frequency warning, which does not apply to strength', () => {
    expect(result.distribution.structureWarnings.some((warning) => warning.kind === 'single-frequency')).toBe(false);
  });
});

describe('levels', () => {
  it('a beginner repeats the lift instead of a variant, with no heavy single', () => {
    const result = plan(3, 90, { level: ExperienceLevel.BEGINNER });
    expect(result.selection.selected.some((entry) => entry.strength?.role === 'VARIANT')).toBe(false);
    const squat = result.selection.selected.find((entry) => entry.exercise.id === 'sentadilla-libre')!;
    expect(squat.strength!.exposures).toEqual([
      { sets: 3, topSingle: false },
      { sets: 3, topSingle: false },
    ]);
  });

  it('an advanced athlete does more complementary work per exposure', () => {
    const row = COMPLEMENTARY_LIFTS.find((spec) => spec.lift === 'ROW')!.exerciseId;
    const sets = (level: ExperienceLevel) =>
      plan(4, 120, { level }).selection.selected.find((entry) => entry.exercise.id === row)!.sets;
    expect(sets(ExperienceLevel.ADVANCED)).toBeGreaterThan(sets(ExperienceLevel.INTERMEDIATE));
  });

  it('rows chest-supported, so the lower back already spent by squat and deadlift does not limit it', () => {
    const row = plan(4, 75).strength!.mainLifts.find((lift) => lift.lift === 'ROW')!;
    expect(row).toEqual({ lift: 'ROW', exerciseId: 'remo-pecho-apoyado', substituted: false });
    const noMachine = EXERCISE_CATALOGUE.filter((exercise) => exercise.equipment !== Equipment.MACHINE);
    const fallback = plan(4, 75, { catalogue: noMachine }).strength!.mainLifts.find((lift) => lift.lift === 'ROW')!;
    expect(fallback.substituted).toBe(true);
    expect(byId(fallback.exerciseId).movementVector).toBe(MovementVector.PULL_HORIZONTAL);
  });
});

describe('fitting the time', () => {
  it('is limited by recovery when everything fits', () => {
    expect(plan(4, 90).limitedBy).toBe('recovery');
    expect(plan(4, 90).squeeze).toBe(0);
  });

  it('drops accessories before the main lifts when time is short', () => {
    const full = plan(4, 120);
    const short = plan(4, 45);
    expect(short.limitedBy).toBe('time');
    expect(short.squeeze).toBeGreaterThan(0);
    MAIN_LIFTS.forEach((spec) => expect(roleOf(short, spec.exerciseId)).toBe('MAIN'));
    const accessories = (result: MesocyclePlan) =>
      result.selection.selected.filter((entry) => entry.strength?.role === 'ACCESSORY').length;
    expect(accessories(short)).toBeLessThan(accessories(full));
    short.distribution.sessions.forEach((session) =>
      expect(session.estimatedWorkMinutes).toBeLessThanOrEqual(short.availableWorkMinutesPerSession),
    );
  });

  it('keeps a small lift that fits after a bigger one that did not', () => {
    // At 3x45 the second squat exposure does not fit anywhere, but a complementary
    // lift still does: a greedy pass keeps it where a prefix search would not.
    const result = plan(3, 45);
    expect(result.limitedBy).toBe('time');
    expect(result.selection.selected.some((entry) => entry.strength?.role === 'COMPLEMENTARY')).toBe(true);
  });

  it('says when not even the three heavy days fit', () => {
    const result = plan(1, 30);
    expect(result.limitedBy).toBe('insufficient-time');
  });

  it('marks a time-limited plan as capacity-capped so its total is not judged', () => {
    expect(plan(4, 45).plan.capacityCapped).toBe(true);
    expect(plan(4, 45).selection.totalVerdict).toBe('not-applicable');
  });
});

describe('material and vetoes', () => {
  it('without a barbell, substitutes every main lift and warns', () => {
    const noBarbell = EXERCISE_CATALOGUE.filter((exercise) => exercise.equipment !== Equipment.BARBELL);
    const result = plan(4, 75, { catalogue: noBarbell });
    expect(result.strength!.missingBarbell).toBe(true);
    const main = result.strength!.mainLifts.filter((lift) => ['SQUAT', 'BENCH', 'DEADLIFT'].includes(lift.lift));
    expect(main).toHaveLength(3);
    main.forEach((lift) => expect(lift.substituted).toBe(true));
  });

  it('never substitutes a vetoed main lift with one of its specific variants', () => {
    const vetoed = EXERCISE_CATALOGUE.filter((exercise) => exercise.id !== 'sentadilla-libre');
    const result = plan(4, 75, { catalogue: vetoed });
    const squat = result.strength!.mainLifts.find((lift) => lift.lift === 'SQUAT')!;
    expect(squat.substituted).toBe(true);
    expect(['sentadilla-pausa']).not.toContain(squat.exerciseId);
  });

  it('reports a pattern with no candidate at all', () => {
    const noKnee = EXERCISE_CATALOGUE.filter((exercise) => exercise.movementVector !== MovementVector.KNEE_DOMINANT);
    const result = plan(4, 75, { catalogue: noKnee });
    expect(result.selection.missingFoundationalPatterns).toContain(MovementVector.KNEE_DOMINANT);
    expect(result.strength!.mainLifts.some((lift) => lift.lift === 'SQUAT')).toBe(false);
  });

  it('reports the missing complementary pattern too', () => {
    const noVerticalPull = EXERCISE_CATALOGUE.filter(
      (exercise) => exercise.movementVector !== MovementVector.PULL_VERTICAL,
    );
    expect(plan(4, 75, { catalogue: noVerticalPull }).selection.missingFoundationalPatterns).toContain(
      MovementVector.PULL_VERTICAL,
    );
  });
});

describe('emphasis', () => {
  const volumePlan = (priority: VolumeRegion[], deprioritized: VolumeRegion[] = []) =>
    buildVolumePlan({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.STRENGTH,
      priorityRegions: priority,
      deprioritizedRegions: deprioritized,
    });
  const slots = (priority: VolumeRegion[], deprioritized: VolumeRegion[] = []) =>
    strengthSlots({
      level: ExperienceLevel.INTERMEDIATE,
      sessions: 4,
      catalogue: EXERCISE_CATALOGUE,
      volumePlan: volumePlan(priority, deprioritized),
      seed: 1,
    }).slots;

  it('adds an accessory for a priority region', () => {
    const extra = slots([VolumeRegion.BICEPS]).filter((slot) => slot.priority === SLOT_PRIORITY.priorityAccessory);
    expect(extra).toHaveLength(1);
    expect(extra[0].exercise.primaryMuscle).toBe(MuscleGroup.BICEPS);
  });

  it('skips the accessory of a deprioritized region', () => {
    const triceps = (deprioritized: VolumeRegion[]) =>
      slots([], deprioritized).filter((slot) => slot.priority === SLOT_PRIORITY.triceps);
    expect(triceps([])).toHaveLength(1);
    expect(triceps([VolumeRegion.TRICEPS])).toHaveLength(0);
  });
});

describe('slotsToSelection', () => {
  it('merges exposures of one lift into one selected exercise, in slot order', () => {
    const squat = byId('sentadilla-libre');
    const selected = slotsToSelection([
      { exercise: squat, role: 'MAIN', sets: 4, topSingle: true, priority: 100 },
      { exercise: byId('press-banca'), role: 'MAIN', sets: 4, topSingle: true, priority: 100 },
      { exercise: squat, role: 'MAIN', sets: 3, topSingle: false, priority: 60 },
    ]);
    expect(selected).toHaveLength(2);
    expect(selected[0]).toMatchObject({
      sets: 7,
      strength: { role: 'MAIN', restSeconds: 240, exposures: [{ sets: 4, topSingle: true }, { sets: 3, topSingle: false }] },
    });
  });

  it('is empty for no slots', () => {
    expect(slotsToSelection([])).toEqual([]);
  });
});

describe('an empty catalogue', () => {
  it('plans nothing and reports every pattern missing', () => {
    const result = plan(4, 75, { catalogue: [] });
    expect(result.selection.selected).toEqual([]);
    expect(result.strength!.mainLiftShare).toBe(0);
    expect(result.selection.missingFoundationalPatterns).toHaveLength(6);
  });
});
