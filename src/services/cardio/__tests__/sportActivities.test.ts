import { discardSportActivity, saveSportDraft, sportActivityMinutes, sportActivityStart, sportDraft, validSportActivity, validSportIdentity, validSportTimeZone } from '../sportActivities';
import type { SportActivityDraft } from '@/models/sportActivity';
import { SESSION_EFFORT_SCALE } from '@/services/training/sessionFeedback';

const now = Date.UTC(2026, 9, 28, 12);
const draft = (patch: Partial<SportActivityDraft> = {}): SportActivityDraft => ({ sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'RECORD',
  startAt: now - 3600000, durationMinutes: 60, timeZone: 'Europe/Madrid', effort: null, ...patch });
const create = (patch: Partial<SportActivityDraft> = {}) => saveSportDraft('activity', 'owner', draft(patch), now);

it('keeps an unplanned actual record independent of plans and never invents sensor data or effort', () => {
  const record = create();
  expect(record).toMatchObject({ planned: null, record: { source: 'MANUAL', feedback: null }, revision: 1, discardedAt: null });
  expect(sportActivityStart(record)).toBe(now - 3600000); expect(sportActivityMinutes(record)).toBe(60);
  expect(JSON.stringify(record)).not.toMatch(/heartRate|zone|calorie/);
  expect(validSportActivity(record, 'owner')).toBe(true); expect(validSportActivity(record, 'other')).toBe(false);
});
it('does not complete a past reservation and preserves its original timing when actual duration/effort differ', () => {
  const planned = create({ mode: 'PLAN', startAt: now - 7200000 });
  expect(planned.record).toBeNull(); expect(sportActivityStart(planned)).toBe(now - 7200000); expect(sportActivityMinutes(planned)).toBe(60);
  const done = saveSportDraft(planned.id, 'owner', draft({ durationMinutes: 45, effort: 8 }), now, planned);
  expect(done.planned).toEqual(planned.planned); expect(done.record?.durationMinutes).toBe(45);
  expect(done.record?.feedback).toMatchObject({ effort: 8, timing: 'MANUAL_ENTRY', recordedAt: now });
  const edited = saveSportDraft(done.id, 'owner', draft({ effort: 6, durationMinutes: 40, name: '  Football  ', notes: '  Local match  ' }), now + 1000, done);
  expect(edited).toMatchObject({ createdAt: now, updatedAt: now + 1000, revision: 3, name: 'Football', notes: 'Local match' });
  expect(edited.record?.feedback).toMatchObject({ effort: 6, timing: 'HISTORY_EDIT', revisions: [{ effort: 8, timing: 'MANUAL_ENTRY' }] });
  const cleared = saveSportDraft(edited.id, 'owner', draft(), now + 2000, edited);
  expect(cleared.record?.feedback?.effort).toBeNull(); expect(cleared.record?.feedback?.revisions).toHaveLength(2);
});
it('edits plans without inventing actual exposure and preserves the original creation date', () => {
  const planned = create({ mode: 'PLAN', startAt: now + 86400000 });
  const moved = saveSportDraft(planned.id, 'owner', draft({ mode: 'PLAN', startAt: now + 172800000, durationMinutes: 90 }), now + 1, planned);
  expect(moved).toMatchObject({ createdAt: now, revision: 2, record: null, planned: { startAt: now + 172800000, durationMinutes: 90 } });
});
it('retains actual history in a recoverable discard marker rather than deleting prescriptions', () => {
  const original = create(); const discarded = discardSportActivity(original, 'owner', now + 1);
  expect(discarded).toMatchObject({ discardedAt: now + 1, revision: 2 }); expect(discarded.record).toEqual(original.record);
  expect(validSportActivity(discarded, 'owner')).toBe(true);
  for (const [item, owner, date] of [[original, 'other', now], [original, 'owner', now - 1], [original, 'owner', NaN], [discarded, 'owner', now + 2]] as const)
    expect(() => discardSportActivity(item, owner, date)).toThrow();
  const exhausted = { ...original, revision: Number.MAX_SAFE_INTEGER };
  expect(() => discardSportActivity(exhausted, 'owner', now + 1)).toThrow();
  expect(() => saveSportDraft(exhausted.id, 'owner', draft(), now + 1, exhausted)).toThrow();
});
it('builds independent editable drafts with optional feedback and appropriate defaults', () => {
  expect(sportDraft(null, 'PLAN', now, 'UTC')).toMatchObject({ startAt: now + 86400000, durationMinutes: 60, timeZone: 'UTC', effort: null });
  expect(sportDraft(null, 'RECORD', now, 'UTC').startAt).toBe(now - 3600000);
  const planned = create({ mode: 'PLAN', effort: null });
  expect(sportDraft(planned, 'PLAN', now, 'UTC').timeZone).toBe('Europe/Madrid');
  expect(sportDraft(planned, 'RECORD', now, 'UTC').startAt).toBe(planned.planned!.startAt);
  const done = create({ effort: 5 }); expect(sportDraft(done, 'RECORD', now, 'UTC').effort).toBe(5);
  const snapshot = JSON.stringify(done); sportDraft(done, 'RECORD', now, 'UTC').notes = 'Changed'; expect(JSON.stringify(done)).toBe(snapshot);
});
it.each([null, {}, { schemaVersion: 2 }, { sport: 'BAD' }, { context: 'BAD' }, { userId: 'other' }, { id: '../invalid' }, { name: ' x ' }, { name: 'x'.repeat(81) }, { notes: null }, { notes: 'x'.repeat(2001) },
  { createdAt: 0 }, { updatedAt: now - 1 }, { revision: 0 }, { revision: 1.5 }, { discardedAt: 0 }, { discardedAt: now - 1 }, { discardedAt: now + 1 }, { planned: {} }, { planned: null, record: null },
  { planned: undefined }, { planned: 1 }, { record: {} }, { record: undefined }, { record: { ...create().record, source: 'HEALTHKIT' } }, { record: { ...create().record, startAt: now } },
  { record: { ...create().record, feedback: { scale: 'UNKNOWN', effort: 5, recordedAt: now, timing: 'AT_FINISH' } } },
  { record: { ...create().record, feedback: { scale: SESSION_EFFORT_SCALE, effort: 11, recordedAt: now, timing: 'AT_FINISH' } } },
  { record: { ...create().record, feedback: { scale: SESSION_EFFORT_SCALE, effort: null, recordedAt: 0, timing: 'AT_FINISH' } } },
  { record: { ...create().record, feedback: { scale: SESSION_EFFORT_SCALE, effort: null, recordedAt: now, timing: 'BAD' } } },
])('rejects malformed or foreign stored activity %p', patch => {
  const value = patch === null ? null : Object.keys(patch).length === 0 ? {} : { ...create(), ...patch };
  expect(validSportActivity(value, 'owner')).toBe(false);
});
it.each([{ mode: 'INVALID' }, { durationMinutes: 0 }, { durationMinutes: 1441 }, { durationMinutes: NaN }, { startAt: -1 }, { startAt: Infinity }, { timeZone: 'Bad/Zone' },
  { timeZone: '' }, { timeZone: 'x'.repeat(101) }, { sport: 'OTHER', name: '' }, { name: null }, { notes: null }, { effort: 0 }, { effort: 2.5 }, { startAt: now },
])('rejects invalid input without saving an estimate as a measured record %p', patch => {
  expect(() => create(patch as Partial<SportActivityDraft>)).toThrow();
});
it('refuses stale, foreign and discarded originals or reversing performed work to a plan', () => {
  const original = create();
  expect(() => saveSportDraft('activity', 'owner', null as any, now)).toThrow();
  for (const [id, owner, date, previous] of [['other', 'owner', now, original], ['activity', 'foreign', now, original], ['activity', 'owner', now - 1, original],
    ['activity', 'owner', now + 2, discardSportActivity(original, 'owner', now + 1)]] as const)
    expect(() => saveSportDraft(id, owner, draft(), date, previous)).toThrow();
  expect(() => saveSportDraft('activity', 'owner', draft({ mode: 'PLAN' }), now, original)).toThrow();
  expect(() => saveSportDraft('bad/id', 'owner', draft(), now)).toThrow();
  expect(() => saveSportDraft('activity', '', draft(), now)).toThrow(); expect(() => saveSportDraft('activity', 'owner', draft(), NaN)).toThrow();
});
it.each([null, '', ' ', '.', '..', 'a/b', 'x'.repeat(129)])('rejects unsafe identities %p', value => expect(validSportIdentity(value)).toBe(false));
it('accepts a valid zone and rejects malformed zone data without crashing', () => {
  expect(validSportIdentity('owner-123')).toBe(true); expect(validSportTimeZone('UTC')).toBe(true);
  expect(validSportTimeZone(null)).toBe(false); expect(validSportActivity(create(), '')).toBe(false);
});
