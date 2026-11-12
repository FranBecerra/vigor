import { ExerciseProfile, type SplitStructure, type Exercise, type PlannedExercise, type PlannedSession } from '@/models';
import { LOWER_BODY_MUSCLES } from '../training/muscleGroups';
import { templateRecovery } from '../training/scheduleTemplate';
import { redundantSessionPair } from '../training/exerciseFamilies';
import { effectiveSetsByMuscle, focusAcceptsMuscle, MIN_HYPERTROPHY_SESSION_SETS, sessionSetCap } from '../training/sessionDistribution';
import { exerciseMinutes } from '../training/trainingCapacity';
import { toRoutineView, type RoutineViewLabels } from '../training/routineView';
import { hybridLegSets, strengthPlacements, type CardioPreviewInput } from './cardioPreview';
import { reviewHybridAuthoring, type HybridSettings, type HybridStrengthDraft } from './hybridAuthoring';
import { hybridRhythmQuality, hybridRhythmRankIsBetter } from './hybridRhythm';

type Review = ReturnType<typeof reviewHybridAuthoring>;
type Move = { exercise: Exercise; fromDay: number; toDay: number };
type Candidate = { strength: HybridStrengthDraft; cardio: CardioPreviewInput; review: Review; moves: Move[]; split?: SplitStructure };
const directLeg = (e: Exercise) => [e.primaryMuscle, ...(e.primaryMuscles ?? [])].some(m => LOWER_BODY_MUSCLES.has(m) || m === 'ERECTORS');
const workSets = (e: PlannedExercise) => e.sets.filter(s => s.setType !== 'WARMUP').length;

function runExposure(day: number, candidate: Candidate) {
  return candidate.review.preview.scheduled.reduce((n, run) => {
    if (run.modality !== 'RUNNING') return n;
    const delta = Math.abs(day - run.dayIndex);
    return n + Math.max(0, 2 - Math.min(delta, candidate.cardio.cycleDays - delta));
  }, 0);
}

function rank(candidate: Candidate) {
  const legSets = hybridLegSets(candidate.review.view);
  const quality = hybridRhythmQuality(candidate.cardio, candidate.review.preview);
  const nearbySets = candidate.cardio.strength.reduce((n,s) => n + (legSets.get(s.id) ?? 0) * runExposure(s.dayIndex!, candidate), 0);
  const shared = candidate.review.preview.scheduled.filter(s => candidate.cardio.strength.some(x => x.dayIndex === s.dayIndex)).length;
  return [candidate.review.issues.length, quality.proximity, nearbySets, shared, quality.longestRun, candidate.moves.length];
}

/** Compare complete prescriptions on the selected calendar, retaining main lifts and every prescribed set. */
export function suggestHybridStructure(draft: HybridStrengthDraft, input: CardioPreviewInput, settings: HybridSettings,
  catalogue: ReadonlyMap<string, Exercise>, labels: RoutineViewLabels, review: Review): Candidate | null {
  const m = draft.mesocycle, sessions = m.plannedSessions;
  if (!sessions || !input.modalities.includes('RUNNING')
    || draft.routine.generation.creationMode === 'MANUAL' || m.prescriptionMode === 'MANUAL' || m.sessionOverrides || m.prescriptionRevisions
    || sessions.some(s => s.exercises.some(e => !catalogue.has(e.exerciseId)))) return null;
  const days = new Map(input.strength.map(s => [s.id, s.dayIndex!]));
  const day = (s: PlannedSession) => days.get(draft.routine.id + ':' + s.index)!;
  if (sessions.some(s => !Number.isInteger(day(s)) || day(s) < 0 || day(s) >= input.cycleDays)
    || new Set(sessions.map(day)).size !== sessions.length) return null;
  const original: Candidate = { strength: draft, cardio: input, review, moves: [] };
  const calendar = { days: input.cycleDays, slots: Array.from({ length:input.cycleDays }, (_,d) => {
    const session = sessions.find(s => day(s) === d);
    return session ? {kind:'workout' as const,sessionIndex:session.index} : {kind:'rest' as const};
  }) };
  const recoveryPairs = (rows: PlannedSession[]) => templateRecovery(calendar,rows,catalogue).filter(pair => pair.reviewSuggested);
  const baselinePairs = recoveryPairs(sessions);
  const baselineCost = baselinePairs.reduce((n,pair) => n + pair.cost,0);
  const preservesRecovery = (rows: PlannedSession[]) => {
    const pairs = recoveryPairs(rows);
    return pairs.length <= baselinePairs.length && pairs.reduce((n,pair) => n + pair.cost,0) <= baselineCost;
  };
  let current = original, remaining = 24;
  for (const template of draft.routine.generation.split === 'AUTO' ? draft.templates ?? [] : []) {
    if (!preservesRecovery(template.sessions)) continue;
    const strength = { ...draft, routine: { ...draft.routine, name: template.routineName ?? draft.routine.name },
      mesocycle: { ...m, plannedSessions: template.sessions } };
    const view = toRoutineView(strength.routine,strength.mesocycle,catalogue,labels);
    if (!view) continue;
    const cardio = { ...input, strength: strengthPlacements(view,true).sessions.map(s => ({ ...s, dayIndex: days.get(s.id) })) };
    const joint = reviewHybridAuthoring(strength,cardio,settings,catalogue,labels);
    if (joint.issues.length) continue;
    const candidate = { strength, cardio, review: joint, moves: [], split: template.split };
    if (hybridRhythmRankIsBetter(rank(candidate),rank(current))) current = candidate;
  }
  for (let pass = 0; pass < 3 && remaining > 0; pass++) {
    let best = current, bestRank = rank(current);
    const rows = current.strength.mesocycle.plannedSessions!;
    for (const from of rows) for (const to of rows) {
      if (from.supersets || to.supersets || runExposure(day(from),current) <= runExposure(day(to),current)) continue;
      for (const entry of from.exercises) {
        const exercise = catalogue.get(entry.exerciseId)!;
        if (!directLeg(exercise) || exercise.profile !== ExerciseProfile.ISOLATION || entry.isEdited || entry.manualRIRBySet
          || entry.strengthRole && entry.strengthRole !== 'ACCESSORY' || !entry.sets.length || entry.sets.some(s => s.setType !== 'NORMAL')
          || !focusAcceptsMuscle(to.focus, exercise.primaryMuscle) || to.exercises.some(other => redundantSessionPair(exercise,catalogue.get(other.exerciseId)!))) continue;
        const rest = from.exercises.filter(e => e !== entry);
        const floor = draft.routine.generation.goal === 'HYPERTROPHY' ? MIN_HYPERTROPHY_SESSION_SETS : 1;
        if (rest.reduce((n,e) => n + workSets(e),0) < floor || (from.focus === 'LOWER' || from.focus === 'LEGS') &&
          !rest.some(e => directLeg(catalogue.get(e.exerciseId)!))) continue;
        // Preserve two exposures for high-volume muscles when consolidation would remove one.
        const important = [exercise.primaryMuscle,...(exercise.primaryMuscles ?? [])];
        const hits = (e: PlannedExercise, muscle: typeof exercise.primaryMuscle) => {
          const x = catalogue.get(e.exerciseId)!;
          return x.primaryMuscle === muscle || x.primaryMuscles?.includes(muscle);
        };
        if (important.some(muscle => !rest.some(e => hits(e,muscle)) && to.exercises.some(e => hits(e,muscle))
          && rows.filter(s => s.exercises.some(e => hits(e,muscle))).length <= 2
          && rows.flatMap(s => s.exercises).reduce((n,e) => n + (hits(e,muscle) ? workSets(e) : 0),0) > 10)) continue;
        const expanded = [...to.exercises,entry];
        const recipients = expanded.map(e => ({ exercise: catalogue.get(e.exerciseId)!, sets: workSets(e) }));
        if ([...effectiveSetsByMuscle(recipients)].some(([muscle,n]) => n > sessionSetCap(muscle,recipients))) continue;
        if (remaining <= 0) break;
        remaining--;
        const changed = rows.map(s => {
          if (s !== from && s !== to) return s;
          const exercises = (s === from ? rest : expanded).map((e,order) => ({ ...e, order }));
          return { ...s, exercises, estimatedWorkMinutes: exercises.reduce((n,e) =>
            n + exerciseMinutes(catalogue.get(e.exerciseId)!,e.sets.length,e.restSeconds),0) };
        });
        if (!preservesRecovery(changed)) continue;
        const strength = { ...current.strength, mesocycle: { ...m, plannedSessions: changed } };
        const view = toRoutineView(strength.routine,strength.mesocycle,catalogue,labels)!;
        const cardio = { ...input, strength: strengthPlacements(view,true).sessions.map(s => ({ ...s, dayIndex: days.get(s.id) })) };
        const nextReview = reviewHybridAuthoring(strength,cardio,settings,catalogue,labels);
        if (nextReview.issues.length || nextReview.preview.scheduled.length !== current.review.preview.scheduled.length
          || nextReview.preview.scheduled.some((s,i) => s.id !== current.review.preview.scheduled[i]?.id ||
          s.dayIndex !== current.review.preview.scheduled[i]?.dayIndex)) continue;
        const next = { strength, cardio, review: nextReview, split: current.split, moves: [...current.moves,{exercise,fromDay:day(from)+1,toDay:day(to)+1}] };
        const score = rank(next);
        if (hybridRhythmRankIsBetter(score,bestRank)) { best = next; bestRank = score; }
      }
    }
    if (best === current) break;
    current = best;
  }
  return current === original ? null : current;
}
