import type { CardioProfile, CardioPlanningConstraints, EasyCardioRequest } from '@/models/cardio';
import { authorEasyCardio, draftEasyCardioPlan } from '../easyCardio';

const profile: CardioProfile = { schemaVersion: 1, modalities: {
  CYCLING: { status: 'REGULAR', qualityExposure: 'CURRENTLY_TOLERATED', typicalSessionMinutes: 30 },
  RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 12 },
} };
const request: EasyCardioRequest = { id: 'bike-1', modality: 'CYCLING', durationMinutes: 45,
  candidateDays: [0, 1, 2, 3, 4, 5, 6, 7], lowerBodyDemand: 'LOW' };
const constraints: Omit<CardioPlanningConstraints, 'candidates'> = { cycleDays: 8, availableDays: [0, 1, 2, 3, 4, 5, 6, 7],
  maxSessions: 2, maxActiveDays: 6, totalMinutes: 60, maxSessionMinutes: 45, allowDoubles: false,
  goal: 'GENERAL_FITNESS', profile, fixedStrength: [{ id: 'lower', dayIndex: 0, lowerBodyDemand: 'HIGH' }] };

describe('easy session authoring', () => {
  it('caps a requested exposure by current modality-specific tolerance and counts the full session', () => {
    const result = authorEasyCardio(request, profile, 60);
    expect(result.durationSeconds).toBe(1800);
    expect(result.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)).toBe(1800);
    expect(result.segments.map(segment => segment.durationSeconds)).toEqual([300, 1200, 300]);
    expect(result.adjustments).toEqual(['TOLERATED_DURATION_CAP']);
    expect(result.basis).toBe('CURRENT_PRACTICE'); expect(result.allowWalking).toBe(false);
    const run = authorEasyCardio({ ...request, modality: 'RUNNING' }, profile, 60);
    expect(run.durationSeconds).toBe(720); expect(run.allowWalking).toBe(true); expect(run.basis).toBe('FAMILIARIZATION');
  });

  it.each(['RUNNING', 'CYCLING', 'MACHINE'] as const)('offers at most 20 full familiarization minutes with unknown %s duration', modality => {
    const result = authorEasyCardio({ ...request, modality }, { schemaVersion: 1, modalities: {} }, 60);
    expect(result.durationSeconds).toBe(1200); expect(result.adjustments).toContain('UNKNOWN_DURATION');
    expect(result.basis).toBe('FAMILIARIZATION'); expect(result.segments.map(segment => segment.durationSeconds)).toEqual([240, 720, 240]);
  });

  it('honors short requests and availability without inflating small doses', () => {
    const result = authorEasyCardio({ ...request, durationMinutes: 1 }, profile, 10);
    expect(result.durationSeconds).toBe(60); expect(result.segments.map(segment => segment.durationSeconds)).toEqual([12, 36, 12]);
    const capped = authorEasyCardio(request, profile, 15);
    expect(capped.durationSeconds).toBe(900); expect(capped.adjustments).toEqual(['TOLERATED_DURATION_CAP', 'AVAILABILITY_CAP']);
    const fractional = authorEasyCardio({ ...request, durationMinutes: 1.234 }, profile, 45);
    expect(fractional.durationSeconds).toBe(74);
    expect(fractional.segments.reduce((sum, segment) => sum + segment.durationSeconds, 0)).toBe(74);
  });

  it.each(['NEW', 'RETURNING', 'UNSURE'] as const)('retains familiarization for %s without copying quality exposure into intensity', status => {
    const result = authorEasyCardio(request, { schemaVersion: 1, modalities: { CYCLING: { status, qualityExposure: 'CURRENTLY_TOLERATED', typicalSessionMinutes: 25 } } }, 45);
    expect(result.basis).toBe('FAMILIARIZATION'); expect(result.stimulus).toBe('EASY');
    expect(result.segments[1].effort).toEqual({ scale: 'VIGOR_CARDIO_EFFORT_0_10_V1', min: 2, max: 4 });
    expect(result.segments.every(segment => segment.talkTest === 'COMFORTABLE_CONVERSATION')).toBe(true);
    expect(result).not.toHaveProperty('targetHeartRate'); expect(result).not.toHaveProperty('distanceKm');
  });

  it('does not let known cycling tolerance supply an unknown running duration', () => {
    const result = authorEasyCardio({ ...request, modality: 'RUNNING' }, { schemaVersion: 1, modalities: { CYCLING: profile.modalities.CYCLING } }, 45);
    expect(result.durationSeconds).toBe(1200); expect(result.basis).toBe('FAMILIARIZATION');
  });

  it.each([null, {}, { ...request, id: '' }, { ...request, id: ' ' }, { ...request, id: 'x'.repeat(161) },
    { ...request, modality: 'SWIMMING' }, ...[0, -1, NaN, Infinity, 601].map(durationMinutes => ({ ...request, durationMinutes }))])('rejects malformed request %#', value => {
    expect(() => authorEasyCardio(value as any, profile, 45)).toThrow('invalidEasyCardioRequest');
  });
  it.each([0, -1, NaN, Infinity, 601])('rejects invalid standalone availability %s', value => {
    expect(() => authorEasyCardio(request, profile, value)).toThrow();
  });
  it('rejects malformed profiles without treating them as an unknown baseline', () => {
    expect(() => authorEasyCardio(request, { schemaVersion: 2 } as any, 45)).toThrow();
  });
});

describe('composing authored sessions with cycle constraints', () => {
  it('schedules an eight-day cycle and returns only the actually scheduled prescriptions', () => {
    const result = draftEasyCardioPlan(constraints, [request, { ...request, id: 'run-1', modality: 'RUNNING', lowerBodyDemand: 'HIGH' }]);
    expect(result.usedMinutes).toBe(42); expect(result.scheduled).toHaveLength(2);
    expect(result.prescriptions.map(item => item.id)).toEqual(result.scheduled.map(item => item.id));
    expect(result.scheduled.find(item => item.modality === 'RUNNING')!.dayIndex).not.toBe(7);
    expect(result.prescriptions.reduce((sum, item) => sum + item.durationSeconds, 0)).toBe(result.usedMinutes * 60);
  });
  it('reports an unaffordable full session instead of dropping its warm-up or forcing extra minutes', () => {
    const result = draftEasyCardioPlan({ ...constraints, totalMinutes: 29 }, [request]);
    expect(result.prescriptions).toEqual([]); expect(result.omitted).toEqual([{ candidateId: 'bike-1', reason: 'TIME_CAP' }]);
  });
  it.each([0, 0.5])('handles a %s-minute ceiling as an omission', maxSessionMinutes => {
    const result = draftEasyCardioPlan({ ...constraints, maxSessionMinutes }, [request]);
    expect(result.prescriptions).toEqual([]); expect(result.omitted[0].reason).toBe('TIME_CAP');
  });
  it('preserves session and day limits and works without any available day', () => {
    expect(draftEasyCardioPlan({ ...constraints, maxSessions: 0 }, [request]).omitted[0].reason).toBe('SESSION_CAP');
    expect(draftEasyCardioPlan({ ...constraints, availableDays: [] }, [request]).omitted[0].reason).toBe('NO_AVAILABLE_DAY');
    expect(draftEasyCardioPlan({ ...constraints, maxActiveDays: 1 }, [request]).prescriptions).toEqual([]);
  });
  it('does not author quality work or a weekly progression when given a VO2 goal', () => {
    const result = draftEasyCardioPlan({ ...constraints, goal: 'VO2_FITNESS' }, [request]);
    expect(result.scheduled[0].stimulus).toBe('EASY'); expect(result.prescriptions[0].policy).toBe('EASY_START_V1');
  });
  it('keeps caller-owned constraints and requests unchanged', () => {
    const before = JSON.stringify({ constraints, request });
    const result = draftEasyCardioPlan(constraints, [request]);
    result.scheduled[0].candidateDays.pop(); result.prescriptions[0].segments.pop();
    expect(JSON.stringify({ constraints, request })).toBe(before);
  });
  it('validates empty and malformed request lists and rejects duplicate identities', () => {
    expect(draftEasyCardioPlan(constraints, []).prescriptions).toEqual([]);
    expect(() => draftEasyCardioPlan({ ...constraints, cycleDays: 0 }, [])).toThrow();
    expect(() => draftEasyCardioPlan(constraints, null as any)).toThrow('invalidEasyCardioRequests');
    expect(() => draftEasyCardioPlan(constraints, [request, request])).toThrow('invalidCardioCandidates');
    expect(() => draftEasyCardioPlan(constraints, [{ ...request, candidateDays: [8] }])).toThrow('invalidCardioCandidates');
    expect(() => draftEasyCardioPlan({ ...constraints, maxSessionMinutes: 0 }, [request, request])).toThrow('invalidCardioCandidates');
  });
});
