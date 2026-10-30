/**
 * The athlete's saved routines, as the training home renders them.
 *
 * Reloads every time the screen gains focus, not only on mount: saving a routine
 * pops the generation screen back to a home that is already mounted, and a load
 * that ran once on mount would never see the routine just written.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { mesocycleRepository, routineRepository, workoutSessionRepository } from '@/services/repositories';
import { useExerciseCatalogue } from './useExerciseCatalogue';
import { TrainingGoal } from '@/services/training/volumePlan';
import { loadRoutineViews, type RoutineView } from '@/services/training/routineView';
import { activationChanges, normalizeRoutineName } from '@/services/training/routineMapper';
import { loadAudit, type LoadTrigger } from '@/services/performance/loadAudit';
import { ROUTINE_ICON_KEYS } from '@/models/routine';
import type { RoutineIdentity } from '@/components/train/RoutineIdentityPicker';

export type RoutinesStatus = 'loading' | 'ready' | 'error';
/** Warm navigation snapshot only; Firestore remains the durable cache/source. */
const viewCache = new Map<string, RoutineView[]>();
function remember(key: string, views: RoutineView[]) {
  viewCache.set(key, views);
  if (viewCache.size > 8) viewCache.delete(viewCache.keys().next().value!);
}

const SOURCES = {
  listRoutines: (userId: string) => loadAudit.measure('training.routines', () => routineRepository.listByUser(userId)),
  getMesocycle: (mesocycleId: string) => loadAudit.measure('training.mesocycle', () => mesocycleRepository.get(mesocycleId)),
  listWorkoutSessions: (userId: string) => loadAudit.measure('training.history', () => workoutSessionRepository.listByUser(userId)),
};

/** Reuse Firestore's existing device cache; never create a second persistent copy. */
function cachedSources(owner: string) {
  return {
    listRoutines: async () => (await routineRepository.listCachedByUser(owner)).filter(routine => routine.userId === owner),
    getMesocycle: async (id: string) => {
      const plan = await mesocycleRepository.getCached(id);
      if (plan && plan.userId !== owner) throw Error('Cached plan owner mismatch');
      return plan;
    },
    listWorkoutSessions: async () => (await workoutSessionRepository.listCachedByUser(owner)).filter(session => session.userId === owner),
  };
}

export function useRoutines(): {
  status: RoutinesStatus;
  routines: RoutineView[];
  reload: () => void;
  activate: (routineId: string) => Promise<void>;
  rename: (routineId: string, name: string, identity?: RoutineIdentity) => Promise<void>;
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
  const visibleKey = useRef(cacheKey);
  visibleKey.current = cacheKey;

  const labels = useMemo(
    () => ({
      focus: (focus: string) => t(`generate.focus${focus}`),
      goal: (goal: string) =>
        goal === TrainingGoal.STRENGTH ? t('generate.goalStrength') : t('generate.goalHypertrophy'),
    }),
    [t],
  );

  const load = useCallback((trigger: LoadTrigger) => {
    const id = ++requestId.current;
    const current = () => id === requestId.current && visibleKey.current === cacheKey;
    if (uid === null) {
      viewCache.clear(); loadedKey.current = cacheKey;
      setRoutines([]);
      setStatus('ready');
      return;
    }
    let remoteState: 'pending' | 'success' | 'error' = 'pending';
    // On a process restart the in-memory view cache is empty, but native
    // Firestore persistence can already paint the complete routine (including rests).
    if (!viewCache.has(cacheKey) && typeof routineRepository.listCachedByUser === 'function') {
      void loadRoutineViews(uid, cachedSources(uid), EXERCISE_BY_ID, labels).then(views => {
        if (!current() || remoteState === 'success' || views.length === 0) return;
        remember(cacheKey, views);
        loadedKey.current = cacheKey;
        setRoutines(views); setStatus(remoteState === 'error' ? 'error' : 'ready');
      }).catch(() => { /* A missing/partial cache is not an error or an empty routine list. */ });
    }
    loadAudit.measure('training.home', () => loadRoutineViews(uid, SOURCES, EXERCISE_BY_ID, labels), trigger)
      .then((views) => {
        remoteState = 'success';
        if (!current()) return;
        remember(cacheKey, views);
        loadedKey.current = cacheKey;
        setRoutines(views);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        remoteState = 'error';
        if (!current()) return;
        console.error('[routines] load failed', error);
        loadedKey.current = cacheKey;
        setRoutines(viewCache.get(cacheKey) ?? []);
        setStatus('error');
      });
  }, [uid, labels, EXERCISE_BY_ID, cacheKey]);
  const reload = useCallback(() => load('focus'), [load]);

  useFocusEffect(useCallback(() => {
    reload();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', state => {
      const resumed = state === 'active' && previous !== 'active'; previous = state;
      if (resumed) load('foreground');
    });
    return () => { requestId.current++; subscription.remove(); };
  }, [reload, load]));

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
    async (routineId: string, raw: string, identity?: RoutineIdentity) => {
      const name = normalizeRoutineName(raw);
      if (name === null || !uid || visibleKey.current !== cacheKey || loadedKey.current !== cacheKey || !routines.some(routine => routine.id === routineId)) return;
      if (identity && !ROUTINE_ICON_KEYS.includes(identity.icon)) throw Error('Invalid routine identity');
      await routineRepository.update(routineId, { name, ...(identity ? { icon: identity.icon } : {}), updatedAt: Date.now() });
      if (visibleKey.current === cacheKey) reload();
    },
    [reload, uid, routines, cacheKey],
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
