import type { Exercise, PlannedSession } from '@/models';
import { effectiveSetsByMuscle, MIN_HYPERTROPHY_SESSION_SETS, sessionSetCap } from '../training/sessionDistribution';
import { exerciseMinutes, MAX_SETS_PER_EXERCISE_APPEARANCE } from '../training/trainingCapacity';
import { toRoutineView, type RoutineViewLabels } from '../training/routineView';
import { hybridLegSets, strengthPlacements, type CardioPreviewInput } from './cardioPreview';
import { reviewHybridAuthoring, type HybridSettings, type HybridStrengthDraft } from './hybridAuthoring';

/** Offer one reversible set transfer between existing appearances of the same lift. */
export function hybridLegAlternative(draft: HybridStrengthDraft, input: CardioPreviewInput, settings: HybridSettings,
  catalogue: ReadonlyMap<string, Exercise>, labels: RoutineViewLabels, review: ReturnType<typeof reviewHybridAuthoring>) {
  const m = draft.mesocycle, sessions = m.plannedSessions;
  if (!sessions || review.issues.length || draft.routine.generation.goal !== 'HYPERTROPHY'
    || m.prescriptionMode === 'MANUAL' || draft.routine.generation.creationMode === 'MANUAL'
    || m.sessionOverrides || m.prescriptionRevisions) return null;
  const runs = review.preview.scheduled.filter(s => s.modality === 'RUNNING');
  if (!runs.length || sessions.some(s => s.exercises.some(e => !catalogue.has(e.exerciseId)))) return null;
  const days = new Map(input.strength.map(s => [s.id, s.dayIndex!]));
  const day = (session: PlannedSession) => days.get(`${draft.routine.id}:${session.index}`)!;
  const proximity = (d: number) => runs.reduce((sum, run) => {
    const delta = Math.abs(run.dayIndex - d);
    return sum + Math.max(0, 2 - Math.min(delta, input.cycleDays - delta));
  }, 0);
  const legSets = hybridLegSets(review.view);
  const options = sessions.flatMap(from => sessions.filter(to => proximity(day(from)) > proximity(day(to)))
    .map(to => ({ from, to, gain: proximity(day(from)) - proximity(day(to)) }))).sort((a,b) => b.gain - a.gain);
  let examined = 0;
  for (const { from, to } of options) {
    if (!legSets.get(`${draft.routine.id}:${from.index}`) || from.supersets || to.supersets ||
      from.exercises.reduce((n,e) => n + e.sets.filter(s => s.setType !== 'WARMUP').length, 0) <= MIN_HYPERTROPHY_SESSION_SETS) continue;
    for (const donor of from.exercises) {
      const exercise = catalogue.get(donor.exerciseId), recipient = to.exercises.find(e => e.exerciseId === donor.exerciseId);
      if (!exercise || !recipient || donor.sets.length <= recipient.sets.length || !recipient.sets.length ||
        recipient.sets.length >= MAX_SETS_PER_EXERCISE_APPEARANCE || [donor, recipient].some(e =>
          e.isEdited || e.manualRIRBySet || e.strengthRole || e.sets.some(s => s.setType !== 'NORMAL'))) continue;
      if (++examined > 16) return null;
      const set = donor.sets[donor.sets.length - 1];
      const changed = sessions.map(session => {
        if (session !== from && session !== to) return session;
        const exercises = session.exercises.map(e => e === donor ? { ...e, sets: e.sets.slice(0,-1) }
          : e === recipient ? { ...e, sets: [...e.sets,set] } : e);
        return { ...session, exercises, estimatedWorkMinutes: exercises.reduce((n,e) =>
          n + exerciseMinutes(catalogue.get(e.exerciseId)!, e.sets.length, e.restSeconds), 0) };
      });
      const destination = changed.find(s => s.index === to.index)!;
      const entries = destination.exercises.map(e => ({ exercise: catalogue.get(e.exerciseId)!, sets: e.sets.length }));
      if ([...effectiveSetsByMuscle(entries)].some(([muscle,count]) => count > sessionSetCap(muscle, entries))) continue;
      const strength = { ...draft, mesocycle: { ...m, plannedSessions: changed } };
      const view = toRoutineView(strength.routine, strength.mesocycle, catalogue, labels)!;
      const newLegSets = hybridLegSets(view), sourceId = `${draft.routine.id}:${from.index}`;
      if (newLegSets.get(sourceId) !== legSets.get(sourceId)! - 1) continue;
      const cardio = { ...input, strength: strengthPlacements(view, true).sessions.map(s => ({ ...s, dayIndex: days.get(s.id) })) };
      const alternate = reviewHybridAuthoring(strength, cardio, settings, catalogue, labels);
      if (alternate.issues.length || alternate.preview.scheduled.some((s,i) =>
        s.id !== review.preview.scheduled[i].id || s.dayIndex !== review.preview.scheduled[i].dayIndex)) continue;
      return { strength, cardio, review: alternate, exercise, fromDay: day(from)+1, toDay: day(to)+1 };
    }
  }
  return null;
}
