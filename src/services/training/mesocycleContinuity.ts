import type { Exercise, Mesocycle, PlannedSession, Routine, WorkoutSession } from '@/models';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { bioPerformanceSeries, ownedBioWorkouts } from '@/services/bio/observations';
import { isPlannedDeload, sessionsForMicrocycle, sessionKey } from './mesocycleEditing';
import { DEFAULT_PROJECTED_MICROCYCLES } from './microcyclePrescription';
import { countWorkingSets } from './sessionSummary';
import { sessionEffortValue } from './sessionFeedback';
import { isSetCompleted } from './sessionMapper';
import { timestampMillis } from './workoutRuntime';
import { addEffortEvidence, addMuscleDose, comparableCycleWindow, emptyEffortEvidence, matchedCycleFeedback, reviewNextStrengthBlock } from './strengthCycleEvidence';

export type ClosureReason = 'COMPLETED' | 'INTERRUPTED';
type OccurrenceState = 'COMPLETED' | 'SKIPPED' | 'PENDING' | 'DRAFT' | 'CONFLICT';

const reviewedHorizon = (source: Mesocycle) => Math.max(source.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES, source.currentMicrocycleIndex + 1);
const validTime = (value: number) => Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime());

function resolveMesocycleClosure(source: Mesocycle, goal: string, history: readonly WorkoutSession[], now: number) {
  const horizon = reviewedHorizon(source);
  if (!source.userId || !source.id || !validTime(now) || !Number.isInteger(horizon) || horizon < 1 || horizon > 100
    || !Number.isInteger(source.currentMicrocycleIndex) || source.currentMicrocycleIndex < 0 || !source.plannedSessions?.length) {
    throw Error('invalidContinuitySource');
  }
  const unique = new Map<string, WorkoutSession>();
  const time = (value: WorkoutSession['completedAt']) => value === undefined || value === null ? 0 : timestampMillis(value) || 0;
  const version = (record: WorkoutSession) => Math.max(time(record.performedAt), time(record.completedAt), time(record.discardedAt), record.editedAt ?? 0);
  for (const record of history) {
    if (record.userId !== source.userId || record.mesocycleId !== source.id || !record.id) continue;
    const previous = unique.get(record.id);
    if (!previous || version(record) > version(previous)
      || version(record) === version(previous) && record.discardedAt !== undefined) unique.set(record.id, record);
  }
  const actuals = new Map<string, WorkoutSession[]>();
  const drafts = new Set<string>();
  const owned = [...unique.values()];
  const valid = ownedBioWorkouts(source.userId, owned, now);
  const validIds = new Set(valid.map(record => record.id));
  const invalid = new Set<string>();
  for (const record of valid) {
    if (!Number.isInteger(record.plannedSessionIndex) || record.plannedSessionIndex! < 0) continue;
    const key = sessionKey(record.microcycleIndex, record.plannedSessionIndex!);
    actuals.set(key, [...(actuals.get(key) ?? []), record]);
  }
  for (const record of owned) {
    if (!Number.isInteger(record.plannedSessionIndex) || record.plannedSessionIndex! < 0) continue;
    const key = sessionKey(record.microcycleIndex, record.plannedSessionIndex!);
    if (version(record) > now) invalid.add(key);
    else if (record.discardedAt !== undefined) continue;
    else if (record.completedAt === undefined) drafts.add(key);
    else if (!validIds.has(record.id)) invalid.add(key);
  }
  const completedWorkouts = new Map<string, WorkoutSession>();
  const plannedBySlot = new Map<string, PlannedSession>();
  const occurrences = Array.from({ length: horizon }, (_, cycleIndex) => sessionsForMicrocycle(source, goal, cycleIndex).map(session => {
    const key = sessionKey(cycleIndex, session.index);
    plannedBySlot.set(key, session);
    const observed = actuals.get(key) ?? [];
    const skippedAt = source.skippedSessions?.[key];
    const skipped = skippedAt !== undefined && validTime(skippedAt) && skippedAt <= now;
    const state: OccurrenceState = invalid.has(key) || skippedAt !== undefined && !skipped || observed.length > 1 || drafts.has(key) && (observed.length > 0 || skipped) || observed.length > 0 && skipped
      ? 'CONFLICT' : drafts.has(key) ? 'DRAFT' : observed.length ? 'COMPLETED' : skipped ? 'SKIPPED' : 'PENDING';
    if (state === 'COMPLETED') completedWorkouts.set(key, observed[0]);
    return { cycleIndex, sessionIndex: session.index, state,
      plannedWorkingSets: session.exercises.reduce((sum, exercise) => sum + countWorkingSets(exercise.sets), 0),
      actualWorkingSets: state === 'COMPLETED' ? observed[0].exercises.reduce((sum, exercise) =>
        sum + countWorkingSets(exercise.sets.filter(isSetCompleted)), 0) : 0,
    };
  })).flat();
  const count = (state: OccurrenceState) => occurrences.filter(occurrence => occurrence.state === state).length;
  const completed = count('COMPLETED'), skipped = count('SKIPPED'), pending = count('PENDING');
  const blocked = count('DRAFT') > 0 || count('CONFLICT') > 0;
  const open = source.status === 'ACTIVE' || source.status === 'DELOAD';
  const review = { occurrences, completed, skipped, pending, blocked,
    canComplete: open && !blocked && completed > 0 && pending === 0,
    canInterrupt: open && !blocked,
    plannedWorkingSets: occurrences.reduce((sum, row) => sum + row.plannedWorkingSets, 0),
    actualWorkingSets: occurrences.reduce((sum, row) => sum + row.actualWorkingSets, 0),
  };
  return { review, completedWorkouts, plannedBySlot };
}

/** Plan and actual counts stay distinct. A skip resolves a slot but earns no adherence. */
export function reviewMesocycleClosure(source: Mesocycle, goal: string, history: readonly WorkoutSession[], now: number) {
  return resolveMesocycleClosure(source, goal, history, now).review;
}

interface CycleObservation {
  cycleIndex: number;
  plannedDeload: boolean;
  effort: ReturnType<typeof emptyEffortEvidence>;
  plannedSessions: number;
  completedSessions: number;
  skippedSessions: number;
  plannedWorkingSets: number;
  actualWorkingSets: number;
  completionRate: number | null;
  observedWindow: { from: number; to: number } | null;
  workouts: { id: string; sessionIndex: number; effort: number | null; effortTiming: NonNullable<WorkoutSession['sessionFeedback']>['timing'] | null }[];
  muscleDose: {
    planned: Parameters<typeof addMuscleDose>[0];
    actual: Parameters<typeof addMuscleDose>[0];
  };
}

/** Read-only evidence for the strength balance. Observed event bounds do not define the duration of a cycle. */
export function strengthLongitudinalIndicators(source: Mesocycle, goal: string, history: readonly WorkoutSession[],
  priorHistory: readonly WorkoutSession[], catalogue: ReadonlyMap<string, Exercise>, now: number,
  feedback: readonly MicrocycleReview[] = []) {
  const { review, completedWorkouts, plannedBySlot } = resolveMesocycleClosure(source, goal, history, now);
  const cycles = new Map<number, CycleObservation>();
  for (const row of review.occurrences) {
    let cycle = cycles.get(row.cycleIndex);
    if (!cycle) {
      cycle = { cycleIndex: row.cycleIndex, plannedDeload: isPlannedDeload(source, goal, row.cycleIndex),
        effort: emptyEffortEvidence(), plannedSessions: 0, completedSessions: 0, skippedSessions: 0,
        plannedWorkingSets: 0, actualWorkingSets: 0, completionRate: null, observedWindow: null, workouts: [],
        muscleDose: { planned: { byMuscle: {}, unclassifiedSets: 0 }, actual: { byMuscle: {}, unclassifiedSets: 0 } } };
      cycles.set(row.cycleIndex, cycle);
    }
    cycle.plannedSessions += 1;
    cycle.plannedWorkingSets += row.plannedWorkingSets;
    cycle.actualWorkingSets += row.actualWorkingSets;
    const key = sessionKey(row.cycleIndex, row.sessionIndex);
    const session = plannedBySlot.get(key)!;
    const workout = completedWorkouts.get(key);
    addEffortEvidence(cycle.effort, session, workout, catalogue);
    for (const exercise of session.exercises) {
      addMuscleDose(cycle.muscleDose.planned, exercise.exerciseSnapshot ?? catalogue.get(exercise.exerciseId), exercise.sets);
    }
    let from: number, to: number;
    if (workout) {
      cycle.completedSessions += 1;
      for (const exercise of workout.exercises) {
        addMuscleDose(cycle.muscleDose.actual, exercise.exerciseSnapshot ?? catalogue.get(exercise.exerciseId), exercise.sets.filter(isSetCompleted));
      }
      from = timestampMillis(workout.performedAt);
      to = timestampMillis(workout.completedAt!);
      const feedback = workout.sessionFeedback;
      const effort = feedback && feedback.recordedAt >= from && feedback.recordedAt <= now ? sessionEffortValue(feedback) : null;
      cycle.workouts.push({ id: workout.id, sessionIndex: row.sessionIndex, effort, effortTiming: effort === null ? null : feedback!.timing });
    } else if (row.state === 'SKIPPED') {
      cycle.skippedSessions += 1;
      from = to = source.skippedSessions![key];
    } else continue;
    const window = cycle.observedWindow;
    cycle.observedWindow = window ? { from: Math.min(window.from, from), to: Math.max(window.to, to) } : { from, to };
  }
  const cycleEvidence = [...cycles.values()].map(cycle => {
    const resolved = cycle.completedSessions + cycle.skippedSessions === cycle.plannedSessions;
    if (resolved) {
      cycle.completionRate = cycle.completedSessions / cycle.plannedSessions;
    }
    const rows = review.occurrences.filter(row => row.cycleIndex === cycle.cycleIndex);
    const workouts = cycle.workouts.map(({ sessionIndex }) => completedWorkouts.get(sessionKey(cycle.cycleIndex, sessionIndex))!);
    const datedWindow = resolved ? comparableCycleWindow(source.trainingCalendar, cycle.cycleIndex, rows.map(row => row.sessionIndex), workouts, now) : null;
    const rate = (dose: CycleObservation['muscleDose']['planned']) => datedWindow && dose.unclassifiedSets === 0
      ? Object.fromEntries(Object.entries(dose.byMuscle).map(([muscle, sets]) => [muscle, sets * 7 / datedWindow.days])) : null;
    return { ...cycle, datedWindow, muscleSetsPerSevenDays: { planned: rate(cycle.muscleDose.planned), actual: rate(cycle.muscleDose.actual) },
      feedback: resolved && cycle.observedWindow ? matchedCycleFeedback(source, cycle.cycleIndex, cycle.observedWindow, feedback, now) : null };
  });
  const previous = priorHistory.filter(row => row.mesocycleId !== source.id);
  const performance = continuityPerformanceEvidence(source, [...history, ...previous], catalogue, now,
    new Set([source.id, ...previous.map(row => row.mesocycleId)]));
  const accumulation = new Set(cycleEvidence.filter(cycle => !cycle.plannedDeload).map(cycle => cycle.cycleIndex));
  const accumulationWorkouts = [...completedWorkouts.values()].filter(workout => accumulation.has(workout.microcycleIndex));
  const blockPerformance = continuityPerformanceEvidence(source, accumulationWorkouts, catalogue, now);
  return { review, cycles: cycleEvidence, performance, blockPerformance, nextBlockReview: reviewNextStrengthBlock(cycleEvidence, blockPerformance) };
}

/** The just-saved planned occurrence must resolve the block, regardless of session order. */
export function completedBlockAfterWorkout(source: Mesocycle, goal: string, history: readonly WorkoutSession[],
  workout: WorkoutSession, now: number): boolean {
  if (!source.routineId || source.continuation || source.id !== workout.mesocycleId || source.userId !== workout.userId
    || workout.plannedSessionIndex === undefined || workout.completedAt === undefined || workout.discardedAt !== undefined) return false;
  try {
    const review = reviewMesocycleClosure(source, goal, [...history.filter(record => record.id !== workout.id), workout], now);
    return review.canComplete && review.occurrences.some(row => row.cycleIndex === workout.microcycleIndex
      && row.sessionIndex === workout.plannedSessionIndex && row.state === 'COMPLETED');
  } catch {
    return false;
  }
}

/** Descriptive evidence only. Sparse or unmatched records cannot drive a proposal. */
export function continuityPerformanceEvidence(source: Mesocycle, history: readonly WorkoutSession[],
  catalogue: ReadonlyMap<string, Exercise>, now: number, blockIds: ReadonlySet<string> = new Set([source.id])) {
  const eligible = history.filter(record => blockIds.has(record.mesocycleId));
  return bioPerformanceSeries(source.userId, eligible, catalogue, now).map(series => {
    const separated: typeof series.points = [];
    for (const point of [...series.points].reverse()) {
      const newer = separated.at(-1);
      if (!newer || newer.at - point.at >= 86_400_000) separated.push(point);
    }
    const recent = separated.slice(0, 4).reverse();
    const previous = recent.slice(0, 2), latest = recent.slice(2);
    const enough = series.comparableEffort && recent.length === 4;
    const higher = enough && Math.min(...latest.map(point => point.estimate)) > Math.max(...previous.map(point => point.estimate));
    const lower = enough && Math.max(...latest.map(point => point.estimate)) < Math.min(...previous.map(point => point.estimate));
    return { exerciseId: series.exerciseId, contextKey: series.key, exposures: separated.length,
      workoutIds: recent.map(point => point.workoutId),
      direction: !enough ? 'INSUFFICIENT' as const : higher ? 'HIGHER' as const : lower ? 'LOWER' as const : 'MIXED' as const };
  });
}

/** Carry the durable baseline and its prescription mode into the next block. */
export function previewMesocycleSuccessor(
  routine: Routine, source: Mesocycle, history: readonly WorkoutSession[],
  options: { successorId: string; reason: ClosureReason; microcycles: number; now: number },
) {
  const { successorId, reason, microcycles, now } = options;
  if (routine.hybrid || routine.userId !== source.userId || source.routineId !== routine.id || routine.activeMesocycleId !== source.id
    || !successorId || successorId.includes('/') || successorId === source.id || !Number.isInteger(microcycles)
    || microcycles < 1 || microcycles > 12 || !['COMPLETED', 'INTERRUPTED'].includes(reason)) throw Error('invalidContinuityIntent');
  const review = reviewMesocycleClosure(source, routine.generation.goal, history, now);
  if (reason === 'COMPLETED' ? !review.canComplete : !review.canInterrupt) throw Error('continuityCloseBlocked');
  const lastObserved = Math.max(source.currentMicrocycleIndex, ...review.occurrences.filter(row =>
    row.state === 'COMPLETED' || row.state === 'SKIPPED').map(row => row.cycleIndex));
  const baseline = [...(source.prescriptionRevisions ?? [])].filter(revision => revision.fromMicrocycleIndex <= lastObserved)
    .sort((a, b) => b.fromMicrocycleIndex - a.fromMicrocycleIndex)[0]?.plannedSessions ?? source.plannedSessions!;
  if (!baseline.length || baseline.some(session => !session.exercises.length)) throw Error('invalidContinuityBaseline');
  const successor: Mesocycle = {
    id: successorId, routineId: routine.id, userId: routine.userId, status: 'ACTIVE',
    prescriptionMode: source.prescriptionMode === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC',
    plannedSessions: baseline, currentMicrocycleIndex: 0, projectedMicrocycles: microcycles, sessionsPerMicrocycle: baseline.length,
    targetVolumePerGroup: source.targetVolumePerGroup, startedAt: now, updatedAt: now,
    scheduleTemplate: source.scheduleTemplate, sessionOrder: source.sessionOrder,
    restDays: source.restDays, exerciseRestOverrides: source.exerciseRestOverrides,
  };
  return { review, sourcePatch: { status: reason, updatedAt: now }, successor: JSON.parse(JSON.stringify(successor)) as Mesocycle,
    routinePatch: { activeMesocycleId: successorId, updatedAt: now } };
}
