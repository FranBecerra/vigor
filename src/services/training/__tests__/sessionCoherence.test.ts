import { ExperienceLevel, MuscleGroup } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { reviewSessionCoherence, sessionPresentationFocus } from '../sessionCoherence';
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
it('fixes impossible labels in preview/persistence without moving sets or changing strength', () => {
  const upperOnly = session('LOWER', ['remo-con-barra', 'curl-barra']);
  expect(sessionPresentationFocus(upperOnly)).toBe('UPPER');
  const planned = toPlannedSession(upperOnly);
  expect(planned.focus).toBe('UPPER');
  expect(planned.exercises.map((e) => e.exerciseId)).toEqual(['remo-con-barra', 'curl-barra']);
  expect(planned.exercises.map((e) => e.sets.length)).toEqual([3, 3]);
  expect(toPlannedSession(upperOnly, TrainingGoal.STRENGTH).focus).toBe('LOWER');
  expect(sessionPresentationFocus(session('PUSH', ['sentadilla-libre']))).toBe('LOWER');
  expect(sessionPresentationFocus(session('UPPER', ['sentadilla-libre']))).toBe('LOWER');
  expect(sessionPresentationFocus(session('LOWER', ['sentadilla-libre', 'press-banca']))).toBe('LOWER');
  expect(sessionPresentationFocus(session('PUSH', ['sentadilla-libre', 'press-banca']))).toBe('PUSH');
  expect(sessionPresentationFocus(session('FULL_BODY', []))).toBe('FULL_BODY');
  expect(sessionPresentationFocus(session('LOWER', ['crunch-polea']))).toBe('LOWER');
});
