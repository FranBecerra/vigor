/** Evaluated, opt-in calendar compression of an existing immutable prescription. */
import { SplitStructure, type Exercise } from '@/models';
import { type MesocyclePlan, type MesocyclePlanInput, repairDosePlacement, refreshPlacement } from './mesocyclePlanner';
import { evaluateGeneratorQuality } from './generatorQuality';
import { shortSessionDisposition } from './generatorDisposition';
import { TrainingGoal, RegionEmphasis } from './volumePlan';
import { distributeSelection, effectiveSetsByMuscle, isSessionAnchor, sessionSetCap,
  sessionSequencingWarnings, MIN_HYPERTROPHY_SESSION_SETS } from './sessionDistribution';
import { exerciseMinutes, SESSION_OVERHEAD_MINUTES, workMinutesAvailable } from './trainingCapacity';
import { redundantSessionPair } from './exerciseFamilies';
import { SECONDARY_CREDIT } from './exerciseSelection';

type Quality = ReturnType<typeof evaluateGeneratorQuality>;
export type ScheduleRejection = 'insufficient-dose' | 'time-budget' | 'invalid-placement' | 'short-session'
  | 'dose-changed' | 'cycle-duration' | 'concentration' | 'muscle-cap' | 'recovery-template'
  | 'previous-workout' | 'redundancy' | 'anchors' | 'coherence' | 'high-dose-exposure';
export interface ScheduleAlternative {
  input: MesocyclePlanInput;
  plan: MesocyclePlan;
  quality: Quality;
  preservesExactDose: true;
}
export interface ScheduleSuitability {
  status: 'not-applicable' | 'balanced' | 'allocation-bottleneck'
    | 'alternative-available' | 'no-compatible-alternative';
  disposition: ReturnType<typeof shortSessionDisposition>;
  alternative: ScheduleAlternative | null;
  attempts: { sessions: number; reasons: ScheduleRejection[] }[];
}

type DoseEntry = { exercise: Exercise; sets: number };
const doseKey = (entries: readonly DoseEntry[]) => JSON.stringify(entries.map((entry) =>
  [entry.exercise.id, entry.sets]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
const muscleDoseKey = (entries: readonly DoseEntry[]) => {
  const muscles = new Map<string, { direct: number; indirect: number }>();
  const get = (muscle: string) => {
    if (!muscles.has(muscle)) muscles.set(muscle, { direct: 0, indirect: 0 });
    return muscles.get(muscle)!;
  };
  for (const { exercise, sets } of entries) {
    get(exercise.primaryMuscle).direct += sets;
    for (const muscle of new Set(exercise.secondaryMuscles)) if (muscle !== exercise.primaryMuscle) get(muscle).indirect += sets * SECONDARY_CREDIT;
  }
  return JSON.stringify([...muscles].sort(([a], [b]) => a.localeCompare(b)));
};
const entries = (plan: MesocyclePlan) => plan.distribution.sessions.flatMap((session) => session.exercises);
const softConcentration = (plan: MesocyclePlan) => plan.distribution.sessions.reduce((sum, session) =>
  sum + [...effectiveSetsByMuscle(session.exercises).values()].reduce((excess, sets) => excess + Math.max(0, sets - 10), 0), 0);
const muscleCapExcess = (plan: MesocyclePlan) => {
  const excess = new Map<string, number>();
  for (const session of plan.distribution.sessions) for (const [muscle, sets] of effectiveSetsByMuscle(session.exercises)) {
    excess.set(muscle, (excess.get(muscle) ?? 0) + Math.max(0, sets - sessionSetCap(muscle, session.exercises)));
  }
  return excess;
};
const redundancy = (plan: MesocyclePlan) => plan.distribution.sessions.reduce((sum, session) => sum
  + session.exercises.reduce((count, entry, index) => count + session.exercises.slice(index + 1)
    .filter((other) => redundantSessionPair(entry.exercise, other.exercise)).length, 0), 0);
const missingAnchors = (plan: MesocyclePlan) => plan.distribution.sessions.filter((session) =>
  !session.exercises.some(isSessionAnchor)).length;
const coherence = (quality: Quality) => quality.issues.filter((issue) =>
  issue.code.startsWith('focus-without-') || ['unsupported-row-concentration', 'torso-hinge-concentration'].includes(issue.code)).length;

/** Full-plan checks across different session counts; ordinal adjacency counts are not comparable calendars. */
export function evaluateScheduleAlternative(input: MesocyclePlanInput, original: MesocyclePlan,
  candidate: MesocyclePlan, quality: Quality, originalQuality = evaluateGeneratorQuality(input, original)): ScheduleRejection[] {
  const reasons: ScheduleRejection[] = [];
  const reject = (reason: ScheduleRejection, condition: boolean) => { if (condition) reasons.push(reason); };
  reject('invalid-placement', !quality.valid || !!candidate.distribution.unassigned.length
    || candidate.distribution.sessions.some((session) => session.estimatedWorkMinutes
      > Math.max(0, input.capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES) + 1e-8));
  reject('short-session', shortSessionDisposition(quality.sessions.map((session) => session.sets)).shortSessionIndexes.length > 0);
  reject('dose-changed', candidate.selection.performedSets !== original.selection.performedSets
    || doseKey(entries(candidate)) !== doseKey(entries(original))
    || muscleDoseKey(entries(candidate)) !== muscleDoseKey(entries(original))
    || doseKey(candidate.selection.selected) !== doseKey(original.selection.selected));
  reject('cycle-duration', quality.scheduleTemplate.days !== originalQuality.scheduleTemplate.days);
  reject('concentration', softConcentration(candidate) > softConcentration(original) + 1e-8);
  const originalCaps = muscleCapExcess(original);
  reject('muscle-cap', [...muscleCapExcess(candidate)].some(([muscle, value]) => value > (originalCaps.get(muscle) ?? 0) + 1e-8));
  const beforeRecovery = originalQuality.templateRecovery.filter((pair) => pair.reviewSuggested);
  const afterRecovery = quality.templateRecovery.filter((pair) => pair.reviewSuggested);
  reject('recovery-template', afterRecovery.length > beforeRecovery.length
    || afterRecovery.reduce((sum, pair) => sum + pair.cost, 0) > beforeRecovery.reduce((sum, pair) => sum + pair.cost, 0) + 1e-8);
  const previousRisk = (plan: MesocyclePlan) => sessionSequencingWarnings(plan.distribution.sessions.slice(0, 1), input.previousSession)
    .reduce((sum, warning) => sum + warning.risk, 0);
  reject('previous-workout', !!input.previousSession?.length && previousRisk(candidate) > previousRisk(original) + 1e-8);
  reject('redundancy', redundancy(candidate) > redundancy(original));
  reject('anchors', missingAnchors(candidate) > missingAnchors(original));
  reject('coherence', coherence(quality) > coherence(originalQuality));
  // Ten fractional sets is a distribution preference, not a biological frequency law.
  reject('high-dose-exposure', Object.entries(originalQuality.muscles).some(([muscle, before]) => before.attributed > 10
    && (quality.muscles[muscle]?.directSessions ?? 0) < Math.min(2, before.directSessions)));
  return reasons;
}

/** Atomic exchanges can repair a label/floor without accepting an invalid intermediate plan. */
function repairAlternativeStructure(input: MesocyclePlanInput, original: MesocyclePlan,
  proposal: MesocyclePlan, originalQuality: Quality): MesocyclePlan {
  const reasons = evaluateScheduleAlternative(input, original, proposal, evaluateGeneratorQuality(input, proposal), originalQuality);
  if (!reasons.length || reasons.some((reason) => !['short-session', 'coherence', 'anchors'].includes(reason))) return proposal;
  const rows = proposal.distribution.sessions;
  let evaluated = 0;
  const tryExchange = (positions: [number, number][], direction = 1): MesocyclePlan | null => {
    if (++evaluated > 600) return null;
    const moved = positions.map(([row, entry]) => rows[row].exercises[entry]);
    const sessions = rows.map((row, index) => {
      const position = positions.findIndex(([source]) => source === index);
      const exercises = row.exercises.map((entry, order) => ({ ...(position >= 0 && order === positions[position][1]
        ? moved[(position + direction) % positions.length] : entry) }));
      return { ...row, exercises, estimatedWorkMinutes: exercises.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0) };
    });
    const candidate = refreshPlacement(proposal, sessions, input.previousSession);
    return evaluateScheduleAlternative(input, original, candidate, evaluateGeneratorQuality(input, candidate), originalQuality).length
      ? null : candidate;
  };
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
    for (let i = 0; i < rows[a].exercises.length; i++) for (let j = 0; j < rows[b].exercises.length; j++) {
      if (evaluated >= 600) return proposal;
      const candidate = tryExchange([[a, i], [b, j]]);
      if (candidate) return candidate;
    }
  }
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) for (let c = b + 1; c < rows.length; c++) {
    for (let i = 0; i < rows[a].exercises.length; i++) for (let j = 0; j < rows[b].exercises.length; j++)
      for (let k = 0; k < rows[c].exercises.length; k++) for (const direction of [1, 2]) {
        if (evaluated >= 600) return proposal;
        const candidate = tryExchange([[a, i], [b, j], [c, k]], direction);
        if (candidate) return candidate;
      }
  }
  return proposal;
}

/** Explicit day preferences remain untouched; return a verified alternative or an honest compromise. */
export function reviewScheduleSuitability(input: MesocyclePlanInput, original: MesocyclePlan): ScheduleSuitability {
  const disposition = shortSessionDisposition(original.distribution.sessions.map((session) =>
    session.exercises.reduce((sum, entry) => sum + entry.sets, 0)));
  const result: ScheduleSuitability = { status: 'not-applicable', disposition, alternative: null, attempts: [] };
  if (input.goal !== TrainingGoal.HYPERTROPHY || !original.selection.performedSets
    || !Number.isInteger(input.capacity.sessionsPerMicrocycle) || input.capacity.sessionsPerMicrocycle < 2
    || !Number.isFinite(input.capacity.minutesPerSession) || input.capacity.minutesPerSession <= 0) return result;
  if (disposition.category === 'no-short-session') return { ...result, status: 'balanced' };
  if (disposition.category === 'allocation-bottleneck-needs-local-repair') return { ...result, status: 'allocation-bottleneck' };
  const originalQuality = evaluateGeneratorQuality(input, original);
  if (!originalQuality.valid || doseKey(entries(original)) !== doseKey(original.selection.selected)) return result;
  result.status = 'no-compatible-alternative';
  const requiredWorkMinutes = original.selection.selected.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0);
  // At most five candidates in the supported UI range, nearest compatible count first.
  for (let sessions = Math.min(6, input.capacity.sessionsPerMicrocycle - 1); sessions >= 2; sessions--) {
    if (sessions > disposition.doseOnlyMaximumSessions) {
      result.attempts.push({ sessions, reasons: ['insufficient-dose'] });
      continue;
    }
    const candidateInput = { ...input, capacity: { ...input.capacity, sessionsPerMicrocycle: sessions } };
    if (requiredWorkMinutes > workMinutesAvailable(candidateInput.capacity) + 1e-8) {
      result.attempts.push({ sessions, reasons: ['time-budget'] });
      continue;
    }
    const distribution = distributeSelection({ selection: original.selection, split: input.split ?? SplitStructure.AUTO,
      sessionsPerMicrocycle: sessions, previousSession: input.previousSession, capacityPacking: true,
      minimumSessionSets: MIN_HYPERTROPHY_SESSION_SETS,
      maxWorkMinutesPerSession: Math.max(0, input.capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES),
      deprioritizedMuscles: original.plan.muscles.filter((muscle) => muscle.emphasis === RegionEmphasis.DEPRIORITIZED).map((muscle) => muscle.muscle) });
    const proposal: MesocyclePlan = { ...original, distribution,
      availableWorkMinutes: workMinutesAvailable(candidateInput.capacity),
      availableWorkMinutesPerSession: Math.max(0, input.capacity.minutesPerSession - SESSION_OVERHEAD_MINUTES),
      estimatedWorkMinutes: distribution.totalWorkMinutes, maxSessionWorkMinutes: distribution.maxSessionWorkMinutes };
    const plan = repairAlternativeStructure(candidateInput, original, repairDosePlacement(candidateInput, proposal), originalQuality);
    const quality = evaluateGeneratorQuality(candidateInput, plan);
    const reasons = evaluateScheduleAlternative(input, original, plan, quality, originalQuality);
    result.attempts.push({ sessions, reasons });
    if (reasons.length) continue;
    return { ...result, status: 'alternative-available', alternative: { input: candidateInput, plan, quality, preservesExactDose: true } };
  }
  return result;
}

/** Compatibility wrapper for audit and existing consumers. */
export function findAlternativeSchedule(input: MesocyclePlanInput, original: MesocyclePlan) {
  return reviewScheduleSuitability(input, original).alternative;
}
