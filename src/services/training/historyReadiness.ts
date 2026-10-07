/** Observed-load recency policy; it does not estimate personal MEV/MRV or recovery. */
import { SetType, type Timestampish, type WorkoutSession } from '@/models';
import { e1RMByExerciseFromHistory } from './e1rmHistory';

const WINDOW_MS = 42 * 24 * 60 * 60 * 1000;
export interface ExerciseHistoryReadiness {
  exerciseId: string;
  status: 'provisional' | 'repeated-observations';
  recentExposures: number;
  exposuresWithLoggedEffort: number;
  newestAt: number;
  estimate: number;
}
function timestampMs(value: Timestampish | undefined): number | undefined {
  if (value === undefined) return undefined;
  const result = typeof value === 'number' ? value : value.seconds * 1000 + value.nanoseconds / 1e6;
  return Number.isFinite(result) ? result : undefined;
}

/**
 * Use the latest three distinct completed exposures, within six weeks.
 * One/two exposures use the newest estimate; three use the median session best.
 * Window/sample size are conservative product defaults, not biological cutoffs.
 * Logged effort is reported separately: missing RIR is never treated as failure.
 */
export function exerciseHistoryReadiness(sessions: readonly WorkoutSession[], now: number): ExerciseHistoryReadiness[] {
  if (!Number.isFinite(now)) throw new RangeError('Invalid history reference time');
  const seen = new Set<string>();
  const observations = new Map<string, { at: number; estimate: number; effort: boolean }[]>();
  const ordered = [...sessions].sort((a, b) => (timestampMs(b.completedAt) ?? -Infinity) - (timestampMs(a.completedAt) ?? -Infinity));
  for (const session of ordered) {
    const at = timestampMs(session.completedAt);
    if (seen.has(session.id) || at === undefined || at > now || at < now - WINDOW_MS) continue;
    seen.add(session.id);
    for (const [exerciseId, estimate] of e1RMByExerciseFromHistory([session])) {
      const effort = session.exercises.filter((exercise) => exercise.exerciseId === exerciseId)
        .some((exercise) => exercise.sets.some((set) => set.setType !== SetType.WARMUP
          && typeof set.actualRIR === 'number' && Number.isFinite(set.actualRIR) && set.actualRIR >= 0 && set.actualRIR <= 5
          && typeof set.actualWeight === 'number' && set.actualWeight > 0 && Number.isFinite(set.actualWeight)
          && Number.isInteger(set.actualReps) && set.actualReps! >= 1 && set.actualReps! <= 12));
      const entries = observations.get(exerciseId) ?? [];
      entries.push({ at, estimate, effort }); observations.set(exerciseId, entries);
    }
  }
  return [...observations].map(([exerciseId, entries]) => {
    const latest = entries.slice(0, 3);
    return { exerciseId, status: latest.length >= 3 ? 'repeated-observations' as const : 'provisional' as const,
      recentExposures: entries.length, exposuresWithLoggedEffort: entries.filter((entry) => entry.effort).length,
      newestAt: entries[0].at, estimate: latest.length >= 3
        ? latest.map((entry) => entry.estimate).sort((a, b) => a - b)[1] : latest[0].estimate };
  }).sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));
}

export function recentE1RMByExerciseFromHistory(sessions: readonly WorkoutSession[], now: number): ReadonlyMap<string, number> {
  return new Map(exerciseHistoryReadiness(sessions, now).map((entry) => [entry.exerciseId, entry.estimate]));
}
