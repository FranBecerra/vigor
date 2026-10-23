import { exerciseName } from '../exerciseName';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import names from '@/data/exercise-names-en.json';
import { searchExercises } from '../exerciseSearch';
it('has a nonempty explicit English display name for every shared exercise, without stale IDs', () => {
  expect(Object.keys(names).sort()).toEqual(EXERCISE_CATALOGUE.map((exercise) => exercise.id).sort());
  for (const exercise of EXERCISE_CATALOGUE) expect(exerciseName(exercise, 'en-GB')).toBe((names as Record<string, string>)[exercise.id]);
});
it('changes presentation only, preserving authored/custom names, Spanish and unknown metadata', () => {
  const ex = EXERCISE_CATALOGUE[0];
  expect(exerciseName(ex, 'EN_us')).toBe('Barbell bench press');
  expect(exerciseName(ex, 'es-ES')).toBe(ex.name);
  expect(exerciseName(ex, 'fr')).toBe(ex.name);
  expect(exerciseName({ ...ex, name: 'My own setup' }, 'en')).toBe('My own setup');
  expect(exerciseName({ id: 'custom:owner:id', name: 'Mi ejercicio' }, 'en')).toBe('Mi ejercicio');
  expect(exerciseName(undefined, 'en')).toBe(''); expect(exerciseName(null, 'en')).toBe('');
  expect(ex.name).toBe('Press de banca');
});
it('finds fully translated names while retaining Spanish keywords', () => {
  expect(searchExercises('Romanian', EXERCISE_CATALOGUE, (muscle) => muscle).some((exercise) => exercise.id === 'peso-muerto-rumano')).toBe(true);
  expect(searchExercises('pec deck', EXERCISE_CATALOGUE, (muscle) => muscle).some((exercise) => exercise.id === 'pec-deck')).toBe(true);
  expect(searchExercises('peso muerto', EXERCISE_CATALOGUE, (muscle) => muscle).some((exercise) => exercise.id === 'peso-muerto-rumano')).toBe(true);
});
