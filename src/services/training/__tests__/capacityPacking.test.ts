import { ExperienceLevel, SplitStructure } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { selectExercises } from '../exerciseSelection';
import { buildVolumePlan, TrainingGoal, VolumeRegion } from '../volumePlan';
import { planMesocycle } from '../mesocyclePlanner';
import { distributeSelection, packSessionCapacity, effectiveSetsByMuscle, sessionSequencingWarnings,
  isSessionAnchor, type DistributedSession } from '../sessionDistribution';
import { workloadTemplateRecovery } from '../scheduleTemplate';
import { exerciseMinutes } from '../trainingCapacity';

const selection = selectExercises({ volumePlan: buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE,
  goal: TrainingGoal.HYPERTROPHY }), catalogue: EXERCISE_CATALOGUE, seed: 11, rankingPolicy: 'accessory-aware' });
function fixture() {
  return distributeSelection({ selection, split: SplitStructure.AUTO, sessionsPerMicrocycle: 4,
    maxWorkMinutesPerSession: 69, capacityPacking: false }).sessions;
}
const dose = (sessions: DistributedSession[]) => {
  const totals = new Map<string, number>();
  sessions.forEach((session) => session.exercises.forEach((entry) => totals.set(entry.exercise.id,
    (totals.get(entry.exercise.id) ?? 0) + entry.sets)));
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
};
const concentration = (sessions: DistributedSession[]) => sessions.reduce((sum, session) => sum
  + [...effectiveSetsByMuscle(session.exercises).values()].reduce((cost, sets) => cost + Math.max(0, sets - 10), 0), 0);
const recovery = (sessions: DistributedSession[]) => workloadTemplateRecovery(sessions.map((session) => {
  const directSets = new Map<string, number>();
  session.exercises.forEach((entry) => directSets.set(entry.exercise.primaryMuscle,
    (directSets.get(entry.exercise.primaryMuscle) ?? 0) + entry.sets));
  return { index: session.index, directSets };
})).filter((pair) => pair.reviewSuggested);

it('does not make a time-fitting but underfilled roster displace the balanced beginner PPL incumbent', () => {
  const plan = planMesocycle({ level: ExperienceLevel.BEGINNER, goal: TrainingGoal.HYPERTROPHY,
    capacity: { sessionsPerMicrocycle: 4, minutesPerSession: 45 }, split: SplitStructure.PUSH_PULL_LEGS,
    seed: 68, priorityRegions: [VolumeRegion.BICEPS], catalogue: EXERCISE_CATALOGUE });
  expect(plan.distribution.sessions.every((session) => session.exercises.reduce((sum, entry) => sum + entry.sets, 0) >= 12)).toBe(true);
});

it('can transfer a set between existing appearances without cloning entries or mutating the original objects', () => {
  const press = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'press-banca-smith')!;
  const curl = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'curl-polea-baja')!;
  const pulldown = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'jalon-al-pecho')!;
  const lateral = EXERCISE_CATALOGUE.find((exercise) => exercise.id === 'elevacion-lateral-maquina')!;
  const sessions: DistributedSession[] = [[{ exercise: press, sets: 3 }, { exercise: curl, sets: 4 }],
    [{ exercise: press, sets: 2 }, { exercise: curl, sets: 3 }]].map((exercises, index) => ({
      index, focus: 'UPPER', exercises: [...exercises, { exercise: pulldown, sets: 4 }, { exercise: lateral, sets: 3 }],
      estimatedWorkMinutes: exercises.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0)
        + exerciseMinutes(pulldown, 4) + exerciseMinutes(lateral, 3),
    }));
  const entries = sessions.flatMap((session) => session.exercises), before = JSON.stringify(entries), beforeDose = dose(sessions);
  const budget = 20 + exerciseMinutes(pulldown, 4) + exerciseMinutes(lateral, 3);
  const result = packSessionCapacity(sessions, budget);
  expect(result.moves).toBeGreaterThan(0);
  expect(sessions.every((session) => session.estimatedWorkMinutes <= budget + 0.01)).toBe(true);
  expect(dose(sessions)).toEqual(beforeDose);
  expect(sessions.flatMap((session) => session.exercises)).toHaveLength(entries.length);
  expect(JSON.stringify(entries)).toBe(before);
});

it('fits the real intermediate fixed-dose roster in four days with preserved dose, anchors and recovery', () => {
  const sessions = fixture(), beforeDose = dose(sessions), beforeConcentration = concentration(sessions);
  const beforeSequence = sessionSequencingWarnings(sessions).length, beforeRecovery = recovery(sessions);
  expect(sessions.some((session) => session.estimatedWorkMinutes > 69)).toBe(true);
  const result = packSessionCapacity(sessions, 69);
  expect(result.moves).toBeGreaterThan(0);
  expect(result.evaluated).toBeLessThanOrEqual(1000);
  expect(dose(sessions)).toEqual(beforeDose);
  expect(sessions.every((session) => session.estimatedWorkMinutes <= 69.01)).toBe(true);
  expect(sessions.every((session) => session.exercises.some(isSessionAnchor))).toBe(true);
  expect(concentration(sessions)).toBeLessThanOrEqual(beforeConcentration);
  expect(sessionSequencingWarnings(sessions).length).toBeLessThanOrEqual(beforeSequence);
  expect(recovery(sessions).length).toBeLessThanOrEqual(beforeRecovery.length);
  expect(recovery(sessions).reduce((sum, pair) => sum + pair.cost, 0))
    .toBeLessThanOrEqual(beforeRecovery.reduce((sum, pair) => sum + pair.cost, 0));
  for (const session of sessions) expect(session.estimatedWorkMinutes).toBeCloseTo(
    session.exercises.reduce((sum, entry) => sum + exerciseMinutes(entry.exercise, entry.sets), 0));
  expect(packSessionCapacity(sessions, 69)).toEqual({ moves: 0, evaluated: 0 });
});
it('leaves invalid, single-session, insufficient-time and strength inputs untouched', () => {
  for (const minutes of [0, -1, NaN, Infinity, 1]) {
    const sessions = fixture(), before = JSON.stringify(sessions);
    expect(packSessionCapacity(sessions, minutes).moves).toBe(0);
    expect(JSON.stringify(sessions)).toBe(before);
  }
  expect(packSessionCapacity([], 69)).toEqual({ moves: 0, evaluated: 0 });
  expect(packSessionCapacity(fixture().slice(0, 1), 69).moves).toBe(0);
  const sessions = fixture(); sessions[0].exercises[0] = { ...sessions[0].exercises[0],
    strength: { role: 'MAIN', restSeconds: 240, topSingle: true } };
  const before = JSON.stringify(sessions);
  expect(packSessionCapacity(sessions, 69)).toEqual({ moves: 0, evaluated: 0 });
  expect(JSON.stringify(sessions)).toBe(before);
});
it('bounds search and rejects noninteger/invalid doses without changing selection objects', () => {
  const source = JSON.stringify(selection);
  expect(packSessionCapacity(fixture(), 69, [], 1).evaluated).toBeLessThanOrEqual(1);
  for (const limit of [0, -1, NaN, Infinity]) expect(packSessionCapacity(fixture(), 69, [], limit).evaluated).toBe(0);
  for (const sets of [0, -1, 1.5, NaN]) {
    const sessions = fixture(); sessions[0].exercises[0] = { ...sessions[0].exercises[0], sets };
    expect(packSessionCapacity(sessions, 69).evaluated).toBe(0);
  }
  expect(JSON.stringify(selection)).toBe(source);
});
it.each([11, 22, 33])('preserves dose, occurrences and refreshed diagnostics without worsening overflow at seed %s', (seed) => {
  const roster = selectExercises({ volumePlan: buildVolumePlan({ level: ExperienceLevel.INTERMEDIATE,
    goal: TrainingGoal.HYPERTROPHY }), catalogue: EXERCISE_CATALOGUE, seed, rankingPolicy: 'accessory-aware' });
  const input = { selection: roster, split: SplitStructure.AUTO, sessionsPerMicrocycle: 4, maxWorkMinutesPerSession: 69 };
  const before = distributeSelection({ ...input, capacityPacking: false }), after = distributeSelection({ ...input, capacityPacking: true });
  expect(dose(after.sessions)).toEqual(dose(before.sessions));
  const overflow = (sessions: DistributedSession[]) => sessions.reduce((sum, session) => sum + Math.max(0, session.estimatedWorkMinutes - 69), 0);
  expect(overflow(after.sessions)).toBeLessThanOrEqual(overflow(before.sessions));
  expect(after.sessions.flatMap((session) => session.exercises.map((entry) => entry.exercise.id)).sort())
    .toEqual(before.sessions.flatMap((session) => session.exercises.map((entry) => entry.exercise.id)).sort());
  expect(after.sequencingWarnings).toEqual(sessionSequencingWarnings(after.sessions));
  expect(after.totalWorkMinutes).toBeCloseTo(after.sessions.reduce((sum, session) => sum + session.estimatedWorkMinutes, 0));
});
