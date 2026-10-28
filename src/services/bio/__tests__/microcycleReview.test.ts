import { MuscleGroup, SetType, type Mesocycle, type WorkoutSession } from '@/models';
import { bioCycleExposure, buildBioCycles, createMicrocycleReview, microcycleReviewId, normalizeReviewAnswers, validMicrocycleReview } from '../microcycleReview';

const day = 86400000, now = 30 * day;
const plan = (patch: Partial<Mesocycle> = {}): Mesocycle => ({ id: 'plan', userId: 'owner', status: 'ACTIVE',
  prescriptionMode: 'MANUAL', currentMicrocycleIndex: 0, sessionsPerMicrocycle: 2, startedAt: 0, updatedAt: 0,
  targetVolumePerGroup: {}, plannedSessions: [0, 1].map((index) => ({ index, focus: 'UPPER', exercises: [], estimatedWorkMinutes: 0 })), ...patch });
const workout = (patch: Partial<WorkoutSession> = {}): WorkoutSession => ({ id: 'workout', userId: 'owner', mesocycleId: 'plan', microcycleId: 'plan:m0',
  microcycleIndex: 0, plannedSessionIndex: 0, performedAt: day, completedAt: day + 60000, exercises: [], ...patch });
const closed = () => buildBioCycles('owner', [plan({ skippedSessions: { '0:1': 9 * day } })], [workout()], now)[0];

it('closes a session-based cycle with explicit skips, without inventing a seven-day period', () => {
  const cycle = closed();
  expect(cycle).toMatchObject({ closed: true, completedSlots: 1, skippedSlots: 1, plannedSlots: 2, observedFrom: day, observedTo: 9 * day });
  expect(cycle.observedTo! - cycle.observedFrom!).toBe(8 * day);
  const review = createMicrocycleReview('owner', cycle, { recovery: 'USUAL' }, 'SUBMITTED', undefined, now);
  expect(review.observedTo).toBe(9 * day); expect(review.updatedAt).toBe(now);
  expect(review.answers).toEqual({ recovery: 'USUAL' }); expect(review).not.toHaveProperty('score');
});

it('counts workouts, skips and rest markers separately and permits an all-skipped review', () => {
  const cycles = buildBioCycles('owner', [plan({ skippedSessions: { '0:0': day, '0:1': 2 * day }, restDayChecks: { '0:r': true } })], [], now);
  expect(cycles[0]).toMatchObject({ closed: true, completedSlots: 0, skippedSlots: 2 });
  expect(bioCycleExposure(cycles[0], new Map())).toEqual({ workouts: 0, workingSets: 0, minutes: 0 });
  expect(buildBioCycles('owner', [plan({ restDayChecks: { '0:r': true } })], [], now)[0].closed).toBe(false);
  expect(buildBioCycles('owner', [plan({ skippedSessions: { '0:0': day, '0:1': now + 1 } })], [workout()], now)[0].skippedSlots).toBe(0);
});

it('filters foreign, discarded, unfinished, invalid and future records; free workouts cannot complete a prescribed slot', () => {
  const records = [workout(), workout({ id: 'foreign', userId: 'other', plannedSessionIndex: 1 }), workout({ id: 'discarded', discardedAt: now, plannedSessionIndex: 1 }),
    workout({ id: 'pending', completedAt: undefined }), workout({ id: 'future', completedAt: now + 1 }), workout({ id: 'reversed', completedAt: 0 }),
    workout({ id: 'bad-time', performedAt: NaN }), workout({ id: 'bad-index', microcycleIndex: -1 }), workout({ id: '', plannedSessionIndex: 1 }),
    workout({ id: 'free', plannedSessionIndex: undefined }), workout({ id: 'unknown-slot', plannedSessionIndex: 42 })];
  const result = buildBioCycles('owner', [plan(), plan({ id: 'other', userId: 'other' })], records, now);
  expect(result).toHaveLength(1); expect(result[0].completedSlots).toBe(1); expect(result[0].closed).toBe(false);
  expect(result[0].workouts.map((item) => item.id)).toEqual(['workout', 'free', 'unknown-slot']);
  expect(buildBioCycles('owner', [plan({ plannedSessions: undefined, currentMicrocycleIndex: -1 })], [], now)).toEqual([]);
  expect(buildBioCycles('owner', [plan({ plannedSessions: [] })], [], now)[0].closed).toBe(false);
});

it('supports Firestore timestamps, historical cycles, plan revisions, stable sorting and deduplicated corrections', () => {
  const records = [workout(), workout({ editedAt: day * 3, exercises: [] }), workout({ editedAt: day * 2 }),
    workout({ id: 'next', microcycleIndex: 1, plannedSessionIndex: 4, performedAt: { seconds: 300000, nanoseconds: 1 }, completedAt: { seconds: 300060, nanoseconds: 0 } })];
  const amended = plan({ currentMicrocycleIndex: 1, prescriptionRevisions: [{ fromMicrocycleIndex: 1,
    plannedSessions: [{ index: 4, focus: 'LOWER', exercises: [], estimatedWorkMinutes: 0 }] }], skippedSessions: { 'bad': day, '0:1': day * 2 } });
  const cycles = buildBioCycles('owner', [amended, amended, plan({ id: 'z', currentMicrocycleIndex: 0 })], records, now);
  expect(cycles.map((cycle) => cycle.id)).toEqual(['plan:m1', 'plan:m0', 'z:m0']);
  expect(cycles[0].closed).toBe(true); expect(cycles[1].workouts).toHaveLength(1); expect(cycles[1].workouts[0].editedAt).toBe(day * 3);
});

it.each(['', 'a/b', 'a\u0000b', 'a'.repeat(301)])('rejects invalid identities %p', (id) => {
  expect(() => microcycleReviewId(id, 0)).toThrow();
  expect(buildBioCycles(id, [plan()], [], now)).toEqual([]);
});
it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid indices %p', (index) => expect(() => microcycleReviewId('plan', index)).toThrow());
it.each([-1, NaN, Infinity, 1e20])('rejects invalid observation clocks %p', (time) => expect(buildBioCycles('owner', [plan()], [], time)).toEqual([]));

it('keeps missing answers unknown, deduplicates muscle/context selections and separates pain from recovery', () => {
  expect(normalizeReviewAnswers({})).toEqual({});
  expect(normalizeReviewAnswers({ unrecoveredMuscles: [] })).toEqual({ unrecoveredMuscles: [] });
  expect(normalizeReviewAnswers({ recovery: 'BETTER', discomfort: 'PRESENT', discomfortMuscles: [MuscleGroup.CHEST],
    unrecoveredMuscles: [MuscleGroup.TRICEPS, MuscleGroup.CHEST, MuscleGroup.TRICEPS], context: ['STRESS', 'SLEEP', 'STRESS'] }))
    .toEqual({ recovery: 'BETTER', discomfort: 'PRESENT', discomfortMuscles: [MuscleGroup.CHEST], unrecoveredMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS], context: ['SLEEP', 'STRESS'] });
  expect(normalizeReviewAnswers({ discomfort: 'NONE', discomfortMuscles: [MuscleGroup.CHEST] })).toEqual({ discomfort: 'NONE' });
});
it.each([null, [], 1, { recovery: 'UNKNOWN' }, { discomfort: 'sometimes' }, { sustainability: 5 }, { context: ['unknown'] },
  { context: 'STRESS' }, { unrecoveredMuscles: ['unknown'] }, { discomfortMuscles: [MuscleGroup.UNCLASSIFIED] }])('rejects invalid answers %p', (value) => {
  expect(() => normalizeReviewAnswers(value as any)).toThrow();
});

it('saves partial feedback or a dismissal, preserves creation time on correction and never dismisses submitted feedback', () => {
  const review = createMicrocycleReview('owner', closed(), { unrecoveredMuscles: [] }, 'SUBMITTED', undefined, now);
  expect(validMicrocycleReview(review, 'owner')).toBe(true);
  expect(validMicrocycleReview({ ...review, answers: { sustainability: 'YES', recovery: 'BETTER' } }, 'owner')).toBe(true);
  const corrected = createMicrocycleReview('owner', closed(), { recovery: 'WORSE', discomfort: 'PRESENT' }, 'SUBMITTED', review, now + 1);
  expect(corrected.createdAt).toBe(now); expect(corrected.updatedAt).toBe(now + 1);
  expect(() => createMicrocycleReview('owner', closed(), {}, 'DISMISSED', review, now + 1)).toThrow('reviewAlreadySubmitted');
  const dismissed = createMicrocycleReview('owner', closed(), {}, 'DISMISSED', undefined, now);
  expect(validMicrocycleReview(dismissed, 'owner')).toBe(true);
  expect(createMicrocycleReview('owner', closed(), { sustainability: 'YES' }, 'SUBMITTED', dismissed, now + 1).createdAt).toBe(now);
  expect(() => createMicrocycleReview('owner', closed(), { context: ['STRESS'] }, 'SUBMITTED', undefined, now)).toThrow('emptyReview');
});

it('rejects stale ownership, reopened cycles and invalid persisted documents', () => {
  const cycle = closed(), review = createMicrocycleReview('owner', cycle, { recovery: 'USUAL' }, 'SUBMITTED', undefined, now);
  for (const patch of [{ closed: false }, { id: 'different' }, { observedFrom: null }, { observedTo: null },
    { observedFrom: now + 1 }, { observedTo: now + 1 }, { observedFrom: -1 }, { observedTo: NaN }]) {
    expect(() => createMicrocycleReview('owner', { ...cycle, ...patch }, {}, 'DISMISSED', undefined, now)).toThrow();
  }
  expect(() => createMicrocycleReview('', cycle, {}, 'DISMISSED', undefined, now)).toThrow();
  expect(() => createMicrocycleReview('owner', cycle, {}, 'invalid' as any, undefined, now)).toThrow();
  expect(() => createMicrocycleReview('owner', cycle, {}, 'DISMISSED', undefined, NaN)).toThrow();
  for (const previous of [{ ...review, userId: 'other' }, { ...review, id: 'other' }, { ...review, updatedAt: now + 1 }]) {
    expect(() => createMicrocycleReview('owner', cycle, { recovery: 'BETTER' }, 'SUBMITTED', previous, now)).toThrow('staleReview');
  }
  for (const invalid of [null, {}, { ...review, userId: 'other' }, { ...review, questionnaireVersion: 2 }, { ...review, status: 'invalid' },
    { ...review, createdAt: now + 1 }, { ...review, observedFrom: now + 1 }, { ...review, observedTo: now + 1 },
    { ...review, answers: {} }, { ...review, answers: { recovery: 'USUAL', unknown: true } }, { ...review, status: 'DISMISSED' }]) {
    expect(validMicrocycleReview(invalid, 'owner')).toBe(false);
  }
});

it('counts completed work without warmups, targets, duplicate records, fabricated RIR or a weekly normalization', () => {
  const set: any = { id: 'normal', setType: SetType.NORMAL, targetReps: 10, targetWeight: 40, targetRIR: 2, isAutoFilled: false,
    actualReps: 8, actualWeight: 35, completionState: 'DONE' };
  const record = workout({ exercises: [{ id: 'ex', exerciseId: 'missing-catalogue', order: 0, isSwap: false,
    sets: [set, { ...set, id: 'warmup', setType: SetType.WARMUP }, { ...set, id: 'pending', actualReps: undefined, completionState: 'PENDING' }] }] });
  const cycle = buildBioCycles('owner', [plan()], [record, record], now)[0];
  expect(bioCycleExposure(cycle, new Map())).toEqual({ workouts: 1, workingSets: 1, minutes: 1 });
  expect(record.exercises[0].sets[0].actualRIR).toBeUndefined();
});
