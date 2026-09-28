import { Equipment, SetType, SplitStructure } from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlan } from '@/services/training/mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '@/services/training/volumePlan';
import {
  exercisePrescription,
  loadForTarget,
  TOP_SINGLE_RIR,
} from '@/services/training/exercisePrescription';
import {
  MAX_ROUTINE_NAME_LENGTH,
  activationChanges,
  normalizeRoutineName,
  routineNameProblem,
  shouldActivateNewRoutine,
  editedExerciseIds,
  plannedExerciseIds,
  toMesocycleDraft,
  toPlannedSession,
  toPlannedSessions,
  toRoutineDraft,
  totalPlannedSets,
} from '@/services/training/routineMapper';

const NOW = 1_800_000_000_000;

function generate(
  sessions = 4,
  minutes = 60,
  goal: TrainingGoal = TrainingGoal.HYPERTROPHY,
): MesocyclePlan {
  return planMesocycle({
    level: ExperienceLevel.INTERMEDIATE,
    goal,
    catalogue: EXERCISE_CATALOGUE,
    seed: 1,
    split: SplitStructure.AUTO,
    capacity: { sessionsPerMicrocycle: sessions, minutesPerSession: minutes },
  });
}

const generationInput = {
  goal: TrainingGoal.HYPERTROPHY,
  experienceLevel: ExperienceLevel.INTERMEDIATE,
  split: SplitStructure.AUTO,
  sessionsPerMicrocycle: 4,
  minutesPerSession: 60,
  availableEquipment: [Equipment.BARBELL, Equipment.DUMBBELL],
  priorityRegions: [VolumeRegion.BACK],
  deprioritizedRegions: [VolumeRegion.CORE],
  vetoedExerciseIds: ['press-banca'],
  seed: 7,
};

describe('toPlannedSession', () => {
  const plan = generate();
  const session = plan.distribution.sessions[0];
  const planned = toPlannedSession(session);

  it('keeps the session index and focus', () => {
    expect(planned.index).toBe(session.index);
    expect(planned.focus).toBe(session.focus);
  });

  it('prescribes one set object per performed set', () => {
    session.exercises.forEach((entry, order) => {
      expect(planned.exercises[order].sets).toHaveLength(entry.sets);
      expect(planned.exercises[order].exerciseId).toBe(entry.exercise.id);
    });
  });

  it('DERIVES per-set RIR instead of writing it by hand', () => {
    // The last set reaches the exercise target and earlier ones leave one more rep
    // in reserve, so the values must be non-increasing and end at the target.
    planned.exercises.forEach((exercise, order) => {
      const rirs = exercise.sets.map((set) => set.targetRIR);
      const profile = session.exercises[order].exercise.profile;
      expect(rirs[rirs.length - 1]).toBe(
        exercisePrescription(TrainingGoal.HYPERTROPHY, profile).targetRIR,
      );
      for (let index = 1; index < rirs.length; index += 1) {
        expect(rirs[index]).toBeLessThanOrEqual(rirs[index - 1]);
      }
    });
  });

  it('raises intensity in the final microcycle before a deload', () => {
    // Volume is static within the mesocycle, so intensity is the only thing that
    // moves between microcycles (§3).
    const peak = toPlannedSession(session, TrainingGoal.HYPERTROPHY, true);
    const routine = planned.exercises[0].sets.map((set) => set.targetRIR);
    const peaked = peak.exercises[0].sets.map((set) => set.targetRIR);
    expect(peaked.every((rir, index) => rir <= routine[index])).toBe(true);
    expect(peaked).not.toEqual(routine);
  });

  it('marks nothing as edited on generation', () => {
    planned.exercises.forEach((exercise) => expect(exercise.isEdited).toBe(false));
  });

  it('prescribes hypertrophy ranges by exercise profile', () => {
    planned.exercises.forEach((exercise) =>
      exercise.sets.forEach((set) => {
        expect(set.setType).toBe(SetType.NORMAL);
        expect(set.targetRepsMin).toBeLessThan(set.targetReps);
      }),
    );
  });

  it('does NOT prescribe a weight on a first mesocycle', () => {
    // There is no load history to project from; the first session establishes it.
    planned.exercises.forEach((exercise) =>
      exercise.sets.forEach((set) => expect(set.targetWeightKg).toBeUndefined()),
    );
  });

  it('numbers the exercises in order from zero', () => {
    expect(planned.exercises.map((exercise) => exercise.order)).toEqual(
      planned.exercises.map((_, index) => index),
    );
  });
});

describe('toPlannedSessions — conservation', () => {
  const plan = generate();
  const sessions = toPlannedSessions(plan);

  it('produces one prescription per distributed session', () => {
    expect(sessions).toHaveLength(plan.distribution.sessions.length);
  });

  it('CONSERVES every prescribed set: nothing is created or lost', () => {
    expect(totalPlannedSets(sessions)).toBe(plan.selection.performedSets);
  });

  it('references only exercises the selection chose', () => {
    const selected = new Set(plan.selection.selected.map((entry) => entry.exercise.id));
    plannedExerciseIds(sessions).forEach((id) => expect(selected.has(id)).toBe(true));
  });

  it('leaves no session empty', () => {
    sessions.forEach((session) => expect(session.exercises.length).toBeGreaterThan(0));
  });

  it('does not repeat an exercise in another session of the microcycle', () => {
    const ids = sessions.flatMap((session) =>
      session.exercises.map((exercise) => exercise.exerciseId),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prescribes a strength plan by role: heavy single, main-lift range, prescribed rest', () => {
    const strengthPlan = generate(4, 60, TrainingGoal.STRENGTH);
    const mapped = toPlannedSessions(strengthPlan).flatMap((session) => session.exercises);
    const squats = mapped.filter((entry) => entry.exerciseId === 'sentadilla-libre');
    expect(squats.length).toBeGreaterThan(0);
    const heavy = squats[0];
    expect(heavy.strengthRole).toBe('MAIN');
    expect(heavy.restSeconds).toBe(240);
    expect(heavy.sets[0]).toEqual({
      setType: SetType.TOP_SINGLE,
      targetRepsMin: 1,
      targetReps: 1,
      targetRIR: TOP_SINGLE_RIR,
    });
    heavy.sets.slice(1).forEach((set) => {
      expect(set).toEqual({ setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3 });
    });
    const accessory = mapped.find((entry) => entry.strengthRole === 'ACCESSORY');
    expect(accessory?.sets.every((set) => set.targetRepsMin === 6 && set.targetReps === 10)).toBe(true);
  });

  it('adds loads from an e1RM only to the lifts that have one, never to accessories', () => {
    const strengthPlan = generate(4, 60, TrainingGoal.STRENGTH);
    const accessoryId = strengthPlan.selection.selected.find(
      (entry) => entry.strength?.role === 'ACCESSORY',
    )!.exercise.id;
    const e1rm = new Map([
      ['sentadilla-libre', 150],
      [accessoryId, 100],
    ]);
    const mapped = toPlannedSessions(strengthPlan, false, { e1rmByExerciseId: e1rm }).flatMap(
      (session) => session.exercises,
    );
    const heavy = mapped.find((entry) => entry.exerciseId === 'sentadilla-libre')!;
    expect(heavy.sets[0].targetWeightKg).toBe(loadForTarget(150, 1, TOP_SINGLE_RIR));
    expect(heavy.sets[1].targetWeightKg).toBe(loadForTarget(150, 5, 3));
    expect(mapped.find((entry) => entry.exerciseId === accessoryId)?.sets[0].targetWeightKg).toBeUndefined();
    expect(mapped.find((entry) => entry.exerciseId === 'press-banca')?.sets[0].targetWeightKg).toBeUndefined();
  });

  it('leaves hypertrophy plans without role or stored rest', () => {
    toPlannedSessions(generate()).forEach((session) =>
      session.exercises.forEach((entry) => {
        expect('strengthRole' in entry).toBe(false);
        expect('restSeconds' in entry).toBe(false);
      }),
    );
  });
});

describe('toMesocycleDraft', () => {
  const plan = generate();
  const draft = toMesocycleDraft({
    userId: 'user-1',
    routineId: 'routine-1',
    plan,
    now: NOW,
  });

  it('starts ACTIVE at the first microcycle', () => {
    expect(draft.status).toBe('ACTIVE');
    expect(draft.currentMicrocycleIndex).toBe(0);
  });

  it('carries the prescription and the routine it came from', () => {
    expect(draft.routineId).toBe('routine-1');
    expect(draft.plannedSessions).toHaveLength(plan.distribution.sessions.length);
  });

  it('preserves edits supplied by the generation preview', () => {
    const planned = draft.plannedSessions!;
    const edited = planned.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        isEdited: true,
      })),
    }));
    const mapped = toMesocycleDraft({
      userId: 'user-1',
      routineId: 'routine-1',
      plan,
      now: NOW,
      plannedSessions: edited,
    });
    expect(mapped.plannedSessions).toEqual(edited);
  });

  it('records the session count from the distribution, not from the request', () => {
    // They can differ: the distribution is what actually got built.
    expect(draft.sessionsPerMicrocycle).toBe(plan.distribution.sessions.length);
  });

  it('persists the volume target per muscle group', () => {
    expect(Object.keys(draft.targetVolumePerGroup).length).toBeGreaterThan(0);
    Object.values(draft.targetVolumePerGroup).forEach((sets) => expect(sets).toBeGreaterThan(0));
  });

  it('OMITS an absent optional instead of setting it to undefined', () => {
    // Firestore rejects an undefined value, which the session mapper already
    // learned the hard way.
    expect('projectedMicrocycles' in draft).toBe(false);
    expect(
      'projectedMicrocycles' in
        toMesocycleDraft({
          userId: 'user-1',
          routineId: 'routine-1',
          plan,
          now: NOW,
          projectedMicrocycles: 5,
        }),
    ).toBe(true);
  });

  it('does NOT persist anything derived', () => {
    // Landmarks, squeeze, warnings and minutes are all recomputable, and freezing
    // them would stop old routines from benefiting when the model improves.
    const keys = Object.keys(draft);
    ['squeeze', 'limitedBy', 'landmarks', 'sequencingWarnings', 'availableWorkMinutes'].forEach(
      (forbidden) => expect(keys).not.toContain(forbidden),
    );
  });

  it('is serialisable without loss, which is what Firestore stores', () => {
    expect(JSON.parse(JSON.stringify(draft))).toEqual(draft);
  });
});

describe('toRoutineDraft', () => {
  const draft = toRoutineDraft({
    userId: 'user-1',
    name: 'Torso pierna',
    icon: 'barbell',
    accentColor: '#9BE317',
    generation: generationInput,
    isActive: true,
    now: NOW,
  });

  it('keeps the identity the athlete recognises', () => {
    expect(draft.name).toBe('Torso pierna');
    expect(draft.icon).toBe('barbell');
    expect(draft.accentColor).toBe('#9BE317');
  });

  it('STORES THE SEED, so a kept plan can be reproduced', () => {
    // Without it, reopening a routine could not show the plan it produced, and the
    // reroll button would have nothing to remember.
    expect(draft.generation.seed).toBe(7);
  });

  it('stores the inputs so a new block needs no re-answering', () => {
    expect(draft.generation.split).toBe(SplitStructure.AUTO);
    expect(draft.generation.priorityRegions).toEqual([VolumeRegion.BACK]);
    expect(draft.generation.deprioritizedRegions).toEqual([VolumeRegion.CORE]);
    expect(draft.generation.vetoedExerciseIds).toEqual(['press-banca']);
    expect(draft.generation.availableEquipment).toHaveLength(2);
  });

  it('is serialisable without loss', () => {
    expect(JSON.parse(JSON.stringify(draft))).toEqual(draft);
  });
});

describe('regenerating from a stored routine', () => {
  it('the SAME stored generation input reproduces the SAME prescription', () => {
    // This is the invariant that makes the routine a template rather than a label:
    // the stored inputs, replayed, must give back the plan the athlete kept.
    const first = toPlannedSessions(generate());
    const second = toPlannedSessions(generate());
    expect(second).toEqual(first);
  });

  it('a different seed changes the exercises but not the session count', () => {
    const base = planMesocycle({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: EXERCISE_CATALOGUE,
      seed: 1,
      split: SplitStructure.AUTO,
      capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 },
    });
    const rerolled = planMesocycle({
      level: ExperienceLevel.INTERMEDIATE,
      goal: TrainingGoal.HYPERTROPHY,
      catalogue: EXERCISE_CATALOGUE,
      seed: 99,
      split: SplitStructure.AUTO,
      capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 },
    });
    const ids = (plan: MesocyclePlan) => plannedExerciseIds(toPlannedSessions(plan)).sort();
    expect(ids(rerolled)).not.toEqual(ids(base));
    expect(toPlannedSessions(rerolled)).toHaveLength(toPlannedSessions(base).length);
  });
});

describe('editedExerciseIds', () => {
  it('reports nothing on a freshly generated plan', () => {
    expect(editedExerciseIds(toPlannedSessions(generate()))).toEqual([]);
  });

  it('reports what the athlete changed by hand', () => {
    // Regeneration must not silently revert a deliberate swap.
    const sessions = toPlannedSessions(generate());
    sessions[0].exercises[0].isEdited = true;
    expect(editedExerciseIds(sessions)).toEqual([sessions[0].exercises[0].exerciseId]);
  });

  it('does not repeat an id edited in two sessions', () => {
    const sessions = toPlannedSessions(generate());
    const id = sessions[0].exercises[0].exerciseId;
    sessions.forEach((session) =>
      session.exercises.forEach((exercise) => {
        if (exercise.exerciseId === id) exercise.isEdited = true;
      }),
    );
    expect(editedExerciseIds(sessions)).toEqual([id]);
  });
});

describe('totalPlannedSets and plannedExerciseIds', () => {
  it('count zero for an empty prescription', () => {
    expect(totalPlannedSets([])).toBe(0);
    expect(plannedExerciseIds([])).toEqual([]);
  });

  it('do not count the same exercise id twice across sessions', () => {
    const sessions = toPlannedSessions(generate());
    const ids = plannedExerciseIds(sessions);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Firestore rejects a document containing `undefined` anywhere in its tree, and the
 * failure surfaces as an opaque write error at the one moment the athlete is saving
 * work. Absent optionals must therefore be OMITTED, not set to undefined.
 */
describe('drafts carry no undefined value, which Firestore would reject', () => {
  function undefinedPaths(value: unknown, path = '$'): string[] {
    if (value === undefined) return [path];
    if (Array.isArray(value)) {
      return value.flatMap((entry, index) => undefinedPaths(entry, `${path}[${index}]`));
    }
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, entry]) =>
        undefinedPaths(entry, `${path}.${key}`),
      );
    }
    return [];
  }

  it('holds for a routine draft', () => {
    const draft = toRoutineDraft({
      userId: 'uid-1',
      name: 'Mi rutina',
      icon: 'barbell',
      accentColor: '#C8F751',
      isActive: false,
      generation: {
        goal: TrainingGoal.HYPERTROPHY,
        experienceLevel: ExperienceLevel.INTERMEDIATE,
        split: SplitStructure.AUTO,
        sessionsPerMicrocycle: 4,
        minutesPerSession: 60,
        availableEquipment: [Equipment.BARBELL],
        priorityRegions: [],
        deprioritizedRegions: [],
        vetoedExerciseIds: [],
        seed: 4242,
      },
      now: NOW,
    });
    expect(undefinedPaths(draft)).toEqual([]);
  });

  it('holds for a mesocycle draft, with and without preview edits', () => {
    const plan = generate();
    const automatic = toMesocycleDraft({ userId: 'uid-1', routineId: 'r1', plan, now: NOW });
    expect(undefinedPaths(automatic)).toEqual([]);
    expect(
      undefinedPaths(
        toMesocycleDraft({
          userId: 'uid-1',
          routineId: 'r1',
          plan,
          plannedSessions: automatic.plannedSessions,
          now: NOW,
        }),
      ),
    ).toEqual([]);
  });
});

describe('one active routine', () => {
  it('activates a new routine only when none is active', () => {
    expect(shouldActivateNewRoutine([])).toBe(true);
    expect(shouldActivateNewRoutine([{ isActive: false }, {}])).toBe(true);
    expect(shouldActivateNewRoutine([{ isActive: false }, { isActive: true }])).toBe(false);
  });

  it('writes only the flags that change', () => {
    const routines = [
      { id: 'a', isActive: true },
      { id: 'b', isActive: false },
      { id: 'c' },
    ];
    expect(activationChanges(routines, 'b')).toEqual([
      { id: 'a', isActive: false },
      { id: 'b', isActive: true },
    ]);
    expect(activationChanges(routines, 'a')).toEqual([]);
  });

  it('repairs a state with two active routines', () => {
    expect(activationChanges([{ id: 'a', isActive: true }, { id: 'b', isActive: true }], 'a')).toEqual([
      { id: 'b', isActive: false },
    ]);
  });
});

describe('routineNameProblem', () => {
  it('requires a name: there is no default', () => {
    expect(routineNameProblem('', [])).toBe('empty');
    expect(routineNameProblem('   ', ['Fuerza'])).toBe('empty');
  });

  it('rejects a name the athlete already uses, ignoring case and spacing', () => {
    expect(routineNameProblem(' fuerza  4 días', ['Fuerza 4 días'])).toBe('duplicate');
    expect(routineNameProblem('Fuerza', ['', 'Hipertrofia'])).toBeNull();
  });
});

describe('normalizeRoutineName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeRoutineName('  Fuerza   de  otoño ')).toBe('Fuerza de otoño');
  });

  it('rejects an empty or blank name', () => {
    expect(normalizeRoutineName('')).toBeNull();
    expect(normalizeRoutineName('   ')).toBeNull();
  });

  it('caps the length to what fits on a card', () => {
    expect(normalizeRoutineName('x'.repeat(90))).toHaveLength(MAX_ROUTINE_NAME_LENGTH);
  });
});
