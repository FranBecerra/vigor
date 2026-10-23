import type { SessionDistribution } from './sessionDistribution';
import { focusAcceptsMuscle } from './sessionDistribution';
import { MuscleGroup, SplitStructure } from '@/models';

const neutral = new Set([MuscleGroup.CORE, MuscleGroup.ERECTORS, MuscleGroup.NECK, MuscleGroup.FOREARMS]);
/** Product definition of a light spillover, not a physiological recovery threshold. */
export function splitAdherence(distribution: Pick<SessionDistribution, 'requestedSplit' | 'sessions'>) {
  const sessions = distribution.requestedSplit === SplitStructure.AUTO ? [] : distribution.sessions.flatMap((session) => {
    const outside = session.exercises.filter((entry) => !neutral.has(entry.exercise.primaryMuscle)
      && !focusAcceptsMuscle(session.focus, entry.exercise.primaryMuscle));
    if (!outside.length) return [];
    const total = session.exercises.reduce((sum, entry) => sum + entry.sets, 0);
    const sets = outside.reduce((sum, entry) => sum + entry.sets, 0);
    return [{ index: session.index, focus: session.focus, exercises: outside.map((entry) => entry.exercise.id), sets, total,
      light: outside.length <= 2 && sets <= total * 0.25 }];
  });
  return { sessions, light: sessions.every((session) => session.light),
    penalty: sessions.reduce((sum, session) => sum + session.sets + (session.light ? 0 : 30), 0) };
}
