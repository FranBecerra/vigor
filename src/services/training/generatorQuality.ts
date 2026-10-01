/** Independent, quantitative quality checks. Thresholds are product heuristics. */
import { ExerciseGenerationTier, ExerciseProfile, type Exercise } from '@/models';
import type { MesocyclePlan, MesocyclePlanInput } from './mesocyclePlanner';
import { SECONDARY_CREDIT, FOUNDATIONAL_PATTERNS } from './exerciseSelection';
import { MIN_HYPERTROPHY_SESSION_SETS } from './sessionDistribution';
import { SESSION_OVERHEAD_MINUTES } from './trainingCapacity';
import { TrainingGoal } from './volumePlan';
import { toPlannedSessions } from './routineMapper';
import { buildScheduleTemplate, templateRecovery } from './scheduleTemplate';
import { hipFamily, isDemandingTorsoHinge } from './exerciseFamilies';
import { reviewSessionCoherence, sessionPresentationFocus } from './sessionCoherence';
import { assessQualityAxes } from './generatorQualityContract';
import { reviewedExerciseMetadata } from './exerciseMetadataReview';

export interface QualityIssue {
  code: string;
  severity: 'error' | 'warning';
  actual: number;
  limit: number;
  sessionIndex?: number;
  subject?: string;
  detail?: string;
}

export function auditCatalogue(catalogue: readonly Exercise[]) {
  const ids = new Set<string>();
  const issues: { id: string; code: string }[] = [];
  const eligible = catalogue.filter((e) => e.generationTier !== ExerciseGenerationTier.MANUAL_ONLY
    && e.generationTier !== ExerciseGenerationTier.STRENGTH_VARIANT);
  for (const exercise of catalogue) {
    if (ids.has(exercise.id)) issues.push({ id: exercise.id, code: 'duplicate-id' });
    ids.add(exercise.id);
    if (new Set(exercise.secondaryMuscles).size !== exercise.secondaryMuscles.length
      || exercise.secondaryMuscles.includes(exercise.primaryMuscle)) {
      issues.push({ id: exercise.id, code: 'duplicate-muscle-credit' });
    }
    if (exercise.stimulusTags?.some((tag) => !/^[A-Z_]+:[A-Z_]+$/.test(tag))) {
      issues.push({ id: exercise.id, code: 'invalid-stimulus-tag' });
    }
  }
  return { total: catalogue.length, eligible: eligible.length, issues,
    missingCriteria: eligible.filter((e) => !e.criteria).map((e) => e.id),
    unknownStimulus: eligible.filter((e) => !e.stimulusTags?.length).map((e) => e.id),
    // Scores are expert assessments, never trial-derived effect sizes.
    scoreProvenance: 'expert-heuristic' as const };
}

export function evaluateGeneratorQuality(input: MesocyclePlanInput, plan: MesocyclePlan) {
  const issues: QualityIssue[] = [];
  if (plan.distribution.sessions.length !== input.capacity.sessionsPerMicrocycle) issues.push({
    code: 'session-count', severity: 'error', actual: plan.distribution.sessions.length, limit: input.capacity.sessionsPerMicrocycle });
  const indexes = plan.distribution.sessions.map((s) => s.index);
  if (new Set(indexes).size !== indexes.length || indexes.some((i) => !Number.isInteger(i) || i < 0)) {
    issues.push({ code: 'invalid-session-index', severity: 'error', actual: indexes.length, limit: new Set(indexes).size });
  }
  const eligibleIds = new Set(input.catalogue.map((e) => e.id));
  const occurrences = new Map<string, number>();
  const muscles: Record<string, { direct: number; indirect: number; attributed: number;
    target: number; directSessions: number }> = {};
  for (const target of plan.plan.muscles) {
    muscles[target.muscle] = { direct: 0, indirect: 0, attributed: 0, target: target.meav, directSessions: 0 };
  }
  const muscleEntry = (key: string) => muscles[key] ??= {
    direct: 0, indirect: 0, attributed: 0, target: 0, directSessions: 0,
  };
  const sessions = plan.distribution.sessions.map((session) => {
    const coherence = reviewSessionCoherence(session, input.level,
      new Set(plan.plan.muscles.filter((m) => m.meav > 0).map((m) => m.muscle)));
    issues.push(...coherence.map((finding) => ({ ...finding, severity: 'warning' as const, sessionIndex: session.index })));
    const sessionMuscles: Record<string, { direct: number; indirect: number }> = {};
    const localMuscle = (muscle: string) => sessionMuscles[muscle] ??= { direct: 0, indirect: 0 };
    const sets = session.exercises.reduce((sum, e) => sum + e.sets, 0);
    const minutes = session.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES;
    if (!Number.isFinite(session.estimatedWorkMinutes) || session.estimatedWorkMinutes < 0) issues.push({
      code: 'invalid-duration', severity: 'error', actual: session.estimatedWorkMinutes, limit: 0, sessionIndex: session.index });
    const hinges = session.exercises.filter((e) => isDemandingTorsoHinge(e.exercise)).length;
    if (hinges > 1) issues.push({ code: 'torso-hinge-concentration', severity: 'warning', actual: hinges, limit: 1, sessionIndex: session.index });
    const directMuscles = new Set<string>();
    if (!sets) issues.push({ code: 'empty-session', severity: 'error', actual: 0, limit: 1, sessionIndex: session.index });
    else if (input.goal === TrainingGoal.HYPERTROPHY && sets < MIN_HYPERTROPHY_SESSION_SETS) {
      issues.push({ code: 'underfilled-session', severity: 'warning', actual: sets,
        limit: MIN_HYPERTROPHY_SESSION_SETS, sessionIndex: session.index });
    }
    if (minutes > input.capacity.minutesPerSession + 0.01) issues.push({ code: 'time-overflow',
      severity: 'error', actual: minutes, limit: input.capacity.minutesPerSession, sessionIndex: session.index });
    for (const { exercise, sets: count } of session.exercises) {
      if (!Number.isInteger(count) || count < 1) issues.push({ code: 'invalid-dose', severity: 'error', actual: count, limit: 1,
        sessionIndex: session.index, subject: exercise.id });
      occurrences.set(exercise.id, (occurrences.get(exercise.id) ?? 0) + 1);
      if (!eligibleIds.has(exercise.id)) issues.push({ code: 'excluded-exercise', severity: 'error',
        actual: 1, limit: 0, subject: exercise.id });
      if (input.goal === TrainingGoal.HYPERTROPHY && (count > 4 || count < 1)) issues.push({
        code: 'appearance-set-cap', severity: 'error', actual: count, limit: 4, subject: exercise.id });
      const primary = muscleEntry(exercise.primaryMuscle);
      primary.direct += count;
      primary.attributed += count;
      localMuscle(exercise.primaryMuscle).direct += count;
      directMuscles.add(exercise.primaryMuscle);
      for (const muscle of new Set(exercise.secondaryMuscles)) {
        if (muscle === exercise.primaryMuscle) continue;
        const secondary = muscleEntry(muscle);
        secondary.indirect += count * SECONDARY_CREDIT;
        secondary.attributed += count * SECONDARY_CREDIT;
        localMuscle(muscle).indirect += count * SECONDARY_CREDIT;
      }
    }
    directMuscles.forEach((muscle) => { muscleEntry(muscle).directSessions += 1; });
    return { index: session.index, focus: session.focus,
      presentationFocus: input.goal === TrainingGoal.HYPERTROPHY ? sessionPresentationFocus(session) : session.focus,
      coherence, sets, minutes, muscles: sessionMuscles,
      patterns: [...new Set(session.exercises.map((e) => e.exercise.movementVector))],
      exercises: session.exercises.map(({ exercise, sets: count }) => ({ id: exercise.id,
        name: exercise.name, muscle: exercise.primaryMuscle, equipment: exercise.equipment,
        pattern: exercise.movementVector, hipFamily: hipFamily(exercise), sets: count, stimulusTags: exercise.stimulusTags ?? null })),
      demandingTorsoHinges: session.exercises.filter((e) => isDemandingTorsoHinge(e.exercise)).length };
  });
  if (input.goal === TrainingGoal.HYPERTROPHY) for (const [id, count] of occurrences) {
    if (count > 1) issues.push({ code: 'repeated-exercise', severity: 'error', actual: count, limit: 1, subject: id });
  }
  const totalSets = sessions.reduce((sum, s) => sum + s.sets, 0);
  const unassignedSets = plan.distribution.unassigned.reduce((sum, e) => sum + e.sets, 0);
  if (unassignedSets) issues.push({ code: 'unassigned-sets', severity: 'error', actual: unassignedSets, limit: 0 });
  if (totalSets + unassignedSets !== plan.selection.performedSets) issues.push({
    code: 'set-conservation', severity: 'error', actual: totalSets + unassignedSets, limit: plan.selection.performedSets });
  for (const { vector, muscles: gating } of FOUNDATIONAL_PATTERNS) {
    if (!gating.some((m) => (muscles[m]?.target ?? 0) > 0)) continue;
    if (!plan.distribution.sessions.some((s) => s.exercises.some((e) =>
      e.exercise.movementVector === vector && e.exercise.profile !== ExerciseProfile.ISOLATION))) {
      issues.push({ code: 'missing-pattern', severity: 'warning', actual: 0, limit: 1, subject: vector });
    }
  }
  for (const [muscle, volume] of Object.entries(muscles)) if (volume.target - volume.attributed >= 3) {
    issues.push({ code: 'volume-deficit', severity: 'warning', actual: volume.attributed,
      limit: volume.target, subject: muscle });
  }
  const underfilled = issues.filter((i) => i.code === 'underfilled-session').length;
  const safePlan = { ...plan, distribution: { ...plan.distribution, sessions: plan.distribution.sessions.map((s) => ({
    ...s, exercises: s.exercises.map((e) => ({ ...e, sets: Number.isInteger(e.sets) && e.sets > 0 && e.sets <= 1000 ? e.sets : 0 })),
  })) } };
  const prescribed = toPlannedSessions(safePlan);
  const catalogue = new Map(input.catalogue.map((e) => [e.id, e]));
  // A malformed index/dose must yield a diagnostic, not crash the evaluator.
  const safePrescribed = prescribed.map((s, index) => ({ ...s, index }));
  const scheduleTemplate = buildScheduleTemplate(safePrescribed, catalogue);
  const recovery = templateRecovery(scheduleTemplate, safePrescribed, catalogue);
  for (const pair of recovery.filter((p) => p.reviewSuggested)) issues.push({ code: 'template-overlap', severity: 'warning',
    actual: pair.gapDays, limit: 2, sessionIndex: pair.to, subject: pair.muscles.join(',') });
  for (const overlap of plan.distribution.sequencingWarnings) issues.push({ code: 'sequence-overlap', severity: 'warning',
    actual: overlap.risk, limit: 0, sessionIndex: overlap.followingSessionIndex, subject: overlap.sharedMuscles.join(',') });
  for (const warning of plan.distribution.structureWarnings) if (warning.kind !== 'empty-session' && warning.kind !== 'underfilled-session'
    && !issues.some((i) => i.code === warning.kind
    && i.sessionIndex === warning.sessionIndex && i.subject === warning.muscle)) issues.push({
    code: warning.kind, severity: 'warning', actual: 1, limit: 0, sessionIndex: warning.sessionIndex,
    subject: warning.muscle, detail: warning.detail });
  const targetCompromises = plan.uncappedPlan.muscles.filter((m) => m.meav > 0).map((m) => ({ muscle: m.muscle,
    requested: m.meav, adjusted: muscles[m.muscle]?.target ?? 0, attributed: muscles[m.muscle]?.attributed ?? 0,
    shortfall: Math.max(0, m.meav - (muscles[m.muscle]?.attributed ?? 0)) }));
  for (const m of targetCompromises) if (m.shortfall >= 3 && m.requested > m.adjusted) issues.push({
    code: 'uncapped-volume-deficit', severity: 'warning', actual: m.attributed, limit: m.requested, subject: m.muscle });
  if (input.goal === TrainingGoal.STRENGTH && plan.strength) {
    if (plan.strength.mainLiftShare < 0.6) issues.push({ code: 'strength-main-share', severity: 'warning', actual: plan.strength.mainLiftShare, limit: 0.6 });
    for (const lift of plan.strength.mainLifts.filter((l) => l.substituted)) issues.push({ code: 'strength-substitution',
      severity: 'warning', actual: 1, limit: 0, subject: lift.exerciseId });
  }
  const selected = [...occurrences.keys()].map((id) => catalogue.get(id)).filter((e): e is Exercise => !!e);
  const unknownStimulusExercises = [...occurrences.keys()].filter((id) => !catalogue.get(id)?.stimulusTags?.length);
  const assessment = assessQualityAxes(issues, { selectedExerciseIds: [...occurrences.keys()],
    missingCriteriaIds: [...occurrences.keys()].filter((id) => !catalogue.get(id)?.criteria),
    unknownStimulusIds: unknownStimulusExercises,
    unverifiedResistanceIds: selected.filter((e) => reviewedExerciseMetadata(e).resistanceProfile === 'unverified').map((e) => e.id),
    individuallySourceReviewedIds: selected.filter((e) => reviewedExerciseMetadata(e).sourceReview).map((e) => e.id) });
  return { totalSets, sessions: sessions.map((s) => ({ ...s, volumeShare: totalSets ? s.sets / totalSets : 0 })),
    muscles, issues, valid: assessment.feasibility.status === 'feasible', assessment,
    compromises: { limitingFactor: plan.limitedBy, squeeze: plan.squeeze, targetCompromises,
      interpretation: plan.limitedBy === 'recovery' ? 'Population-informed volume budget, not measured individual recovery.'
        : 'Catalogue or estimated time constrained the requested starting volume.' },
    setSpread: sessions.length ? Math.max(...sessions.map((s) => s.sets)) - Math.min(...sessions.map((s) => s.sets)) : 0,
    unknownStimulusExercises,
    overlapWarnings: plan.distribution.sequencingWarnings,
    structureWarnings: plan.distribution.structureWarnings,
    recoveryStatus: 'template-estimate' as const,
    scheduleTemplate, templateRecovery: recovery,
    weeklyNormalization: { days: scheduleTemplate.days, setsPerSevenDays: totalSets * 7 / scheduleTemplate.days },
    // A candidate to evaluate, not a promise that fewer sessions will fit the clock.
    suggestedSessionCount: underfilled && totalSets >= 2 * MIN_HYPERTROPHY_SESSION_SETS
      && totalSets < sessions.length * MIN_HYPERTROPHY_SESSION_SETS
      ? Math.floor(totalSets / MIN_HYPERTROPHY_SESSION_SETS) : null };
}
