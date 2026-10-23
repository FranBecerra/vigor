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
  SplitStructure,
  type Exercise,
  type Equipment,
  type Mesocycle,
  type MuscleGroup,
  type PlannedSession,
  type PlannedSessionFocus,
  type Routine,
  type Timestampish,
  type WorkoutSession,
  MuscleGroup as Muscle,
} from '@/models';
import type { RoutineIconKey } from '@/models/routine';
import { durationCalibration } from './sessionDuration';
import { estimateSessionMinutes } from './sessionSummary';
import { formatRepRange } from './exercisePrescription';
import {
  DEFAULT_PROJECTED_MICROCYCLES,
  isDeloadMicrocycle,
} from './microcyclePrescription';
import { sessionKey, sessionsForMicrocycle } from './mesocycleEditing';
import { restDurationFor } from './restTimer';
import { plannedPresentationFocus } from './sessionCoherence';
import { TrainingGoal } from './volumePlan';
import { orderedRoutineSessions } from './routineRestDays';
import { workoutHistoryDetails } from './workoutHistory';
import { timestampMillis } from './workoutRuntime';

export { DEFAULT_PROJECTED_MICROCYCLES };

/** Training domain shown by the home pills. */
export type TrainingDomain = 'STRENGTH' | 'CARDIO';

/** One exercise of a session, resolved against the catalogue. */
export interface SessionExerciseView {
  isTimed?: boolean;
  excludeFromVolume?: boolean;
  exerciseId: string;
  name: string;
  primaryMuscle: MuscleGroup;
  primaryMuscles?: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  sets: { setType: SetType; targetRIR?: number }[];
  restSeconds: number;
  /** Prescribed repetition range, for the preview. */
  repRange: string;
  /** Last working-set RIR, retained for legacy cards and fallback data. */
  targetRIR: number;
}

export interface SessionView {
  scheduledOn?: string;
  id: string;
  /** The persisted prescription position used to launch and link execution. */
  plannedSessionIndex: number;
  name: string;
  exercises: SessionExerciseView[];
  /** ISO date it was performed. `undefined` = pending, and pending sessions show no day. */
  completedOn?: string;
  /** Execution stays separate from the prescription: history edits never replan. */
  completedWorkoutId?: string;
  performedExercises?: SessionExerciseView[];
  skippedOn?: string;
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
  /** Already-loaded metadata keeps workout/rest rows in the first home render. */
  mesocycleSnapshot?: Mesocycle;
  durationFeedback?: ReturnType<typeof durationCalibration>;
  id: string;
  mesocycleId: string;
  name: string;
  objective: string;
  /** Untranslated goal used by the execution runtime. */
  generationGoal: string;
  availableEquipment: Equipment[];
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

function completedWorkoutsByPlannedSession(
  sessions: readonly WorkoutSession[],
  mesocycleId: string,
  owner: string,
): ReadonlyMap<string, WorkoutSession> {
  const records = new Map<string, WorkoutSession>();
  sessions.forEach((session) => {
    if (session.userId !== owner || session.discardedAt !== undefined || session.mesocycleId !== mesocycleId
      || !Number.isInteger(session.plannedSessionIndex) || session.plannedSessionIndex! < 0
      || !Number.isInteger(session.microcycleIndex) || session.microcycleIndex < 0) return;
    const date = timestampToISODate(session.completedAt);
    if (date !== undefined) {
      const key = `${session.microcycleIndex}:${session.plannedSessionIndex}`;
      const previous = records.get(key);
      if (!previous || timestampMillis(session.completedAt!) > timestampMillis(previous.completedAt!)
        || timestampMillis(session.completedAt!) === timestampMillis(previous.completedAt!) && session.id > previous.id) records.set(key, session);
    }
  });
  return records;
}

function firstIncompleteMicrocycle(
  initialIndex: number,
  horizon: number,
  planned: readonly PlannedSession[],
  completed: ReadonlyMap<string, unknown>,
  skipped: Readonly<Record<string, number>>,
): number {
  for (let index = Math.max(0, initialIndex); index < horizon; index += 1) {
    if (planned.some((session) =>
      !completed.has(sessionKey(index, session.index)) &&
      skipped[sessionKey(index, session.index)] === undefined)) return index;
  }
  return Math.max(0, Math.min(initialIndex, horizon - 1));
}

/** Actual completed rows only. Unknown effort stays absent, never a planned fallback. */
function performedExerciseViews(session: WorkoutSession, catalogue: ReadonlyMap<string, Exercise>): SessionExerciseView[] {
  return workoutHistoryDetails(session, catalogue).exercises.map((entry) => {
    const source = session.exercises.find((exercise) => exercise.id === entry.id)!;
    const exercise = source.exerciseSnapshot ?? catalogue.get(entry.exerciseId);
    const done = entry.sets.filter((set) => set.done);
    const working = done.filter((set) => set.setType !== SetType.WARMUP);
    const quantities = working.flatMap((set) => set.quantity === null ? [] : [set.quantity]);
    const efforts = working.flatMap((set) => set.rir === null ? [] : [set.rir]);
    const timed = exercise?.recording?.measure === 'SECONDS' || working.some((set) => set.seconds);
    const min = Math.min(...quantities), max = Math.max(...quantities);
    return {
      exerciseId: entry.exerciseId, name: entry.name ?? entry.exerciseId,
      primaryMuscle: exercise?.primaryMuscle ?? Muscle.UNCLASSIFIED,
      ...(exercise?.primaryMuscles ? { primaryMuscles: [...exercise.primaryMuscles] } : {}),
      secondaryMuscles: [...(exercise?.secondaryMuscles ?? [])],
      ...(timed ? { isTimed: true, excludeFromVolume: true } : {}),
      sets: done.map((set) => ({ setType: set.setType, ...(set.rir === null ? {} : { targetRIR: set.rir }) })),
      restSeconds: 0,
      repRange: quantities.length ? `${min === max ? min : formatRepRange({ min, max })}${timed ? 's' : ''}` : '—',
      // Legacy summary field only; recorded charts read each set, not this fallback.
      targetRIR: efforts.length ? Math.min(...efforts) : 0,
    };
  });
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
    if (session.name?.trim()) return session.name.trim();
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
  const exercise = planned.exerciseSnapshot ?? exerciseById.get(planned.exerciseId);
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
    ...(exercise.primaryMuscles ? { primaryMuscles: [...exercise.primaryMuscles] } : {}),
    ...(exercise.recording?.measure === 'SECONDS' ? { isTimed: true } : {}),
    ...(exercise.recording?.measure === 'SECONDS' ? { excludeFromVolume: true } : {}),
    secondaryMuscles: [...exercise.secondaryMuscles],
    sets: planned.sets.map((set) => ({ setType: set.setType, targetRIR: set.targetRIR })),
    restSeconds: planned.restSeconds ?? restDurationFor(exercise.profile),
    repRange: last.targetDurationSeconds !== undefined ? `${last.targetDurationSeconds}s` : min < max ? formatRepRange({ min, max }) : `${max}`,
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

  const names = sessionNames(routine.generation.goal === TrainingGoal.HYPERTROPHY && routine.generation.split === SplitStructure.AUTO
    ? planned.map((session) => ({ ...session, focus: plannedPresentationFocus(session, exerciseById) }))
    : planned, labels.focus);
  const storedCurrent = mesocycle.currentMicrocycleIndex;
  const count = Math.max(mesocycle.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES, storedCurrent + 1);
  const completed = completedWorkoutsByPlannedSession(completedSessions, mesocycle.id, mesocycle.userId);
  const skipped = mesocycle.skippedSessions ?? {};
  const current = firstIncompleteMicrocycle(storedCurrent, count, planned, completed, skipped);

  const setsOf = (sessions: readonly PlannedSession[]) =>
    sessions.flatMap((session) => session.exercises.flatMap((exercise) => exercise.sets));
  const base = setsOf(planned);
  const meanRIR = (sets: readonly { targetRIR: number; targetDurationSeconds?: number }[]) => {
    const repetitionSets = sets.filter((set) => set.targetDurationSeconds === undefined);
    return repetitionSets.reduce((sum, set) => sum + set.targetRIR, 0) / Math.max(1, repetitionSets.length);
  };

  // Volume is static within a mesocycle (§3); what moves between microcycles, the
  // strength RIR ramp and the deload, comes from `prescriptionForMicrocycle`.
  const microcycles = Array.from({ length: count }, (_, index): MicrocycleView => {
    const sessions = orderedRoutineSessions(sessionsForMicrocycle(mesocycle, routine.generation.goal, index), mesocycle.sessionOrder);
    const sets = setsOf(sessions);
    return {
      id: `${mesocycle.id}:m${index}`,
      number: index + 1,
      isDeload: mesocycle.prescriptionMode !== 'MANUAL' && isDeloadMicrocycle(index, count),
      isProjected: index > current,
      volumeAdjustmentSets: sets.length - base.length,
      intensityAdjustmentRIR: meanRIR(sets) - meanRIR(base),
      sessions: sessions.map((session, position) => ({
        id: `${mesocycle.id}:m${index}:s${session.index}`,
        plannedSessionIndex: session.index,
        name: names[planned.findIndex((candidate) => candidate.index === session.index)] ?? names[position],
        completedOn: timestampToISODate(completed.get(`${index}:${session.index}`)?.completedAt),
        ...(completed.has(`${index}:${session.index}`) ? {
          completedWorkoutId: completed.get(`${index}:${session.index}`)!.id,
          performedExercises: performedExerciseViews(completed.get(`${index}:${session.index}`)!, exerciseById),
        } : {}),
        skippedOn: timestampToISODate(skipped[sessionKey(index, session.index)]),
        ...(mesocycle.trainingCalendar?.[`${index}:${session.index}`]?.kind === 'workout'
          ? { scheduledOn: mesocycle.trainingCalendar[`${index}:${session.index}`].date } : {}),
        exercises: [...session.exercises]
          .sort((a, b) => a.order - b.order)
          .map((exercise) => toExerciseView(exercise, exerciseById))
          .filter((exercise): exercise is SessionExerciseView => exercise !== null),
      })),
    };
  });

  const durationSamples = completedSessions.filter((session) => session.mesocycleId === mesocycle.id
    && session.completedAt !== undefined && session.plannedSessionIndex !== undefined).flatMap((session) => {
    const plannedSession = sessionsForMicrocycle(mesocycle, routine.generation.goal, session.microcycleIndex)
      .find((s) => s.index === session.plannedSessionIndex);
    if (!plannedSession || session.exercises.length !== plannedSession.exercises.length) return [];
    const sameDose = session.exercises.every((exercise) => {
      const prescription = plannedSession.exercises.find((e) => e.exerciseId === exercise.exerciseId);
      return prescription && prescription.sets.length === exercise.sets.length
        && exercise.sets.every((set) => set.actualReps !== undefined && set.actualWeight !== undefined);
    });
    if (!sameDose) return [];
    const milliseconds = (value: Timestampish) => typeof value === 'number' ? value
      : value.seconds * 1000 + value.nanoseconds / 1_000_000;
    const resolved = plannedSession.exercises.map((e) => toExerciseView(e, exerciseById))
      .filter((e): e is SessionExerciseView => e !== null);
    if (resolved.length !== plannedSession.exercises.length) return [];
    return [{ estimatedMinutes: estimateSessionMinutes(resolved),
      actualMinutes: (milliseconds(session.completedAt!) - milliseconds(session.performedAt)) / 60000 }];
  });
  const durationFeedback = durationCalibration(durationSamples);
  return {
    ...(durationFeedback.sampleCount ? { durationFeedback } : {}),
    id: routine.id,
    mesocycleSnapshot: mesocycle,
    mesocycleId: mesocycle.id,
    name: routine.name,
    objective: labels.goal(routine.generation.goal),
    generationGoal: routine.generation.goal,
    availableEquipment: [...routine.generation.availableEquipment],
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
  const candidates = active?.microcycles[active.currentMicrocycleIndex]?.sessions.filter(
    (session) => session.completedOn === undefined && session.skippedOn === undefined,
  ) ?? [];
  const pending = (active?.mesocycleSnapshot?.sessionOrder ? candidates : candidates.sort((a, b) =>
    (a.scheduledOn ?? '9999-12-31').localeCompare(b.scheduledOn ?? '9999-12-31')))[0];
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
