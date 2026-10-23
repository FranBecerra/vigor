import { SetType, type PlannedExercise, type PlannedSession } from '@/models';
import { deloadSets, reloadForRIR } from './microcyclePrescription';

export interface ProgressionStep { index: number; session: PlannedSession; isDeload?: boolean }
const bounded = (rir: number) => Math.max(0, Math.min(5, Math.round(rir)));
const signature = (exercise: PlannedExercise) => JSON.stringify({
  id: exercise.exerciseId, rest: exercise.restSeconds,
  sets: exercise.sets.map((set) => [set.setType, set.targetRepsMin ?? set.targetReps, set.targetReps, set.targetRIR, set.targetDurationSeconds, set.targetLoadLevel]),
});

/** Stable field order avoids false stale-preview failures after a storage roundtrip. */
export function progressionFingerprint(steps: readonly ProgressionStep[] | null): string {
  return JSON.stringify(steps?.map((step) => [step.index, step.isDeload, step.session.index, step.session.name,
    step.session.exercises.map((exercise) => [exercise.order, signature(exercise), exercise.sets.map((set) => set.targetWeightKg)])]));
}

export function hasSessionRIRChanges(previous: PlannedSession, edited: PlannedSession): boolean {
  return edited.exercises.some((exercise) => {
    const old = previous.exercises.find((entry) => entry.exerciseId === exercise.exerciseId);
    return !!old && exercise.sets.some((set, index) => old.sets[index] && set.targetRIR !== old.sets[index].targetRIR);
  });
}

/** Explicit opt-in: re-anchor changed exercises while keeping unrelated trajectories intact. */
export function replanSessionRIR(steps: readonly ProgressionStep[], edited: PlannedSession, start: number, horizon: number): ProgressionStep[] {
  if (!Number.isInteger(start) || start < 0 || !Number.isInteger(horizon) || horizon < 1 || start >= horizon) throw new Error('Invalid progression horizon');
  const current = steps.find((step) => step.index === start)?.session;
  if (!current || current.index !== edited.index) throw new Error('Missing progression anchor');
  if (edited.exercises.some((exercise) => exercise.sets.some((set) => !Number.isFinite(set.targetRIR) || set.targetRIR < 0 || set.targetRIR > 5))) throw new Error('Invalid RIR anchor');
  const deload = horizon > 1 ? horizon - 1 : -1;
  const lastAccumulation = Math.max(start, horizon - (deload >= 0 ? 2 : 1));
  const final = steps.find((step) => step.index === lastAccumulation)?.session;
  const project = (exercise: PlannedExercise, index: number): PlannedExercise => {
    const old = current.exercises.find((entry) => entry.exerciseId === exercise.exerciseId);
    const future = steps.find((step) => step.index === index)?.session.exercises.find((entry) => entry.exerciseId === exercise.exerciseId);
    if (old && signature(old) === signature(exercise)) return future ? { ...future, order: exercise.order } : exercise;
    if (index === start) return { ...exercise, sets: exercise.sets.map((set) => ({ ...set })) };
    if (exercise.sets.every((set) => set.targetDurationSeconds !== undefined)) return { ...exercise, sets: exercise.sets.map((set) => ({ ...set })) };
    if (index === deload) {
      const accumulated = project(exercise, lastAccumulation);
      return { ...accumulated, sets: deloadSets(accumulated.sets) };
    }
    const end = final?.exercises.find((entry) => entry.exerciseId === exercise.exerciseId);
    const fraction = Math.min(1, Math.max(0, (index - start) / Math.max(1, lastAccumulation - start)));
    const { manualRIRBySet: _manual, ...base } = exercise;
    return { ...base, sets: exercise.sets.map((set, setIndex) => {
      if (set.setType === SetType.WARMUP || set.setType === SetType.TOP_SINGLE || set.targetDurationSeconds !== undefined) return { ...set };
      if (set.setType === SetType.FAILURE) return { ...set, targetRIR: 0 };
      const previous = old?.sets[setIndex];
      const changed = !previous || set.targetRIR !== previous.targetRIR;
      let target = future?.sets[setIndex]?.targetRIR ?? set.targetRIR;
      if (changed) {
        const shiftedEnd = (end?.sets[setIndex]?.targetRIR ?? set.targetRIR) + (previous ? set.targetRIR - previous.targetRIR : 0);
        // A formerly fixed/manual prescription still gets a one-RIR progression.
        const endRIR = bounded(shiftedEnd >= set.targetRIR && set.targetRIR > 0 ? set.targetRIR - 1 : shiftedEnd);
        target = bounded(set.targetRIR + fraction * (endRIR - set.targetRIR));
      }
      return { ...set, targetRIR: target,
        ...(set.targetWeightKg !== undefined ? { targetWeightKg: reloadForRIR(set.targetWeightKg, set.targetReps, set.targetRIR, target) } : {}) };
    }) };
  };
  const rosterChanged = JSON.stringify(current.exercises.map((exercise) => exercise.exerciseId)) !== JSON.stringify(edited.exercises.map((exercise) => exercise.exerciseId));
  return steps.filter((step) => step.index >= start && step.index < horizon).map((step) => {
    const exercises = step.index === start || rosterChanged ? edited.exercises.map((exercise) => project(exercise, step.index))
      : step.session.exercises.map((future) => {
        const source = edited.exercises.find((exercise) => exercise.exerciseId === future.exerciseId);
        return source ? { ...project(source, step.index), order: future.order } : future;
      });
    const originalCount = edited.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const count = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    return { index: step.index, isDeload: step.index === deload,
      session: { ...edited, exercises, estimatedWorkMinutes: originalCount ? edited.estimatedWorkMinutes * count / originalCount : 0 } };
  });
}
