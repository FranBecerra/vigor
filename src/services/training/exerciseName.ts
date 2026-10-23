import type { Exercise } from '@/models';
import englishNames from '@/data/exercise-names-en.json';
import { EXERCISE_CATALOGUE } from './exerciseCatalogue';

const canonical = new Map(EXERCISE_CATALOGUE.map((exercise) => [exercise.id, exercise.name]));
/** Presentation only: never translate authored names or mutate stored snapshots/identities. */
export function exerciseName(exercise: Pick<Exercise, 'id' | 'name'> | undefined | null, language: string): string {
  if (!exercise) return '';
  if (language.split(/[-_]/)[0].toLowerCase() !== 'en' || exercise.name !== canonical.get(exercise.id)) return exercise.name;
  return (englishNames as Record<string, string>)[exercise.id] ?? exercise.name;
}
