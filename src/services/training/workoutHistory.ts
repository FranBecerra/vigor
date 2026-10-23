import { SetType, type Exercise, type WorkoutSession } from '@/models';
import { isSetCompleted } from './sessionMapper';
import { timestampMillis } from './workoutRuntime';
import { primaryMusclesOf } from './exerciseMuscles';
import { MuscleGroup } from '@/models';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** Read actuals only. Missing catalogue entries must not erase recorded work. */
export function workoutHistoryDetails(session: WorkoutSession, catalogue: ReadonlyMap<string, Exercise>) {
  let working = 0; let warmups = 0; let tonnage = 0; const efforts: number[] = [];
  const volumes = new Map<MuscleGroup, number>();
  const exercises = [...session.exercises].sort((a, b) => a.order - b.order).map((entry) => {
    const exercise = entry.exerciseSnapshot ?? catalogue.get(entry.exerciseId);
    let normal = 0; let completed = 0;
    const sets = entry.sets.map((set) => {
      if (set.setType !== SetType.WARMUP) normal++;
      const mode = set.recording ?? exercise?.recording;
      const done = mode ? isSetCompleted({ ...set, recording: mode }) : isSetCompleted(set)
        && finite(set.actualWeight) && set.actualWeight >= 0 && Number.isInteger(set.actualReps) && set.actualReps! > 0;
      const weight = mode?.load === 'NONE' ? null : mode?.load === 'LEVEL' ? set.actualLoadLevel : set.actualWeight;
      const quantity = mode?.measure === 'SECONDS' ? set.actualDurationSeconds : set.actualReps;
      const rir = finite(set.actualRIR) && set.actualRIR >= 0 && set.actualRIR <= 5 ? set.actualRIR : null;
      if (done) {
        if (set.setType === SetType.WARMUP) warmups++;
        else {
          working++; completed++; if (rir !== null) efforts.push(rir);
          const comparable = !mode || ['TOTAL_KG', 'PER_HAND_KG', 'ADDED_KG'].includes(mode.load);
          if (comparable && mode?.measure !== 'SECONDS' && finite(set.actualWeight) && set.actualWeight >= 0 && finite(set.actualReps) && set.actualReps > 0) {
            tonnage += set.actualWeight * set.actualReps;
            for (const extension of set.extensions ?? []) {
              const load = extension.weight ?? set.actualWeight;
              if (finite(load) && load >= 0 && finite(extension.reps) && extension.reps > 0) tonnage += load * extension.reps;
            }
          }
        }
      }
      return { id: set.id, number: set.setType === SetType.WARMUP ? null : normal, setType: set.setType, done,
        weight: finite(weight) ? weight : null, quantity: finite(quantity) ? quantity : null, rir,
        partialReps: Number.isInteger(set.actualPartialReps) && set.actualPartialReps! > 0 && set.actualPartialReps! <= 999 ? set.actualPartialReps! : null,
        seconds: mode?.measure === 'SECONDS', load: mode?.load ?? 'TOTAL_KG',
        extensions: (set.extensions ?? []).map((extension) => ({ weight: finite(extension.weight) ? extension.weight : null, reps: finite(extension.reps) ? extension.reps : null })) };
    });
    if (exercise && completed) {
      const direct = primaryMusclesOf(exercise);
      for (const muscle of new Set([...direct, ...(exercise.secondaryMuscles ?? [])])) {
        if (muscle === MuscleGroup.UNCLASSIFIED || !Object.values(MuscleGroup).includes(muscle)) continue;
        volumes.set(muscle, (volumes.get(muscle) ?? 0) + completed * (direct.includes(muscle) ? 1 : 0.5));
      }
    }
    return { id: entry.id, exerciseId: entry.exerciseId, name: exercise?.name ?? null, note: entry.notes ?? null, exerciseNote: entry.exerciseNote ?? null, completed, sets };
  });
  const start = timestampMillis(session.performedAt); const end = session.completedAt === undefined ? NaN : timestampMillis(session.completedAt);
  return { exercises, working, warmups, tonnage, sessionNote: session.sessionNote ?? null, mesocycleNote: session.mesocycleNote ?? null, volumes: [...volumes].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle)), meanRIR: efforts.length ? efforts.reduce((sum, value) => sum + value, 0) / efforts.length : null,
    durationSeconds: finite(start) && finite(end) && end >= start ? Math.floor((end - start) / 1000) : null };
}
