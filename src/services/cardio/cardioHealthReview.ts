import { HEALTH_CARDIO_KINDS, type CardioHealthRead, type CardioHealthWorkout } from '@/models/cardioHealth';

export const CARDIO_HEALTH_DAYS = 42;
export const CARDIO_HEALTH_CAP = 1000;
const day = 86400000;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 512;
const optionalId = (v: unknown) => v === undefined || text(v);

export function cardioHealthWindow(now: number) {
  if (!finite(now) || now <= CARDIO_HEALTH_DAYS * day) throw Error('invalidCardioHealthWindow');
  return { start: now - CARDIO_HEALTH_DAYS * day, end: now };
}
function validWorkout(v: CardioHealthWorkout, start: number, end: number) {
  return !!v && text(v.id) && HEALTH_CARDIO_KINDS.includes(v.kind) && finite(v.start) && finite(v.end)
    && v.start >= start && v.end <= end && v.end > v.start && finite(v.durationSeconds) && v.durationSeconds > 0
    && v.durationSeconds * 1000 <= v.end - v.start + 1000
    && (v.distanceMetres === undefined || finite(v.distanceMetres) && v.distanceMetres >= 0 && v.distanceMetres <= 1_000_000)
    && text(v.sourceId) && text(v.sourceName) && typeof v.manuallyEntered === 'boolean'
    && typeof v.ownExport === 'boolean' && typeof v.mixedActivities === 'boolean' && optionalId(v.externalId);
}
const sameExposure = (a: CardioHealthWorkout, b: CardioHealthWorkout) => a.kind === b.kind && a.start === b.start && a.end === b.end
  && a.durationSeconds === b.durationSeconds && a.distanceMetres === b.distanceMetres;

/** Recorded volume only: not current tolerance, adherence, intensity or a starting-dose recommendation. */
export function reviewCardioHealth(raw: unknown, now: number, sourceId?: string, excludedIds: readonly string[] = []) {
  const window = cardioHealthWindow(now), data = raw as CardioHealthRead;
  if (!data || data.version !== 1 || typeof data.truncated !== 'boolean' || !Array.isArray(data.workouts)
    || data.workouts.length > CARDIO_HEALTH_CAP || data.earliestAllowedStart !== undefined
      && (!finite(data.earliestAllowedStart) || data.earliestAllowedStart <= 0 || data.earliestAllowedStart > now)) throw Error('invalidCardioHealthRead');
  // A capped query is not a valid complete window. Do not summarize its newest subset as a baseline.
  const observations = data.truncated ? [] : data.workouts;
  let invalidCount = 0, duplicateCount = 0, ownCount = 0;
  const unique = new Map<string, CardioHealthWorkout>(), conflictingIds = new Set<string>();
  for (const value of observations) {
    if (!validWorkout(value, window.start, window.end)) { invalidCount++; continue; }
    if (value.ownExport) { ownCount++; continue; }
    const v: CardioHealthWorkout = { id: value.id, kind: value.kind, start: value.start, end: value.end,
      durationSeconds: value.durationSeconds, sourceId: value.sourceId, sourceName: value.sourceName,
      manuallyEntered: value.manuallyEntered, ownExport: false, mixedActivities: value.mixedActivities,
      ...(value.distanceMetres === undefined ? {} : { distanceMetres: value.distanceMetres }),
      ...(value.externalId === undefined ? {} : { externalId: value.externalId }) };
    const previous = unique.get(v.id);
    if (previous) {
      if (sameExposure(previous, v) && previous.sourceId === v.sourceId && previous.manuallyEntered === v.manuallyEntered && previous.mixedActivities === v.mixedActivities) duplicateCount++;
      else conflictingIds.add(v.id);
    } else unique.set(v.id, v);
  }
  const sources = [...new Map([...unique.values()].filter(v => !conflictingIds.has(v.id)).map(v => [v.sourceId, { id: v.sourceId, name: v.sourceName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const rows: CardioHealthWorkout[] = [], external = new Map<string, CardioHealthWorkout>();
  for (const v of [...unique.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (conflictingIds.has(v.id) || sourceId !== undefined && v.sourceId !== sourceId) continue;
    // Only explicit shared identity plus exactly matching measurements deduplicate across sources.
    const key = v.externalId && JSON.stringify([v.externalId, v.kind, v.start, v.end, v.durationSeconds, v.distanceMetres, v.manuallyEntered, v.mixedActivities]);
    if (key && external.has(key)) { duplicateCount++; continue; }
    if (key) external.set(key, v);
    rows.push(v);
  }
  const excluded = new Set(excludedIds);
  const eligible = rows.filter(v => !v.manuallyEntered && !v.mixedActivities && !excluded.has(v.id));
  const overlapping = new Set<string>();
  // Never guess which source is authoritative. Selection/exclusion can resolve a potential duplicate.
  for (let i = 0; i < eligible.length; i++) for (let j = i + 1; j < eligible.length; j++) {
    const a = eligible[i], b = eligible[j];
    if (a.start < b.end && b.start < a.end) { overlapping.add(a.id); overlapping.add(b.id); }
  }
  const counted = eligible.filter(v => !overlapping.has(v.id));
  const groups = HEALTH_CARDIO_KINDS.flatMap(kind => {
    const workouts = counted.filter(v => v.kind === kind);
    if (!workouts.length) return [];
    const distances = workouts.filter(v => v.distanceMetres !== undefined);
    return [{ kind, sessions: workouts.length, minutes: workouts.reduce((n, v) => n + v.durationSeconds / 60, 0),
      observedSessionsPerWeek: workouts.length / (CARDIO_HEALTH_DAYS / 7),
      distanceMetres: distances.length ? distances.reduce((n, v) => n + v.distanceMetres!, 0) : null,
      distanceSessions: distances.length, longestMinutes: Math.max(...workouts.map(v => v.durationSeconds / 60)) }];
  });
  return { ...window, truncated: data.truncated, limited: data.earliestAllowedStart !== undefined && data.earliestAllowedStart > window.start,
    invalidCount, conflictingCount: conflictingIds.size, duplicateCount, ownCount, sources,
    rows: rows.sort((a, b) => b.start - a.start || a.id.localeCompare(b.id)), groups,
    overlappingIds: [...overlapping].sort(), excludedIds: [...excluded],
    manualCount: rows.filter(v => v.manuallyEntered).length, mixedCount: rows.filter(v => v.mixedActivities).length,
    countedCount: counted.length, canConfirm: !data.truncated && invalidCount === 0 && conflictingIds.size === 0 && !overlapping.size && counted.length > 0 };
}
export type CardioHealthReview = ReturnType<typeof reviewCardioHealth>;
