import { Equipment, ExperienceLevel, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE, filterCatalogue } from '../exerciseCatalogue';
import { planMesocycle } from '../mesocyclePlanner';
import { TrainingGoal } from '../volumePlan';
import { auditCatalogue, evaluateGeneratorQuality } from '../generatorQuality';

const input = { level: ExperienceLevel.INTERMEDIATE, goal: TrainingGoal.HYPERTROPHY,
  capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 60 }, seed: 31,
  split: SplitStructure.AUTO, catalogue: filterCatalogue(EXERCISE_CATALOGUE,
    { availableEquipment: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.BODYWEIGHT] }) };

it('preserves every performed set and independently validates the limited-equipment regression', () => {
  const plan = planMesocycle(input);
  const report = evaluateGeneratorQuality(input, plan);
  expect(report.valid).toBe(true);
  expect(report.totalSets).toBeGreaterThanOrEqual(52);
  expect(report.sessions.reduce((n, s) => n + s.volumeShare, 0)).toBeCloseTo(1);
  expect(report.recoveryStatus).toBe('template-estimate');
  expect(report.scheduleTemplate.slots.filter((s) => s.kind === 'rest')).toHaveLength(3);
  expect(report.weeklyNormalization).toEqual({ days: 7, setsPerSevenDays: report.totalSets });
});

it('reports an impossible empty catalogue without inventing exercises', () => {
  const empty = { ...input, catalogue: [] };
  const report = evaluateGeneratorQuality(empty, planMesocycle(empty));
  expect(report.valid).toBe(false);
  expect(report.totalSets).toBe(0);
  expect(report.issues.filter((i) => i.code === 'empty-session')).toHaveLength(4);
  expect(report.issues.filter((i) => i.code === 'underfilled-session')).toHaveLength(0);
});

it('detects set loss, excluded exercises, repeated identities and overflowing sessions', () => {
  const plan = planMesocycle(input);
  plan.distribution.sessions[1].exercises.push(plan.distribution.sessions[0].exercises[0]);
  plan.distribution.sessions[0].estimatedWorkMinutes = 100;
  const report = evaluateGeneratorQuality({ ...input, catalogue: [] }, plan);
  expect(report.issues.map((i) => i.code)).toEqual(expect.arrayContaining([
    'set-conservation', 'excluded-exercise', 'repeated-exercise', 'time-overflow',
  ]));
});

it('makes catalogue uncertainty visible without fabricating scores', () => {
  const audit = auditCatalogue(EXERCISE_CATALOGUE);
  expect(audit.issues).toEqual([]);
  expect(audit.missingCriteria).toEqual([]);
  expect(audit.unknownStimulus.length).toBeGreaterThan(0);
  const exercise = EXERCISE_CATALOGUE[0];
  expect(auditCatalogue([{ ...exercise, criteria: undefined }]).missingCriteria).toEqual([exercise.id]);
  expect(auditCatalogue([exercise, { ...exercise, secondaryMuscles: [exercise.primaryMuscle],
    stimulusTags: ['invalid'] }]).issues.map((i) => i.code)).toEqual([
    'duplicate-id', 'duplicate-muscle-credit', 'invalid-stimulus-tag',
  ]);
});

it('reports a feasible but limited plan independently of evidence confidence', () => {
  const report = evaluateGeneratorQuality(input, planMesocycle(input));
  expect(report.assessment.feasibility.status).toBe('feasible');
  expect(report.assessment.confidence.status).toBe('heuristic-limited');
  expect(report.assessment.confidence.unverifiedResistanceIds.length).toBeGreaterThan(0);
  expect(report.compromises.targetCompromises.length).toBeGreaterThan(0);
  expect(report.assessment.programming.findings.every((f) => !!f.explanation)).toBe(true);
});

it.each([NaN, Infinity, -1, 1.5, 0])('flags invalid doses instead of passing feasibility: %s', (dose) => {
  const plan = planMesocycle(input);
  plan.distribution.sessions[0].exercises[0].sets = dose;
  const report = evaluateGeneratorQuality(input, plan);
  expect(report.valid).toBe(false);
  expect(report.issues.some((i) => i.code === 'invalid-dose')).toBe(true);
});

it('flags invalid durations, indices and session count without losing diagnostics', () => {
  const plan = planMesocycle(input);
  plan.distribution.sessions[0].estimatedWorkMinutes = NaN;
  plan.distribution.sessions[1].index = plan.distribution.sessions[0].index;
  const report = evaluateGeneratorQuality({ ...input, capacity: { ...input.capacity, sessionsPerMicrocycle: 5 } }, plan);
  expect(report.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['invalid-duration', 'invalid-session-index', 'session-count']));
  expect(report.assessment.programming.status).toBe('not-assessable');
});

it('preserves goal-specific strength repetitions and makes lift substitutions visible', () => {
  const strength = { ...input, goal: TrainingGoal.STRENGTH,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 90 },
    catalogue: EXERCISE_CATALOGUE.filter((e) => e.equipment === Equipment.DUMBBELL || e.equipment === Equipment.BODYWEIGHT) };
  const report = evaluateGeneratorQuality(strength, planMesocycle(strength));
  expect(report.issues.some((i) => i.code === 'repeated-exercise')).toBe(false);
  expect(report.issues.some((i) => i.code === 'strength-substitution')).toBe(true);
});

it('reports the original volume compromise even when adjusted targets look sufficient', () => {
  const plan = planMesocycle(input);
  plan.uncappedPlan.muscles[0].meav = 999;
  const report = evaluateGeneratorQuality(input, plan);
  expect(report.issues.some((i) => i.code === 'uncapped-volume-deficit')).toBe(true);
});

it('reviews demanding hinge concentration but permits RDL plus supported hip thrust', () => {
  const plan = planMesocycle(input);
  const rdl = EXERCISE_CATALOGUE.find((e) => e.id === 'peso-muerto-rumano')!;
  const thrust = EXERCISE_CATALOGUE.find((e) => e.id === 'hip-thrust')!;
  const dumbbellRdl = EXERCISE_CATALOGUE.find((e) => e.id === 'peso-muerto-rumano-mancuernas')!;
  plan.distribution.sessions[0].exercises = [{ exercise: rdl, sets: 3 }, { exercise: thrust, sets: 3 }];
  expect(evaluateGeneratorQuality(input, plan).issues.some((i) => i.code === 'torso-hinge-concentration' && i.sessionIndex === 0)).toBe(false);
  plan.distribution.sessions[0].exercises.push({ exercise: dumbbellRdl, sets: 3 });
  expect(evaluateGeneratorQuality(input, plan).issues.some((i) => i.code === 'torso-hinge-concentration' && i.sessionIndex === 0)).toBe(true);
});

it('reports strength main-share deviations without imposing hypertrophy appearance caps', () => {
  const strength = { ...input, goal: TrainingGoal.STRENGTH, capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 90 } };
  const plan = planMesocycle(strength);
  plan.strength!.mainLiftShare = 0.5;
  plan.distribution.sessions[0].exercises[0].sets = 5;
  const report = evaluateGeneratorQuality(strength, plan);
  expect(report.issues.some((i) => i.code === 'strength-main-share')).toBe(true);
  expect(report.issues.some((i) => i.code === 'appearance-set-cap')).toBe(false);
});

it('records unassigned work, source-reviewed manual data and attribution outside requested targets', () => {
  const plan = planMesocycle(input);
  const jm = EXERCISE_CATALOGUE.find((e) => e.id === 'guide-211')!;
  plan.plan.muscles = [];
  plan.distribution.sessions[0].exercises = [{ exercise: { ...jm, secondaryMuscles: [jm.primaryMuscle] }, sets: 3 }];
  plan.distribution.unassigned.push({ exercise: jm, sets: 3 });
  const report = evaluateGeneratorQuality({ ...input, catalogue: EXERCISE_CATALOGUE }, plan);
  expect(report.issues.some((i) => i.code === 'unassigned-sets')).toBe(true);
  expect(report.assessment.confidence.missingCriteriaIds).toContain(jm.id);
  expect(report.assessment.confidence.individuallySourceReviewedIds).toContain(jm.id);
});

it('keeps review suggestions distinct from fabricated filler and handles an absent distribution', () => {
  const plan = planMesocycle(input);
  plan.distribution.sessions.forEach((session) => { session.exercises = session.exercises.slice(0, 2).map((e) => ({ ...e, sets: 3 })); });
  expect(evaluateGeneratorQuality(input, plan).suggestedSessionCount).toBe(2);
  plan.distribution.sessions = [];
  expect(evaluateGeneratorQuality(input, plan).setSpread).toBe(0);
});

it('cannot hide a focus/task contradiction behind a large session load', () => {
  const plan = planMesocycle(input);
  const lateral = EXERCISE_CATALOGUE.find((e) => e.id === 'elevacion-lateral-polea')!;
  plan.distribution.sessions[0].focus = 'PUSH';
  plan.distribution.sessions[0].exercises = Array.from({ length: 5 }, () => ({ exercise: lateral, sets: 3 }));
  const report = evaluateGeneratorQuality(input, plan);
  expect(report.sessions[0].sets).toBe(15);
  expect(report.assessment.programming.findings.some((i) => i.code === 'focus-without-press')).toBe(true);
});

it('explains adjacent repeatable-template exposure without claiming measured recovery', () => {
  const plan = planMesocycle(input);
  const entry = plan.distribution.sessions[0].exercises[0];
  plan.distribution.sessions = Array.from({ length: 6 }, (_, index) => ({ index, focus: 'FULL_BODY' as const,
    exercises: [{ ...entry, sets: 3 }], estimatedWorkMinutes: 15 }));
  const report = evaluateGeneratorQuality({ ...input, capacity: { ...input.capacity, sessionsPerMicrocycle: 6 } }, plan);
  const finding = report.assessment.programming.findings.find((i) => i.code === 'template-overlap')!;
  expect(finding.explanation).toContain('not a claim of inadequate recovery');
  expect(finding.magnitude.actual).toBe(1);
});
