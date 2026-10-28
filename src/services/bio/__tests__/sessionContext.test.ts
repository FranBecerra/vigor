import { MuscleGroup, SetType, type WorkoutSession } from '@/models';
import { buildBioSessionContext } from '../sessionContext';
import { buildReadinessIndex } from '../readinessIndex';
import { buildBioCycles, createMicrocycleReview } from '../microcycleReview';
import { readinessFixture } from '@/test-support/readinessFixture';
import { sessionContextFixture, contextWorkout, CONTEXT_UPPER, CONTEXT_LOWER } from '@/test-support/sessionContextFixture';

function reviewed(weights = [40, 41, 42, 50, 51, 52]) {
  const input = sessionContextFixture(), plan = input.plans[0];
  plan.plannedSessions = [plan.plannedSessions![0]]; plan.sessionsPerMicrocycle = 1; plan.currentMicrocycleIndex = 2; plan.projectedMicrocycles = 4;
  input.history = weights.map((weight, index) => {
    const workout = contextWorkout(CONTEXT_UPPER, { id: `w${index}`, mesocycleId: plan.id, microcycleIndex: index < 3 ? 0 : 1,
      performedAt: input.now - (11 - index * 2) * 86400000 - 3600000, completedAt: input.now - (11 - index * 2) * 86400000 });
    workout.exercises[0].sets[0].actualWeight = weight; return workout;
  });
  input.reviews = buildBioCycles(input.owner, [plan], input.history, input.now).filter((cycle) => cycle.closed).map((cycle) =>
    createMicrocycleReview(input.owner, cycle, { recovery: 'USUAL', discomfort: 'NONE', sustainability: 'YES', unrecoveredMuscles: [] }, 'SUBMITTED', undefined, input.now - 3600000));
  return input;
}
it('resolves the same active next prescription as home, allows preview selection, and never mutates inputs', () => {
  const input = sessionContextFixture(), before = JSON.stringify(input);
  const context = buildBioSessionContext(input);
  expect(context).toMatchObject({ policy: 'SESSION_CONTEXT_V1', status: 'AVAILABLE', target: { name: 'Synthetic Upper', microcycleIndex: 0 },
    general: { coverage: 'UNAVAILABLE' }, prompts: [] });
  expect(context.choices.map((choice) => choice.index)).toEqual([0, 1]);
  expect(JSON.stringify(input)).toBe(before);
  expect(buildBioSessionContext({ ...input, selectedSessionIndex: 1 }).target!.name).toBe('Synthetic Lower');
  expect(buildBioSessionContext({ ...input, selectedSessionIndex: 99 }).target!.session.index).toBe(0);
  input.plans[0].sessionOrder = [1, 0]; expect(buildBioSessionContext(input).target!.session.index).toBe(1);
  input.plans[0].sessionOrder = undefined;
  input.plans[0].trainingCalendar = { '0:0': { kind: 'workout', date: '2026-11-01', sessionIndex: 0 }, '0:1': { kind: 'workout', date: '2026-10-29', sessionIndex: 1 } } as any;
  expect(buildBioSessionContext(input).target!.session.index).toBe(1);
});
it('respects actual completion, skips and effective prescription edits without assuming a seven-day microcycle', () => {
  const input = sessionContextFixture(), plan = input.plans[0];
  input.history = [contextWorkout(CONTEXT_UPPER, { mesocycleId: plan.id, performedAt: input.now - 12 * 86400000, completedAt: input.now - 11 * 86400000 })];
  expect(buildBioSessionContext(input).target!.session.index).toBe(1);
  plan.skippedSessions = { '0:1': input.now - 1 }; expect(buildBioSessionContext(input).target!.microcycleIndex).toBe(1);
  plan.projectedMicrocycles = 1; expect(buildBioSessionContext(input).status).toBe('COMPLETE');
  plan.skippedSessions = { '0:1': input.now + 1 }; expect(buildBioSessionContext(input).target!.session.index).toBe(1);
  plan.skippedSessions = { '0:1': NaN }; expect(buildBioSessionContext(input).target!.session.index).toBe(1);
  plan.sessionOverrides = { '0:1': { ...plan.plannedSessions![1], exercises: [{ ...plan.plannedSessions![1].exercises[0], sets: [{ setType: SetType.FAILURE, targetReps: 8, targetRIR: 0 }] }] } };
  expect(buildBioSessionContext(input).target!.session.exercises[0].sets).toEqual([{ setType: SetType.FAILURE, targetReps: 8, targetRIR: 0 }]);
});
it('describes pending rest markers without scheduling training or advancing workout progress', () => {
  const input = sessionContextFixture(), plan = input.plans[0]; plan.restDays = [{ id: 'start', afterSessionIndex: null }];
  expect(buildBioSessionContext(input).target!.restBefore).toBe(true);
  plan.restDayChecks = { '0:start': true }; expect(buildBioSessionContext(input).target!.restBefore).toBe(false);
  plan.restDays = [{ id: 'after-upper', afterSessionIndex: 0 }]; input.history = [contextWorkout(CONTEXT_UPPER, { mesocycleId: plan.id })];
  expect(buildBioSessionContext(input).target).toMatchObject({ session: { index: 1 }, restBefore: true });
});
it('withholds private context for absent/ambiguous/foreign/inactive or malformed plans rather than selecting a convenient routine', () => {
  for (const patch of [{ owner: '' }, { now: NaN }, { now: -1 }, { now: 9e15 }, { routines: [] }]) expect(buildBioSessionContext({ ...sessionContextFixture(), ...patch }).status).toBe('NO_ACTIVE_ROUTINE');
  let input = sessionContextFixture(); input.routines[0].userId = 'other'; expect(buildBioSessionContext(input).target).toBeUndefined();
  input = sessionContextFixture(); input.routines[0].isActive = false; expect(buildBioSessionContext(input).target).toBeUndefined();
  input = sessionContextFixture(); input.routines = [...input.routines, { ...input.routines[0], id: 'duplicate' }]; expect(buildBioSessionContext(input).status).toBe('AMBIGUOUS');
  for (const patch of [{ plans: [] }, { plans: [sessionContextFixture().plans[0], sessionContextFixture().plans[0]] }]) expect(buildBioSessionContext({ ...sessionContextFixture(), ...patch }).status).toBe('UNAVAILABLE');
  for (const patch of [{ userId: 'other' }, { status: 'COMPLETED' }, { currentMicrocycleIndex: -1 }, { currentMicrocycleIndex: 52 }, { currentMicrocycleIndex: 0.5 },
    { projectedMicrocycles: 0 }, { projectedMicrocycles: 53 }, { projectedMicrocycles: 1.5 }, { plannedSessions: [] }, { restDays: [{ id: 'bad/id', afterSessionIndex: null }] }]) {
    const invalid = sessionContextFixture(); Object.assign(invalid.plans[0], patch); expect(buildBioSessionContext(invalid).status).toBe('UNAVAILABLE');
  }
  input = sessionContextFixture(); input.routines[0].generation = undefined as any; expect(buildBioSessionContext(input).status).toBe('UNAVAILABLE');
  input = sessionContextFixture(); delete input.plans[0].projectedMicrocycles; expect(buildBioSessionContext(input).status).toBe('AVAILABLE');
});
it('attributes planned working sets deterministically with snapshots, multiple primary groups and explicit unknowns', () => {
  const input = sessionContextFixture(), session = input.plans[0].plannedSessions![0], row = session.exercises[0];
  row.exerciseSnapshot = { ...CONTEXT_UPPER, primaryMuscles: [MuscleGroup.CHEST, MuscleGroup.TRICEPS], secondaryMuscles: [MuscleGroup.TRICEPS, MuscleGroup.BICEPS, MuscleGroup.UNCLASSIFIED, 'bad' as any] };
  row.sets.push({ setType: SetType.WARMUP, targetReps: 10, targetRIR: 4 });
  session.exercises.push({ ...row, exerciseId: 'missing', exerciseSnapshot: undefined });
  session.exercises.push({ ...row, exerciseId: 'unclassified', exerciseSnapshot: { ...CONTEXT_UPPER, primaryMuscle: MuscleGroup.UNCLASSIFIED, primaryMuscles: [], secondaryMuscles: [] } });
  session.exercises.push({ ...row, exerciseId: 'only-warmup', sets: [{ setType: SetType.WARMUP, targetReps: 10, targetRIR: 4 }] });
  const context = buildBioSessionContext(input);
  expect(context.unknownPlannedExercises).toBe(2);
  expect(context.exposure).toEqual([{ muscle: MuscleGroup.BICEPS, plannedSets: 1, recentSets: 0 },
    { muscle: MuscleGroup.CHEST, plannedSets: 2, recentSets: 0 }, { muscle: MuscleGroup.TRICEPS, plannedSets: 2, recentSets: 0 }]);
  delete (row.exerciseSnapshot as any).secondaryMuscles;
  expect(buildBioSessionContext(input).status).toBe('UNAVAILABLE');
});
it('shows all owned recent actual work, excludes warmups/pending/future/discarded copies and never equates exposure with recovery', () => {
  const input = sessionContextFixture(), work = contextWorkout();
  const extra = { ...work.exercises[0].sets[0], id: 'warmup', setType: SetType.WARMUP };
  work.exercises[0].sets.push(extra, { ...extra, id: 'pending', setType: SetType.NORMAL, completionState: 'PENDING' });
  work.exercises[0].sets[0].setType = SetType.DROP_SET; work.exercises[0].sets[0].extensions = [{ reps: 5, weight: 30 }];
  input.history = [work, { ...contextWorkout(), id: 'foreign', userId: 'other' }, { ...contextWorkout(), id: 'future', completedAt: input.now + 1 },
    { ...contextWorkout(), id: 'old', completedAt: input.now - 72 * 3600000 - 1, performedAt: input.now - 73 * 3600000 },
    { ...contextWorkout(), id: 'boundary', completedAt: input.now - 72 * 3600000, performedAt: input.now - 73 * 3600000 },
    { ...contextWorkout(), id: 'discarded' }, { ...contextWorkout(), id: 'discarded', editedAt: input.now, discardedAt: input.now }];
  const unknown = contextWorkout({ ...CONTEXT_UPPER, id: 'unknown', primaryMuscle: MuscleGroup.UNCLASSIFIED, secondaryMuscles: [] });
  input.history = [...input.history, { ...unknown, id: 'unknown' }];
  const missing = contextWorkout(); missing.exercises[0].exerciseSnapshot = undefined; missing.exercises[0].exerciseId = 'missing'; missing.id = 'missing'; input.history = [...input.history, missing];
  const fallback = contextWorkout(); fallback.id = 'catalogue-fallback'; delete fallback.exercises[0].exerciseSnapshot; input.history = [...input.history, fallback];
  const context = buildBioSessionContext(input), chest = context.exposure.find((entry) => entry.muscle === MuscleGroup.CHEST)!;
  expect(chest.recentSets).toBe(3); expect(chest.lastAt).toBe(work.completedAt); expect(context.unknownRecentExercises).toBe(2);
  expect(context.prompts).toEqual([]); expect(context.target!.session.index).toBe(0);
});
it('keeps general signals separate, including partial adverse data, and ignores stale/future/incompatible indices', () => {
  const input = sessionContextFixture(), index = buildReadinessIndex(readinessFixture(), 480, input.now);
  expect(buildBioSessionContext({ ...input, readiness: index }).general).toMatchObject({ coverage: 'COMPLETE', signals: [] });
  expect(buildBioSessionContext({ ...input, readiness: { ...index, sleep: { ...index.sleep, score: 99.9 }, cardiac: { score: 96 } } }).prompts).toEqual([]);
  for (const patch of [{ calculatedAt: input.now + 1 }, { calculatedAt: input.now - 300001 }, { calculatedAt: NaN },
    { policy: 'unknown' }, { reasons: ['STALE'] }, { reasons: ['NO_OBSERVATIONS'] }]) {
    expect(buildBioSessionContext({ ...input, readiness: { ...index, ...patch } as any }).general.coverage).toBe('UNAVAILABLE');
  }
  let changed = { ...index, sleep: { ...index.sleep, score: 80 }, cardiac: { ...index.cardiac, score: 60 } };
  expect(buildBioSessionContext({ ...input, readiness: changed })).toMatchObject({ general: { signals: ['SLEEP_SHORTFALL', 'CARDIAC_DEPARTURE'] }, prompts: ['GENERAL_CHANGE'] });
  changed = { ...changed, score: undefined, cardiac: { ...index.cardiac, score: undefined } } as any;
  expect(buildBioSessionContext({ ...input, readiness: changed }).general).toMatchObject({ coverage: 'PARTIAL', signals: ['SLEEP_SHORTFALL'] });
  const unusual = { ...index, score: undefined, reasons: ['UNUSUAL_SIGNAL'], sleep: { ...index.sleep, score: undefined }, cardiac: {} } as any;
  expect(buildBioSessionContext({ ...input, readiness: unusual }).general).toMatchObject({ coverage: 'PARTIAL', signals: ['UNUSUAL_SIGNAL'] });
  expect(buildBioSessionContext({ ...input, readiness: { ...index, score: undefined, sleep: { ...index.sleep, score: NaN }, cardiac: { score: 101 } } }).general.coverage).toBe('UNAVAILABLE');
  expect(buildBioSessionContext({ ...input, readiness: { ...index, sleep: { ...index.sleep, score: -1 } } }).general.coverage).toBe('PARTIAL');
});
it('shows dated feedback and comparable performance without allowing a high general index to erase discomfort', () => {
  const input = reviewed(); input.readiness = buildReadinessIndex(readinessFixture(), 480, input.now);
  input.reviews[0].answers.discomfort = 'PRESENT'; input.reviews[0].answers.discomfortMuscles = [MuscleGroup.CHEST];
  input.reviews[0].answers.unrecoveredMuscles = [MuscleGroup.CHEST];
  const context = buildBioSessionContext(input);
  expect(context.general.coverage).toBe('COMPLETE');
  expect(context.review).toMatchObject({ microcycleIndex: 1, updatedAt: input.now - 3600000 });
  expect(context.prompts).toEqual(['DATED_DISCOMFORT', 'DATED_LOCAL_RECOVERY', 'DOSE_REVIEW']);
  expect(context.dose.some((entry) => entry.reason === 'DISCOMFORT')).toBe(true);
  const progress = buildBioSessionContext(reviewed()); expect(progress.dose.some((entry) => entry.reason === 'RECORDED_PROGRESS')).toBe(true);
  const lower = buildBioSessionContext(reviewed([50, 51, 52, 40, 41, 42])); expect(lower.prompts).toContain('DOSE_REVIEW');
  const unconfirmed = reviewed(); unconfirmed.history.forEach((session) => session.exercises[0].sets[0].actualRIRSource = 'INHERITED_TARGET');
  expect(buildBioSessionContext(unconfirmed).dose.every((entry) => entry.reason === 'INSUFFICIENT')).toBe(true);
});
it('does not treat missing, conflicting, dismissed, foreign, stale or future reviews as good current tolerance', () => {
  for (const mode of ['missing', 'conflicting', 'dismissed', 'foreign', 'historyChanged', 'future', 'invalid', 'unavailable']) {
    const input = reviewed();
    if (mode === 'missing') input.reviews = [];
    if (mode === 'conflicting') input.reviews = [...input.reviews, { ...input.reviews[0], answers: { discomfort: 'PRESENT' } }];
    if (mode === 'dismissed') { input.reviews[0].status = 'DISMISSED'; input.reviews[0].answers = {}; }
    if (mode === 'foreign') input.reviews[0].userId = 'other';
    if (mode === 'historyChanged') input.reviews[0].observedTo--;
    if (mode === 'future') input.reviews[0].updatedAt = input.now + 1;
    if (mode === 'invalid') input.reviews[0].questionnaireVersion = 99 as any;
    if (mode === 'unavailable') input.reviewsAvailable = false;
    const context = buildBioSessionContext(input); expect(context.review).toBeUndefined();
    expect(context.reviewStatus).toBe(mode === 'unavailable' ? 'UNAVAILABLE' : 'MISSING');
    expect(context.prompts).not.toContain('DATED_DISCOMFORT'); expect(context.prompts).not.toContain('DATED_LOCAL_RECOVERY');
  }
});
it('only associates localized retrospective concerns and dose evidence with muscles used in the intended session', () => {
  const input = reviewed(); input.reviews[0].answers.discomfort = 'PRESENT'; input.reviews[0].answers.discomfortMuscles = [MuscleGroup.QUADS];
  input.reviews[0].answers.unrecoveredMuscles = [MuscleGroup.QUADS];
  expect(buildBioSessionContext(input).prompts).toEqual([]);
  delete input.reviews[0].answers.discomfortMuscles; expect(buildBioSessionContext(input).prompts).toContain('DATED_DISCOMFORT');
  input.reviews[0].answers.discomfortMuscles = []; expect(buildBioSessionContext(input).prompts).toContain('DATED_DISCOMFORT');
});
it('does not let an already executed later-index cycle override context for an earlier intended cycle', () => {
  const input = reviewed(); input.plans[0].projectedMicrocycles = 6;
  input.plans[0].skippedSessions = { '5:0': input.now - 1 };
  const later = contextWorkout(CONTEXT_UPPER, { id: 'later-cycle', mesocycleId: input.plans[0].id, microcycleIndex: 4 });
  input.history = [...input.history, later];
  expect(buildBioSessionContext(input).review!.microcycleIndex).toBe(1);
  expect(buildBioSessionContext(input).dose.some((entry) => entry.reason === 'RECORDED_PROGRESS')).toBe(true);
});
