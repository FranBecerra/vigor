import type { Mesocycle } from '@/models';

/** Explicit plan-only override; no kg, RIR, performed work or session identity changes. */
export function changeExerciseRest(meso: Mesocycle, owner: string, exerciseId: string, seconds: number) {
  if (meso.userId !== owner || !exerciseId.trim() || !Number.isInteger(seconds) || seconds < 0 || seconds > 3600) throw Error('invalidRestPrescription');
  const sessionOverrides = meso.sessionOverrides ? Object.fromEntries(Object.entries(meso.sessionOverrides).map(([key, session]) =>
    [key, { ...session, exercises: session.exercises.map((exercise) => exercise.exerciseId === exerciseId
      ? { ...exercise, restSeconds: seconds } : exercise) }])) : undefined;
  return { exerciseRestOverrides: { ...meso.exerciseRestOverrides, [exerciseId]: seconds },
    ...(sessionOverrides ? { sessionOverrides } : {}) };
}
