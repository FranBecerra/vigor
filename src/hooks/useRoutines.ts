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
import { mesocycleRepository, routineRepository } from '@/services/repositories';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { TrainingGoal } from '@/services/training/volumePlan';
import { loadRoutineViews, type RoutineView } from '@/services/training/routineView';
import { activationChanges, normalizeRoutineName } from '@/services/training/routineMapper';

export type RoutinesStatus = 'loading' | 'ready' | 'error';

const EXERCISE_BY_ID = new Map(EXERCISE_CATALOGUE.map((exercise) => [exercise.id, exercise]));

const SOURCES = {
  listRoutines: (userId: string) => routineRepository.listByUser(userId),
  getMesocycle: (mesocycleId: string) => mesocycleRepository.get(mesocycleId),
};

export function useRoutines(): {
  status: RoutinesStatus;
  routines: RoutineView[];
  reload: () => void;
  activate: (routineId: string) => Promise<void>;
  rename: (routineId: string, name: string) => Promise<void>;
} {
  const { t } = useTranslation();
  const { uid } = useAuth();
  const [status, setStatus] = useState<RoutinesStatus>('loading');
  const [routines, setRoutines] = useState<RoutineView[]>([]);
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
    if (uid === null) {
      setRoutines([]);
      setStatus('ready');
      return;
    }
    const id = ++requestId.current;
    loadRoutineViews(uid, SOURCES, EXERCISE_BY_ID, labels)
      .then((views) => {
        if (id !== requestId.current) return;
        setRoutines(views);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (id !== requestId.current) return;
        console.error('[routines] load failed', error);
        setStatus('error');
      });
  }, [uid, labels]);

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

  return { status, routines, reload, activate, rename };
}
