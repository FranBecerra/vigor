/**
 * Maps between the generator's in-memory output and the persisted routine shape.
 * PURE LOGIC.
 *
 * WHY THIS EXISTS
 *   `planMesocycle` returns a rich object: the volume plan, the selection, the
 *   distribution, which ceiling bound it, warnings. Almost none of that should be
 *   persisted, because almost all of it is DERIVED and would go stale the moment
 *   the catalogue or the landmarks change. What must survive is the prescription
 *   the athlete agreed to, plus the inputs that produced it.
 *
 *   So this module draws that line explicitly rather than letting each caller
 *   decide, which is how two callers end up persisting different subsets.
 *
 * WHAT IS PERSISTED AND WHAT IS NOT
 *   Persisted: the planned sessions (exercises, sets, target reps and RIR) and the
 *     generation input including the seed.
 *   Not persisted: volume landmarks, attributed volume, the squeeze, sequencing
 *     and structure warnings, minutes available. All recomputable from the plan
 *     and the catalogue, and all wrong to freeze: a landmark table that improves
 *     should improve old routines' diagnostics too.
 *
 *   The one apparent exception is `estimatedWorkMinutes`, which IS stored. It
 *   depends on the rest-time model, and when that model changes the stored value
 *   goes stale. It is stored anyway so a session card can show a duration without
 *   loading the whole catalogue, and it is labelled an estimate everywhere it
 *   appears. Recomputing it on load is a deliberate option left open.
 */
import type {
  Mesocycle,
  PlannedExercise,
  PlannedSession,
  PlannedSessionFocus,
  PlannedSet,
  Routine,
  RoutineGenerationInput,
} from '@/models';
import { SetType } from '@/models';
import type { MesocyclePlan } from './mesocyclePlanner';
import type { DistributedSession } from './sessionDistribution';
import { deriveSetRIRs } from './setIntensity';
import { exercisePrescription } from './exercisePrescription';
import { TrainingGoal } from './volumePlan';
import { toTargetVolumePerGroup } from './volumePlan';

/** Legacy single-value fallback retained for older callers and migrations. */
export const DEFAULT_TARGET_REPS = 10;

/**
 * Turns one distributed session into a persistable prescription.
 *
 * `isFinalMicrocycleBeforeDeload` is the only thing that changes between
 * microcycles: volume is static (§3), so the exercises and set counts are
 * identical and only the intensity floor moves, from the routine floor to the peak
 * floor in the last microcycle before a deload (§3.4).
 */
export function toPlannedSession(
  session: DistributedSession,
  goal: TrainingGoal = TrainingGoal.HYPERTROPHY,
  isFinalMicrocycleBeforeDeload = false,
): PlannedSession {
  return {
    index: session.index,
    focus: session.focus as PlannedSessionFocus,
    estimatedWorkMinutes: session.estimatedWorkMinutes,
    exercises: session.exercises.map((entry, order): PlannedExercise => {
      // Per-set RIR is DERIVED, never written by hand: the last set reaches the
      // exercise target and earlier ones leave one more rep in reserve. Writing it
      // out would desynchronise from the set count the moment either changes.
      const prescription = exercisePrescription(
        goal,
        entry.exercise.profile,
        isFinalMicrocycleBeforeDeload,
      );
      const perSet = deriveSetRIRs(
        prescription.targetRIR,
        entry.sets,
        prescription.maxExtraReserve,
      );
      return {
        exerciseId: entry.exercise.id,
        order,
        isEdited: false,
        sets: perSet.map(
          (rir): PlannedSet => ({
            setType: SetType.NORMAL,
            targetRepsMin: prescription.reps.min,
            targetReps: prescription.reps.max,
            targetRIR: rir,
          }),
        ),
      };
    }),
  };
}

/** The prescription for a whole microcycle. */
export function toPlannedSessions(
  plan: MesocyclePlan,
  isFinalMicrocycleBeforeDeload = false,
): PlannedSession[] {
  return plan.distribution.sessions.map((session) =>
    toPlannedSession(session, plan.plan.goal, isFinalMicrocycleBeforeDeload),
  );
}

export interface RoutineDraftInput {
  userId: string;
  name: string;
  icon: Routine['icon'];
  accentColor: string;
  generation: RoutineGenerationInput;
  now: number;
}

/** A routine ready to persist. The id is assigned by the repository. */
export function toRoutineDraft(input: RoutineDraftInput): Omit<Routine, 'id'> {
  return {
    userId: input.userId,
    name: input.name,
    icon: input.icon,
    accentColor: input.accentColor,
    generation: input.generation,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export interface MesocycleDraftInput {
  userId: string;
  routineId: string;
  plan: MesocyclePlan;
  now: number;
  /** Estimated horizon in microcycles, for the roadmap view (§3.1). */
  projectedMicrocycles?: number;
}

/**
 * A mesocycle ready to persist, carrying its prescription.
 *
 * `completedAt` and other absent optionals are OMITTED rather than set to
 * undefined: Firestore rejects an undefined value, and the session mapper already
 * learned that the hard way.
 */
export function toMesocycleDraft(input: MesocycleDraftInput): Omit<Mesocycle, 'id'> {
  const { plan, now } = input;
  const draft: Omit<Mesocycle, 'id'> = {
    userId: input.userId,
    routineId: input.routineId,
    status: 'ACTIVE',
    targetVolumePerGroup: toTargetVolumePerGroup(plan.plan),
    currentMicrocycleIndex: 0,
    sessionsPerMicrocycle: plan.distribution.sessions.length,
    plannedSessions: toPlannedSessions(plan),
    startedAt: now,
    updatedAt: now,
  };
  if (input.projectedMicrocycles !== undefined) {
    draft.projectedMicrocycles = input.projectedMicrocycles;
  }
  return draft;
}

/** Total prescribed sets across the microcycle. Used by the summary cards. */
export function totalPlannedSets(sessions: readonly PlannedSession[]): number {
  return sessions.reduce(
    (sum, session) =>
      sum + session.exercises.reduce((inner, exercise) => inner + exercise.sets.length, 0),
    0,
  );
}

/** Exercise ids the prescription uses, for loading only what is needed. */
export function plannedExerciseIds(sessions: readonly PlannedSession[]): string[] {
  const ids = new Set<string>();
  sessions.forEach((session) =>
    session.exercises.forEach((exercise) => ids.add(exercise.exerciseId)),
  );
  return [...ids];
}

/**
 * Exercises the athlete edited by hand, so regeneration can preserve them instead
 * of quietly reverting a deliberate choice.
 */
export function editedExerciseIds(sessions: readonly PlannedSession[]): string[] {
  const ids = new Set<string>();
  sessions.forEach((session) =>
    session.exercises.forEach((exercise) => {
      if (exercise.isEdited) ids.add(exercise.exerciseId);
    }),
  );
  return [...ids];
}
