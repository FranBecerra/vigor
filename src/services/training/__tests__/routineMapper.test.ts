import { Equipment, SetType, SplitStructure } from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { planMesocycle, type MesocyclePlan } from '@/services/training/mesocyclePlanner';
import { TrainingGoal, VolumeRegion } from '@/services/training/volumePlan';
import { targetRIR } from '@/services/training/rirAutoregulation';
import {
  DEFAULT_TARGET_REPS,
  editedExerciseIds,
  plannedExerciseIds,
  toMesocycleDraft,
  toPlannedSession,
  toPlannedSessions,
  toRoutineDraft,
  totalPlannedSets,
} from '@/services/training/routineMapper';

const NOW = 1_800_000_000_000;

function generate(sessions = 4, minutes = 60): MesocyclePlan {
  return planMesocycle({
    level: ExperienceLevel.INTERMEDIATE,
    goal: TrainingGoal.HYPERTROPHY,
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
      expect(rirs[rirs.length - 1]).toBe(targetRIR(profile));
      for (let index = 1; index < rirs.length; index += 1) {
        expect(rirs[index]).toBeLessThanOrEqual(rirs[index - 1]);
      }
    });
  });

  it('raises intensity in the final microcycle before a deload', () => {
    // Volume is static within the mesocycle, so intensity is the only thing that
    // moves between microcycles (§3).
    const peak = toPlannedSession(session, true);
    const routine = planned.exercises[0].sets.map((set) => set.targetRIR);
    const peaked = peak.exercises[0].sets.map((set) => set.targetRIR);
    expect(peaked.every((rir, index) => rir <= routine[index])).toBe(true);
    expect(peaked).not.toEqual(routine);
  });

  it('marks nothing as edited on generation', () => {
    planned.exercises.forEach((exercise) => expect(exercise.isEdited).toBe(false));
  });

  it('prescribes normal working sets with the default rep target', () => {
    planned.exercises.forEach((exercise) =>
      exercise.sets.forEach((set) => {
        expect(set.setType).toBe(SetType.NORMAL);
        expect(set.targetReps).toBe(DEFAULT_TARGET_REPS);
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
