import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { spreadDirectBiceps, type DistributedSession } from '../sessionDistribution';
import { MuscleGroup } from '@/models';

/** Original seed-21 placement, before the late exchange. */
function fixture(): DistributedSession[] {
  const entries: [string, number][][] = [
    [['remo-alto-polea', 4], ['extension-sobre-cabeza-mancuerna', 4], ['elevacion-lateral-polea', 4],
      ['curl-predicador', 4], ['cruces-polea-baja', 3], ['curl-bayesian', 3]],
    [['peso-muerto-piernas-rigidas', 3], ['bulgara', 3], ['hip-thrust', 3], ['remo-maquina', 3],
      ['rueda-abdominal', 3], ['pullover-polea', 3], ['crunch-maquina', 3]],
    [['press-banca-declinado', 3], ['pushdown-barra', 4], ['elevacion-lateral-maquina', 4],
      ['pec-deck-invertido', 4], ['pullover-mancuerna', 3], ['encogimientos-inclinado', 3]],
    [['press-banca-cerrado', 4], ['sentadilla-hack', 3], ['jalon-agarre-neutro', 3],
      ['press-frances', 4], ['elevacion-lateral-inclinado', 3], ['curl-femoral-sentado', 3], ['pec-deck', 3]],
  ];
  return entries.map((items, index) => ({ index, focus: index === 1 ? 'LOWER' : 'UPPER',
    estimatedWorkMinutes: [66, 64.5, 63, 69][index],
    exercises: items.map(([id, sets]) => ({ exercise: EXERCISE_CATALOGUE.find((e) => e.id === id)!, sets })) }));
}
const settings = { minimumSessionSets: 12, maxWorkMinutesPerSession: 69 };
const roster = (sessions: DistributedSession[]) => sessions.flatMap((s) => s.exercises)
  .map((e) => `${e.exercise.id}:${e.sets}`).sort();

it('rejects the tempting overhead-extension exchange that worsens cyclic template recovery', () => {
  const items: [string, number][][] = [
    [['peso-muerto-convencional', 3], ['curl-inclinado', 3], ['curl-polea-baja', 3], ['elevacion-lateral-polea', 3]],
    [['sentadilla-frontal', 4], ['press-inclinado-mancuernas', 4], ['elevacion-lateral-maquina', 4]],
    [['jalon-al-pecho', 3], ['rueda-abdominal', 3], ['extension-sobre-cabeza-mancuerna', 3], ['pec-deck', 3]],
    [['buenos-dias', 3], ['remo-maquina', 3], ['face-pull', 4], ['press-frances', 3]],
  ];
  const sessions: DistributedSession[] = items.map((entries, index) => ({ index,
    focus: index === 1 ? 'LOWER' : 'UPPER', estimatedWorkMinutes: 40,
    exercises: entries.map(([id, sets]) => ({ exercise: EXERCISE_CATALOGUE.find((e) => e.id === id)!, sets })) }));
  const before = roster(sessions);
  expect(spreadDirectBiceps({ ...settings, maxWorkMinutesPerSession: 59 }, sessions)).toBe(true);
  expect(roster(sessions)).toEqual(before);
  expect(sessions[2].exercises.some((e) => e.exercise.id === 'extension-sobre-cabeza-mancuerna')).toBe(true);
  expect(sessions[0].exercises.some((e) => e.exercise.id === 'pec-deck')).toBe(true);
});

it('exchanges the curl with French press on an existing indirect biceps exposure', () => {
  const sessions = fixture(); const before = roster(sessions);
  expect(spreadDirectBiceps(settings, sessions)).toBe(true);
  expect(roster(sessions)).toEqual(before);
  expect(sessions[0].exercises.some((e) => e.exercise.id === 'press-frances')).toBe(true);
  expect(sessions[3].exercises.some((e) => e.exercise.primaryMuscle === MuscleGroup.BICEPS)).toBe(true);
  expect(sessions.map((s) => s.estimatedWorkMinutes)).toEqual([69, 64.5, 63, 66]);
  expect(spreadDirectBiceps(settings, sessions)).toBe(false);
});

it('does not force frequency for maintenance, insufficient time or no pull exposure', () => {
  expect(spreadDirectBiceps(settings, [])).toBe(false);
  expect(spreadDirectBiceps(settings, [fixture()[0]])).toBe(false);
  expect(spreadDirectBiceps({ ...settings, deprioritizedMuscles: [MuscleGroup.BICEPS] }, fixture())).toBe(false);
  expect(spreadDirectBiceps({ ...settings, maxWorkMinutesPerSession: 1 }, fixture())).toBe(false);
  const noPull = fixture().map((s) => ({ ...s, exercises: s.exercises.filter((e) =>
    !e.exercise.secondaryMuscles.includes(MuscleGroup.BICEPS)) }));
  const before = roster(noPull);
  expect(spreadDirectBiceps(settings, noPull)).toBe(false);
  expect(roster(noPull)).toEqual(before);
});

it('preserves prescribed strength appearances and rejects unknown complementary geometry', () => {
  const strength = fixture();
  strength[0].exercises.filter((e) => e.exercise.primaryMuscle === MuscleGroup.BICEPS)
    .forEach((e) => { e.strength = { role: 'ACCESSORY', restSeconds: 120, topSingle: false }; });
  expect(spreadDirectBiceps(settings, strength)).toBe(false);
  const unknown = fixture();
  unknown.forEach((s) => s.exercises.forEach((e) => {
    e.exercise = { ...e.exercise, stimulusTags: undefined };
  }));
  expect(spreadDirectBiceps(settings, unknown)).toBe(false);
});
