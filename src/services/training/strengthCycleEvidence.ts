import { MuscleGroup, SetType, type Exercise, type Mesocycle, type PlannedSession, type WorkoutSession } from '@/models';
import type { MicrocycleReview, MicrocycleReviewAnswers } from '@/models/microcycleReview';
import { localCheckInDate } from '@/services/bio/dailyCheckIn';
import { validMicrocycleReview } from '@/services/bio/microcycleReview';
import { countWorkingSets, muscleSetVolume } from './sessionSummary';
import { shiftCalendarDate, validCalendarDate } from './trainingCalendar';
import { timestampMillis } from './workoutRuntime';
import { plannedSetId } from './plannedSessionRuntime';
import { isSetCompleted } from './sessionMapper';
import { MAX_RIR, MIN_RIR } from './setIntensity';

type MuscleDose = { byMuscle: Record<string, number>; unclassifiedSets: number };

const validRir = (value: unknown): value is number => typeof value === 'number' && value >= MIN_RIR && value <= MAX_RIR;

export function emptyEffortEvidence() {
  return { planned: [] as number[], pairedTargets: [] as number[], reported: [] as number[], harder: 0, onTarget: 0, easier: 0 };
}

/** Pair standard sets with their original prescription rows, even after a warmup was added or a set removed. */
export function addEffortEvidence(effort: ReturnType<typeof emptyEffortEvidence>, plan: PlannedSession,
  workout: WorkoutSession | undefined, catalogue: ReadonlyMap<string, Exercise>) {
  for (const exercise of plan.exercises) {
    const exerciseDetails = exercise.exerciseSnapshot ?? catalogue.get(exercise.exerciseId);
    if (exerciseDetails?.recording?.measure === 'SECONDS') continue;
    const matches = workout?.exercises.filter(entry => entry.exerciseId === exercise.exerciseId) ?? [];
    const entry = matches.length === 1 ? matches[0] : undefined;
    const setsById = new Map<string, WorkoutSession['exercises'][number]['sets'][number] | null>();
    if (entry && !entry.isSwap && !entry.swappedFromExerciseId && entry.exerciseSnapshot?.recording?.measure !== 'SECONDS') {
      for (const set of entry.sets) setsById.set(set.id, setsById.has(set.id) ? null : set);
    }
    exercise.sets.forEach((target, index) => {
      if (target.setType !== SetType.NORMAL || target.targetDurationSeconds !== undefined || !validRir(target.targetRIR)) return;
      effort.planned.push(target.targetRIR);
      const set = setsById.get(plannedSetId(plan.index, exercise.order, index));
      if (!set || set.setType !== SetType.NORMAL || set.recording?.measure === 'SECONDS' || set.targetDurationSeconds !== undefined
        || set.targetRIR !== target.targetRIR || set.targetReps !== target.targetReps || set.actualRIRSource !== 'ATHLETE'
        || !validRir(set.actualRIR) || !Number.isInteger(set.actualReps) || set.actualReps! <= 0 || set.actualReps! > 999
        || (!set.recording && (!Number.isFinite(set.actualWeight) || set.actualWeight! < 0))
        || (set.extensions?.length ?? 0) > 0 || !isSetCompleted(set)) return;
      effort.pairedTargets.push(target.targetRIR);
      effort.reported.push(set.actualRIR);
      if (set.actualRIR < target.targetRIR) effort.harder++;
      else if (set.actualRIR > target.targetRIR) effort.easier++;
      else effort.onTarget++;
    });
  }
}

interface ReviewCycle {
  cycleIndex: number;
  plannedDeload: boolean;
  observedWindow: object | null;
  completionRate: number | null;
  muscleDose: { planned: MuscleDose; actual: MuscleDose };
  effort: ReturnType<typeof emptyEffortEvidence>;
  feedback: { answers: MicrocycleReviewAnswers } | null;
  workouts: readonly { id: string }[];
}

export function reviewNextStrengthBlock(cycles: readonly ReviewCycle[], performance: readonly {
  exerciseId: string; workoutIds: readonly string[]; direction: 'HIGHER' | 'LOWER' | 'MIXED' | 'INSUFFICIENT';
}[]) {
  const recent = cycles.filter(cycle => !cycle.plannedDeload && cycle.observedWindow).slice(-2);
  const [first, last] = recent;
  const cycleIndexes = recent.map(cycle => cycle.cycleIndex);
  if (!first || !last || last.cycleIndex !== first.cycleIndex + 1 || recent.some(cycle => cycle.completionRate === null)) {
    return { action: 'INSUFFICIENT' as const, cycleIndexes, signals: [] };
  }
  const signals: ('REPEATED_HARDER_RIR' | 'REPEATED_RECOVERY_DIFFICULTY' | 'REPEATED_FEASIBILITY_DIFFICULTY' | 'LOWER_PERFORMANCE' | 'PROGRESS_WITH_TOLERANCE')[] = [];
  const earlierIds = new Set(first.workouts.map(workout => workout.id));
  const latestIds = new Set(last.workouts.map(workout => workout.id));
  const trends = performance.filter(signal => latestIds.has(signal.workoutIds.at(-1) ?? '')
    && signal.workoutIds.some(id => earlierIds.has(id)));
  const reports = recent.map(cycle => cycle.feedback?.answers);
  const comparableEffort = (cycle: ReviewCycle) => cycle.effort.reported.length >= 2
    && cycle.effort.reported.length * 2 >= cycle.effort.planned.length;
  const harder = (cycle: ReviewCycle) => comparableEffort(cycle) && cycle.effort.harder * 2 > cycle.effort.reported.length;
  if (recent.every(harder)) signals.push('REPEATED_HARDER_RIR');
  const unrecoveredMuscles = reports[0]?.unrecoveredMuscles ?? [];
  if (reports.every(answer => answer?.recovery === 'WORSE')
    || unrecoveredMuscles.some(muscle => reports[1]?.unrecoveredMuscles?.includes(muscle))) signals.push('REPEATED_RECOVERY_DIFFICULTY');
  if (reports.every(answer => answer?.sustainability === 'TIGHT' || answer?.sustainability === 'NO')) signals.push('REPEATED_FEASIBILITY_DIFFICULTY');
  if (trends.some(trend => trend.direction === 'LOWER')) signals.push('LOWER_PERFORMANCE');
  if (signals.length) return { action: 'REVIEW' as const, cycleIndexes, signals };
  const executedDose = ({ muscleDose: { planned, actual } }: ReviewCycle) => planned.unclassifiedSets === 0 && actual.unclassifiedSets === 0
    && Object.keys(planned.byMuscle).length > 0 && Object.keys(planned.byMuscle).length === Object.keys(actual.byMuscle).length
    && Object.entries(planned.byMuscle).every(([muscle, sets]) => sets === actual.byMuscle[muscle]);
  const tolerated = recent.every(cycle => cycle.completionRate === 1 && executedDose(cycle) && comparableEffort(cycle) && !harder(cycle))
    && reports.every(answer => (answer?.recovery === 'USUAL' || answer?.recovery === 'BETTER') && answer.discomfort === 'NONE'
      && answer.sustainability === 'YES' && answer.unrecoveredMuscles?.length === 0);
  if (tolerated && trends.some(trend => trend.direction === 'HIGHER')) {
    signals.push('PROGRESS_WITH_TOLERANCE');
    return { action: 'KEEP' as const, cycleIndexes, signals };
  }
  return { action: 'INSUFFICIENT' as const, cycleIndexes, signals };
}

export function addMuscleDose(dose: MuscleDose, exercise: Exercise | undefined, sets: Parameters<typeof countWorkingSets>[0]) {
  if (!exercise || !Object.values(MuscleGroup).includes(exercise.primaryMuscle) || exercise.primaryMuscle === MuscleGroup.UNCLASSIFIED) {
    dose.unclassifiedSets += countWorkingSets(sets);
    return;
  }
  const volume = muscleSetVolume([{ ...exercise, sets, secondaryMuscles: (exercise.secondaryMuscles ?? [])
    .filter(muscle => Object.values(MuscleGroup).includes(muscle)) }]);
  for (const [muscle, count] of Object.entries(volume)) {
    dose.byMuscle[muscle] = (dose.byMuscle[muscle] ?? 0) + count;
  }
}

/** A closed civil schedule gives a denominator only if every slot and day is accounted for. */
export function comparableCycleWindow(calendar: Mesocycle['trainingCalendar'], index: number,
  sessionIndexes: readonly number[], workouts: readonly WorkoutSession[], now: number) {
  const entries = Object.values(calendar ?? {});
  const days = entries.filter(entry => entry?.microcycleIndex === index);
  if (!days.length || days.some(entry => typeof entry.date !== 'string' || !validCalendarDate(entry.date)
    || !['workout', 'rest'].includes(entry.kind))) return null;
  days.sort((a, b) => a.date.localeCompare(b.date));
  const from = days[0].date, to = days.at(-1)!.date;
  if (to >= localCheckInDate(now) || days.some((entry, offset) => entry.date !== shiftCalendarDate(from, offset))
    || entries.some(entry => entry && entry.microcycleIndex !== index && entry.date >= from && entry.date <= to)) return null;
  const scheduled = days.flatMap(entry => entry.kind === 'workout' ? [entry.sessionIndex] : []);
  const expected = new Set(sessionIndexes);
  if (expected.size !== sessionIndexes.length || scheduled.length !== expected.size
    || new Set(scheduled).size !== expected.size || scheduled.some(slot => !expected.has(slot))) return null;
  if (workouts.some(workout => localCheckInDate(timestampMillis(workout.performedAt)) < from
    || localCheckInDate(timestampMillis(workout.completedAt!)) > to)) return null;
  return { from, to, days: days.length };
}

export function matchedCycleFeedback(source: Mesocycle, index: number, observed: { from: number; to: number },
  reviews: readonly MicrocycleReview[], now: number) {
  const candidates = reviews.filter(review => validMicrocycleReview(review, source.userId)
    && review.mesocycleId === source.id && review.microcycleIndex === index && review.updatedAt <= now);
  if (candidates.length !== 1) return null;
  const [review] = candidates;
  return review.status === 'SUBMITTED' && review.observedFrom === observed.from && review.observedTo === observed.to
    ? { id: review.id, updatedAt: review.updatedAt, answers: review.answers } : null;
}
