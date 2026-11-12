import type { CardioPlanningConstraints, CardioPlanCandidate } from '@/models/cardio';
import { cardioGapCost, easySpacingRank, spacingRankIsBetter, spreadEasyCardio, type CardioAssignment } from '../cardioSpacing';
import { scheduleCardioCandidates } from '../cardioPlanner';
import { buildCardioPreview, cardioPreviewIssue, type CardioPreviewInput } from '../cardioPreview';
import { saveCardioProposal, validSavedCardioPlan } from '../savedCardioPlan';
import { reviewedInput, reviewedNow } from '@/testing/cardioReviewFixture';

const candidate = (id = 'a', patch: Partial<CardioPlanCandidate> = {}): CardioPlanCandidate => ({ id, modality: 'CYCLING', stimulus: 'EASY',
  lowerBodyDemand: 'LOW', durationMinutes: 30, candidateDays: [0, 1, 2, 3, 4, 5, 6, 7], ...patch });
const constraints = (patch: Partial<CardioPlanningConstraints> = {}): CardioPlanningConstraints => ({ placementPolicy: 'BALANCED_V2', spacingPolicy: 'SPREAD_EASY_V1',
  cycleDays: 8, availableDays: [0, 1, 2, 3, 4, 5, 6, 7], maxSessions: 3, maxActiveDays: 8, totalMinutes: 120, maxSessionMinutes: 60,
  allowDoubles: false, goal: 'GENERAL_FITNESS', profile: { schemaVersion: 1, modalities: {} }, fixedStrength: [], candidates: [candidate(), candidate('b')], ...patch });
const input = (patch: Partial<CardioPreviewInput> = {}): CardioPreviewInput => ({ placementPolicy: 'BALANCED_V2', spacingPolicy: 'SPREAD_EASY_V1', cycleDays: 8,
  modalities: ['CYCLING'], profile: { schemaVersion: 1, modalities: { CYCLING: { status: 'NEW', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 40 } } },
  availableDays: [0, 1, 2, 3, 4, 5, 6, 7], sessions: 2, cardioMinutes: 80, sessionMinutes: 40, maxActiveDays: 8, allowDoubles: false, strength: [], ...patch });
const assignment = (dayIndex: number, id: string, patch: Partial<CardioPlanCandidate> = {}): CardioAssignment => ({ dayIndex, candidate: candidate(id, patch) });

it('measures wrap-around gaps, ignores phase and handles zero/one/duplicate days', () => {
  expect(cardioGapCost([], 8)).toBe(0); expect(cardioGapCost([3], 8)).toBe(0);
  expect(cardioGapCost([7, 0], 8)).toBe(50); expect(cardioGapCost([0, 1], 8)).toBe(50);
  expect(cardioGapCost([0, 4], 8)).toBe(32); expect(cardioGapCost([1, 5], 8)).toBe(32); expect(cardioGapCost([0, 0], 8)).toBe(64);
  expect(spacingRankIsBetter([0, 3], [1, 0])).toBe(true); expect(spacingRankIsBetter([1, 0], [0, 3])).toBe(false); expect(spacingRankIsBetter([0, 3], [0, 3])).toBe(false);
});
it.each([7, 8, 10, 31])('spreads two easy cycling sessions over a %i-day circular cycle without changing dose', days => {
  const i = input({ cycleDays: days, availableDays: Array.from({ length: days }, (_, d) => d), maxActiveDays: days });
  const before = JSON.stringify(i), old = buildCardioPreview({ ...i, spacingPolicy: undefined }), plan = buildCardioPreview(i);
  expect(old.scheduled.map(s => s.dayIndex)).toEqual([0, 1]); expect(plan.scheduled).toHaveLength(2);
  const [a, b] = plan.scheduled.map(s => s.dayIndex); expect(Math.min(b - a, days - b + a)).toBe(Math.floor(days / 2));
  expect(plan.usedMinutes).toBe(80); expect(plan.prescriptions.map(p => p.durationSeconds)).toEqual([2400, 2400]);
  expect(JSON.stringify(i)).toBe(before);
});
it('preserves available days, per-candidate slots, hard active-day/double limits, omissions and candidate identity', () => {
  const source = constraints({ availableDays: [0, 1, 4], maxActiveDays: 2, allowDoubles: true, doublePolicy: 'STRENGTH_CARDIO_ONLY_V1',
    fixedStrength: [{ id: 'upper', dayIndex: 0, lowerBodyDemand: 'LOW', estimatedMinutes: 30 }],
    candidates: [candidate('a', { candidateDays: [1] }), candidate('b', { candidateDays: [0, 4] }), candidate('omitted', { durationMinutes: 100 })] });
  const legacy = scheduleCardioCandidates({ ...source, spacingPolicy: undefined }), next = scheduleCardioCandidates(source);
  expect(next.scheduled.map(s => s.id).sort()).toEqual(legacy.scheduled.map(s => s.id).sort()); expect(next.omitted).toEqual(legacy.omitted);
  expect(next.usedMinutes).toBe(legacy.usedMinutes); expect(next.activeDays.length).toBeLessThanOrEqual(2);
  next.scheduled.forEach(s => { expect(s.candidateDays).toContain(s.dayIndex); expect(source.availableDays).toContain(s.dayIndex); });
  expect(new Set(next.scheduled.map(s => s.dayIndex)).size).toBe(next.scheduled.length);
  const none = constraints({ maxActiveDays: 0 }); expect(scheduleCardioCandidates(none).scheduled).toEqual([]);
  expect(spreadEasyCardio(source, [])).toEqual([]);
  const quality = [assignment(0, 'quality', { stimulus: 'QUALITY' })]; expect(spreadEasyCardio(source, quality)).toEqual(quality);
});
it('never exchanges lower-body proximity for tidier gaps and scores doubles, absent duration and wrap-around activity', () => {
  const i = constraints({ fixedStrength: [{ id: 'lower', dayIndex: 0, lowerBodyDemand: 'HIGH' }], allowDoubles: true });
  const old = [assignment(0, 'a', { lowerBodyDemand: 'HIGH' }), assignment(7, 'b', { lowerBodyDemand: 'HIGH' })];
  expect(easySpacingRank(i, old)[0]).toBe(180); expect(easySpacingRank(i, old)[2]).toBe(1);
  const next = spreadEasyCardio(i, old); expect(easySpacingRank(i, next)[0]).toBeLessThanOrEqual(easySpacingRank(i, old)[0]);
  const fixed = constraints({ availableDays: [0], maxActiveDays: 1, allowDoubles: true });
  expect(spreadEasyCardio(fixed, [assignment(0, 'a'), assignment(0, 'b')])).toEqual([assignment(0, 'a'), assignment(0, 'b')]);
  const full = constraints(); expect(easySpacingRank(full, Array.from({ length: 8 }, (_, d) => assignment(d, String(d))))[3]).toBe(8);
});
it('uses a pair swap when all feasible days are occupied and respects both candidates restrictions', () => {
  const i = constraints({ availableDays: [0, 1], maxActiveDays: 2, allowDoubles: true, doublePolicy: 'STRENGTH_CARDIO_ONLY_V1',
    fixedStrength: [{ id: 'lower', dayIndex: 0, lowerBodyDemand: 'HIGH', estimatedMinutes: 45 }] });
  const old = [assignment(0, 'high', { lowerBodyDemand: 'HIGH' }), assignment(1, 'low')];
  expect(spreadEasyCardio(i, old).map(a => a.dayIndex)).toEqual([1, 0]);
  const restricted = old.map(a => ({ ...a, candidate: { ...a.candidate, candidateDays: [a.dayIndex] } }));
  expect(spreadEasyCardio(i, restricted)).toEqual(restricted);
  const triple = { ...i, fixedStrength: [...i.fixedStrength, { id: 'other', dayIndex: 0, lowerBodyDemand: 'LOW' as const }] };
  expect(spreadEasyCardio(triple, [assignment(1, 'single')])).toEqual([assignment(1, 'single')]);
});
it('keeps all old saved reconstructions exact and detaches/validates the opt-in policy on new saves', () => {
  const legacy = saveCardioProposal('old', 'owner', 'Old', { ...input(), spacingPolicy: undefined }, null, 1800000000000);
  const next = saveCardioProposal('next', 'owner', 'New', input(), null, 1800000000000);
  expect(legacy.preview.scheduled.map(s => s.dayIndex)).toEqual([0, 1]); expect(validSavedCardioPlan(legacy, 'owner')).toBe(true);
  expect(validSavedCardioPlan(next, 'owner')).toBe(true); expect(next.input.spacingPolicy).toBe('SPREAD_EASY_V1');
  expect(validSavedCardioPlan({ ...next, input: { ...next.input, spacingPolicy: 'unknown' } }, 'owner')).toBe(false);
  expect(cardioPreviewIssue({ ...input(), spacingPolicy: 'unknown' as any })).toBe('LIMITS');
  expect(cardioPreviewIssue({ ...input(), placementPolicy: undefined })).toBe('LIMITS');
  expect(() => scheduleCardioCandidates(constraints({ spacingPolicy: 'unknown' as any }))).toThrow('invalidCardioPlanningConstraints');
  expect(() => scheduleCardioCandidates(constraints({ placementPolicy: undefined }))).toThrow('invalidCardioPlanningConstraints');
  const health = reviewedInput(), savedHealth = saveCardioProposal('health', 'owner', 'Health', health, null, reviewedNow, true);
  const spacedHealth = saveCardioProposal('health-new', 'owner', 'Health new', { ...health, spacingPolicy: 'SPREAD_EASY_V1' }, null, reviewedNow, true);
  expect(validSavedCardioPlan(savedHealth, 'owner')).toBe(true); expect(validSavedCardioPlan(spacedHealth, 'owner')).toBe(true);
  expect(spacedHealth.input.healthBaseline).toEqual(savedHealth.input.healthBaseline);
});
it('bounds a dense 31-day multi-modality review and preserves authored prescription identity after reordering', () => {
  const days = Array.from({ length: 31 }, (_, day) => day);
  const i = constraints({ cycleDays: 31, availableDays: days, maxActiveDays: 31, maxSessions: 14, totalMinutes: 1000,
    candidates: Array.from({ length: 14 }, (_, n) => candidate(String(n), { candidateDays: days })) });
  const old = scheduleCardioCandidates({ ...i, spacingPolicy: undefined }), next = scheduleCardioCandidates(i);
  expect(next.scheduled).toHaveLength(14); expect(easySpacingRank(i, next.scheduled.map(candidate => ({ candidate, dayIndex: candidate.dayIndex })))[0]).toBe(0);
  expect(cardioGapCost(next.scheduled.map(s => s.dayIndex), 31)).toBeLessThan(cardioGapCost(old.scheduled.map(s => s.dayIndex), 31));
  const mixed = buildCardioPreview(input({ modalities: ['CYCLING', 'RUNNING'], sessions: 3, cardioMinutes: 100, maxActiveDays: 4,
    profile: { schemaVersion: 1, modalities: { CYCLING: { status: 'NEW', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 40 }, RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 20 } } } }));
  mixed.scheduled.forEach((s, n) => { expect(mixed.prescriptions[n].id).toBe(s.id); expect(mixed.prescriptions[n].modality).toBe(s.modality); expect(mixed.prescriptions[n].durationSeconds).toBe(s.durationMinutes * 60); });
});
