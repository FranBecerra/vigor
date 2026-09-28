import { Equipment, SetType, SplitStructure, type Mesocycle, type PlannedSession, type Routine } from '@/models';
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

  it('treats a deloading mesocycle as active and a finished or foreign one as not', () => {
    expect(toRoutineView(routine(), mesocycle('r1-m0', { status: 'DELOAD' }), BY_ID, LABELS)?.isActive).toBe(true);
    expect(toRoutineView(routine(), mesocycle('r1-m0', { status: 'COMPLETED' }), BY_ID, LABELS)?.isActive).toBe(false);
    expect(toRoutineView(routine(), mesocycle('other'), BY_ID, LABELS)?.isActive).toBe(false);
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

  it('skips routines with nothing pending and returns empty when none has', () => {
    const done = {
      ...active,
      id: 'done',
      microcycles: active.microcycles.map((m) => ({
        ...m,
        sessions: m.sessions.map((s) => ({ ...s, completedOn: '2026-09-28' })),
      })),
    };
    const outOfRange = { ...active, id: 'broken', currentMicrocycleIndex: 99 };
    expect(defaultSessionId([done, outOfRange, active])).toBe(active.microcycles[0].sessions[0].id);
    expect(defaultSessionId([done])).toBe('');
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
