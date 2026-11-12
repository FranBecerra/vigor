import { hybridFixture } from '@/test-support/hybridFixture';
import { prepareHybridBundle, reviewHybridAuthoring, validHybridBundle, validHybridSettings, hybridSameDayOrder } from '../hybridAuthoring';
import { reviewedContext, reviewedRecords } from '@/testing/cardioReviewFixture';
import { acceptReviewedCardioStart, reviewedCardioDefaults } from '../reviewedCardioStart';
const now = 1800000000000;
const prepare = () => { const f = hybridFixture(); return prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now); };
it('reviews the complete shared budget without altering either prescription in an eight-day cycle', () => {
  const f = hybridFixture(), before = JSON.stringify(f.draft);
  const result = reviewHybridAuthoring(f.draft, f.input, f.settings, f.exercises, f.labels);
  expect(result.issues).toEqual([]); expect(result.totalMinutes).toBe(result.strengthMinutes + result.preview.usedMinutes);
  expect(result.preview.activeDays.length).toBeLessThanOrEqual(f.input.maxActiveDays);
  expect(JSON.stringify(f.draft)).toBe(before);
  expect(hybridSameDayOrder('STRENGTH')).toBe('STRENGTH_FIRST'); expect(hybridSameDayOrder('CARDIO')).toBe('CARDIO_FIRST');
  expect(hybridSameDayOrder('BALANCED')).toBe('CHOOSE_PRIORITY_SESSION'); expect(() => hybridSameDayOrder('x' as any)).toThrow();
});
it('preserves all working sets/RIR and links an inactive new routine to the actual reviewed rhythm', () => {
  const f = hybridFixture(); f.input.strength[1].dayIndex = 5;
  const bundle = prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, now);
  expect(validHybridBundle(bundle, 'owner')).toBe(true); expect(validHybridBundle(bundle, 'other')).toBe(false);
  expect(bundle.routine.isActive).toBe(false); expect(bundle.routine.hybrid).toMatchObject({ cardioPlanId: bundle.cardio.id, priority: 'BALANCED' });
  expect(bundle.mesocycle.plannedSessions).toEqual(f.draft.mesocycle.plannedSessions);
  expect(bundle.mesocycle.scheduleTemplate!.slots[5]).toEqual({ kind: 'workout', sessionIndex: 1 });
  expect(bundle.cardio.strengthSource).toMatchObject({ routineId: bundle.routine.id, microcycleIndex: 0 });
  bundle.mesocycle.plannedSessions![0].exercises[0].sets[0].targetRIR = 4;
  expect(f.draft.mesocycle.plannedSessions![0].exercises[0].sets[0].targetRIR).toBe(2);
});
it('blocks oversubscribed time, long sessions and omitted cardio instead of silently reducing either dose', () => {
  const f = hybridFixture(); const args = [f.draft, f.input, { ...f.settings, totalMinutesPerCycle: 30 }, f.exercises, f.labels] as const;
  expect(reviewHybridAuthoring(...args).issues).toContain('TOTAL_TIME'); expect(() => prepareHybridBundle(...args, now)).toThrow('hybridCapacityExceeded');
  f.input.profile.modalities.CYCLING = { status: 'REGULAR', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 60 };
  f.input.sessionMinutes = 60; f.input.cardioMinutes = 120;
  expect(reviewHybridAuthoring(f.draft, f.input, { ...f.settings, maxSessionMinutes: 30 }, f.exercises, f.labels).issues).toContain('SESSION_TIME');
  f.input.maxActiveDays = 2;
  expect(reviewHybridAuthoring(f.draft, f.input, f.settings, f.exercises, f.labels).issues).toContain('CARDIO_OMITTED');
});
it.each([null, {}, { priority: 'x', totalMinutesPerCycle: 300, maxSessionMinutes: 120 },
  { priority: 'BALANCED', totalMinutesPerCycle: NaN, maxSessionMinutes: 120 }, { priority: 'CARDIO', totalMinutesPerCycle: 400, maxSessionMinutes: 0 }])('rejects malformed shared capacity %j', value => {
  expect(validHybridSettings(value)).toBe(false);
});
it('rejects changed or missing strength rosters, foreign or performed sources and invalid calendars', () => {
  const test = (mutate: (f: ReturnType<typeof hybridFixture>) => void) => { const f = hybridFixture(); mutate(f);
    expect(() => reviewHybridAuthoring(f.draft, f.input, f.settings, f.exercises, f.labels)).toThrow(); };
  test(f => { f.input.strength.pop(); }); test(f => { f.input.strength[0].estimatedMinutes = 0; });
  test(f => { f.input.strength[0].name = 'changed'; }); test(f => { f.input.strength[0].id = 'other'; });
  test(f => { f.input.availableDays = f.input.availableDays.filter(day => day !== f.input.strength[0].dayIndex); });
  test(f => { f.draft.mesocycle.userId = 'other'; }); test(f => { f.draft.mesocycle.currentMicrocycleIndex = 1; });
  test(f => { f.draft.mesocycle.trainingCalendar = {}; }); test(f => { f.draft.mesocycle.plannedSessions![1].index = 0; });
  test(f => { f.exercises.clear(); }); test(f => { f.input.cycleDays = 0; });
  test(f => { f.settings.totalMinutesPerCycle = -1; });
  const f = hybridFixture(); expect(() => prepareHybridBundle(f.draft, f.input, f.settings, f.exercises, f.labels, Infinity)).toThrow();
});
it('rejects malformed saved links and never accepts arbitrary partially constructed bundles', () => {
  const changes = [
    (b: ReturnType<typeof prepare>) => { b.routine.isActive = true; },
    (b: ReturnType<typeof prepare>) => { b.mesocycle.routineId = 'different'; },
    (b: ReturnType<typeof prepare>) => { b.routine.hybrid!.cardioPlanId = 'different'; },
    (b: ReturnType<typeof prepare>) => { b.routine.hybrid!.totalMinutesPerCycle = 30; },
    (b: ReturnType<typeof prepare>) => { b.routine.hybrid!.maxSessionMinutes = 0; },
    (b: ReturnType<typeof prepare>) => { b.mesocycle.scheduleTemplate!.slots[0] = { kind: 'rest' }; },
    (b: ReturnType<typeof prepare>) => { b.cardio.archivedAt = now; },
  ];
  for (const change of changes) { const bundle = prepare(); change(bundle); expect(validHybridBundle(bundle, 'owner')).toBe(false); }
  expect(validHybridBundle(null as any, 'owner')).toBe(false);
});
it('reviews Health-informed hybrid doses but materializes numeric provenance only with fresh explicit save consent', () => {
  const f = hybridFixture(), b = acceptReviewedCardioStart(reviewedRecords(now), now, now, { ...reviewedContext, cycleDays: 8, maxSessionMinutes: 60, totalMinutes: 120 });
  const input = { ...f.input, ...reviewedCardioDefaults(b, f.input.profile) };
  expect(reviewHybridAuthoring(f.draft, input, f.settings, f.exercises, f.labels).issues).toEqual([]);
  expect(() => prepareHybridBundle(f.draft, input, f.settings, f.exercises, f.labels, now)).toThrow();
  const saved = prepareHybridBundle(f.draft, input, f.settings, f.exercises, f.labels, now, true);
  expect(validHybridBundle(saved, 'owner')).toBe(true); expect(saved.cardio.input.healthBaseline).toEqual(b);
  expect(saved.cardio.healthPlanningConsent).toMatchObject({ acceptedAt: now });
  expect(JSON.stringify(saved)).not.toContain('private-workout'); expect(JSON.stringify(saved)).not.toContain('private-source');
  expect(() => prepareHybridBundle(f.draft, input, f.settings, f.exercises, f.labels, now + 86400001, true)).toThrow();
});
