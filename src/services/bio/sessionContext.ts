import { MuscleGroup, SetType, type Exercise, type Mesocycle, type Routine, type WorkoutSession } from '@/models';
import type { BioReadinessIndex } from '@/models/bioReadiness';
import type { BioSessionContext } from '@/models/bioSessionContext';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { defaultSessionId, toRoutineView, type RoutineViewLabels } from '@/services/training/routineView';
import { sessionsForMicrocycle } from '@/services/training/mesocycleEditing';
import { orderedRoutineSessions, restDayKey, routineDays } from '@/services/training/routineRestDays';
import { primaryMusclesOf } from '@/services/training/exerciseMuscles';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { timestampMillis } from '@/services/training/workoutRuntime';
import { ownedBioWorkouts } from './observations';
import { buildBioCycles, validMicrocycleReview } from './microcycleReview';
import { reviewVolumeResponse } from './volumeResponse';

export const SESSION_EXPOSURE_HOURS = 72;
export interface BioSessionInputs {
  owner: string; plans: readonly Mesocycle[]; routines: readonly Routine[]; history: readonly WorkoutSession[];
  reviews: readonly MicrocycleReview[]; reviewsAvailable: boolean; catalogue: ReadonlyMap<string, Exercise>;
  labels: RoutineViewLabels; readiness?: BioReadinessIndex; selectedSessionIndex?: number; now: number;
}
function generalContext(index: BioReadinessIndex | undefined, now: number): BioSessionContext['general'] {
  const empty: BioSessionContext['general'] = { coverage: 'UNAVAILABLE', signals: [] };
  if (index?.policy !== 'RECOVERY_CONTEXT_V1' || !Number.isFinite(index.calculatedAt) || index.calculatedAt > now
    || now - index.calculatedAt > 5 * 60000 || index.reasons.includes('STALE') || index.reasons.includes('NO_OBSERVATIONS')) return empty;
  const usable = (score?: number) => score !== undefined && Number.isFinite(score) && score >= 0 && score <= 100;
  const sleep = usable(index.sleep.score), cardiac = usable(index.cardiac.score);
  const unusual = index.reasons.includes('UNUSUAL_SIGNAL');
  return { coverage: sleep && cardiac && usable(index.score) ? 'COMPLETE' : sleep || cardiac || unusual ? 'PARTIAL' : 'UNAVAILABLE',
    date: index.date, signals: [
      // One five-point component step is a presentation trigger, not a physiological threshold.
      ...(sleep && index.sleep.score! <= 95 ? ['SLEEP_SHORTFALL' as const] : []),
      ...(cardiac && index.cardiac.score! <= 95 ? ['CARDIAC_DEPARTURE' as const] : []),
      ...(unusual ? ['UNUSUAL_SIGNAL' as const] : []),
    ] };
}
/** Facts and review prompts, not a prediction that the intended session is safe or optimal. */
export function buildBioSessionContext(input: BioSessionInputs): BioSessionContext {
  const { owner, plans, routines, history, reviews, reviewsAvailable, catalogue, labels, now } = input;
  const result: BioSessionContext = { policy: 'SESSION_CONTEXT_V1', status: 'NO_ACTIVE_ROUTINE', choices: [],
    general: { coverage: 'UNAVAILABLE', signals: [] }, exposure: [], unknownPlannedExercises: 0, unknownRecentExercises: 0,
    reviewStatus: reviewsAvailable ? 'MISSING' : 'UNAVAILABLE', dose: [], prompts: [] };
  if (!owner || !Number.isFinite(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) return result;
  const active = routines.filter((routine) => routine.userId === owner && routine.isActive === true);
  if (!active.length) return result;
  if (active.length > 1) return { ...result, status: 'AMBIGUOUS' };
  const routine = active[0], matches = plans.filter((plan) => plan.userId === owner && plan.id === routine.activeMesocycleId
    && (plan.status === 'ACTIVE' || plan.status === 'DELOAD'));
  if (matches.length !== 1) return { ...result, status: 'UNAVAILABLE' };
  const rawPlan = matches[0];
  // Bound malformed persisted projection metadata before the existing view builder allocates it.
  if (!Number.isInteger(rawPlan.currentMicrocycleIndex) || rawPlan.currentMicrocycleIndex < 0 || rawPlan.currentMicrocycleIndex >= 52
    || rawPlan.projectedMicrocycles !== undefined && (!Number.isInteger(rawPlan.projectedMicrocycles) || rawPlan.projectedMicrocycles < 1 || rawPlan.projectedMicrocycles > 52)) {
    return { ...result, status: 'UNAVAILABLE' };
  }
  const plan = { ...rawPlan, skippedSessions: Object.fromEntries(Object.entries(rawPlan.skippedSessions ?? {})
    .filter(([, time]) => Number.isFinite(time) && time >= 0 && time <= now)) };
  const work = ownedBioWorkouts(owner, history, now);
  try {
    // Share home selection/naming, prescription revisions, explicit order, skips and projections.
    const view = toRoutineView(routine, plan, catalogue, labels, work);
    if (!view) return { ...result, status: 'UNAVAILABLE' };
    const current = view.microcycles[view.currentMicrocycleIndex];
    const pending = current.sessions.filter((session) => session.completedOn === undefined && session.skippedOn === undefined);
    result.choices = pending.map((session) => ({ index: session.plannedSessionIndex, name: session.name }));
    const selected = pending.find((session) => session.plannedSessionIndex === input.selectedSessionIndex)
      ?? pending.find((session) => session.id === defaultSessionId([view]));
    if (!selected) return { ...result, status: 'COMPLETE' };
    const sessions = orderedRoutineSessions(sessionsForMicrocycle(plan, routine.generation.goal, view.currentMicrocycleIndex), plan.sessionOrder);
    const session = sessions.find((candidate) => candidate.index === selected.plannedSessionIndex)!;
    const days = routineDays(sessions, plan.restDays ?? []);
    const firstPending = days.find((day) => day.kind === 'rest'
      ? plan.restDayChecks?.[restDayKey(view.currentMicrocycleIndex, day.id)] !== true
      : pending.some((candidate) => candidate.plannedSessionIndex === day.sessionIndex));
    result.target = { routineName: routine.name, mesocycleId: plan.id, microcycleIndex: view.currentMicrocycleIndex,
      goal: routine.generation.goal, name: selected.name, session, restBefore: firstPending?.kind === 'rest' };
  } catch { return { ...result, target: undefined, choices: [], status: 'UNAVAILABLE' }; }
  result.status = 'AVAILABLE';
  result.general = generalContext(input.readiness, now);
  if (result.general.signals.length) result.prompts.push('GENERAL_CHANGE');
  const muscles = new Map<MuscleGroup, number>();
  for (const entry of result.target!.session.exercises) {
    const count = entry.sets.filter((set) => set.setType !== SetType.WARMUP).length;
    if (!count) continue;
    const exercise = entry.exerciseSnapshot ?? catalogue.get(entry.exerciseId);
    const direct = exercise ? primaryMusclesOf(exercise).filter((muscle) => Object.values(MuscleGroup).includes(muscle)) : [];
    if (!direct.length) result.unknownPlannedExercises++;
    if (!exercise) continue;
    for (const muscle of new Set([...direct, ...exercise.secondaryMuscles])) {
      if (muscle === MuscleGroup.UNCLASSIFIED || !Object.values(MuscleGroup).includes(muscle)) continue;
      muscles.set(muscle, (muscles.get(muscle) ?? 0) + count * (direct.includes(muscle) ? 1 : 0.5));
    }
  }
  const exposure = new Map<MuscleGroup, { sets: number; lastAt: number }>();
  for (const workout of work.filter((entry) => timestampMillis(entry.completedAt!) >= now - SESSION_EXPOSURE_HOURS * 3600000)) {
    const details = workoutHistoryDetails(workout, catalogue), at = timestampMillis(workout.completedAt!);
    result.unknownRecentExercises += details.exercises.filter((entry) => entry.completed > 0 && (() => {
      const original = workout.exercises.find((item) => item.id === entry.id)!;
      const exercise = original.exerciseSnapshot ?? catalogue.get(original.exerciseId);
      return !exercise || primaryMusclesOf(exercise).length === 0;
    })()).length;
    for (const entry of details.volumes) {
      const previous = exposure.get(entry.muscle);
      exposure.set(entry.muscle, { sets: (previous?.sets ?? 0) + entry.sets, lastAt: at });
    }
  }
  result.exposure = [...muscles].sort(([a], [b]) => a.localeCompare(b)).map(([muscle, plannedSets]) => ({ muscle, plannedSets,
    recentSets: exposure.get(muscle)?.sets ?? 0, ...(exposure.has(muscle) ? { lastAt: exposure.get(muscle)!.lastAt } : {}) }));
  if (!reviewsAvailable) return result;
  const target = result.target!;
  const reviewPlan = { ...plan, currentMicrocycleIndex: target.microcycleIndex,
    skippedSessions: Object.fromEntries(Object.entries(plan.skippedSessions).filter(([key]) => Number(key.split(':')[0]) <= target.microcycleIndex)) };
  const reviewWork = work.filter((workout) => workout.mesocycleId !== plan.id || workout.microcycleIndex <= target.microcycleIndex);
  const latest = buildBioCycles(owner, [reviewPlan], reviewWork, now).filter((cycle) => cycle.closed && cycle.index <= target.microcycleIndex)
    .sort((a, b) => b.index - a.index)[0];
  const ownedReviews = reviews.filter((review) => validMicrocycleReview(review, owner) && review.updatedAt <= now);
  const reviewCounts = new Map<string, number>();
  ownedReviews.forEach((review) => reviewCounts.set(review.id, (reviewCounts.get(review.id) ?? 0) + 1));
  const unambiguous = ownedReviews.filter((review) => reviewCounts.get(review.id) === 1);
  const matching = unambiguous.filter((review) => latest && review.id === latest.id
    && review.observedFrom === latest.observedFrom && review.observedTo === latest.observedTo);
  // Ambiguous conflicting copies do not select a convenient answer or resurrect an older review.
  if (matching.length === 1 && matching[0].status === 'SUBMITTED') {
    const review = matching[0], answers = review.answers;
    result.review = { microcycleIndex: review.microcycleIndex, updatedAt: review.updatedAt, observedTo: review.observedTo, answers };
    result.reviewStatus = 'AVAILABLE';
    if (answers.discomfort === 'PRESENT' && (!answers.discomfortMuscles?.length || answers.discomfortMuscles.some((muscle) => muscles.has(muscle)))) result.prompts.push('DATED_DISCOMFORT');
    if (answers.unrecoveredMuscles?.some((muscle) => muscles.has(muscle))) result.prompts.push('DATED_LOCAL_RECOVERY');
  }
  // Suppress ambiguous questionnaire data in the existing dose-review service as well.
  result.dose = reviewVolumeResponse(owner, reviewPlan, reviewWork, unambiguous, catalogue, now).filter((entry) => muscles.has(entry.muscle));
  if (result.dose.some((entry) => entry.action === 'REVIEW')) result.prompts.push('DOSE_REVIEW');
  return result;
}
