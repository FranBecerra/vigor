/** Persisted edits to a mesocycle's generated prescription. Pure logic. */
import { SetType, type Exercise, type Mesocycle, type PlannedExercise, type PlannedSession } from '@/models';
import { DEFAULT_PROJECTED_MICROCYCLES, prescriptionForMicrocycle } from './microcyclePrescription';
import { exerciseMinutes } from './trainingCapacity';
import { TrainingGoal } from './volumePlan';
import { replanSessionRIR, type ProgressionStep } from './rirReplanning';

export function sessionKey(microcycleIndex: number, sessionIndex: number): string {
  return `${microcycleIndex}:${sessionIndex}`;
}

/** Resolve the effective plan before a one-off override is applied. */
export function baseSessionsForMicrocycle(
  mesocycle: Mesocycle,
  goal: string,
  index: number,
): PlannedSession[] {
  const horizon = mesocycle.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES;
  const revision = [...(mesocycle.prescriptionRevisions ?? [])]
    .filter((candidate) => candidate.fromMicrocycleIndex <= index)
    .sort((a, b) => b.fromMicrocycleIndex - a.fromMicrocycleIndex)[0];
  const start = revision?.fromMicrocycleIndex ?? 0;
  if (mesocycle.prescriptionMode === 'MANUAL') return JSON.parse(JSON.stringify(revision?.plannedSessions ?? mesocycle.plannedSessions ?? []));
  // A strength ramp is tied to the whole mesocycle, not restarted when a
  // routine is edited halfway through it. Hypertrophy edits instead become
  // the new baseline for the remaining accumulation weeks.
  const prescriptionIndex = revision && goal === TrainingGoal.STRENGTH ? index : index - start;
  const prescriptionHorizon = revision && goal === TrainingGoal.STRENGTH ? horizon : horizon - start;
  return prescriptionForMicrocycle(
    revision?.plannedSessions ?? mesocycle.plannedSessions ?? [],
    goal,
    Math.max(0, prescriptionIndex),
    Math.max(1, prescriptionHorizon),
  );
}

export function sessionsForMicrocycle(
  mesocycle: Mesocycle,
  goal: string,
  index: number,
): PlannedSession[] {
  return baseSessionsForMicrocycle(mesocycle, goal, index).map((session) => {
    const resolved = { ...session, exercises: session.exercises.map((exercise) => {
      const seconds = mesocycle.exerciseRestOverrides?.[exercise.exerciseId];
      return seconds !== undefined && Number.isFinite(seconds) && seconds >= 0 && seconds <= 3600
        ? { ...exercise, restSeconds: seconds } : exercise;
    }) };
    return mesocycle.sessionOverrides?.[sessionKey(index, session.index)] ?? resolved;
  });
}

export function withSessionOverride(
  mesocycle: Mesocycle,
  index: number,
  session: PlannedSession,
): NonNullable<Mesocycle['sessionOverrides']> {
  return { ...mesocycle.sessionOverrides, [sessionKey(index, session.index)]: session };
}

export function withPlanRevision(
  mesocycle: Mesocycle,
  fromMicrocycleIndex: number,
  plannedSessions: PlannedSession[],
): NonNullable<Mesocycle['prescriptionRevisions']> {
  const previous = (mesocycle.prescriptionRevisions ?? []).filter(
    (revision) => revision.fromMicrocycleIndex < fromMicrocycleIndex);
  return [...previous, { fromMicrocycleIndex, plannedSessions }]
    .sort((a, b) => a.fromMicrocycleIndex - b.fromMicrocycleIndex);
}

export type SessionEditScope = 'microcycle' | 'remaining-mesocycle' | 'recalculate-progression';

/** A later plan revision supersedes pending overrides, including reviewed effort schedules. */
export function pendingOverridesAfterRevision(mesocycle: Mesocycle, fromIndex: number, sessionIndex?: number, protectedKeys: readonly string[] = []): NonNullable<Mesocycle['sessionOverrides']> {
  return Object.fromEntries(Object.entries(mesocycle.sessionOverrides ?? {}).filter(([key]) => {
    const [micro, session] = key.split(':').map(Number);
    return !Number.isInteger(micro) || !Number.isInteger(session) || micro < fromIndex || (sessionIndex !== undefined && session !== sessionIndex)
      || protectedKeys.includes(key) || mesocycle.skippedSessions?.[key] !== undefined;
  }));
}

export function sessionProgressionProposal(mesocycle: Mesocycle, goal: string, index: number, edited: PlannedSession, completed: readonly number[] = []): ProgressionStep[] {
  const horizon = mesocycle.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES;
  const steps = Array.from({ length: horizon - index }, (_, offset) => {
    const position = index + offset;
    const session = sessionsForMicrocycle(mesocycle, goal, position).find((entry) => entry.index === edited.index);
    if (!session) throw new Error('Missing progression session');
    return { index: position, session };
  });
  return replanSessionRIR(steps, edited, index, horizon).filter((step) => !completed.includes(step.index) && mesocycle.skippedSessions?.[sessionKey(step.index, edited.index)] === undefined);
}

/** Persist a session edit without changing completed work or unrelated sessions. */
export function changesForSessionEdit(
  mesocycle: Mesocycle,
  goal: string,
  microcycleIndex: number,
  session: PlannedSession,
  scope: SessionEditScope,
  currentMicrocycleHasHistory: boolean,
  completedMicrocycleIndexes: readonly number[] = [],
): Pick<Mesocycle, 'sessionOverrides' | 'prescriptionRevisions' | 'exerciseRestOverrides'> {
  let overrides = withSessionOverride(mesocycle, microcycleIndex, session);
  // A later explicit plan edit must not remain hidden behind a workout-time default.
  const exerciseRestOverrides = mesocycle.exerciseRestOverrides ? { ...mesocycle.exerciseRestOverrides } : undefined;
  for (const exercise of session.exercises) if (exerciseRestOverrides && exercise.restSeconds !== undefined
    && exerciseRestOverrides[exercise.exerciseId] !== undefined) exerciseRestOverrides[exercise.exerciseId] = exercise.restSeconds;
  const rest = exerciseRestOverrides ? { exerciseRestOverrides } : {};
  if (scope === 'microcycle') return { sessionOverrides: overrides };
  if (scope === 'recalculate-progression') {
    const planned = { ...mesocycle.sessionOverrides };
    for (const step of sessionProgressionProposal(mesocycle, goal, microcycleIndex, session)) {
      const key = sessionKey(step.index, session.index);
      if (!completedMicrocycleIndexes.includes(step.index) && mesocycle.skippedSessions?.[key] === undefined) planned[key] = step.session;
    }
    return { ...rest, sessionOverrides: planned };
  }

  const horizon = mesocycle.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES;
  const revisionIndex = currentMicrocycleHasHistory ? microcycleIndex + 1 : microcycleIndex;
  if (revisionIndex >= horizon) return { ...rest, sessionOverrides: overrides };

  const base = baseSessionsForMicrocycle(mesocycle, goal, revisionIndex);
  const revised = base.map((candidate) => candidate.index === session.index ? session : candidate);
  if (!currentMicrocycleHasHistory) {
    // A stale one-off override for this session must not hide the new revision.
    delete overrides[sessionKey(microcycleIndex, session.index)];
  }
  overrides = pendingOverridesAfterRevision({ ...mesocycle, sessionOverrides: overrides }, revisionIndex, session.index,
    completedMicrocycleIndexes.map((index) => sessionKey(index, session.index)));
  return {
    ...rest,
    sessionOverrides: overrides,
    prescriptionRevisions: withPlanRevision(mesocycle, revisionIndex, revised),
  };
}

/** Resize working sets while keeping a strength top single separate. */
export function resizeExerciseSets(exercise: PlannedExercise, workingCount: number): PlannedExercise {
  const count = Math.max(1, Math.min(30, Math.trunc(workingCount)));
  const single = exercise.sets.filter((set) => set.setType === SetType.TOP_SINGLE);
  const working = exercise.sets.filter((set) => set.setType !== SetType.TOP_SINGLE);
  const template = working.at(-1);
  if (template === undefined) return exercise;
  return {
    ...exercise,
    isEdited: true,
    sets: [...single, ...Array.from({ length: count }, (_, index) => ({
      ...(working[index] ?? template),
    }))],
  };
}

export function replaceSessionExercise(
  session: PlannedSession,
  exerciseId: string,
  replacement: PlannedExercise,
): PlannedSession {
  return { ...session, exercises: session.exercises.map((exercise) =>
    exercise.exerciseId === exerciseId ? replacement : exercise) };
}

export function withEstimatedWorkMinutes(
  session: PlannedSession,
  catalogue: ReadonlyMap<string, Exercise>,
): PlannedSession {
  return {
    ...session,
    estimatedWorkMinutes: session.exercises.reduce((sum, planned) => {
      const exercise = catalogue.get(planned.exerciseId);
      return sum + (exercise === undefined ? 0 : exerciseMinutes(
        exercise, planned.sets.length, planned.restSeconds));
    }, 0),
  };
}
