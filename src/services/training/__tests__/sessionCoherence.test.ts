import { ExperienceLevel, MuscleGroup } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { reviewSessionCoherence, sessionPresentationFocus, plannedPresentationFocus } from '../sessionCoherence';
import { toPlannedSession } from '../routineMapper';
import { TrainingGoal } from '../volumePlan';
import type { DistributedSession } from '../sessionDistribution';

const session = (focus: DistributedSession['focus'], ids: string[]): DistributedSession => ({ index: 0, focus,
  estimatedWorkMinutes: 20, exercises: ids.map((id) => ({ exercise: EXERCISE_CATALOGUE.find((e) => e.id === id)!, sets: 3 })) });
const targets = new Set([MuscleGroup.CHEST, MuscleGroup.LATS, MuscleGroup.QUADS]);
it('flags a misleading focus while permitting mixed-body spillover', () => {
  expect(reviewSessionCoherence(session('PUSH', ['sentadilla-libre']), ExperienceLevel.ADVANCED, targets)[0].code).toBe('focus-without-press');
  expect(reviewSessionCoherence(session('PUSH', ['sentadilla-libre', 'press-banca']), ExperienceLevel.ADVANCED, targets)).toEqual([]);
  expect(reviewSessionCoherence(session('PULL', ['curl-barra']), ExperienceLevel.INTERMEDIATE, targets)[0].code).toBe('focus-without-pull');
  expect(reviewSessionCoherence(session('PULL', ['curl-barra', 'jalon-al-pecho']), ExperienceLevel.INTERMEDIATE, targets)).toEqual([]);
  expect(reviewSessionCoherence(session('LOWER', ['press-banca']), ExperienceLevel.INTERMEDIATE, targets)[0].code).toBe('focus-without-lower-work');
});
it('does not require tasks excluded by the athlete or issue empty-session duplicates', () => {
  expect(reviewSessionCoherence(session('PUSH', ['sentadilla-libre']), ExperienceLevel.ADVANCED, new Set([MuscleGroup.QUADS]))).toEqual([]);
  expect(reviewSessionCoherence(session('LEGS', ['press-banca']), ExperienceLevel.ADVANCED, new Set([MuscleGroup.CHEST]))).toEqual([]);
  expect(reviewSessionCoherence(session('PULL', []), ExperienceLevel.BEGINNER, targets)).toEqual([]);
});
it('reports beginner coaching needs and concentrated unsupported rows without banning exercises', () => {
  const work = session('FULL_BODY', ['buenos-dias', 'remo-con-barra', 'remo-barra-agarre-supino']);
  const snapshot = JSON.stringify(work);
  expect(reviewSessionCoherence(work, ExperienceLevel.BEGINNER, targets).filter((f) => f.code === 'beginner-technique-review')).toHaveLength(3);
  expect(reviewSessionCoherence(work, ExperienceLevel.ADVANCED, targets).map((f) => f.code)).toEqual(['unsupported-row-concentration']);
  expect(JSON.stringify(work)).toBe(snapshot);
});
it('names sessions by the muscle groups they train without moving sets or changing strength', () => {
  const pullOnly = session('LOWER', ['remo-con-barra', 'curl-barra']);
  expect(sessionPresentationFocus(pullOnly)).toBe('PULL');
  const planned = toPlannedSession(pullOnly);
  expect(planned.focus).toBe('PULL');
  expect(planned.exercises.map((e) => e.exerciseId)).toEqual(['remo-con-barra', 'curl-barra']);
  expect(planned.exercises.map((e) => e.sets.length)).toEqual([3, 3]);
  expect(toPlannedSession(pullOnly, TrainingGoal.STRENGTH).focus).toBe('LOWER');
  expect(sessionPresentationFocus(session('PUSH', ['sentadilla-libre']))).toBe('LOWER');
  expect(sessionPresentationFocus(session('LEGS', ['sentadilla-libre', 'crunch-polea']))).toBe('LEGS');
  // Mixed push and pull with lower work is full body, whatever slot it was planned for.
  expect(sessionPresentationFocus(session('UPPER', ['press-banca', 'jalon-al-pecho', 'sentadilla-libre']))).toBe('FULL_BODY');
  expect(sessionPresentationFocus(session('UPPER', ['press-banca', 'curl-femoral-sentado']))).toBe('FULL_BODY');
  // Squats push, hinges and leg curls pull, so push and pull days may carry legs.
  expect(sessionPresentationFocus(session('LOWER', ['sentadilla-libre', 'press-banca']))).toBe('PUSH');
  expect(sessionPresentationFocus(session('UPPER', ['prensa-45', 'extension-cuadriceps', 'press-militar-barra', 'press-frances']))).toBe('PUSH');
  expect(sessionPresentationFocus(session('UPPER', ['peso-muerto-rumano', 'jalon-al-pecho', 'curl-barra']))).toBe('PULL');
  expect(sessionPresentationFocus(session('UPPER', ['peso-muerto-convencional', 'hip-thrust', 'remo-con-barra']))).toBe('PULL');
  expect(sessionPresentationFocus(session('PUSH', ['curl-femoral-sentado', 'jalon-al-pecho']))).toBe('PULL');
  // Calves and isolated hip work do not decide the side.
  expect(sessionPresentationFocus(session('UPPER', ['press-banca', 'gemelos-de-pie', 'abduccion-cadera-maquina']))).toBe('PUSH');
  expect(sessionPresentationFocus(session('UPPER', ['elevacion-lateral-mancuernas', 'gemelos-de-pie']))).toBe('FULL_BODY');
  expect(sessionPresentationFocus(session('FULL_BODY', ['press-banca', 'press-frances']))).toBe('PUSH');
  expect(sessionPresentationFocus(session('FULL_BODY', ['press-banca', 'jalon-al-pecho']))).toBe('UPPER');
  // Lateral delts, core and forearms do not decide push versus pull.
  expect(sessionPresentationFocus(session('PULL', ['jalon-al-pecho', 'elevacion-lateral-mancuernas', 'crunch-polea']))).toBe('PULL');
  expect(sessionPresentationFocus(session('PUSH', ['elevacion-lateral-mancuernas']))).toBe('UPPER');
  expect(sessionPresentationFocus(session('FULL_BODY', []))).toBe('FULL_BODY');
  expect(sessionPresentationFocus(session('LOWER', ['crunch-polea']))).toBe('LOWER');
});

it('renames saved sessions from their exercises and ignores unknown ids', () => {
  const byId = new Map(EXERCISE_CATALOGUE.map((e) => [e.id, e]));
  const saved = toPlannedSession(session('UPPER', ['press-banca', 'jalon-al-pecho', 'sentadilla-libre']));
  expect(plannedPresentationFocus({ ...saved, focus: 'UPPER' }, byId)).toBe('FULL_BODY');
  const unknown = { ...saved, focus: 'PUSH' as const, exercises: [{ ...saved.exercises[0], exerciseId: 'deleted-exercise' }] };
  expect(plannedPresentationFocus(unknown, byId)).toBe('PUSH');
});
