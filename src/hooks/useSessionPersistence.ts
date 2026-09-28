/**
 * Persistencia de la sesión de entrenamiento en curso.
 *
 * Qué resuelve: hoy la sesión vive solo en memoria, así que cerrar la app pierde
 * el entrenamiento. Este hook la guarda en Firestore y la recupera al volver.
 *
 * TRES DECISIONES QUE IMPORTAN
 *
 * 1. ESCRITURA DIFERIDA (debounce). Escribir en cada pulsación de tecla
 *    generaría una escritura por carácter mientras el usuario teclea un peso.
 *    Se agrupan los cambios y se escribe una vez pasados `WRITE_DELAY_MS` sin
 *    actividad. El usuario no percibe la diferencia; la cuota de Firestore sí.
 *
 * 2. LA RED NO BLOQUEA LA INTERFAZ. El estado local es la fuente de verdad
 *    mientras se entrena; el guardado ocurre detrás. React Native Firebase tiene
 *    caché en disco activada por defecto, así que una escritura sin cobertura se
 *    encola y sincroniza sola al recuperar red (PRD §2.1). Entrenar en un sótano
 *    sin señal es el caso normal, no la excepción.
 *
 * 3. NO SE GUARDA UNA SESIÓN VACÍA. Abrir la pantalla y salir sin registrar nada
 *    no debe dejar un documento huérfano en el historial.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { workoutSessionRepository } from '@/services/repositories';
import {
  isSessionEmpty,
  toSessionSetsByExercise,
  toWorkoutSession,
  type SessionContext,
  type SessionSetsByExercise,
} from '@/services/training/sessionMapper';

/** Margen de inactividad antes de escribir. Suficiente para agrupar el tecleo. */
const WRITE_DELAY_MS = 1200;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseSessionPersistenceOptions {
  /** Contexto de la sesión. `null` mientras no hay usuario autenticado. */
  context: SessionContext | null;
  exerciseOrder: readonly string[];
  setsByExercise: SessionSetsByExercise;
  /** Se invoca si existía una sesión guardada, para restaurar el estado. */
  onRestore: (restored: SessionSetsByExercise) => void;
}

export function useSessionPersistence({
  context,
  exerciseOrder,
  setsByExercise,
  onRestore,
}: UseSessionPersistenceOptions) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [hasRestored, setHasRestored] = useState(false);

  // Refs para leer el último estado dentro del temporizador sin re-armarlo en
  // cada cambio, que anularía el propósito del debounce.
  const latestSets = useRef(setsByExercise);
  const latestOrder = useRef(exerciseOrder);
  latestSets.current = setsByExercise;
  latestOrder.current = exerciseOrder;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once an athlete explicitly ends a session, later unmount/debounce writes must
  // never erase `completedAt` by replacing the document with an in-progress copy.
  const completedAtRef = useRef<number | undefined>(undefined);
  const sessionId = context?.sessionId ?? null;

  // --- Recuperación: una sola vez por sesión ------------------------------
  useEffect(() => {
    if (context === null) return;
    let cancelled = false;

    workoutSessionRepository
      .get(context.sessionId)
      .then((saved) => {
        if (cancelled) return;
        if (saved && saved.exercises.length > 0) {
          onRestore(toSessionSetsByExercise(saved));
        }
        setHasRestored(true);
      })
      .catch(() => {
        // Un fallo al recuperar no debe impedir entrenar: se sigue con el
        // estado local y se marca como restaurado para habilitar el guardado.
        if (!cancelled) setHasRestored(true);
      });

    return () => {
      cancelled = true;
    };
    // Deliberadamente ligado al id de sesión: recuperar es una operación única
    // por sesión, no algo que repetir cuando cambian las series.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /** Escribe ya, sin esperar al temporizador. Para cerrar o salir. */
  const flush = useCallback(async (completedAt?: number): Promise<boolean> => {
    if (context === null || isSessionEmpty(latestSets.current)) return false;
    if (completedAt !== undefined) completedAtRef.current = completedAt;
    const finalCompletedAt = completedAt ?? completedAtRef.current;

    setStatus('saving');
    try {
      await workoutSessionRepository.create(
        toWorkoutSession(
          finalCompletedAt === undefined ? context : { ...context, completedAt: finalCompletedAt },
          latestOrder.current,
          latestSets.current,
        ),
      );
      setStatus('saved');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, [context]);

  // --- Guardado diferido --------------------------------------------------
  useEffect(() => {
    // No guardar antes de haber intentado recuperar: escribir primero
    // sobreescribiría con el estado inicial una sesión ya empezada.
    if (context === null || !hasRestored) return;
    if (isSessionEmpty(setsByExercise)) return;

    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, WRITE_DELAY_MS);

    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [setsByExercise, context, hasRestored, flush]);

  // Al desmontar, vuelca lo pendiente: salir de la pantalla no debe perder los
  // cambios de los últimos segundos.
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  return { status, hasRestored, flush };
}
