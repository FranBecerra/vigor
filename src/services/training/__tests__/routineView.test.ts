import { Equipment, SetType, SplitStructure, type Mesocycle, type PlannedSession, type Routine, type WorkoutSession } from '@/models';
import { ExperienceLevel } from '@/models/athlete';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { planMesocycle } from '@/services/training/mesocyclePlanner';
import { toMesocycleDraft, toRoutineDraft } from '@/services/training/routineMapper';
import { restDurationFor } from '@/services/training/restTimer';
import { TrainingGoal } from '@/services/training/volumePlan';
import {
  DEFAULT_PROJECTED_MICROCYCLES,
  defaultExpandedRoutineId,
  defaultSessionId,
  loadRoutineViews,
  orderRoutineViews,
  sessionNames,
  toRoutineView,
  type RoutineView,
} from '@/services/training/routineView';

const NOW = 1_800_000_000_000;
const BY_ID = new Map(EXERCISE_CATALOGUE.map((exercise) => [exercise.id, exercise]));
const LABELS = {
  focus: (focus: string) => focus.toLowerCase(),
  goal: (goal: string) => `goal:${goal}`,
};

it('calibrates duration only from matching completed workout doses', () => {
  const exercise = EXERCISE_CATALOGUE[0];
  const planned: PlannedSession = { index: 0, focus: 'PUSH', estimatedWorkMinutes: 9,
    exercises: [{ exerciseId: exercise.id, order: 0, isEdited: false, restSeconds: 120,
      sets: Array.from({ length: 3 }, () => ({ setType: SetType.NORMAL, targetReps: 10, targetRIR: 2 })) }] };
  const meso = mesocycle('r1-m0', { plannedSessions: [planned], sessionsPerMicrocycle: 1 });
  const history: WorkoutSession[] = Array.from({ length: 5 }, (_, index) => ({
    id: `workout-${index}`, userId: 'u1', mesocycleId: meso.id, microcycleId: `m${index}`,
    microcycleIndex: index, plannedSessionIndex: 0, performedAt: NOW, completedAt: NOW + 18 * 60000,
    exercises: [{ id: exercise.id, exerciseId: exercise.id, order: 0, isSwap: false,
      sets: planned.exercises[0].sets.map((set, i) => ({ ...set, id: `s${i}`, targetWeight: 20,
        actualReps: 10, actualWeight: 20, isAutoFilled: false })) }],
  }));
  expect(toRoutineView(routine(), meso, BY_ID, LABELS, history)?.durationFeedback)
    .toMatchObject({ ready: true, sampleCount: 5, observedMultiplier: 1.2 });
  const incomplete = history.map((session) => ({ ...session, completedAt: undefined }));
  expect(toRoutineView(routine(), meso, BY_ID, LABELS, incomplete)?.durationFeedback).toBeUndefined();
  const swapped = history.map((session) => ({ ...session,
    exercises: session.exercises.map((e) => ({ ...e, exerciseId: 'missing' })) }));
  expect(toRoutineView(routine(), meso, BY_ID, LABELS, swapped)?.durationFeedback).toBeUndefined();
});

it('recommends dated pending sessions in calendar order without completing a rest marker', () => {
  const meso = mesocycle('r1-m0', { trainingCalendar: {
    '0:0': { kind: 'workout', date: '2026-10-03', microcycleIndex: 0, sessionIndex: 0 },
    '0:1': { kind: 'workout', date: '2026-10-01', microcycleIndex: 0, sessionIndex: 1 },
    'rest:2026-10-02': { kind: 'rest', date: '2026-10-02', microcycleIndex: 0, checked: true },
  } });
  const view = toRoutineView(routine(), meso, BY_ID, LABELS)!;
  expect(defaultSessionId([view])).toBe('r1-m0:m0:s1');
  expect(view.currentMicrocycleIndex).toBe(0);
  expect(view.microcycles[0].sessions).toHaveLength(4);
});

function routine(id = 'r1', overrides: Partial<Routine> = {}): Routine {
  return {
    id,
    ...toRoutineDraft({
      userId: 'u1',
      name: 'My routine',
      icon: 'barbell',
      accentColor: '#9BE317',
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
        seed: 1,
      },
      isActive: true,
      now: NOW,
    }),
    activeMesocycleId: `${id}-m0`,
    ...overrides,
  };
}

function mesocycle(id = 'r1-m0', overrides: Partial<Mesocycle> = {}): Mesocycle {
  const plan = planMesocycle({
    level: ExperienceLevel.INTERMEDIATE,
    goal: TrainingGoal.HYPERTROPHY,
    catalogue: EXERCISE_CATALOGUE,
    seed: 1,
    split: SplitStructure.AUTO,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 },
  });
  return { id, ...toMesocycleDraft({ userId: 'u1', routineId: 'r1', plan, now: NOW }), ...overrides };
}

function session(index: number, focus: PlannedSession['focus']): PlannedSession {
  return { index, focus, exercises: [], estimatedWorkMinutes: 0 };
}

describe('sessionNames', () => {
  it('uses the bare focus label when a focus appears once', () => {
    expect(sessionNames([session(0, 'PUSH'), session(1, 'PULL')], LABELS.focus)).toEqual([
      'push',
      'pull',
    ]);
  });

  it('letters repeated focuses so rows can be told apart', () => {
    expect(
      sessionNames(
        [session(0, 'UPPER'), session(1, 'LOWER'), session(2, 'UPPER')],
        LABELS.focus,
      ),
    ).toEqual(['upper A', 'lower', 'upper B']);
  });
});

describe('toRoutineView', () => {
  const meso = mesocycle();
  const view = toRoutineView(routine(), meso, BY_ID, LABELS) as RoutineView;

  it('carries the routine identity and a translated objective', () => {
    expect(view).toMatchObject({
      id: 'r1',
      name: 'My routine',
      icon: 'barbell',
      color: '#9BE317',
      domain: 'STRENGTH',
      objective: `goal:${TrainingGoal.HYPERTROPHY}`,
      isActive: true,
      currentMicrocycleIndex: 0,
    });
  });

  it('projects the default horizon and marks only the last microcycle as deload', () => {
    expect(view.microcycles).toHaveLength(DEFAULT_PROJECTED_MICROCYCLES);
    expect(view.microcycles.map((m) => m.isDeload)).toEqual([false, false, false, false, false, true]);
    expect(view.microcycles.map((m) => m.isProjected)).toEqual([false, true, true, true, true, true]);
    expect(view.microcycles.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('repeats every planned set, resolved against the catalogue', () => {
    const planned = meso.plannedSessions ?? [];
    const current = view.microcycles[0];
    expect(current.sessions).toHaveLength(planned.length);
    current.sessions.forEach((viewSession, position) => {
      const source = planned[position];
      expect(viewSession.exercises).toHaveLength(source.exercises.length);
      viewSession.exercises.forEach((exercise, order) => {
        const plannedExercise = source.exercises[order];
        const catalogue = BY_ID.get(plannedExercise.exerciseId)!;
        expect(exercise.name).toBe(catalogue.name);
        expect(exercise.primaryMuscle).toBe(catalogue.primaryMuscle);
        expect(exercise.sets).toHaveLength(plannedExercise.sets.length);
        expect(exercise.restSeconds).toBe(restDurationFor(catalogue.profile));
        expect(exercise.targetRIR).toBe(Math.min(...plannedExercise.sets.map((s) => s.targetRIR)));
      });
    });
  });

  it('gives each session a distinct id per microcycle', () => {
    const ids = view.microcycles.flatMap((m) => m.sessions.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('formats a range with a dash and a fixed target as a single number', () => {
    const exercises = [
      {
        exerciseId: EXERCISE_CATALOGUE[0].id,
        order: 1,
        isEdited: false,
        sets: [{ setType: SetType.NORMAL, targetRepsMin: 6, targetReps: 10, targetRIR: 2 }],
      },
      {
        exerciseId: EXERCISE_CATALOGUE[1].id,
        order: 0,
        isEdited: false,
        sets: [{ setType: SetType.NORMAL, targetReps: 8, targetRIR: 1 }],
      },
    ];
    const custom = mesocycle('r1-m0', {
      plannedSessions: [{ index: 0, focus: 'FULL_BODY', exercises, estimatedWorkMinutes: 30 }],
    });
    const result = toRoutineView(routine(), custom, BY_ID, LABELS) as RoutineView;
    const rendered = result.microcycles[0].sessions[0].exercises;
    // Sorted by order, not by storage position.
    expect(rendered.map((e) => e.exerciseId)).toEqual([EXERCISE_CATALOGUE[1].id, EXERCISE_CATALOGUE[0].id]);
    expect(rendered.map((e) => e.repRange)).toEqual(['8', '6–10']);
  });

  it('uses the prescribed rest and the working-set effort, not the heavy single', () => {
    const custom = mesocycle('r1-m0', {
      plannedSessions: [
        {
          index: 0,
          focus: 'LOWER',
          estimatedWorkMinutes: 30,
          exercises: [
            {
              exerciseId: 'sentadilla-libre',
              order: 0,
              isEdited: false,
              restSeconds: 240,
              strengthRole: 'MAIN',
              sets: [
                { setType: SetType.TOP_SINGLE, targetRepsMin: 1, targetReps: 1, targetRIR: 2 },
                { setType: SetType.NORMAL, targetRepsMin: 3, targetReps: 5, targetRIR: 3 },
              ],
            },
            {
              exerciseId: 'plancha',
              order: 1,
              isEdited: false,
              sets: [{ setType: SetType.TOP_SINGLE, targetReps: 1, targetRIR: 2 }],
            },
          ],
        },
      ],
    });
    const strengthRoutine = routine('r1', {
      generation: { ...routine().generation, goal: TrainingGoal.STRENGTH },
    });
    const result = toRoutineView(strengthRoutine, custom, BY_ID, LABELS) as RoutineView;
    const [squat, plank] = result.microcycles[0].sessions[0].exercises;
    expect(squat.restSeconds).toBe(240);
    expect(squat.targetRIR).toBe(3);
    expect(squat.repRange).toBe('3–5');
    expect(squat.sets.map((set) => set.setType)).toEqual([SetType.TOP_SINGLE, SetType.NORMAL]);
    // A single-only entry falls back to the single's own effort.
    expect(plank.targetRIR).toBe(2);
    // The strength ramp reaches RIR 1 in the last accumulation microcycle.
    expect(result.microcycles[4].sessions[0].exercises[0].targetRIR).toBe(1);
    expect(result.microcycles[4].intensityAdjustmentRIR).toBeLessThan(0);
  });

  it('shows the deload with fewer sets than the base microcycle', () => {
    const deload = view.microcycles[view.microcycles.length - 1];
    expect(deload.isDeload).toBe(true);
    expect(deload.volumeAdjustmentSets).toBeLessThan(0);
    expect(deload.intensityAdjustmentRIR).toBeGreaterThan(0);
    expect(view.microcycles[0].volumeAdjustmentSets).toBe(0);
    expect(view.microcycles[0].intensityAdjustmentRIR).toBe(0);
  });

  it('drops exercises the catalogue does not know and exercises with no sets', () => {
    const custom = mesocycle('r1-m0', {
      plannedSessions: [
        {
          index: 0,
          focus: 'FULL_BODY',
          estimatedWorkMinutes: 30,
          exercises: [
            { exerciseId: 'gone', order: 0, isEdited: false, sets: [{ setType: SetType.NORMAL, targetReps: 8, targetRIR: 1 }] },
            { exerciseId: EXERCISE_CATALOGUE[0].id, order: 1, isEdited: false, sets: [] },
          ],
        },
      ],
    });
    const result = toRoutineView(routine(), custom, BY_ID, LABELS) as RoutineView;
    expect(result.microcycles[0].sessions[0].exercises).toEqual([]);
  });

  it('extends the horizon past a mesocycle that outlived its projection', () => {
    const result = toRoutineView(
      routine(),
      mesocycle('r1-m0', { projectedMicrocycles: 3, currentMicrocycleIndex: 4 }),
      BY_ID,
      LABELS,
    ) as RoutineView;
    expect(result.microcycles).toHaveLength(5);
    expect(result.currentMicrocycleIndex).toBe(4);
  });

  it('has no deload in a single-microcycle horizon', () => {
    const result = toRoutineView(
      routine(),
      mesocycle('r1-m0', { projectedMicrocycles: 1 }),
      BY_ID,
      LABELS,
    ) as RoutineView;
    expect(result.microcycles.map((m) => m.isDeload)).toEqual([false]);
  });

  it('takes the active flag from the routine, not from the mesocycle', () => {
    expect(toRoutineView(routine('r1', { isActive: false }), meso, BY_ID, LABELS)?.isActive).toBe(false);
    expect(toRoutineView(routine('r1', { isActive: undefined }), meso, BY_ID, LABELS)?.isActive).toBe(false);
    expect(toRoutineView(routine(), mesocycle('r1-m0', { status: 'DELOAD' }), BY_ID, LABELS)?.isActive).toBe(true);
  });

  it('marks a completed planned session with its real date', () => {
    const completed: WorkoutSession = {
      id: 'done', userId: 'u1', mesocycleId: meso.id, microcycleId: `${meso.id}:m0`,
      microcycleIndex: 0, plannedSessionIndex: 0, performedAt: NOW, completedAt: NOW,
      exercises: [],
    };
    const result = toRoutineView(routine(), meso, BY_ID, LABELS, [completed]) as RoutineView;
    expect(result.microcycles[0].sessions[0].completedOn).toBe('2027-01-15');
    expect(result.currentMicrocycleIndex).toBe(0);
  });

  it('returns null for a half-finished save with no prescription', () => {
    expect(toRoutineView(routine(), null, BY_ID, LABELS)).toBeNull();
    expect(toRoutineView(routine(), mesocycle('r1-m0', { plannedSessions: undefined }), BY_ID, LABELS)).toBeNull();
    expect(toRoutineView(routine(), mesocycle('r1-m0', { plannedSessions: [] }), BY_ID, LABELS)).toBeNull();
  });
});

describe('ordering and defaults', () => {
  const active = toRoutineView(routine('old'), mesocycle('old-m0'), BY_ID, LABELS) as RoutineView;
  const newer = { ...active, id: 'new', isActive: false };
  const newest = { ...active, id: 'newest', isActive: false };
  const created = new Map([
    ['old', 1],
    ['new', 2],
    ['newest', 3],
  ]);

  it('puts the active routine first, then the newest', () => {
    expect(orderRoutineViews([newer, active, newest], created).map((r) => r.id)).toEqual([
      'old',
      'newest',
      'new',
    ]);
  });

  it('orders unknown creation times last', () => {
    expect(orderRoutineViews([newer, newest], new Map()).map((r) => r.id)).toEqual(['new', 'newest']);
  });

  it('expands the active routine, else the first, else nothing', () => {
    expect(defaultExpandedRoutineId([newer, active])).toBe('old');
    expect(defaultExpandedRoutineId([newer, newest])).toBe('new');
    expect(defaultExpandedRoutineId([])).toBe('');
  });

  it("selects the first pending session of the running microcycle as today's", () => {
    expect(defaultSessionId([active])).toBe(active.microcycles[0].sessions[0].id);
  });

  it('shows a skip without calling it a completed workout and advances past skipped sessions', () => {
    const baseMeso = mesocycle('skip-m0');
    const first = toRoutineView(routine('skip'), baseMeso, BY_ID, LABELS) as RoutineView;
    const keys = first.microcycles[0].sessions.map((session) =>
      `0:${session.plannedSessionIndex}`);
    const one = toRoutineView(routine('skip'), {
      ...baseMeso, skippedSessions: { [keys[0]]: NOW },
    }, BY_ID, LABELS) as RoutineView;
    expect(one.microcycles[0].sessions[0].skippedOn).toBeDefined();
    expect(one.microcycles[0].sessions[0].completedOn).toBeUndefined();
    expect(defaultSessionId([one])).toBe(one.microcycles[0].sessions[1].id);
    const all = toRoutineView(routine('skip'), {
      ...baseMeso, skippedSessions: Object.fromEntries(keys.map((key) => [key, NOW])),
    }, BY_ID, LABELS) as RoutineView;
    expect(all.currentMicrocycleIndex).toBe(1);
  });

  it('takes today only from the active routine, and nothing when it has nothing pending', () => {
    const done = {
      ...active,
      id: 'done',
      microcycles: active.microcycles.map((m) => ({
        ...m,
        sessions: m.sessions.map((s) => ({ ...s, completedOn: '2026-09-28' })),
      })),
    };
    const outOfRange = { ...active, id: 'broken', currentMicrocycleIndex: 99 };
    expect(defaultSessionId([newer, active])).toBe(active.microcycles[0].sessions[0].id);
    expect(defaultSessionId([newer, newest])).toBe('');
    expect(defaultSessionId([done])).toBe('');
    expect(defaultSessionId([outOfRange])).toBe('');
  });
});

describe('loadRoutineViews', () => {
  it('joins each routine with its active mesocycle and hides half-finished saves', async () => {
    const getMesocycle = jest.fn(async (id: string) => (id === 'a-m0' ? mesocycle('a-m0') : null));
    const views = await loadRoutineViews(
      'u1',
      {
        listRoutines: async () => [
          routine('a', { createdAt: 1 }),
          routine('b', { activeMesocycleId: undefined }),
          routine('c', { activeMesocycleId: 'missing' }),
        ],
        getMesocycle,
      },
      BY_ID,
      LABELS,
    );
    expect(views.map((v) => v.id)).toEqual(['a']);
    expect(getMesocycle.mock.calls.map(([id]) => id)).toEqual(['a-m0', 'missing']);
  });

  it('orders by creation time and tolerates a non-numeric timestamp', async () => {
    const views = await loadRoutineViews(
      'u1',
      {
        listRoutines: async () => [
          routine('a', { createdAt: 1, activeMesocycleId: 'x' }),
          routine('b', { createdAt: { seconds: 5 } as unknown as number, activeMesocycleId: 'x' }),
          routine('c', { createdAt: 2, activeMesocycleId: 'x' }),
        ],
        getMesocycle: async () => mesocycle('other'),
      },
      BY_ID,
      LABELS,
    );
    expect(views.map((v) => v.id)).toEqual(['c', 'a', 'b']);
  });

  it('propagates a read failure so the screen can offer a retry', async () => {
    await expect(
      loadRoutineViews(
        'u1',
        { listRoutines: async () => Promise.reject(new Error('offline')), getMesocycle: async () => null },
        BY_ID,
        LABELS,
      ),
    ).rejects.toThrow('offline');
  });
});
