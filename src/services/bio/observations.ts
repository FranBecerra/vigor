import { SetType, type Exercise, type WorkoutSession, type WorkoutSet } from '@/models';
import { isSetCompleted } from '@/services/training/sessionMapper';
import { epleyE1RM } from '@/services/analytics/e1rm';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { localCheckInDate } from './dailyCheckIn';

function timestampMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value
    && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number'
    && value.nanoseconds >= 0 && value.nanoseconds < 1e9) return value.seconds * 1000 + value.nanoseconds / 1e6;
  return NaN;
}

/** Latest correction wins; a discarded latest copy cannot resurrect an older copy. */
export function ownedBioWorkouts(owner: string, history: readonly WorkoutSession[], now: number): WorkoutSession[] {
  if (!owner || !Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return [];
  const unique = new Map<string, WorkoutSession>();
  for (const session of history) {
    if (session.userId !== owner || !session.id) continue;
    const old = unique.get(session.id);
    const revision = (item: WorkoutSession) => item.editedAt ?? (timestampMillis(item.completedAt) || 0);
    if (!old || revision(session) >= revision(old)) unique.set(session.id, session);
  }
  return [...unique.values()].filter((session) => {
    const start = timestampMillis(session.performedAt), end = timestampMillis(session.completedAt!);
    return session.discardedAt === undefined && session.completedAt !== undefined && Array.isArray(session.exercises)
      && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start && end <= now
      && session.exercises.every((entry) => entry && typeof entry.exerciseId === 'string' && !!entry.exerciseId
        && Number.isInteger(entry.order) && entry.order >= 0 && Array.isArray(entry.sets)
        && entry.sets.every((set) => set && Object.values(SetType).includes(set.setType)
          && (set.extensions === undefined || Array.isArray(set.extensions) && set.extensions.every((extra) => extra && typeof extra === 'object'))));
  }).sort((a, b) => timestampMillis(a.completedAt!) - timestampMillis(b.completedAt!) || a.id.localeCompare(b.id));
}

export interface BioPerformancePoint {
  workoutId: string; at: number; weight: number; reps: number; estimate: number; rir: number | null;
}
export interface BioPerformanceSeries {
  key: string; exerciseId: string; exercise?: Exercise; comparableEffort: boolean;
  recordingLoad: 'TOTAL_KG' | 'PER_HAND_KG'; points: BioPerformancePoint[];
}

function reportedEffort(set: WorkoutSet): number | null {
  if (set.setType === SetType.FAILURE && set.actualRIRSource === 'FAILURE') return 0;
  return set.actualRIRSource === 'ATHLETE' && typeof set.actualRIR === 'number' && Number.isFinite(set.actualRIR)
    && set.actualRIR >= 0 && set.actualRIR <= 5 ? set.actualRIR : null;
}

/** Observed main sets only. Unknown effort is a separate descriptive series. */
export function bioPerformanceSeries(owner: string, history: readonly WorkoutSession[], catalogue: ReadonlyMap<string, Exercise>, now: number): BioPerformanceSeries[] {
  const series = new Map<string, BioPerformanceSeries>();
  for (const session of ownedBioWorkouts(owner, history, now)) {
    const ordered = [...session.exercises].sort((a, b) => a.order - b.order);
    for (const entry of ordered) {
      const exercise = entry.exerciseSnapshot ?? catalogue.get(entry.exerciseId);
      for (const set of entry.sets) {
        const mode = set.recording ?? exercise?.recording ?? { measure: 'REPETITIONS', load: 'TOTAL_KG' };
        if (!isSetCompleted({ ...set, recording: mode }) || mode.measure !== 'REPETITIONS'
          || !['TOTAL_KG', 'PER_HAND_KG'].includes(mode.load)
          || ![SetType.NORMAL, SetType.FAILURE].includes(set.setType)
          || (set.extensions?.length ?? 0) > 0 || (set.actualPartialReps ?? 0) > 0
          || !Number.isFinite(set.actualWeight) || set.actualWeight! <= 0 || set.actualWeight! > 10000
          || !Number.isInteger(set.actualReps) || set.actualReps! < 1 || set.actualReps! > 12) continue;
        const rir = reportedEffort(set);
        // Setup identity is bounded to recorded fields. Missing snapshots stay distinct.
        const setup = entry.exerciseSnapshot ? JSON.stringify([exercise?.equipment, exercise?.laterality,
          exercise?.stimulusTags?.slice().sort(), exercise?.requiredApparatus?.slice().sort()]) : 'UNRECORDED_SETUP';
        const group = session.supersets?.[entry.exerciseId];
        const partners = group ? Object.entries(session.supersets ?? {}).filter(([, value]) => value === group).map(([id]) => id).sort() : [];
        const key = JSON.stringify([entry.exerciseId, mode.load, setup, set.setType, rir,
          ordered.filter((item) => item.order < entry.order).map((item) => item.exerciseId), partners]);
        const current = series.get(key) ?? { key, exerciseId: entry.exerciseId, exercise,
          comparableEffort: rir !== null && rir < 5 && !!entry.exerciseSnapshot, recordingLoad: mode.load as 'TOTAL_KG' | 'PER_HAND_KG', points: [] };
        const point = { workoutId: session.id, at: timestampMillis(session.completedAt!), weight: set.actualWeight!,
          reps: set.actualReps!, estimate: epleyE1RM(set.actualWeight!, set.actualReps!), rir };
        const previous = current.points.findIndex((item) => item.workoutId === session.id);
        if (previous < 0) current.points.push(point);
        else if (point.estimate > current.points[previous].estimate) current.points[previous] = point;
        series.set(key, current);
      }
    }
  }
  return [...series.values()].sort((a, b) => b.points.at(-1)!.at - a.points.at(-1)!.at || a.key.localeCompare(b.key));
}

export type BioGranularity = 'DAY' | 'SESSION' | 'MICROCYCLE' | 'MESOCYCLE';
export interface BioExposureRow {
  id: string; date: string; from: number; to: number; workouts: number; sets: number; minutes: number;
  muscles: { muscle: string; sets: number }[];
}
/** Actual exposure at calendar/session/cycle/block granularity; never a seven-day normalization. */
export function bioExposureRows(owner: string, history: readonly WorkoutSession[], catalogue: ReadonlyMap<string, Exercise>,
  now: number, granularity: BioGranularity): BioExposureRow[] {
  const rows = new Map<string, BioExposureRow>();
  for (const session of ownedBioWorkouts(owner, history, now)) {
    const at = timestampMillis(session.completedAt!), from = timestampMillis(session.performedAt), date = localCheckInDate(at);
    const id = granularity === 'DAY' ? date : granularity === 'SESSION' ? session.id
      : granularity === 'MICROCYCLE' ? `${session.mesocycleId}:${session.microcycleIndex}` : session.mesocycleId;
    const details = workoutHistoryDetails(session, catalogue);
    const row = rows.get(id) ?? { id, date, from, to: at, workouts: 0, sets: 0, minutes: 0, muscles: [] };
    row.from = Math.min(row.from, from); row.to = Math.max(row.to, at);
    row.workouts++; row.sets += details.working; row.minutes += details.durationSeconds ?? 0;
    const volumes = new Map(row.muscles.map((entry) => [entry.muscle, entry.sets]));
    for (const entry of details.volumes) volumes.set(entry.muscle, (volumes.get(entry.muscle) ?? 0) + entry.sets);
    row.muscles = [...volumes].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => a.muscle.localeCompare(b.muscle));
    rows.set(id, row);
  }
  return [...rows.values()].map((row) => ({ ...row, minutes: Math.round(row.minutes / 60) })).sort((a, b) => b.to - a.to || a.id.localeCompare(b.id));
}
