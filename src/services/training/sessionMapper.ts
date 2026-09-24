/**
 * Conversión entre el estado de la pantalla de sesión y el modelo persistido
 * `WorkoutSession` — LÓGICA PURA.
 *
 * Por qué existe esta capa: la pantalla trabaja con un mapa
 * `exerciseId -> series[]` porque es lo que necesita el carrusel, mientras
 * Firestore guarda una lista ordenada de `WorkoutExercise`. Traducir en un sitio
 * único evita que cada pantalla invente su propio formato, y permite testear la
 * ida y la vuelta sin tocar la red.
 *
 * INVARIANTE CLAVE: la conversión debe ser reversible. Guardar y volver a leer
 * tiene que devolver las mismas series, en el mismo orden, con los mismos
 * tramos. Si no lo fuera, el usuario perdería trabajo real al reabrir la app.
 */
import type { SetExtension, WorkoutExercise, WorkoutSession, WorkoutSet } from '@/models';

/** Serie tal como la maneja la pantalla: el modelo más su estado de ejecución. */
export interface SessionSetState extends WorkoutSet {
  isCompleted: boolean;
  previous?: { weight: number; reps: number; rir: number };
}

/** Estado de la pantalla: series por ejercicio. */
export type SessionSetsByExercise = Record<string, SessionSetState[]>;

/**
 * Serie persistida. `isCompleted` NO se guarda como campo propio: se deriva de
 * que existan valores reales registrados. Guardar ambas cosas permitiría que se
 * contradijeran, y entonces habría que decidir cuál gana.
 */
function toPersistedSet(set: SessionSetState): WorkoutSet {
  const { isCompleted, previous, ...persisted } = set;
  return persisted;
}

/** ¿Esta serie cuenta como ejecutada? */
export function isSetCompleted(set: WorkoutSet): boolean {
  return set.actualReps !== undefined && set.actualWeight !== undefined;
}

/**
 * Construye los `WorkoutExercise` en el ORDEN dado por `exerciseOrder`.
 *
 * El orden lo manda la sesión, no las claves del objeto: el orden de las claves
 * de un objeto no es una garantía sobre la que se deba construir el historial.
 * Un ejercicio sin series se omite en lugar de guardarse vacío.
 */
export function toWorkoutExercises(
  exerciseOrder: readonly string[],
  setsByExercise: SessionSetsByExercise,
): WorkoutExercise[] {
  const exercises: WorkoutExercise[] = [];

  exerciseOrder.forEach((exerciseId) => {
    const sets = setsByExercise[exerciseId] ?? [];
    if (sets.length === 0) return;
    exercises.push({
      id: exerciseId,
      exerciseId,
      order: exercises.length,
      sets: sets.map(toPersistedSet),
      isSwap: false,
    });
  });

  return exercises;
}

/** Datos de la sesión que no viven en el estado de series. */
export interface SessionContext {
  sessionId: string;
  userId: string;
  mesocycleId: string;
  microcycleId: string;
  microcycleIndex: number;
  performedAt: number;
  /** Instante de cierre. Ausente mientras la sesión sigue en curso. */
  completedAt?: number;
}

/** Documento listo para guardar. */
export function toWorkoutSession(
  context: SessionContext,
  exerciseOrder: readonly string[],
  setsByExercise: SessionSetsByExercise,
): WorkoutSession {
  const session: WorkoutSession = {
    id: context.sessionId,
    userId: context.userId,
    mesocycleId: context.mesocycleId,
    microcycleId: context.microcycleId,
    microcycleIndex: context.microcycleIndex,
    exercises: toWorkoutExercises(exerciseOrder, setsByExercise),
    performedAt: context.performedAt,
  };
  // Se omite la clave en lugar de escribir `undefined`: Firestore rechaza
  // valores undefined, y un campo ausente es la forma correcta de decir
  // "todavía no ha ocurrido".
  if (context.completedAt !== undefined) {
    session.completedAt = context.completedAt;
  }
  return session;
}

/**
 * Reconstruye el estado de la pantalla desde un documento guardado.
 * Es la vuelta del viaje: `toWorkoutSession` seguido de esto debe devolver las
 * mismas series.
 */
export function toSessionSetsByExercise(session: WorkoutSession): SessionSetsByExercise {
  const byExercise: SessionSetsByExercise = {};

  [...session.exercises]
    .sort((a, b) => a.order - b.order)
    .forEach((exercise) => {
      byExercise[exercise.exerciseId] = exercise.sets.map((set) => ({
        ...set,
        isCompleted: isSetCompleted(set),
      }));
    });

  return byExercise;
}

/** Orden de ejercicios de una sesión guardada. */
export function exerciseOrderOf(session: WorkoutSession): string[] {
  return [...session.exercises]
    .sort((a, b) => a.order - b.order)
    .map((exercise) => exercise.exerciseId);
}

/** Series totales y completadas, para el resumen de cabecera. */
export function sessionProgress(setsByExercise: SessionSetsByExercise): {
  total: number;
  completed: number;
} {
  const all = Object.values(setsByExercise).flat();
  return {
    total: all.length,
    completed: all.filter((set) => set.isCompleted).length,
  };
}

/** true si la sesión no tiene ningún dato que merezca guardarse. */
export function isSessionEmpty(setsByExercise: SessionSetsByExercise): boolean {
  return Object.values(setsByExercise).every((sets) => sets.length === 0);
}

/** Tramos extra normalizados: descarta los que el usuario dejó sin rellenar. */
export function cleanExtensions(extensions: readonly SetExtension[] | undefined): SetExtension[] {
  return (extensions ?? []).filter((extension) => extension.reps !== undefined);
}
