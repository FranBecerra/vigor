import { SetType, type WorkoutSession } from '@/models';
import {
  cleanExtensions,
  exerciseOrderOf,
  isSessionEmpty,
  isSetCompleted,
  sessionProgress,
  toSessionSetsByExercise,
  toWorkoutExercises,
  toWorkoutSession,
  type SessionContext,
  type SessionSetState,
} from '@/services/training/sessionMapper';

function setState(overrides: Partial<SessionSetState> = {}): SessionSetState {
  return {
    id: 's1',
    setType: SetType.NORMAL,
    targetReps: 8,
    targetRIR: 2,
    targetWeight: 80,
    isAutoFilled: false,
    isCompleted: false,
    ...overrides,
  };
}

const context: SessionContext = {
  sessionId: 'session-1',
  userId: 'user-1',
  mesocycleId: 'meso-1',
  microcycleId: 'micro-1',
  microcycleIndex: 2,
  performedAt: 1_700_000_000_000,
};

describe('isSetCompleted', () => {
  it('es true solo con peso y reps reales registrados', () => {
    expect(isSetCompleted(setState({ actualReps: 8, actualWeight: 80 }))).toBe(true);
  });

  it('es false si falta alguno de los dos', () => {
    expect(isSetCompleted(setState({ actualReps: 8 }))).toBe(false);
    expect(isSetCompleted(setState({ actualWeight: 80 }))).toBe(false);
    expect(isSetCompleted(setState())).toBe(false);
  });

  it('acepta ceros reales como registro válido', () => {
    expect(isSetCompleted(setState({ actualReps: 0, actualWeight: 0 }))).toBe(true);
  });
});

describe('toWorkoutExercises', () => {
  it('respeta el orden recibido, no el de las claves del objeto', () => {
    const exercises = toWorkoutExercises(['ohp', 'bench'], {
      bench: [setState({ id: 'b1' })],
      ohp: [setState({ id: 'o1' })],
    });
    expect(exercises.map((e) => e.exerciseId)).toEqual(['ohp', 'bench']);
    expect(exercises.map((e) => e.order)).toEqual([0, 1]);
  });

  it('omite los ejercicios sin series', () => {
    const exercises = toWorkoutExercises(['bench', 'vacio'], {
      bench: [setState()],
      vacio: [],
    });
    expect(exercises).toHaveLength(1);
    expect(exercises[0].order).toBe(0);
  });

  it('no guarda el estado de interfaz en el documento', () => {
    const exercises = toWorkoutExercises(['bench'], {
      bench: [setState({ isCompleted: true, previous: { weight: 80, reps: 8, rir: 2 } })],
    });
    expect(exercises[0].sets[0]).not.toHaveProperty('isCompleted');
    expect(exercises[0].sets[0]).not.toHaveProperty('previous');
  });

  it('devuelve lista vacía sin ejercicios', () => {
    expect(toWorkoutExercises([], {})).toEqual([]);
  });

  it('omite un ejercicio que no está en el estado', () => {
    // El orden puede nombrar un ejercicio que la pantalla aún no ha cargado.
    expect(toWorkoutExercises(['fantasma'], {})).toEqual([]);
  });
});

describe('toWorkoutSession', () => {
  it('construye el documento con el contexto de la sesión', () => {
    const session = toWorkoutSession(context, ['bench'], { bench: [setState()] });
    expect(session.id).toBe('session-1');
    expect(session.userId).toBe('user-1');
    expect(session.microcycleIndex).toBe(2);
    expect(session.exercises).toHaveLength(1);
  });

  it('OMITE completedAt mientras la sesión sigue en curso', () => {
    const session = toWorkoutSession(context, ['bench'], { bench: [setState()] });
    expect('completedAt' in session).toBe(false);
  });

  it('incluye completedAt al cerrar la sesión', () => {
    const session = toWorkoutSession(
      { ...context, completedAt: 1_700_000_100_000 },
      ['bench'],
      { bench: [setState()] },
    );
    expect(session.completedAt).toBe(1_700_000_100_000);
  });
});

describe('round-trip: guardar y volver a leer', () => {
  it('devuelve las mismas series, en el mismo orden', () => {
    const original = {
      bench: [
        setState({ id: 'b1', actualReps: 8, actualWeight: 80, isCompleted: true }),
        setState({ id: 'b2' }),
      ],
      ohp: [setState({ id: 'o1', actualReps: 6, actualWeight: 45, isCompleted: true })],
    };
    const session = toWorkoutSession(context, ['bench', 'ohp'], original);
    const restored = toSessionSetsByExercise(session);

    expect(Object.keys(restored)).toEqual(['bench', 'ohp']);
    expect(restored.bench.map((s) => s.id)).toEqual(['b1', 'b2']);
    expect(restored.bench[0].isCompleted).toBe(true);
    expect(restored.bench[1].isCompleted).toBe(false);
    expect(restored.ohp[0].actualWeight).toBe(45);
  });

  it('conserva los tramos de una serie avanzada', () => {
    const session = toWorkoutSession(context, ['tri'], {
      tri: [
        setState({
          id: 't1',
          setType: SetType.DROP_SET,
          actualReps: 10,
          actualWeight: 20,
          isCompleted: true,
          extensions: [
            { reps: 6, weight: 15 },
            { reps: 4, weight: 10 },
          ],
        }),
      ],
    });
    const restored = toSessionSetsByExercise(session);
    expect(restored.tri[0].extensions).toEqual([
      { reps: 6, weight: 15 },
      { reps: 4, weight: 10 },
    ]);
  });

  it('reordena por `order` aunque llegue desordenado de la red', () => {
    const session: WorkoutSession = {
      ...toWorkoutSession(context, ['bench', 'ohp'], {
        bench: [setState({ id: 'b1' })],
        ohp: [setState({ id: 'o1' })],
      }),
    };
    session.exercises = [...session.exercises].reverse();
    expect(exerciseOrderOf(session)).toEqual(['bench', 'ohp']);
    expect(Object.keys(toSessionSetsByExercise(session))).toEqual(['bench', 'ohp']);
  });
});

describe('sessionProgress', () => {
  it('cuenta series totales y completadas', () => {
    expect(
      sessionProgress({
        bench: [setState({ isCompleted: true }), setState()],
        ohp: [setState({ isCompleted: true })],
      }),
    ).toEqual({ total: 3, completed: 2 });
  });

  it('es cero sin series', () => {
    expect(sessionProgress({})).toEqual({ total: 0, completed: 0 });
  });
});

describe('isSessionEmpty', () => {
  it('es true sin ejercicios y con ejercicios sin series', () => {
    expect(isSessionEmpty({})).toBe(true);
    expect(isSessionEmpty({ bench: [] })).toBe(true);
  });

  it('es false con al menos una serie', () => {
    expect(isSessionEmpty({ bench: [setState()] })).toBe(false);
  });
});

describe('cleanExtensions', () => {
  it('descarta los tramos que el usuario dejó vacíos', () => {
    expect(cleanExtensions([{ reps: 3 }, {}, { reps: 2, weight: 40 }])).toEqual([
      { reps: 3 },
      { reps: 2, weight: 40 },
    ]);
  });

  it('devuelve lista vacía sin tramos', () => {
    expect(cleanExtensions(undefined)).toEqual([]);
    expect(cleanExtensions([])).toEqual([]);
  });
});
