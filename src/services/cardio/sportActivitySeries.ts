import type { SportActivity, SportActivityDraft, SportActivitySeries } from '@/models/sportActivity';
import { saveSportDraft, validSportActivity, validSportIdentity, validSportTimeZone } from './sportActivities';
import { MAX_SPORT_OCCURRENCES, previewSportRecurrence, validSportRepeatRule } from './sportRecurrence';

export function createSportActivitySeries(id: string, owner: string, draft: SportActivityDraft, now: number): SportActivitySeries {
  if (!validSportIdentity(id) || id.length > 120 || !draft?.repeat || draft.mode !== 'PLAN'
    || !Number.isSafeInteger(now) || now <= 0 || now > 8.64e15) throw Error('invalidSportRecurrence');
  const preview = previewSportRecurrence(draft.startAt, draft.timeZone, draft.repeat);
  const { repeat, ...single } = draft;
  const occurrences = Object.fromEntries(preview.starts.map((startAt, index) => [String(index), {
    ...saveSportDraft(`${id}~${index}`, owner, { ...single, startAt }, now),
    occurrence: { seriesId: id, index, originalStartAt: startAt },
  }]));
  return { schemaVersion: 2, id, userId: owner, rule: JSON.parse(JSON.stringify(repeat)),
    anchorStartAt: draft.startAt, timeZone: draft.timeZone, createdAt: now, occurrences };
}

export function validSportActivitySeries(value: unknown, owner: string): value is SportActivitySeries {
  if (!value || typeof value !== 'object') return false;
  const series = value as SportActivitySeries;
  if (series.schemaVersion !== 2 || !validSportIdentity(series.id) || series.id.length > 120 || series.userId !== owner
    || !validSportRepeatRule(series.rule) || !validSportTimeZone(series.timeZone)
    || !Number.isSafeInteger(series.createdAt) || series.createdAt <= 0 || !series.occurrences
    || typeof series.occurrences !== 'object' || Array.isArray(series.occurrences)) return false;
  try {
    const starts = previewSportRecurrence(series.anchorStartAt, series.timeZone, series.rule).starts;
    if (Object.keys(series.occurrences).length !== starts.length || starts.length > MAX_SPORT_OCCURRENCES) return false;
    return starts.every((startAt, index) => {
      const entry = series.occurrences[String(index)];
      return Object.prototype.hasOwnProperty.call(series.occurrences, String(index))
        && validSportActivity(entry, owner) && entry.occurrence?.seriesId === series.id && entry.occurrence.index === index
        && entry.occurrence.originalStartAt === startAt && entry.createdAt === series.createdAt;
    });
  } catch { return false; }
}

/** Invalid documents are reported, never partly exposed as a convincing empty calendar. */
export function sportDocumentEntries(value: unknown, owner: string): SportActivity[] | null {
  if (validSportActivity(value, owner)) return [value];
  return validSportActivitySeries(value, owner) ? Object.values(value.occurrences) : null;
}
