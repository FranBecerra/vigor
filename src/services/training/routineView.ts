/**
 * Turns persisted routines into what the training home renders (PRD §8.5).
 * PURE LOGIC.
 *
 * The home cards were built against mock data whose shape is a VIEW: exercise
 * names, muscles, rest and rep range already resolved, and the mesocycle unrolled
 * into microcycles. What Firestore holds is the prescription (`PlannedSession`)
 * keyed by catalogue id. This module is the one place that joins the two, so the
 * components keep rendering a view and never learn about the catalogue.
 */
import {
  SetType,
  type Exercise,
  type Mesocycle,
  type MuscleGroup,
  type PlannedSession,
  type PlannedSessionFocus,
  type Routine,
  type Timestampish,
  type WorkoutSession,
} from '@/models';
import type { RoutineIconKey } from '@/models/routine';
import { formatRepRange } from './exercisePrescription';
import {
  DEFAULT_PROJECTED_MICROCYCLES,
  isDeloadMicrocycle,
  prescriptionForMicrocycle,
} from './microcyclePrescription';
import { restDurationFor } from './restTimer';

export { DEFAULT_PROJECTED_MICROCYCLES };

/** Training domain shown by the home pills. */
export type TrainingDomain = 'STRENGTH' | 'CARDIO';

/** One exercise of a session, resolved against the catalogue. */
export interface SessionExerciseView {
  exerciseId: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  sets: { setType: SetType }[];
  restSeconds: number;
  /** Prescribed repetition range, for the preview. */
  repRange: string;
  /** Exercise RIR target; per-set RIR is derived (services/training/setIntensity). */
  targetRIR: number;
}

export interface SessionView {
  id: string;
  /** The persisted prescription position used to launch and link execution. */
  plannedSessionIndex: number;
  name: string;
  exercises: SessionExerciseView[];
  /** ISO date it was performed. `undefined` = pending, and pending sessions show no day. */
  completedOn?: string;
}

/** A microcycle is its sessions; it has no duration in days (§3.1). */
export interface MicrocycleView {
  id: string;
  /** 1-based position, for display. */
  number: number;
  sessions: SessionView[];
  isDeload: boolean;
  /** Not reached yet: drawn as a projection. */
  isProjected: boolean;
  /** Set delta against the base session; positive = more volume. */
  volumeAdjustmentSets: number;
  /** RIR delta; negative = more intensity. */
  intensityAdjustmentRIR: number;
}

export interface RoutineView {
  id: string;
  mesocycleId: string;
  name: string;
  objective: string;
  /** Untranslated goal used by the execution runtime. */
  generationGoal: string;
  icon: RoutineIconKey;
  color: string;
  domain: TrainingDomain;
  /** true = the running routine, expanded by default. */
  isActive: boolean;
  microcycles: MicrocycleView[];
  /** 0-based index of the running microcycle within `microcycles`. */
  currentMicrocycleIndex: number;
}

function timestampToISODate(timestamp: Timestampish | undefined): string | undefined {
  if (timestamp === undefined) return undefined;
  const milliseconds = typeof timestamp === 'number'
    ? timestamp
    : timestamp.seconds * 1_000 + Math.floor(timestamp.nanoseconds / 1_000_000);
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function completedDatesByPlannedSession(
  sessions: readonly WorkoutSession[],
  mesocycleId: string,
): ReadonlyMap<string, string> {
  const dates = new Map<string, string>();
  sessions.forEach((session) => {
    if (session.mesocycleId !== mesocycleId || session.plannedSessionIndex === undefined) return;
    const date = timestampToISODate(session.completedAt);
    if (date !== undefined) {
      dates.set(`${session.microcycleIndex}:${session.plannedSessionIndex}`, date);
    }
  });
  return dates;
}

function firstIncompleteMicrocycle(
  initialIndex: number,
  horizon: number,
  planned: readonly PlannedSession[],
  completed: ReadonlyMap<string, string>,
): number {
  for (let index = Math.max(0, initialIndex); index < horizon; index += 1) {
    if (planned.some((session) => !completed.has(`${index}:${session.index}`))) return index;
  }
  return Math.max(0, Math.min(initialIndex, horizon - 1));
}

export interface RoutineViewLabels {
  focus: (focus: PlannedSessionFocus) => string;
  goal: (goal: string) => string;
}

/**
 * Session names from their focus. A split can repeat a focus (two upper days in a
 * PPLUL), and two rows both called "Upper" cannot be told apart, so repeats get a
 * letter.
 */
export function sessionNames(
  sessions: readonly PlannedSession[],
  focusLabel: (focus: PlannedSessionFocus) => string,
): string[] {
  const seen = new Map<PlannedSessionFocus, number>();
  return sessions.map((session) => {
    const label = focusLabel(session.focus);
    if (sessions.filter((other) => other.focus === session.focus).length < 2) return label;
    const nth = seen.get(session.focus) ?? 0;
    seen.set(session.focus, nth + 1);
    return `${label} ${String.fromCharCode(65 + nth)}`;
  });
}

function toExerciseView(
  planned: PlannedSession['exercises'][number],
  exerciseById: ReadonlyMap<string, Exercise>,
): SessionExerciseView | null {
  const exercise = exerciseById.get(planned.exerciseId);
  // An id the catalogue no longer knows cannot be named or attributed to a muscle.
  // Dropping it keeps the card honest about what it can show.
  if (exercise === undefined || planned.sets.length === 0) return null;
  const last = planned.sets[planned.sets.length - 1];
  const max = last.targetReps;
  const min = last.targetRepsMin ?? max;
  // The heavy single has its own effort; the exercise target is its working sets'.
  const working = planned.sets.filter((set) => set.setType !== SetType.TOP_SINGLE);
  const effort = working.length > 0 ? working : planned.sets;
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: [...exercise.secondaryMuscles],
    sets: planned.sets.map((set) => ({ setType: set.setType })),
    restSeconds: planned.restSeconds ?? restDurationFor(exercise.profile),
    repRange: min < max ? formatRepRange({ min, max }) : `${max}`,
    targetRIR: Math.min(...effort.map((set) => set.targetRIR)),
  };
}

/**
 * The view of one routine, or null when it has no prescription to show.
 *
 * A routine whose mesocycle is missing is a half-finished save (the routine write
 * landed, the mesocycle write did not). It has no sessions, and the card cannot
 * render a microcycle that does not exist.
 */
export function toRoutineView(
  routine: Routine,
  mesocycle: Mesocycle | null,
  exerciseById: ReadonlyMap<string, Exercise>,
  labels: RoutineViewLabels,
  completedSessions: readonly WorkoutSession[] = [],
): RoutineView | null {
  const planned = [...(mesocycle?.plannedSessions ?? [])].sort((a, b) => a.index - b.index);
  if (mesocycle === null || planned.length === 0) return null;

  const names = sessionNames(planned, labels.focus);
  const storedCurrent = mesocycle.currentMicrocycleIndex;
  const count = Math.max(mesocycle.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES, storedCurrent + 1);
  const completed = completedDatesByPlannedSession(completedSessions, mesocycle.id);
  const current = firstIncompleteMicrocycle(storedCurrent, count, planned, completed);

  const setsOf = (sessions: readonly PlannedSession[]) =>
    sessions.flatMap((session) => session.exercises.flatMap((exercise) => exercise.sets));
  const base = setsOf(planned);
  const meanRIR = (sets: readonly { targetRIR: number }[]) =>
    sets.reduce((sum, set) => sum + set.targetRIR, 0) / Math.max(1, sets.length);

  // Volume is static within a mesocycle (§3); what moves between microcycles, the
  // strength RIR ramp and the deload, comes from `prescriptionForMicrocycle`.
  const microcycles = Array.from({ length: count }, (_, index): MicrocycleView => {
    const sessions = prescriptionForMicrocycle(planned, routine.generation.goal, index, count);
    const sets = setsOf(sessions);
    return {
      id: `${mesocycle.id}:m${index}`,
      number: index + 1,
      isDeload: isDeloadMicrocycle(index, count),
      isProjected: index > current,
      volumeAdjustmentSets: sets.length - base.length,
      intensityAdjustmentRIR: meanRIR(sets) - meanRIR(base),
      sessions: sessions.map((session, position) => ({
        id: `${mesocycle.id}:m${index}:s${session.index}`,
        plannedSessionIndex: session.index,
        name: names[position],
        completedOn: completed.get(`${index}:${session.index}`),
        exercises: [...session.exercises]
          .sort((a, b) => a.order - b.order)
          .map((exercise) => toExerciseView(exercise, exerciseById))
          .filter((exercise): exercise is SessionExerciseView => exercise !== null),
      })),
    };
  });

  return {
    id: routine.id,
    mesocycleId: mesocycle.id,
    name: routine.name,
    objective: labels.goal(routine.generation.goal),
    generationGoal: routine.generation.goal,
    icon: routine.icon,
    color: routine.accentColor,
    domain: 'STRENGTH',
    isActive: routine.isActive === true,
    microcycles,
    currentMicrocycleIndex: current,
  };
}

/** Active routines first, then newest first. Ids end in their creation time. */
export function orderRoutineViews(
  views: readonly RoutineView[],
  createdAt: ReadonlyMap<string, number>,
): RoutineView[] {
  return [...views].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      (createdAt.get(b.id) ?? 0) - (createdAt.get(a.id) ?? 0),
  );
}

/**
 * Today's session: the first pending one of the ACTIVE routine's running
 * microcycle. Inactive routines are shown for reference and to be activated; they
 * never supply today's workout.
 */
export function defaultSessionId(routines: readonly RoutineView[]): string {
  const active = routines.find((routine) => routine.isActive);
  const pending = active?.microcycles[active.currentMicrocycleIndex]?.sessions.find(
    (session) => session.completedOn === undefined,
  );
  return pending?.id ?? '';
}

/** The routine the accordion opens with. */
export function defaultExpandedRoutineId(routines: readonly RoutineView[]): string {
  return routines.find((routine) => routine.isActive)?.id ?? routines[0]?.id ?? '';
}

/** Reads the screen needs, injected so the join is testable without Firestore. */
export interface RoutineViewSources {
  listRoutines: (userId: string) => Promise<Routine[]>;
  getMesocycle: (mesocycleId: string) => Promise<Mesocycle | null>;
  /** Optional while migrating older callers; production always supplies it. */
  listWorkoutSessions?: (userId: string) => Promise<WorkoutSession[]>;
}

/** Loads the athlete's routines with their running mesocycle, ordered for the home. */
export async function loadRoutineViews(
  userId: string,
  sources: RoutineViewSources,
  exerciseById: ReadonlyMap<string, Exercise>,
  labels: RoutineViewLabels,
): Promise<RoutineView[]> {
  const [routines, completedSessions] = await Promise.all([
    sources.listRoutines(userId),
    sources.listWorkoutSessions?.(userId) ?? Promise.resolve([]),
  ]);
  const mesocycles = await Promise.all(
    routines.map((routine) =>
      routine.activeMesocycleId === undefined
        ? Promise.resolve(null)
        : sources.getMesocycle(routine.activeMesocycleId),
    ),
  );
  const createdAt = new Map(
    routines.map((routine) => [
      routine.id,
      typeof routine.createdAt === 'number' ? routine.createdAt : 0,
    ]),
  );
  const views = routines
    .map((routine, index) => toRoutineView(routine, mesocycles[index], exerciseById, labels, completedSessions))
    .filter((view): view is RoutineView => view !== null);
  return orderRoutineViews(views, createdAt);
}
