import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
import type { CardioBlock, CardioCycleResponses, CardioWorkout } from '@/models/cardioTraining';
import { confirmCardioCycle, reviewCardioCycle, withCardioProgression } from '../cardioProgression';
import { cardioCycleDoses, cardioSlotPrescription, nextEasyDurations, validCardioProgression } from '../cardioProgressionPolicy';
import { createCardioBlock, validCardioBlock, coordinateCardioBlock, changeCardioSlot } from '../cardioBlock';
import { startCardioWorkout, transitionCardioWorkout } from '../cardioWorkout';
import { saveSportDraft } from '../sportActivities';
import * as blockValidation from '../cardioBlock';

const yes: CardioCycleResponses = { easy: 'YES', recovered: 'YES', symptoms: 'NONE' };
const unknown: CardioCycleResponses = { easy: 'UNKNOWN', recovered: 'UNKNOWN', symptoms: 'UNKNOWN' };
const later = now + 8 * 86400000;
const make = (cycleDays = 8, regular = false) => {
  const base = cardioFixture({ cycleDays, availableDays: Array.from({ length: cycleDays }, (_, i) => i), cardioMinutes: 120, sessionMinutes: 40,
    profile: { schemaVersion: 1, modalities: regular ? { RUNNING: { status: 'REGULAR', typicalSessionMinutes: 20, qualityExposure: 'UNKNOWN' } } : {} } });
  return withCardioProgression(createCardioBlock(base.id, base.proposal, base.startDate, 4, base.timeZone, now));
};
const done = (b: CardioBlock, effort: number | null = 3): CardioWorkout[] => b.slots.filter(s => s.cycle === 0).map((slot, i) => {
  const run = startCardioWorkout(b, slot.id, now, `run-${i}`);
  return transitionCardioWorkout(run, 'FINISH', now + 3600000, run.prescription.durationSeconds, effort);
});

it('keeps legacy blocks frozen and gives unknown capacity an adaptation repeat before a provisional increase', () => {
  const legacy = cardioFixture(), before = JSON.stringify(legacy);
  expect(cardioCycleDoses(legacy).map(c => c.seconds)).toEqual([[1200, 1200], [1200, 1200]]);
  expect(cardioCycleDoses(legacy).every(c => c.confirmed)).toBe(true);
  const b = make(); expect(cardioCycleDoses(b).map(c => c.seconds)).toEqual([[1200, 1200], [1200, 1200], [1260, 1260], [1320, 1320]]);
  expect(cardioCycleDoses(b).map(c => c.confirmed)).toEqual([true, false, false, false]);
  expect(cardioCycleDoses(make(8, true))[1].seconds).toEqual([1260, 1260]);
  expect(JSON.stringify(legacy)).toBe(before);
  expect(() => withCardioProgression(b)).toThrow();
  expect(() => withCardioProgression({ ...legacy, revision: 2 })).toThrow();
  expect(() => withCardioProgression(null as any)).toThrow();
});
it.each([7, 8, 10, 31])('uses full %s-day microcycles, not a seven-day conversion or elapsed-24-hour assumption', days => {
  const b = make(days), records = done(b), stamp = now + days * 86400000;
  expect(reviewCardioCycle(b, records, yes, now + (days - 1) * 86400000).ready).toBe(false);
  expect(reviewCardioCycle(b, records, yes, stamp).canIncrease).toBe(true);
});
it('confirms only after explicit acceptance and snapshots actual execution from the confirmed dose', () => {
  const b = make(), records = done(b), original = JSON.stringify([b, records]);
  const review = reviewCardioCycle(b, records, yes, later);
  expect(review).toMatchObject({ ready: true, canIncrease: true, next: [1260, 1260], completed: 2 });
  const future = b.slots.find(s => s.cycle === 2)!;
  expect(cardioSlotPrescription(b, future.id, true).durationSeconds).toBe(1260);
  expect(startCardioWorkout(b, future.id, later, 'future').prescription.durationSeconds).toBe(1200);
  const accepted = confirmCardioCycle(b, records, yes, 'INCREASE', review.fingerprint, later);
  expect(validCardioBlock(accepted, 'owner')).toBe(true); expect(accepted.revision).toBe(2);
  expect(accepted.progression!.reviews[0]).toMatchObject({ cycle: 0, decision: 'INCREASE', responses: yes, nextSeconds: [1260, 1260] });
  expect(cardioCycleDoses(accepted)[1].confirmed).toBe(true);
  expect(startCardioWorkout(accepted, accepted.slots[2].id, later, 'next').prescription.durationSeconds).toBe(1260);
  expect(startCardioWorkout(accepted, accepted.slots[2].id, later, 'next').prescription.policy).toBe('REVIEWED_EASY_DURATION_V1');
  const p = cardioSlotPrescription(accepted, accepted.slots[2].id);
  expect(p.segments.reduce((n, s) => n + s.durationSeconds, 0)).toBe(p.durationSeconds);
  p.segments[0].effort.min = 99; expect(accepted.proposal.preview.prescriptions[0].segments[0].effort.min).toBe(1);
  expect(JSON.stringify([b, records])).toBe(original);
  expect(() => cardioSlotPrescription(b, 'missing')).toThrow();
});
it('keeps unknown, difficult, symptomatic, incomplete, replaced and duplicated exposures from authorizing an increase', () => {
  const b = make(), records = done(b);
  expect(reviewCardioCycle(b, records, unknown, later).reasons).toContain('UNKNOWN');
  for (const responses of [{ ...yes, easy: 'NO' }, { ...yes, recovered: 'NO' }, { ...yes, symptoms: 'PRESENT' }]) {
    const review = reviewCardioCycle(b, records, responses as CardioCycleResponses, later);
    expect(review.canIncrease).toBe(false); expect(review.ready).toBe(true);
    expect(() => confirmCardioCycle(b, records, responses as CardioCycleResponses, 'INCREASE', review.fingerprint, later)).toThrow();
  }
  expect(reviewCardioCycle(b, done(b, 5), yes, later).reasons).toContain('DIFFICULT');
  expect(reviewCardioCycle(b, done(b, null), yes, later).canIncrease).toBe(true); // Explicit cycle response, never fabricated per-session effort.
  for (const rs of [[], records.slice(1), [...records, { ...records[0], id: 'duplicate' }], records.map(w => ({ ...w, actualSeconds: 30 }))]) {
    const r = reviewCardioCycle(b, rs, yes, later); expect(r.reasons).toContain('INCOMPLETE'); expect(r.canIncrease).toBe(false);
  }
  const skipped = changeCardioSlot(b, b.slots[0].id, b.slots[0].date, 'SKIPPED', null, [], now);
  expect(reviewCardioCycle(skipped, records, yes, later).canIncrease).toBe(false);
  const sport = saveSportDraft('padel', 'owner', { sport: 'PADEL', context: 'CLASS', name: '', notes: '', mode: 'RECORD', startAt: now, durationMinutes: 60, timeZone: 'UTC', effort: 3 }, now + 3600000);
  const replaced = changeCardioSlot(b, b.slots[0].id, b.slots[0].date, 'SPORT', sport, [], now + 3600000);
  expect(reviewCardioCycle(replaced, records, yes, later).canIncrease).toBe(false);
  const r = reviewCardioCycle(b, [], unknown, later);
  const repeated = confirmCardioCycle(b, [], unknown, 'REPEAT', r.fingerprint, later);
  expect(cardioCycleDoses(repeated)[1].seconds).toEqual([1200, 1200]);
});
it('protects pending and started sessions, owners, malformed records and stale review sources', () => {
  const b = make(), records = done(b), review = reviewCardioCycle(b, records, yes, later);
  expect(reviewCardioCycle(b, [{ ...records[0], userId: 'other' }, records[1]], yes, later).canIncrease).toBe(false);
  expect(reviewCardioCycle(b, [{ ...records[0], blockId: 'other' }, records[1]], yes, later).canIncrease).toBe(false);
  expect(reviewCardioCycle(b, [{ ...records[0], status: 'DISCARDED' }, records[1]], yes, later).canIncrease).toBe(false);
  const running = startCardioWorkout(b, b.slots[0].id, now, 'running');
  expect(reviewCardioCycle(b, [running], yes, later).ready).toBe(false);
  expect(reviewCardioCycle(b, [{ ...records[0], revision: 0 }], yes, later).ready).toBe(false);
  expect(reviewCardioCycle(b, [{ ...records[0], prescription: null } as any], yes, later).ready).toBe(false);
  expect(reviewCardioCycle(b, [{ ...records[0], updatedAt: later + 1 }], yes, later).ready).toBe(false);
  const future = startCardioWorkout(b, b.slots[2].id, later, 'started');
  expect(reviewCardioCycle(b, [...records, future], yes, later).reasons).toContain('NEXT_STARTED');
  expect(() => confirmCardioCycle(b, [...records, future], yes, 'REPEAT', review.fingerprint, later)).toThrow();
  expect(() => confirmCardioCycle(b, records.map(w => ({ ...w, revision: w.revision + 1 })), yes, 'INCREASE', review.fingerprint, later)).toThrow();
  expect(() => confirmCardioCycle(b, records, yes, 'BAD' as any, review.fingerprint, later)).toThrow();
  expect(() => confirmCardioCycle({ ...b, revision: Number.MAX_SAFE_INTEGER }, records, yes, 'REPEAT', reviewCardioCycle({ ...b, revision: Number.MAX_SAFE_INTEGER }, records, yes, later).fingerprint, later)).toThrow();
  for (const value of [cardioFixture(), { ...b, endedAt: now }, null]) expect(() => reviewCardioCycle(value as any, records, yes, later)).toThrow();
  for (const time of [NaN, Infinity, now - 1, 8.64e15 + 1]) expect(() => reviewCardioCycle(b, records, yes, time)).toThrow();
  expect(() => reviewCardioCycle(b, records, null as any, later)).toThrow();
});
it('observes cycle/session ceilings and explains a repeated dose when no room remains', () => {
  const b = make();
  expect(nextEasyDurations(b, [], true)).toEqual([]);
  expect(nextEasyDurations(b, [2400, 2400], true)).toEqual([2400, 2400]);
  const tight = { ...b, proposal: { ...b.proposal, input: { ...b.proposal.input, cardioMinutes: 40 } } };
  expect(nextEasyDurations(tight, [1200, 1200], true)).toEqual([1200, 1200]);
  const review = reviewCardioCycle(tight, done(tight), yes, later);
  expect(review.reasons).toContain('CAPACITY'); expect(review.canIncrease).toBe(false);
  const partial = { ...b, proposal: { ...b.proposal, input: { ...b.proposal.input, cardioMinutes: 41 } } };
  expect(nextEasyDurations(partial, [1200, 1200], true)).toEqual([1230, 1230]);
  const final = withCardioProgression(createCardioBlock('one', b.proposal, b.startDate, 1, b.timeZone, now));
  expect(reviewCardioCycle(final, [], yes, later).reasons).toContain('NO_FUTURE');
  const lastReview = reviewCardioCycle(final, [], unknown, later);
  const finished = confirmCardioCycle(final, [], unknown, 'REPEAT', lastReview.fingerprint, later);
  expect(finished.progression!.reviews).toHaveLength(1); expect(validCardioBlock(finished, 'owner')).toBe(true);
  expect(() => reviewCardioCycle(finished, [], yes, later)).toThrow();
  expect(validCardioBlock({ ...finished, progression: { ...finished.progression!, reviews: [{ ...finished.progression!.reviews[0], decision: 'INCREASE', responses: yes }] } }, 'owner')).toBe(false);
  const empty = { ...b, slots: [], proposal: { ...b.proposal, preview: { ...b.proposal.preview, scheduled: [], prescriptions: [] } } };
  expect(() => reviewCardioCycle(empty, [], yes, later)).toThrow();
});
it('validates every persisted review, including sparse arrays and optional legacy state', () => {
  const b = make(), records = done(b), review = reviewCardioCycle(b, records, yes, later);
  const accepted = confirmCardioCycle(b, records, yes, 'INCREASE', review.fingerprint, later), p = accepted.progression!, r = p.reviews[0];
  for (const value of [null, {}, { ...p, policy: 'BAD' }, { ...p, reviews: null }, { ...p, reviews: Array(5) }, { ...p, reviews: Array(1) }]) expect(validCardioProgression(value, accepted)).toBe(false);
  for (const patch of [null, { cycle: 2 }, { recordedAt: now - 1 }, { recordedAt: later + 1 }, { recordedAt: NaN }, { responses: null }, { decision: 'BAD' },
    { responses: unknown }, { nextSeconds: null }, { nextSeconds: [] }, { nextSeconds: Array(2) }, { nextSeconds: [9000, 9000] }]) {
    expect(validCardioBlock({ ...accepted, progression: { ...p, reviews: [patch === null ? null : { ...r, ...patch }] } }, 'owner')).toBe(false);
  }
  expect(validCardioBlock({ ...b, progression: null }, 'owner')).toBe(false);
  expect(coordinateCardioBlock(accepted, [], [])).toHaveLength(8);
});

it('rejects a generated update if the final record validator rejects it', () => {
  const b = make(), records = done(b), review = reviewCardioCycle(b, records, yes, later);
  const validate = jest.spyOn(blockValidation, 'validCardioBlock').mockReturnValueOnce(true).mockReturnValueOnce(false);
  try { expect(() => confirmCardioCycle(b, records, yes, 'INCREASE', review.fingerprint, later)).toThrow('invalidCardioReview'); }
  finally { validate.mockRestore(); }
});
