import { repairSessionAllocation, type DistributedSession } from '../sessionDistribution';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { workloadTemplateRecovery } from '../scheduleTemplate';

function fixture(): DistributedSession[] {
  const entries: [string, number][][] = [
    [['press-banca-smith', 4], ['elevacion-lateral-maquina', 4], ['curl-polea-baja', 3], ['pushdown-cuerda', 3]],
    [['sentadilla-frontal', 3], ['peso-muerto-convencional', 3], ['rueda-abdominal', 3], ['elevacion-lateral-polea', 3]],
    [['remo-maquina', 4], ['face-pull', 4], ['extension-sobre-cabeza-mancuerna', 3]],
    [['jalon-agarre-neutro', 4], ['peso-muerto-rumano-mancuernas', 3], ['press-banca-cerrado', 3], ['curl-bayesian', 3]],
  ];
  return entries.map((items, index) => ({ index, focus: index === 1 ? 'LOWER' : 'UPPER', estimatedWorkMinutes: 50,
    exercises: items.map(([id, sets]) => ({ exercise: EXERCISE_CATALOGUE.find((entry) => entry.id === id)!, sets })) }));
}
const roster = (sessions: DistributedSession[]) => sessions.flatMap((s) => s.exercises)
  .map((e) => `${e.exercise.id}:${e.sets}`).sort();
const warnings = (sessions: DistributedSession[]) => workloadTemplateRecovery(sessions.map((s) => {
  const directSets = new Map<string, number>();
  s.exercises.forEach((e) => directSets.set(e.exercise.primaryMuscle, (directSets.get(e.exercise.primaryMuscle) ?? 0) + e.sets));
  return { index: s.index, directSets };
})).filter((pair) => pair.reviewSuggested).length;

it('repairs the real 14/12/11/13 case through multiple exchanges without changing dose or template warnings', () => {
  const sessions = fixture(); const original = roster(sessions); const beforeWarnings = warnings(sessions);
  expect(repairSessionAllocation(sessions, 12, 69)).toBe(true);
  expect(sessions.every((s) => s.exercises.reduce((sum, e) => sum + e.sets, 0) >= 12)).toBe(true);
  expect(roster(sessions)).toEqual(original);
  expect(warnings(sessions)).toBeLessThanOrEqual(beforeWarnings);
  expect(sessions.every((s) => s.estimatedWorkMinutes <= 69)).toBe(true);
  expect(repairSessionAllocation(sessions, 12, 69)).toBe(false);
});
it('leaves impossible dose, incompatible time and prescribed strength intact', () => {
  expect(repairSessionAllocation([], 12)).toBe(false);
  const sessions = fixture(); const original = JSON.stringify(sessions);
  expect(repairSessionAllocation(sessions, 20, 69)).toBe(false);
  expect(repairSessionAllocation(sessions, 12, 1)).toBe(false);
  expect(JSON.stringify(sessions)).toBe(original);
  sessions[0].exercises[0].strength = { role: 'MAIN', restSeconds: 240, topSingle: false };
  expect(repairSessionAllocation(sessions, 12, 69)).toBe(false);
});
