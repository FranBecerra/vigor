import { applyVigorStartingPoint, historyReviewInput, planningHistoryContext, vigorPlanningHistory } from '../planningHistory';
import { planningHistoryFixture } from '@/test-support/planningHistoryFixture';
import { cardioHealthWindow, reviewCardioHealth } from '../cardioHealthReview';
import { hybridFixture } from '@/test-support/hybridFixture';
import { acceptReviewedCardioStart } from '../reviewedCardioStart';
import { buildCardioPreview, cardioPreviewIssue } from '../cardioPreview';
const now = Date.UTC(2026, 10, 3, 12), day = 86400000;
const input = () => ({ ...hybridFixture().input, cycleDays: 8, modalities: ['RUNNING'] as ['RUNNING'], sessions: 2,
  sessionMinutes: 60, cardioMinutes: 120, profile: { schemaVersion: 1 as const, modalities: { RUNNING: { status: 'NEW' as const,
    qualityExposure: 'UNKNOWN' as const, typicalSessionMinutes: 40 } } } });
const baseline = (i = input()) => acceptReviewedCardioStart(vigorPlanningHistory(planningHistoryFixture(now), 'owner', now), now, now,
  { ...planningHistoryContext(i, 'RUNNING'), representative: true, response: 'RECOVERED' });
it('adapts only owned completed coherent running/cycling timer records without original provenance', () => {
  const entries = planningHistoryFixture(now), first = entries[0], window = cardioHealthWindow(now);
  const raw = vigorPlanningHistory([...entries, { ...first, userId: 'other' }, null as any,
    { ...first, status: 'DISCARDED' }, { ...first, startedAt: window.start - 1 }, { ...first, finishedAt: now + 1, updatedAt: now + 1 },
    { ...first, prescription: { ...first.prescription, modality: 'MACHINE' } }], 'owner', now);
  expect(raw.workouts).toHaveLength(8); expect(raw.workouts[0]).toMatchObject({ id: `vigor:${first.id}`, sourceName: 'Vigor', ownExport: false });
  expect(JSON.stringify(raw)).not.toContain('blockId'); expect(reviewCardioHealth(raw, now).canConfirm).toBe(true);
  const cycling = vigorPlanningHistory(planningHistoryFixture(now, 'CYCLING'), 'owner', now);
  expect(cycling.workouts.every(w => w.kind === 'CYCLING')).toBe(true);
  expect(vigorPlanningHistory([], 'owner', now)).toEqual({ version: 1, truncated: false, workouts: [] });
});
it('does not turn corrupt, temporally impossible or truncated histories into usable empty history', () => {
  const w = planningHistoryFixture(now)[0];
  for (const entries of [null, [{ ...w, revision: 0 }], [{ ...w, finishedAt: w.startedAt - 1 }], [{ ...w, actualSeconds: 2402 }]]) {
    expect(() => vigorPlanningHistory(entries as any, 'owner', now)).toThrow();
  }
  expect(() => vigorPlanningHistory([], '', now)).toThrow(); expect(() => vigorPlanningHistory([], 'owner', 0)).toThrow();
  const many = Array.from({ length: 1001 }, (_, i) => ({ ...w, id: `record-${i}` }));
  const raw = vigorPlanningHistory(many, 'owner', now); expect(raw.truncated).toBe(true); expect(raw.workouts).toHaveLength(1000);
  expect(reviewCardioHealth(raw, now).canConfirm).toBe(false);
  expect(reviewCardioHealth(vigorPlanningHistory([w, w], 'owner', now), now).duplicateCount).toBe(1);
});
it('keeps a NEW athlete at a confirmed 40 minutes, applies eight-day frequency and never persists a Health baseline', () => {
  const i = input(), before = JSON.stringify(i), b = baseline(i), next = applyVigorStartingPoint(i, b, now);
  expect(next).toMatchObject({ sessions: 2, sessionMinutes: 40, cardioMinutes: 80, healthBaseline: undefined,
    profile: { modalities: { RUNNING: { status: 'NEW', typicalSessionMinutes: 40, sessionsPerWeek: 2 } } } });
  expect(JSON.stringify(i)).toBe(before); expect(cardioPreviewIssue(next)).toBeNull();
  expect(buildCardioPreview(next).scheduled.every(s => s.durationMinutes === 40)).toBe(true);
  expect(JSON.stringify(next)).not.toContain('vigor:'); expect(JSON.stringify(next)).not.toContain('observedAt');
  const undeclared = { ...i, profile: { schemaVersion: 1 as const, modalities: {} } };
  expect(planningHistoryContext(undeclared, 'RUNNING').comfortableMinutes).toBeUndefined();
  expect(applyVigorStartingPoint(undeclared, b, now).profile.modalities.RUNNING?.status).toBe('UNSURE');
});
it('rejects stale reviews and changed modalities/capacity, while preserving the source draft', () => {
  const i = input(), b = baseline(i);
  for (const next of [{ ...i, modalities: ['RUNNING', 'CYCLING'] }, { ...i, modalities: ['CYCLING'] }, { ...i, cycleDays: 7 },
    { ...i, sessions: 3 }, { ...i, sessionMinutes: 30 }, { ...i, cardioMinutes: 100 }]) expect(() => applyVigorStartingPoint(next as any, b, now)).toThrow('stalePlanningContext');
  expect(() => applyVigorStartingPoint(i, b, now + day + 1)).toThrow();
});
it('does not treat untouched 20-minute/two-session starter defaults as capacity; respects edited doses and doubles', () => {
  const i = input(), shared = { cycleDays: 8, trainingDays: 5, minutesPerSession: 60, allowDoubles: false };
  expect(historyReviewInput(i, shared)).toMatchObject({ sessions: 3, sessionMinutes: 60, cardioMinutes: 180, maxActiveDays: 5 });
  expect(historyReviewInput(i, { ...shared, allowDoubles: true }).sessions).toBe(5);
  expect(historyReviewInput(i, { ...shared, trainingDays: 2 }).sessions).toBe(0);
  expect(historyReviewInput(i, shared, true)).toBe(i);
  expect(historyReviewInput({ ...i, strength: [], allowDoubles: true })).toMatchObject({ sessions: 8, sessionMinutes: 600, cardioMinutes: 1440 });
  expect(historyReviewInput({ ...i, availableDays: Array.from({ length: 31 }, (_, d) => d), strength: [] }).sessions).toBe(14);
});
