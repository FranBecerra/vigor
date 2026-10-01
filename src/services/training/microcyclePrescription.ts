/**
 * The prescription of ONE microcycle, derived from the stored one. PURE LOGIC.
 *
 * A mesocycle stores its first microcycle only (§3: volume is static). What
 * changes from one microcycle to the next is derived here, in one place, so the
 * home, the mesocycle view and the session all see the same numbers:
 *  - strength: the RIR ramp by role, RIR 3 first and RIR 1 in the last
 *    accumulation microcycle, with loads re-derived from the new RIR when the set
 *    carries one;
 *  - both goals: the deload, the last microcycle of the horizon.
 */
import { SetType, type PlannedSession, type PlannedSet } from '@/models';
import { LOAD_INCREMENT_KG, strengthRIR } from './exercisePrescription';
import { MAX_RIR } from './setIntensity';
import { TrainingGoal } from './volumePlan';

/**
 * Five accumulation microcycles and a deload, the PRD §3.1 roadmap example and
 * the middle of the 4-6 the strength guideline gives. A projection, not a
 * contract: deload triggers can end accumulation earlier.
 */
export const DEFAULT_PROJECTED_MICROCYCLES = 6;

/**
 * Share of each exercise's working sets kept in the deload: 40-50 % less volume
 * dissipates fatigue while the movement pattern stays practised.
 */
export const DELOAD_SET_FACTOR = 0.55;
/** Load kept in the deload: 5-10 % lighter bar. */
export const DELOAD_LOAD_FACTOR = 0.9;
/** Extra reserve in the deload, the direct consequence of the lighter bar. */
export const DELOAD_RIR_INCREASE = 2;

export function isDeloadMicrocycle(index: number, horizon: number): boolean {
  return horizon > 1 && index === horizon - 1;
}

function roundLoad(kg: number): number {
  // The epsilon keeps 117.5 from flooring to 115 after a ratio that should be 1.
  return Math.max(0, Math.floor(kg / LOAD_INCREMENT_KG + 1e-9) * LOAD_INCREMENT_KG);
}

/**
 * Load that keeps the same e1RM when the reserve changes, by Epley over
 * `reps + rir`. Less reserve means a heavier bar for the same reps.
 */
export function reloadForRIR(kg: number, reps: number, fromRIR: number, toRIR: number): number {
  return roundLoad((kg * (1 + (reps + fromRIR) / 30)) / (1 + (reps + toRIR) / 30));
}

function deloadSets(sets: readonly PlannedSet[]): PlannedSet[] {
  // The heavy single is exposure to near-maximal load, the one thing a deload removes.
  const working = sets.filter((set) => set.setType !== SetType.TOP_SINGLE);
  const kept = Math.max(1, Math.round(working.length * DELOAD_SET_FACTOR));
  return working.slice(0, kept).map((set) => {
    const deloaded: PlannedSet = {
      ...set,
      targetRIR: Math.min(MAX_RIR, set.targetRIR + DELOAD_RIR_INCREASE),
    };
    if (set.targetWeightKg !== undefined) {
      deloaded.targetWeightKg = roundLoad(set.targetWeightKg * DELOAD_LOAD_FACTOR);
    }
    return deloaded;
  });
}

/**
 * The sessions of microcycle `index` (0-based) in a horizon of `horizon`
 * microcycles, the last one being the deload.
 */
export function prescriptionForMicrocycle(
  sessions: readonly PlannedSession[],
  goal: string,
  index: number,
  horizon: number,
): PlannedSession[] {
  if (isDeloadMicrocycle(index, horizon)) {
    return sessions.map((session) => {
      const before = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
      const exercises = session.exercises.map((exercise) => ({
        ...exercise,
        sets: deloadSets(exercise.sets),
      }));
      const after = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
      return {
        ...session,
        exercises,
        estimatedWorkMinutes: before === 0 ? 0 : (session.estimatedWorkMinutes * after) / before,
      };
    });
  }

  if (goal !== TrainingGoal.STRENGTH) {
    const accumulation = Math.max(1, horizon - 1);
    return sessions.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => {
        const working = exercise.sets.filter((set) => set.setType !== SetType.TOP_SINGLE);
        const workingIndexes = exercise.sets.flatMap((set, setIndex) =>
          set.setType === SetType.TOP_SINGLE ? [] : [setIndex]);
        const reductions = Math.min(
          workingIndexes.filter((setIndex) => exercise.manualRIRBySet?.[setIndex] === undefined).length,
          Math.ceil((Math.max(0, index) * working.length) / Math.max(1, accumulation - 1)),
        );
        // RIR 4-5 is a cautious first exposure for demanding compounds, not
        // the default for an entire block. Keep later working sets within 0-3.
        const rir = working.map((set) => index > 0 ? Math.min(3, set.targetRIR) : set.targetRIR);
        const reduced = new Set<number>();
        for (let step = 0; step < reductions; step += 1) {
          // Lower the latest of the highest-RIR sets first. This preserves the
          // within-exercise effort ramp instead of making an early set harder
          // than the set after it.
          let candidate = -1;
          for (let position = 0; position < rir.length; position += 1) {
            if (reduced.has(position) || rir[position] <= 0 ||
              exercise.manualRIRBySet?.[workingIndexes[position]] !== undefined) continue;
            if (candidate < 0 || rir[position] >= rir[candidate]) candidate = position;
          }
          if (candidate < 0) break;
          rir[candidate] -= 1;
          reduced.add(candidate);
        }
        let position = 0;
        return {
          ...exercise,
          sets: exercise.sets.map((set, setIndex): PlannedSet => {
            if (set.setType === SetType.TOP_SINGLE) return { ...set };
            const projectedRIR = rir[position++];
            const nextRIR = exercise.manualRIRBySet?.[setIndex] ?? projectedRIR;
            const next = { ...set, targetRIR: nextRIR };
            if (set.targetWeightKg !== undefined) {
              next.targetWeightKg = reloadForRIR(
                set.targetWeightKg, set.targetReps, set.targetRIR, nextRIR,
              );
            }
            return next;
          }),
        };
      }),
    }));
  }

  const accumulation = Math.max(1, horizon - 1);
  return sessions.map((session) => ({
    ...session,
    exercises: session.exercises.map((exercise) => {
      const role = exercise.strengthRole;
      if (role === undefined) return exercise;
      const current = strengthRIR(role, index, accumulation);
      return {
        ...exercise,
        sets: exercise.sets.map((set, setIndex): PlannedSet => {
          if (set.setType === SetType.TOP_SINGLE) return { ...set };
          const nextRIR = exercise.manualRIRBySet?.[setIndex] ?? current;
          const next: PlannedSet = { ...set, targetRIR: nextRIR };
          if (set.targetWeightKg !== undefined) {
            next.targetWeightKg = reloadForRIR(set.targetWeightKg, set.targetReps,
              set.targetRIR, nextRIR);
          }
          return next;
        }),
      };
    }),
  }));
}
