import { useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/models';
import Activity from '@/components/train/WorkoutLiveActivity.ios';
import type { SessionContext, SessionSetsByExercise } from '@/services/training/sessionMapper';
import { workoutActivityState } from '@/services/training/workoutActivityState';

let activityQueue: Promise<unknown> = Promise.resolve();

/** Never leave a previous account's workout visible after sign-out/account switching. */
export function useWorkoutActivityOwner(owner: string | null, loading: boolean) {
  useEffect(() => {
    if (loading) return;
    activityQueue = activityQueue.catch(() => undefined).then(async () => {
      const file = new File(Paths.document, 'vigor-workout-activity.json');
      let previous: string | undefined;
      if (file.exists) { try { previous = JSON.parse(file.textSync()).owner; } catch { /* End orphaned activities. */ } }
      if (owner && previous === owner) return;
      for (const instance of Activity.getInstances()) await instance.end('immediate');
      if (file.exists) file.delete();
    }).catch(() => undefined);
  }, [owner, loading]);
}

/** Reuse the OS activity across relaunch; screen unmount does not end a paused workout. */
export function useWorkoutActivity(context: SessionContext | null, exercises: readonly Exercise[], sets: SessionSetsByExercise, finished: boolean) {
  const { t } = useTranslation(); const [unavailable, setUnavailable] = useState(false);
  const signature = JSON.stringify(context ? { id: context.sessionId, owner: context.userId, finished,
    props: { ...workoutActivityState(exercises, sets, context.activeExerciseId, context.restTimer ?? { startedAt: null, durationSeconds: 0, anchorSetId: null }),
      title: context.sessionName ?? 'Vigor', nextLabel: t('workout.nextSet'), doneLabel: t('workout.allSetsDone') } } : null);
  useEffect(() => {
    if (!context) return;
    let disposed = false;
    const snapshot = JSON.parse(signature)!;
    activityQueue = activityQueue.catch(() => undefined).then(async () => {
      if (disposed && !snapshot.finished) return;
      const file = new File(Paths.document, 'vigor-workout-activity.json');
      let mapping: { sessionId?: string; activityId?: string; owner?: string } = {};
      if (file.exists) { try { mapping = JSON.parse(file.textSync()); } catch { /* Recover unmatched activities. */ } }
      const instances = Activity.getInstances();
      let current = instances.find((instance) => instance.getId() === mapping.activityId && mapping.sessionId === snapshot.id && mapping.owner === snapshot.owner);
      for (const instance of instances) if (instance !== current) await instance.end('immediate');
      if (snapshot.finished) { if (current) await current.end('immediate'); if (file.exists) file.delete(); return; }
      if (current) await current.update(snapshot.props);
      else {
        current = Activity.start(snapshot.props,
          `vigor://session?mesocycleId=${encodeURIComponent(context.mesocycleId)}&goal=${encodeURIComponent(context.trainingGoal ?? '')}&microcycleIndex=${context.microcycleIndex}&plannedSessionIndex=${context.plannedSessionIndex ?? 0}`);
        file.create({ overwrite: true }); file.write(JSON.stringify({ sessionId: snapshot.id, owner: snapshot.owner, activityId: current.getId() }));
      }
      if (!disposed) setUnavailable(false);
    }).catch(() => { if (!disposed) setUnavailable(true); });
    return () => { disposed = true; };
  }, [signature]);
  return unavailable;
}
