/**
 * The athlete's saved routines, as the training home renders them.
 *
 * Reloads every time the screen gains focus, not only on mount: saving a routine
 * pops the generation screen back to a home that is already mounted, and a load
 * that ran once on mount would never see the routine just written.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { mesocycleRepository, routineRepository, workoutSessionRepository } from '@/services/repositories';
import { useExerciseCatalogue } from './useExerciseCatalogue';
import { TrainingGoal } from '@/services/training/volumePlan';
import { loadRoutineViews, type RoutineView } from '@/services/training/routineView';
import { activationChanges, normalizeRoutineName } from '@/services/training/routineMapper';

export type RoutinesStatus = 'loading' | 'ready' | 'error';
/** Warm navigation snapshot only; Firestore remains the durable cache/source. */
const viewCache = new Map<string, RoutineView[]>();

const SOURCES = {
  listRoutines: (userId: string) => routineRepository.listByUser(userId),
  getMesocycle: (mesocycleId: string) => mesocycleRepository.get(mesocycleId),
  listWorkoutSessions: (userId: string) => workoutSessionRepository.listByUser(userId),
};

export function useRoutines(): {
  status: RoutinesStatus;
  routines: RoutineView[];
  reload: () => void;
  activate: (routineId: string) => Promise<void>;
  rename: (routineId: string, name: string) => Promise<void>;
  remove: (routineId: string) => Promise<void>;
} {
  const { t, i18n } = useTranslation();
  const { uid } = useAuth();
  const { exercisesById: EXERCISE_BY_ID } = useExerciseCatalogue();
  const cacheKey = JSON.stringify([uid, i18n?.resolvedLanguage ?? i18n?.language ?? 'en']);
  const cached = uid ? viewCache.get(cacheKey) : undefined;
  const [status, setStatus] = useState<RoutinesStatus>(cached ? 'ready' : 'loading');
  const [routines, setRoutines] = useState<RoutineView[]>(cached ?? []);
  const loadedKey = useRef(cacheKey);
  // A slow read must not overwrite a newer one that already landed.
  const requestId = useRef(0);

  const labels = useMemo(
    () => ({
      focus: (focus: string) => t(`generate.focus${focus}`),
      goal: (goal: string) =>
        goal === TrainingGoal.STRENGTH ? t('generate.goalStrength') : t('generate.goalHypertrophy'),
    }),
    [t],
  );

  const reload = useCallback(() => {
    const id = ++requestId.current;
    if (uid === null) {
      viewCache.clear(); loadedKey.current = cacheKey;
      setRoutines([]);
      setStatus('ready');
      return;
    }
    loadRoutineViews(uid, SOURCES, EXERCISE_BY_ID, labels)
      .then((views) => {
        if (id !== requestId.current) return;
        viewCache.set(cacheKey, views);
        if (viewCache.size > 8) viewCache.delete(viewCache.keys().next().value!);
        loadedKey.current = cacheKey;
        setRoutines(views);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (id !== requestId.current) return;
        console.error('[routines] load failed', error);
        loadedKey.current = cacheKey;
        setRoutines(viewCache.get(cacheKey) ?? []);
        setStatus('error');
      });
  }, [uid, labels, EXERCISE_BY_ID, cacheKey]);

  useFocusEffect(reload);

  /** Makes this the only active routine. Re-reads first so the batch sees current flags. */
  const activate = useCallback(
    async (routineId: string) => {
      if (uid === null) return;
      const current = await routineRepository.listByUser(uid);
      await routineRepository.applyActivation(activationChanges(current, routineId), Date.now());
      reload();
    },
    [uid, reload],
  );

  const rename = useCallback(
    async (routineId: string, raw: string) => {
      const name = normalizeRoutineName(raw);
      if (name === null) return;
      await routineRepository.update(routineId, { name, updatedAt: Date.now() });
      reload();
    },
    [reload],
  );

  /** Deletes the routine and every mesocycle generated from it. */
  const remove = useCallback(
    async (routineId: string) => {
      if (uid === null) return;
      const mesocycles = await mesocycleRepository.listByRoutine(uid, routineId);
      await routineRepository.deleteWithMesocycles(
        routineId,
        mesocycles.map((mesocycle) => mesocycle.id),
      );
      reload();
    },
    [uid, reload],
  );

  return { status: loadedKey.current === cacheKey ? status : cached ? 'ready' : 'loading',
    routines: loadedKey.current === cacheKey ? routines : cached ?? [], reload, activate, rename, remove };
}
