import type { CardioPlanCandidate, CardioPlanningConstraints } from '@/models/cardio';
import { scheduleCardioCandidates, validateCardioProfile } from '../cardioPlanner';

const profile: CardioPlanningConstraints['profile'] = {
  schemaVersion: 1,
  modalities: {
    RUNNING: { status: 'REGULAR', qualityExposure: 'CURRENTLY_TOLERATED', consistentWeeks: 12, sessionsPerWeek: 3, typicalSessionMinutes: 35, recentLongestRunKm: 8 },
    CYCLING: { status: 'UNSURE', qualityExposure: 'UNKNOWN' },
  },
};

const candidate = (overrides: Partial<CardioPlanCandidate> = {}): CardioPlanCandidate => ({
  id: 'easy-run', modality: 'RUNNING', stimulus: 'EASY', durationMinutes: 30,
  candidateDays: [0, 1, 2, 3, 4, 5, 6], lowerBodyDemand: 'LOW', ...overrides,
});

const constraints = (overrides: Partial<CardioPlanningConstraints> = {}): CardioPlanningConstraints => ({
  cycleDays: 7, availableDays: [0, 1, 2, 3, 4, 5, 6], maxSessions: 3, maxActiveDays: 7,
  totalMinutes: 120, maxSessionMinutes: 60, allowDoubles: true, goal: 'AEROBIC_BASE',
  profile, candidates: [candidate()], fixedStrength: [], ...overrides,
});

describe('validateCardioProfile', () => {
  it('accepts an empty draft and valid modality-specific self-report', () => {
    expect(validateCardioProfile({ schemaVersion: 1, modalities: {} })).toBe(true);
    expect(validateCardioProfile(profile)).toBe(true);
  });

  it.each([
    null,
    {},
    { schemaVersion: 2, modalities: {} },
    { schemaVersion: 1, modalities: [] },
    { schemaVersion: 1, modalities: { SWIMMING: { status: 'REGULAR', qualityExposure: 'UNKNOWN' } } },
    { schemaVersion: 1, modalities: { RUNNING: null } },
    { schemaVersion: 1, modalities: { RUNNING: { status: 'ADVANCED', qualityExposure: 'UNKNOWN' } } },
    { schemaVersion: 1, modalities: { RUNNING: { status: 'NEW', qualityExposure: 'OFTEN' } } },
    { schemaVersion: 1, modalities: { RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', sessionsPerWeek: -1 } } },
    { schemaVersion: 1, modalities: { RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', consistentWeeks: 521 } } },
    { schemaVersion: 1, modalities: { RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', typicalSessionMinutes: 0 } } },
    { schemaVersion: 1, modalities: { RUNNING: { status: 'NEW', qualityExposure: 'UNKNOWN', recentLongestRunKm: 0 } } },
    { schemaVersion: 1, modalities: { CYCLING: { status: 'REGULAR', qualityExposure: 'UNKNOWN', recentLongestRunKm: 10 } } },
  ])('rejects malformed profile %p', value => {
    expect(validateCardioProfile(value)).toBe(false);
  });
});

describe('scheduleCardioCandidates', () => {
  it('keeps unknown duration neutral in the v2 soft tie-breaker', () => {
    const result = scheduleCardioCandidates(constraints({ placementPolicy: 'BALANCED_V2', availableDays: [0],
      candidates: [candidate({ candidateDays: [0] })], fixedStrength: [{ id: 'upper', dayIndex: 0, lowerBodyDemand: 'LOW' }] }));
    expect(result.scheduled[0].dayIndex).toBe(0);
  });
  it('uses deterministic goal ordering and stable day/id tie breaks independent of input order', () => {
    const easy = candidate({ id: 'z-easy', candidateDays: [2, 1] });
    const quality = candidate({ id: 'a-quality', stimulus: 'QUALITY', durationMinutes: 20, candidateDays: [0] });
    const general = constraints({ candidates: [quality, easy], maxSessions: 1 });
    const base = scheduleCardioCandidates(general);
    const vo2 = scheduleCardioCandidates({ ...general, goal: 'VO2_FITNESS' });
    expect(base.scheduled.map(item => item.id)).toEqual(['z-easy']);
    expect(base.scheduled[0].dayIndex).toBe(1);
    expect(vo2.scheduled.map(item => item.id)).toEqual(['a-quality']);
    expect(scheduleCardioCandidates({ ...general, candidates: [easy, quality] })).toEqual(base);
  });

  it('requires explicit currently tolerated quality exposure for that modality', () => {
    const quality = candidate({ id: 'quality-bike', modality: 'CYCLING', stimulus: 'QUALITY' });
    const result = scheduleCardioCandidates(constraints({ candidates: [quality] }));
    expect(result).toMatchObject({ scheduled: [], omitted: [{ candidateId: 'quality-bike', reason: 'QUALITY_EXPOSURE_UNKNOWN' }], usedMinutes: 0 });
    const notTolerated = { ...profile, modalities: { ...profile.modalities, CYCLING: { status: 'RETURNING' as const, qualityExposure: 'NOT_TOLERATED' as const } } };
    expect(scheduleCardioCandidates(constraints({ candidates: [quality], profile: notTolerated })).omitted[0].reason).toBe('QUALITY_NOT_TOLERATED');
    expect(scheduleCardioCandidates(constraints({ candidates: [candidate({ id: 'quality-run', stimulus: 'QUALITY' })] })).scheduled).toHaveLength(1);
  });

  it('honors session, per-session, total-time, active-day and no-double caps', () => {
    const candidates = [
      candidate({ id: 'a', durationMinutes: 40, candidateDays: [0] }),
      candidate({ id: 'b', durationMinutes: 40, candidateDays: [1] }),
      candidate({ id: 'c', durationMinutes: 20, candidateDays: [2] }),
      candidate({ id: 'd', durationMinutes: 70, candidateDays: [3] }),
    ];
    const result = scheduleCardioCandidates(constraints({ candidates, maxSessions: 3, maxActiveDays: 1, totalMinutes: 60, maxSessionMinutes: 60 }));
    expect(result.scheduled.map(item => item.id)).toEqual(['a']);
    expect(result.omitted).toEqual([
      { candidateId: 'b', reason: 'TIME_CAP' },
      { candidateId: 'c', reason: 'NO_AVAILABLE_DAY' },
      { candidateId: 'd', reason: 'TIME_CAP' },
    ]);

    const sessionLimited = scheduleCardioCandidates(constraints({ candidates: candidates.slice(0, 2), maxSessions: 1 }));
    expect(sessionLimited.omitted[0].reason).toBe('SESSION_CAP');
    const noDoubles = scheduleCardioCandidates(constraints({ candidates: [candidate({ candidateDays: [2] })], allowDoubles: false, fixedStrength: [{ id: 'lift', dayIndex: 2, lowerBodyDemand: 'LOW' }] }));
    expect(noDoubles.omitted[0].reason).toBe('NO_AVAILABLE_DAY');
    const noCardioDoubles = scheduleCardioCandidates(constraints({
      candidates: [candidate({ id: 'first', candidateDays: [2] }), candidate({ id: 'second', candidateDays: [2] })],
      maxSessions: 2, allowDoubles: false,
    }));
    expect(noCardioDoubles).toMatchObject({ scheduled: [{ id: 'first', dayIndex: 2 }], omitted: [{ candidateId: 'second', reason: 'NO_AVAILABLE_DAY' }] });
    const timeLimited = scheduleCardioCandidates(constraints({ candidates: [candidate({ id: 'a', durationMinutes: 30 }), candidate({ id: 'b', durationMinutes: 20 })], totalMinutes: 30 }));
    expect(timeLimited.omitted[0]).toEqual({ candidateId: 'b', reason: 'TIME_CAP' });
  });

  it('places high lower-body demand away from fixed and already assigned stress where possible, including cycle wrap', () => {
    const fixedStrength = [{ id: 'legs-day-0', dayIndex: 0, lowerBodyDemand: 'HIGH' as const }];
    const run = candidate({ lowerBodyDemand: 'HIGH', candidateDays: [1, 2, 6] });
    const result = scheduleCardioCandidates(constraints({ candidates: [run], fixedStrength }));
    expect(result.scheduled[0]).toMatchObject({ dayIndex: 2, overlap: 'NONE' });
    const onlyWrappedAdjacent = scheduleCardioCandidates(constraints({ candidates: [candidate({ lowerBodyDemand: 'HIGH', candidateDays: [6] })], fixedStrength }));
    expect(onlyWrappedAdjacent.scheduled[0]).toMatchObject({ dayIndex: 6, overlap: 'ADJACENT_DAY' });
    const onlySame = scheduleCardioCandidates(constraints({ candidates: [candidate({ lowerBodyDemand: 'HIGH', candidateDays: [0] })], fixedStrength }));
    expect(onlySame.scheduled[0]).toMatchObject({ dayIndex: 0, overlap: 'SAME_DAY' });
  });

  it('penalizes same/adjacent lower-body cardio days and sorts same-day assignments by id', () => {
    const allQuality = profile;
    const result = scheduleCardioCandidates(constraints({ goal: 'VO2_FITNESS', profile: allQuality, candidates: [
      candidate({ id: 'a-high', stimulus: 'QUALITY', lowerBodyDemand: 'HIGH', candidateDays: [0] }),
      candidate({ id: 'b-high', stimulus: 'QUALITY', lowerBodyDemand: 'HIGH', candidateDays: [0, 1] }),
      candidate({ id: 'c-high', stimulus: 'QUALITY', lowerBodyDemand: 'HIGH', candidateDays: [0] }),
      candidate({ id: 'd-low', stimulus: 'QUALITY', lowerBodyDemand: 'LOW', candidateDays: [0] }),
      candidate({ id: 'e-high', stimulus: 'QUALITY', lowerBodyDemand: 'HIGH', candidateDays: [0, 1] }),
      candidate({ id: 'f-high', stimulus: 'QUALITY', lowerBodyDemand: 'HIGH', candidateDays: [3] }),
    ], maxSessions: 6, totalMinutes: 360 }));
    expect(result.scheduled.map(item => `${item.dayIndex}:${item.id}`)).toEqual([
      '0:a-high', '0:c-high', '0:d-low', '1:b-high', '1:e-high', '3:f-high',
    ]);
  });

  it('returns no-overlap for low demand, respects empty availability and cycle lengths of one', () => {
    const low = scheduleCardioCandidates(constraints({ cycleDays: 1, maxActiveDays: 1, availableDays: [0], candidates: [candidate({ candidateDays: [0] })], fixedStrength: [{ id: 'upper', dayIndex: 0, lowerBodyDemand: 'HIGH' }] }));
    expect(low.scheduled[0]).toMatchObject({ dayIndex: 0, overlap: 'NONE' });
    const none = scheduleCardioCandidates(constraints({ availableDays: [], candidates: [candidate({ candidateDays: [0] })] }));
    expect(none.omitted[0].reason).toBe('NO_AVAILABLE_DAY');
    expect(scheduleCardioCandidates(constraints({ candidates: [] }))).toEqual({ scheduled: [], omitted: [], usedMinutes: 0, activeDays: [] });
  });

  it.each([
    [{ cycleDays: 0 }],
    [{ maxSessions: -1 }],
    [{ maxActiveDays: 8 }],
    [{ totalMinutes: Number.NaN }],
    [{ maxSessionMinutes: -1 }],
    [{ goal: 'UNKNOWN' }],
    [{ profile: null }],
    [{ allowDoubles: 0 }],
    [{ availableDays: [7] }],
    [{ availableDays: [1, 1] }],
    [{ candidates: [candidate(), candidate()] }],
    [{ candidates: [candidate({ id: '' })] }],
    [{ candidates: [candidate({ durationMinutes: 0 })] }],
    [{ candidates: [candidate({ candidateDays: [9] })] }],
    [{ candidates: [candidate({ lowerBodyDemand: 'MAYBE' as 'HIGH' })] }],
    [{ fixedStrength: [{ id: 'bad', dayIndex: 7, lowerBodyDemand: 'HIGH' }] }],
  ])('rejects invalid planning input %p', override => {
    expect(() => scheduleCardioCandidates(constraints(override as Partial<CardioPlanningConstraints>))).toThrow();
  });
});
