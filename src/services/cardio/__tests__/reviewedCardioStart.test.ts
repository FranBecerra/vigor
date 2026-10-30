import { acceptReviewedCardioStart, copyReviewedCardioStart, freshReviewedCardioStart, reviewedCardioDefaults, validReviewedCardioStart } from '../reviewedCardioStart';
import { reviewedContext, reviewedInput, reviewedNow as now, reviewedRecords, reviewedStart } from '@/testing/cardioReviewFixture';
import { buildCardioPreview, cardioPreviewIssue, suggestCardioCapacity } from '../cardioPreview';
import { archiveCardioProposal, cardioPlanPolicy, cardioStrengthSource, saveCardioProposal, validSavedCardioPlan } from '../savedCardioPlan';
import { createCardioBlock } from '../cardioBlock';
import { startCardioWorkout, validCardioWorkout } from '../cardioWorkout';
const day = 86400000;
it('accepts only a newly recalculated proposal and detaches numeric provenance from original Health records', () => {
  const raw = reviewedRecords(), before = JSON.stringify(raw), baseline = acceptReviewedCardioStart(raw, now, now + 1, reviewedContext);
  expect(baseline.acceptedAt).toBe(now + 1); expect(validReviewedCardioStart(baseline)).toBe(true);
  expect(JSON.stringify(raw)).toBe(before); expect(JSON.stringify(baseline)).not.toMatch(/private-|Private source|workouts|symptoms|RECOVERED/);
  raw.workouts[0].durationSeconds = 1; expect(baseline.sessionMinutes).toBe(30);
  const copy = copyReviewedCardioStart(baseline); copy.sessionMinutes = 10; expect(baseline.sessionMinutes).toBe(30);
  expect(() => acceptReviewedCardioStart(raw, now, now + day + 1, reviewedContext)).toThrow('unavailableReviewedCardioStart');
  expect(() => acceptReviewedCardioStart(raw, now, now, { ...reviewedContext, response: 'DISCOMFORT' })).toThrow();
  expect(() => copyReviewedCardioStart({ ...baseline, sourceId: 'no' } as any)).toThrow('invalidReviewedCardioStart');
});
it.each([null, {}, { version: 2 }, { policy: 'OTHER' }, { modality: 'MACHINE' }, { observedAt: NaN }, { observedAt: 0 },
  { acceptedAt: now - 1 }, { acceptedAt: now + day + 1 }, { cycleDays: 6 }, { cycleDays: 32 }, { sessions: 0 }, { sessions: 15 },
  { sessionMinutes: 0 }, { sessionMinutes: 601 }, { totalMinutes: 0 }, { totalMinutes: 1441 }, { comfortableMinutes: 0 },
  { maxSessions: 0 }, { maxSessionMinutes: 0 }, { availableMinutes: 0 }, { observedSessions: 3 }, { observedSessions: 1001 },
  { representedWeeks: 2 }, { representedWeeks: 5 }, { typicalMinutes: 0 }, { typicalMinutes: Infinity }, { weeklyMinutes: 0 },
  { weeklySessions: 0 }, { weeklySessions: .1 }, { sessionMinutes: 29 }, { sessions: 1 }, { totalMinutes: 59 }, { workoutIds: ['private'] }])('rejects malformed or inconsistent numeric provenance %j', patch => {
  expect(validReviewedCardioStart(patch === null || !Object.keys(patch).length ? patch : { ...reviewedStart(), ...patch })).toBe(false);
});
it('enforces fresh handoff/save boundaries but keeps historical immutable records readable', () => {
  const baseline = reviewedStart();
  expect(freshReviewedCardioStart(baseline, now)).toBe(true); expect(freshReviewedCardioStart(baseline, now + day)).toBe(true);
  for (const clock of [now - 1, now + day + 1, NaN, Infinity]) expect(freshReviewedCardioStart(baseline, clock)).toBe(false);
  expect(freshReviewedCardioStart({}, now)).toBe(false);
  const saved = saveCardioProposal('p', 'owner', 'Base', reviewedInput(), null, now, true);
  expect(validSavedCardioPlan(saved, 'owner')).toBe(true); expect(validSavedCardioPlan(archiveCardioProposal(saved, 'owner', now + 50 * day), 'owner')).toBe(true);
  expect(() => saveCardioProposal('p', 'owner', 'Base', reviewedInput(), null, now + day + 1, true)).toThrow();
});
it('seeds current answers without fabricating a regular/advanced experience level or quality tolerance', () => {
  const unknown = reviewedCardioDefaults(reviewedStart(), { schemaVersion: 1, modalities: {} });
  expect(unknown.profile.modalities.RUNNING).toEqual({ status: 'UNSURE', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 40 });
  expect(unknown).toMatchObject({ modalities: ['RUNNING'], sessions: 2, sessionMinutes: 40, cardioMinutes: 80 });
  const regular = reviewedCardioDefaults(reviewedStart(), { schemaVersion: 1, modalities: { RUNNING: { status: 'REGULAR', qualityExposure: 'CURRENTLY_TOLERATED' } } });
  expect(regular.profile.modalities.RUNNING?.status).toBe('REGULAR'); expect(regular.profile.modalities.RUNNING?.qualityExposure).toBe('UNKNOWN');
});
it('freezes v3 initial dose while retaining availability for later reviewed progression', () => {
  const input = reviewedInput(), preview = buildCardioPreview(input);
  expect(preview.usedMinutes).toBe(60); expect(preview.prescriptions.map(p => p.durationSeconds)).toEqual([1800, 1800]);
  expect(preview.prescriptions.every(p => p.basis === 'REVIEWED_HISTORY')).toBe(true);
  expect(suggestCardioCapacity(input)).toEqual({ sessions: 2, sessionMinutes: 40, cardioMinutes: 80, maxActiveDays: 2 });
  expect(buildCardioPreview({ ...input, sessions: 1 }).usedMinutes).toBe(30);
  expect(buildCardioPreview({ ...input, sessionMinutes: 15 }).usedMinutes).toBe(30);
  expect(buildCardioPreview({ ...input, sessionMinutes: 100, cardioMinutes: 500 }).usedMinutes).toBe(60);
  for (const patch of [{ modalities: ['CYCLING'] }, { modalities: ['RUNNING', 'CYCLING'] }, { cycleDays: 8 }, { sessions: 3 }, { placementPolicy: undefined }, { healthBaseline: {} }]) {
    expect(cardioPreviewIssue({ ...input, ...patch } as any)).toBe('HEALTH_BASELINE');
  }
  for (const patch of [{ modalities: ['CYCLING'] }, { cycleDays: 10 }, { healthBaseline: {} }]) expect(() => suggestCardioCapacity({ ...input, ...patch } as any)).toThrow();
});
it('requires explicit private-account save acceptance and validates consent and dose rather than trusting UI labels', () => {
  const input = reviewedInput();
  expect(() => saveCardioProposal('p', 'owner', 'Base', input, null, now)).toThrow();
  expect(() => saveCardioProposal('p', 'owner', 'Base', input, null, now, false)).toThrow();
  const saved = saveCardioProposal('p', 'owner', 'Base', input, null, now, true);
  expect(saved.policy).toBe('CARDIO_PREVIEW_V3'); expect(saved.healthPlanningConsent).toEqual({ policy: 'HEALTH_DERIVED_PRIVATE_PLAN_V1', acceptedAt: now });
  expect(cardioPlanPolicy(input)).toBe('CARDIO_PREVIEW_V3'); expect(validSavedCardioPlan(saved, 'owner')).toBe(true);
  for (const healthPlanningConsent of [undefined, {}, { policy: 'OTHER', acceptedAt: now }, { policy: 'HEALTH_DERIVED_PRIVATE_PLAN_V1', acceptedAt: now + 1 }, { ...saved.healthPlanningConsent, raw: 'no' }]) {
    expect(validSavedCardioPlan({ ...saved, healthPlanningConsent }, 'owner')).toBe(false);
  }
  const legacyInput = { ...input, healthBaseline: undefined };
  const legacy = saveCardioProposal('p', 'owner', 'Old', legacyInput, null, now);
  expect(legacy.policy).toBe('CARDIO_PREVIEW_V2'); expect(validSavedCardioPlan({ ...legacy, healthPlanningConsent: saved.healthPlanningConsent }, 'owner')).toBe(false);
  expect(validSavedCardioPlan({ ...saved, policy: 'CARDIO_PREVIEW_V2' }, 'owner')).toBe(false);
  expect(validSavedCardioPlan({ ...saved, input: { ...saved.input, healthBaseline: { ...saved.input.healthBaseline, sourceId: 'private' } } }, 'owner')).toBe(false);
  input.healthBaseline!.sessionMinutes = 1; expect(saved.input.healthBaseline!.sessionMinutes).toBe(30);
});
it('pins strength context for v3 and keeps accepted prescriptions executable with no new sensor permissions', () => {
  const routine = { id: 'r', currentMicrocycleIndex: 0, microcycles: [{ sessions: [] }] } as any;
  expect(cardioStrengthSource(routine, 'CARDIO_PREVIEW_V3')).toMatchObject({ routineId: 'r', microcycleIndex: 0 });
  const plan = saveCardioProposal('p', 'owner', 'Base', reviewedInput(), null, now, true);
  const block = createCardioBlock('b', plan, '2026-10-30', 4, 'Europe/Madrid', now);
  const workout = startCardioWorkout(block, block.slots[0].id, now, 'w');
  expect(workout.prescription.basis).toBe('REVIEWED_HISTORY'); expect(validCardioWorkout(workout, 'owner')).toBe(true);
});
