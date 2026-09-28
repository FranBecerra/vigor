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
import type {
  Exercise,
  Mesocycle,
  MuscleGroup,
  PlannedSession,
  PlannedSessionFocus,
  Routine,
  SetType,
} from '@/models';
import type { RoutineIconKey } from '@/models/routine';
import { formatRepRange } from './exercisePrescription';
import { restDurationFor } from './restTimer';

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
  name: string;
  objective: string;
  icon: RoutineIconKey;
  color: string;
  domain: TrainingDomain;
  /** true = the running routine, expanded by default. */
  isActive: boolean;
  microcycles: MicrocycleView[];
  /** 0-based index of the running microcycle within `microcycles`. */
  currentMicrocycleIndex: number;
}

/**
 * Roadmap horizon when the mesocycle stores none: five accumulation microcycles
 * and a deload, the example the PRD gives for the roadmap (§3.1). It is drawn as a
 * projection, never as a promise.
 */
export const DEFAULT_PROJECTED_MICROCYCLES = 6;

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
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: [...exercise.secondaryMuscles],
    sets: planned.sets.map((set) => ({ setType: set.setType })),
    restSeconds: restDurationFor(exercise.profile),
    repRange: min < max ? formatRepRange({ min, max }) : `${max}`,
    targetRIR: Math.min(...planned.sets.map((set) => set.targetRIR)),
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
): RoutineView | null {
  const planned = [...(mesocycle?.plannedSessions ?? [])].sort((a, b) => a.index - b.index);
  if (mesocycle === null || planned.length === 0) return null;

  const names = sessionNames(planned, labels.focus);
  const current = mesocycle.currentMicrocycleIndex;
  const count = Math.max(mesocycle.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES, current + 1);

  // Volume is static within a mesocycle (§3): every microcycle repeats the same
  // prescription, and only its ids differ so a session can be selected per microcycle.
  const microcycles = Array.from({ length: count }, (_, index): MicrocycleView => ({
    id: `${mesocycle.id}:m${index}`,
    number: index + 1,
    isDeload: count > 1 && index === count - 1,
    isProjected: index > current,
    volumeAdjustmentSets: 0,
    intensityAdjustmentRIR: 0,
    sessions: planned.map((session, position) => ({
      id: `${mesocycle.id}:m${index}:s${session.index}`,
      name: names[position],
      exercises: [...session.exercises]
        .sort((a, b) => a.order - b.order)
        .map((exercise) => toExerciseView(exercise, exerciseById))
        .filter((exercise): exercise is SessionExerciseView => exercise !== null),
    })),
  }));

  return {
    id: routine.id,
    name: routine.name,
    objective: labels.goal(routine.generation.goal),
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
}

/** Loads the athlete's routines with their running mesocycle, ordered for the home. */
export async function loadRoutineViews(
  userId: string,
  sources: RoutineViewSources,
  exerciseById: ReadonlyMap<string, Exercise>,
  labels: RoutineViewLabels,
): Promise<RoutineView[]> {
  const routines = await sources.listRoutines(userId);
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
    .map((routine, index) => toRoutineView(routine, mesocycles[index], exerciseById, labels))
    .filter((view): view is RoutineView => view !== null);
  return orderRoutineViews(views, createdAt);
}
