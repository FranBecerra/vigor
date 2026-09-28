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
import {
  exercisePrescription,
  loadForTarget,
  STRENGTH_ROLE_REPS,
  strengthRIR,
  TOP_SINGLE_RIR,
} from './exercisePrescription';
import { DEFAULT_PROJECTED_MICROCYCLES } from './microcyclePrescription';
import { TrainingGoal } from './volumePlan';
import { toTargetVolumePerGroup } from './volumePlan';

/** Legacy single-value fallback retained for older callers and migrations. */
export const DEFAULT_TARGET_REPS = 10;

/** Optional inputs that only some plans have. */
export interface PlannedSessionOptions {
  /**
   * Estimated 1RM per exercise, from the athlete's history. Only then does a
   * strength set carry a load: without history the first session is where the load
   * is found, by RIR, and a percentage of an unknown max would be a guess.
   */
  e1rmByExerciseId?: ReadonlyMap<string, number>;
}

/** Sets of a strength entry: the heavy single first when the appearance has one. */
function strengthSets(
  strength: NonNullable<DistributedSession['exercises'][number]['strength']>,
  setCount: number,
  e1rm: number | undefined,
): PlannedSet[] {
  const { role, topSingle } = strength;
  const reps = STRENGTH_ROLE_REPS[role];
  const rir = strengthRIR(role, 0, DEFAULT_PROJECTED_MICROCYCLES - 1);
  const withLoad = (set: PlannedSet): PlannedSet =>
    e1rm === undefined || role === 'ACCESSORY'
      ? set
      : { ...set, targetWeightKg: loadForTarget(e1rm, set.targetReps, set.targetRIR) };
  const single: PlannedSet[] = topSingle
    ? [withLoad({ setType: SetType.TOP_SINGLE, targetRepsMin: 1, targetReps: 1, targetRIR: TOP_SINGLE_RIR })]
    : [];
  const working = Array.from({ length: Math.max(0, setCount - single.length) }, () =>
    withLoad({ setType: SetType.NORMAL, targetRepsMin: reps.min, targetReps: reps.max, targetRIR: rir }),
  );
  return [...single, ...working];
}

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
  options: PlannedSessionOptions = {},
): PlannedSession {
  return {
    index: session.index,
    focus: session.focus as PlannedSessionFocus,
    estimatedWorkMinutes: session.estimatedWorkMinutes,
    exercises: session.exercises.map((entry, order): PlannedExercise => {
      if (entry.strength !== undefined) {
        // A strength plan prescribes by ROLE: the ramp across microcycles is derived
        // later by `prescriptionForMicrocycle`, so this stores the first one.
        return {
          exerciseId: entry.exercise.id,
          order,
          isEdited: false,
          restSeconds: entry.strength.restSeconds,
          strengthRole: entry.strength.role,
          sets: strengthSets(
            entry.strength,
            entry.sets,
            options.e1rmByExerciseId?.get(entry.exercise.id),
          ),
        };
      }
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
  options: PlannedSessionOptions = {},
): PlannedSession[] {
  return plan.distribution.sessions.map((session) =>
    toPlannedSession(session, plan.plan.goal, isFinalMicrocycleBeforeDeload, options),
  );
}

export interface RoutineDraftInput {
  userId: string;
  name: string;
  icon: Routine['icon'];
  accentColor: string;
  generation: RoutineGenerationInput;
  /** Whether the new routine becomes the one the athlete follows. */
  isActive: boolean;
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
    isActive: input.isActive,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * A new routine becomes active only when the athlete follows none. Taking over from
 * a routine they are in the middle of is a decision, made with the activate button.
 */
export function shouldActivateNewRoutine(existing: readonly Pick<Routine, 'isActive'>[]): boolean {
  return !existing.some((routine) => routine.isActive === true);
}

/**
 * The writes that make `routineId` the only active routine: only documents whose
 * flag actually changes, so activating the active routine writes nothing.
 */
export function activationChanges(
  routines: readonly Pick<Routine, 'id' | 'isActive'>[],
  routineId: string,
): { id: string; isActive: boolean }[] {
  return routines
    .map((routine) => ({ id: routine.id, isActive: routine.id === routineId }))
    .filter(
      (change, index) => change.isActive !== (routines[index].isActive === true),
    );
}

/** Trimmed routine name, or null when nothing usable remains. */
export function normalizeRoutineName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed === '' ? null : trimmed.slice(0, MAX_ROUTINE_NAME_LENGTH);
}

/** Long enough for a descriptive name, short enough for one line on a card. */
export const MAX_ROUTINE_NAME_LENGTH = 40;

export type RoutineNameProblem = 'empty' | 'duplicate';

/**
 * Why a name cannot be used, or null when it can. A routine has no default name:
 * three routines all called "My routine" cannot be told apart on the home. Names
 * compare case-insensitively after normalising, so "Fuerza" and " fuerza " clash.
 */
export function routineNameProblem(
  raw: string,
  existingNames: readonly string[],
): RoutineNameProblem | null {
  const name = normalizeRoutineName(raw);
  if (name === null) return 'empty';
  const key = name.toLocaleLowerCase();
  const taken = existingNames.some(
    (existing) => normalizeRoutineName(existing)?.toLocaleLowerCase() === key,
  );
  return taken ? 'duplicate' : null;
}

export interface MesocycleDraftInput {
  userId: string;
  routineId: string;
  plan: MesocyclePlan;
  now: number;
  /** Estimated horizon in microcycles, for the roadmap view (§3.1). */
  projectedMicrocycles?: number;
  /** Optional edits made in the generation preview. */
  plannedSessions?: readonly PlannedSession[];
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
    plannedSessions: input.plannedSessions === undefined
      ? toPlannedSessions(plan)
      : input.plannedSessions.map((session) => ({
          ...session,
          exercises: session.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) => ({ ...set })),
          })),
        })),
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
