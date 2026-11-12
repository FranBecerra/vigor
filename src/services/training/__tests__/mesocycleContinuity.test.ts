import { SetType, type WorkoutSession } from '@/models';
import { hybridFixture } from '@/test-support/hybridFixture';
import { continuityFixture } from '@/test-support/continuityFixture';
import { completedBlockAfterWorkout, continuityPerformanceEvidence, previewMesocycleSuccessor, reviewMesocycleClosure, strengthLongitudinalIndicators } from '../mesocycleContinuity';
import { reviseSessionFeedback } from '../sessionFeedback';
import { localCheckInDate } from '@/services/bio/dailyCheckIn';
import { microcycleReviewId } from '@/services/bio/microcycleReview';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { proposeCalendar, shiftCalendarDate } from '../trainingCalendar';
import { sessionsForMicrocycle } from '../mesocycleEditing';
import { plannedSetId } from '../plannedSessionRuntime';

const now = 1800000000000;
const fixture = () => {
  const { draft } = hybridFixture();
  const routine = { ...draft.routine, hybrid: undefined };
  const source = { ...draft.mesocycle, projectedMicrocycles: 1, prescriptionMode: 'MANUAL' as const };
  const completed = (index = 0, patch: Partial<WorkoutSession> = {}): WorkoutSession => ({
    id: `workout-${index}`, userId: source.userId, mesocycleId: source.id, microcycleId: 'microcycle', microcycleIndex: 0, plannedSessionIndex: index,
    performedAt: now - 60000, completedAt: now - 20000, exercises: [{ id: 'ex', exerciseId: 'ex', order: 0, isSwap: false, sets: [
      { id: 'warmup', setType: SetType.WARMUP, targetRIR: 0, targetReps: 10, targetWeight: 20, isAutoFilled: false, actualReps: 10, actualWeight: 20 },
      { id: 'work', setType: SetType.NORMAL, targetRIR: 2, targetReps: 10, targetWeight: 40, isAutoFilled: false, actualReps: 10, actualWeight: 40 },
    ] }], ...patch,
  });
  return { routine, source, completed };
};

function blockReviewFixture(automatic = false) {
  const { data, exercises } = continuityFixture(now);
  const goal = data.routine.generation.goal;
  const source = { ...data.source, prescriptionMode: automatic ? 'AUTOMATIC' as const : 'MANUAL' as const };
  const history = data.history.map(workout => {
    const session = sessionsForMicrocycle(source, goal, workout.microcycleIndex)[0];
    const planned = session.exercises[0];
    const exercise = workout.exercises[0];
    return { ...workout, exercises: [{ ...exercise, sets: planned.sets.map((set, index) => ({
      ...exercise.sets[index], id: plannedSetId(session.index, planned.order, index),
      targetRIR: set.targetRIR, targetReps: set.targetReps,
    })) }] };
  });
  const feedback: MicrocycleReview[] = history.map(workout => ({
    id: microcycleReviewId(source.id, workout.microcycleIndex), userId: source.userId, mesocycleId: source.id,
    microcycleIndex: workout.microcycleIndex, questionnaireVersion: 1, status: 'SUBMITTED',
    answers: { recovery: 'USUAL', discomfort: 'NONE', sustainability: 'YES', unrecoveredMuscles: [] },
    observedFrom: workout.performedAt as number, observedTo: workout.completedAt as number, createdAt: now - 1, updatedAt: now,
  }));
  const read = (records: WorkoutSession[] = history, reports = feedback, plan = source) =>
    strengthLongitudinalIndicators(plan, goal, records, [], exercises, now, reports);
  return { read, history, feedback, source };
}

it('pairs athlete-reported effort with the effective prescribed set, never by display position', () => {
  const { read, history, source } = blockReviewFixture();
  const [workout] = history, [exercise] = workout.exercises;
  const [a, b, c] = exercise.sets;
  const modified = { ...workout, exercises: [{ ...exercise, sets: [
    { ...a, id: 'extra', actualRIR: 0 }, { ...b, actualRIR: 0 },
    { ...a, actualRIRSource: 'INHERITED_TARGET' as const }, { ...c, targetRIR: c.targetRIR + 1 },
  ] }] };
  expect(read([modified]).cycles[0].effort).toEqual({ planned: [a.targetRIR, b.targetRIR, c.targetRIR],
    pairedTargets: [b.targetRIR], reported: [0], harder: 1, onTarget: 0, easier: 0 });
  const override = source.plannedSessions[0];
  const plan = { ...source, sessionOverrides: { '0:0': { ...override, exercises: override.exercises.map(entry => ({
    ...entry, sets: entry.sets.map(set => ({ ...set, targetRIR: 5 })),
  })) } } };
  expect(read([modified], [], plan).cycles[0].effort).toMatchObject({ planned: [5, 5, 5], reported: [] });
  for (const changed of [
    { ...exercise, isSwap: true }, { ...exercise, sets: [a, { ...a, actualRIR: 0 }] },
    { ...exercise, sets: [{ ...a, completionState: 'PENDING' as const }, { ...b, actualRIR: Infinity }, { ...c, actualRIRSource: undefined }] },
  ]) expect(read([{ ...workout, exercises: [changed] }]).cycles[0].effort.reported).toEqual([]);
});

it('supports keeping the approach only with progress and evidence of performed and tolerated dose', () => {
  const { read, history, feedback } = blockReviewFixture();
  expect(read().nextBlockReview).toEqual({ action: 'KEEP', cycleIndexes: [2, 3], signals: ['PROGRESS_WITH_TOLERANCE'] });
  expect(read(history, []).nextBlockReview.action).toBe('INSUFFICIENT');
  const extraWork = history.map((workout, index) => index !== 3 ? workout : { ...workout, exercises: workout.exercises.map(entry => ({
    ...entry, sets: [...entry.sets, { ...entry.sets[0], id: 'added' }],
  })) });
  expect(read(extraWork, feedback).nextBlockReview.action).toBe('INSUFFICIENT');
  expect(read(history.filter(workout => workout.microcycleIndex !== 2)).nextBlockReview.action).toBe('INSUFFICIENT');
});

it('flags repeated harder RIR and recovery or feasibility concerns without changing the plan', () => {
  const { read, history, feedback } = blockReviewFixture();
  const harder = history.map((workout, index) => index < 2 ? workout : { ...workout, exercises: workout.exercises.map(entry => ({
    ...entry, sets: entry.sets.map(set => ({ ...set, actualRIR: 0 })),
  })) });
  const reports = feedback.map((report, index): MicrocycleReview => index < 2 ? report : ({ ...report,
    answers: { recovery: 'WORSE', sustainability: index === 2 ? 'TIGHT' : 'NO' },
  }));
  expect(read(harder, reports).nextBlockReview).toEqual({ action: 'REVIEW', cycleIndexes: [2, 3],
    signals: ['REPEATED_HARDER_RIR', 'REPEATED_RECOVERY_DIFFICULTY', 'REPEATED_FEASIBILITY_DIFFICULTY'] });
  expect(read([history[0], history[1], history[2], harder[3]], [reports[3]]).nextBlockReview.action).toBe('INSUFFICIENT');
  const sparse = harder.map(workout => ({ ...workout, exercises: workout.exercises.map(entry => ({ ...entry,
    sets: entry.sets.map((set, index) => ({ ...set, actualRIRSource: index === 0 ? 'ATHLETE' as const : 'INHERITED_TARGET' as const })),
  })) }));
  expect(read(sparse, []).nextBlockReview.action).toBe('INSUFFICIENT');
  const muscle = history[0].exercises[0].exerciseSnapshot!.primaryMuscle;
  const local = feedback.map((report, index) => index < 2 ? report : { ...report, answers: { unrecoveredMuscles: [muscle] } });
  expect(read(history, local).nextBlockReview).toMatchObject({ action: 'REVIEW', signals: ['REPEATED_RECOVERY_DIFFICULTY'] });
});

it('uses only matched accumulation sessions for programming trends and separates the planned deload', () => {
  const { read, history } = blockReviewFixture(true);
  const result = read();
  expect(result.cycles.map(cycle => cycle.plannedDeload)).toEqual([false, false, false, true]);
  expect(result.nextBlockReview.cycleIndexes).toEqual([1, 2]);
  expect(result.blockPerformance.flatMap(signal => signal.workoutIds)).not.toContain(history[3].id);
  const lower = blockReviewFixture();
  const declining = lower.history.map((workout, index) => ({ ...workout, exercises: workout.exercises.map(entry => ({
    ...entry, sets: entry.sets.map(set => ({ ...set, actualReps: index < 2 ? 10 : 8 })),
  })) }));
  expect(lower.read(declining).nextBlockReview).toMatchObject({ action: 'REVIEW', signals: ['LOWER_PERFORMANCE'] });
});

it('resolves skips without crediting them and reports only completed working sets', () => {
  const { routine, source, completed } = fixture();
  const plan = { ...source, skippedSessions: { '0:1': now - 1000 } };
  const review = reviewMesocycleClosure(plan, routine.generation.goal, [completed(), completed(1, { userId: 'foreign' })], now);
  expect(review).toMatchObject({ completed: 1, skipped: 1, pending: 0, actualWorkingSets: 1, canComplete: true, canInterrupt: true });
  expect(review.plannedWorkingSets).toBeGreaterThan(review.actualWorkingSets);
  expect(reviewMesocycleClosure({ ...plan, skippedSessions: { '0:0': now, '0:1': now } }, routine.generation.goal, [], now).canComplete).toBe(false);
});

it('blocks unresolved drafts, duplicate completed occurrences and inconsistent skip history', () => {
  const { routine, source, completed } = fixture(), goal = routine.generation.goal;
  for (const history of [[completed(0, { completedAt: undefined })], [completed(0, { completedAt: now + 1 })], [completed(), completed(0, { id: 'other-copy' })]]) {
    expect(reviewMesocycleClosure(source, goal, history, now)).toMatchObject({ blocked: true, canComplete: false, canInterrupt: false });
  }
  expect(reviewMesocycleClosure({ ...source, skippedSessions: { '0:0': now } }, goal, [completed()], now).blocked).toBe(true);
  const record = completed();
  expect(reviewMesocycleClosure(source, goal, [record, { ...record, discardedAt: now }], now)).toMatchObject({ completed: 0, pending: 2, blocked: false });
});

it('fails closed on invalid skip timestamps and does not close inactive blocks', () => {
  const { routine, source } = fixture(), goal = routine.generation.goal;
  for (const skippedAt of [NaN, Infinity, now + 1]) {
    const review = reviewMesocycleClosure({ ...source, skippedSessions: { '0:0': skippedAt } }, goal, [], now);
    expect(review).toMatchObject({ blocked: true, canComplete: false, canInterrupt: false });
  }
  for (const status of ['COMPLETED', 'INTERRUPTED'] as const) {
    const review = reviewMesocycleClosure({ ...source, status }, goal, [], now);
    expect(review).toMatchObject({ canComplete: false, canInterrupt: false });
  }
  expect(reviewMesocycleClosure({ ...source, status: 'DELOAD' }, goal, [], now).canInterrupt).toBe(true);
});

it('ignores records outside the source owner and block when resolving occurrences', () => {
  const { routine, source, completed } = fixture();
  const unrelated = [completed(0, { mesocycleId: 'other-block' }), completed(0, { userId: 'other-owner' })];
  expect(reviewMesocycleClosure(source, routine.generation.goal, unrelated, now)).toMatchObject({
    completed: 0, skipped: 0, pending: source.plannedSessions!.length, blocked: false,
  });
});

it('keeps dose and adherence tied to planned occurrences over the observed span', () => {
  const { routine, source, completed } = fixture();
  const day = 86_400_000;
  const start = now - 10 * day, skipped = now - day;
  const workout = completed(0, { performedAt: start, completedAt: start + 60000 });
  const plan = { ...source, skippedSessions: { '0:1': skipped } };
  const result = strengthLongitudinalIndicators(plan, routine.generation.goal, [
    workout, completed(1, { userId: 'another-owner' }), completed(1, { plannedSessionIndex: undefined }),
  ], [], new Map(), now);
  expect(result.cycles).toMatchObject([{
    cycleIndex: 0, plannedSessions: 2, completedSessions: 1, skippedSessions: 1, completionRate: 0.5,
    plannedWorkingSets: result.review.plannedWorkingSets, actualWorkingSets: 1,
    observedWindow: { from: start, to: skipped },
    workouts: [{ id: workout.id, sessionIndex: 0, effort: null, effortTiming: null }],
  }]);
});

it('keeps unknown effort and unresolved cycles explicit, and uses the latest effort correction', () => {
  const { routine, source, completed } = fixture();
  const initial = reviseSessionFeedback(undefined, 8, now - 20000, 'AT_FINISH');
  const original = completed(0, { sessionFeedback: initial });
  const indicators = (history: WorkoutSession[]) =>
    strengthLongitudinalIndicators(source, routine.generation.goal, history, [], new Map(), now).cycles[0];
  expect(indicators([])).toMatchObject({ completionRate: null, observedWindow: null, workouts: [] });
  expect(indicators([original])).toMatchObject({ completionRate: null, workouts: [{ effort: 8, effortTiming: 'AT_FINISH' }] });
  for (const feedback of [reviseSessionFeedback(initial, null, now, 'HISTORY_EDIT'), { ...initial!, recordedAt: now + 1 }]) {
    expect(indicators([original, { ...original, editedAt: now, sessionFeedback: feedback }]).workouts[0])
      .toMatchObject({ effort: null, effortTiming: null });
  }
  expect(indicators([original, completed(0, { id: 'conflicting-copy' })])).toMatchObject({
    completionRate: null, observedWindow: null, workouts: [], actualWorkingSets: 0,
  });
});

it('uses prior blocks for comparable performance without crediting their sessions to the current block', () => {
  const { data, exercises } = continuityFixture();
  const [a, b, ...current] = data.history;
  const prior = [a, b].map(row => ({ ...row, mesocycleId: 'previous' }));
  const result = strengthLongitudinalIndicators(data.source, data.routine.generation.goal, current, prior, exercises, data.now);
  expect(result.performance[0]).toMatchObject({ direction: 'HIGHER', workoutIds: data.history.map(row => row.id) });
  expect(result.cycles.map(row => row.completionRate)).toEqual([null, null, 1, 1]);
  expect(result.review.completed).toBe(2);
});

it('attributes planned and actual muscle dose and normalizes only complete dated schedules', () => {
  const { data, exercises } = continuityFixture(new Date(2026, 10, 6, 12).getTime());
  const { source, history, now, routine } = data;
  const first = history[0];
  const muscle = first.exercises[0].exerciseSnapshot!.primaryMuscle;
  const date = localCheckInDate(first.performedAt as number);
  const goal = routine.generation.goal;
  const calculate = (plan: typeof source, records = history) =>
    strengthLongitudinalIndicators(plan, goal, records, [], exercises, now).cycles[0];
  const calendar = proposeCalendar(date, 8, 0, [0]);
  const result = calculate({ ...source, trainingCalendar: calendar });
  expect(result.muscleDose).toMatchObject({
    planned: { byMuscle: { [muscle]: 3 }, unclassifiedSets: 0 },
    actual: { byMuscle: { [muscle]: 3 }, unclassifiedSets: 0 },
  });
  expect(result.datedWindow).toEqual({ from: date, to: shiftCalendarDate(date, 7), days: 8 });
  expect(result.muscleSetsPerSevenDays).toMatchObject({ planned: { [muscle]: 21 / 8 }, actual: { [muscle]: 21 / 8 } });
  expect(calculate(source).muscleSetsPerSevenDays).toEqual({ planned: null, actual: null });
  const gap = { ...calendar };
  delete gap[`rest:${shiftCalendarDate(date, 3)}`];
  for (const trainingCalendar of [gap, proposeCalendar(shiftCalendarDate(date, 1), 8, 0, [0]),
    proposeCalendar(date, 8, 0, [1]), { ...calendar, other: { kind: 'rest' as const, date, microcycleIndex: 1, checked: false } }]) {
    expect(calculate({ ...source, trainingCalendar }).datedWindow).toBeNull();
  }
  const unknown = { ...first, exercises: [{ ...first.exercises[0], exerciseId: 'removed', exerciseSnapshot: undefined }] };
  expect(calculate({ ...source, trainingCalendar: calendar }, [unknown]).muscleDose.actual).toEqual({ byMuscle: {}, unclassifiedSets: 3 });
  expect(calculate({ ...source, trainingCalendar: calendar }, [unknown]).muscleSetsPerSevenDays.actual).toBeNull();
  expect(calculate({ ...source, trainingCalendar: calendar }, []).datedWindow).toBeNull();
  expect(calculate({ ...source, trainingCalendar: calendar, plannedSessions: [source.plannedSessions[0], source.plannedSessions[0]] }).datedWindow).toBeNull();
});

it('uses submitted owner feedback for the exact resolved observation window', () => {
  const { data, exercises } = continuityFixture();
  const { source, history, routine, now } = data;
  const report: MicrocycleReview = {
    id: microcycleReviewId(source.id, 0), userId: source.userId, mesocycleId: source.id, microcycleIndex: 0,
    questionnaireVersion: 1, status: 'SUBMITTED', answers: { recovery: 'WORSE', discomfort: 'PRESENT' },
    observedFrom: history[0].performedAt as number, observedTo: history[0].completedAt as number,
    createdAt: now - 1, updatedAt: now,
  };
  const read = (reports: MicrocycleReview[], records = history) =>
    strengthLongitudinalIndicators(source, routine.generation.goal, records, [], exercises, now, reports).cycles[0].feedback;
  expect(read([report])).toEqual({ id: report.id, updatedAt: now, answers: report.answers });
  for (const rejected of [{ ...report, userId: 'foreign' }, { ...report, observedFrom: report.observedFrom - 1 },
    { ...report, updatedAt: now + 1 }, { ...report, status: 'DISMISSED' as const, answers: {} }]) {
    expect(read([rejected])).toBeNull();
  }
  expect(read([report, report])).toBeNull();
  expect(read([report], history.slice(1))).toBeNull();
});

it('previews a successor with the latest durable prescription, preserves order and omits old occurrence state', () => {
  const { routine, source, completed } = fixture();
  const revised = source.plannedSessions!.map(session => ({ ...session, name: 'Revised' }));
  const withEdits = { ...source, sessionOrder: [1, 0], prescriptionRevisions: [{ fromMicrocycleIndex: 0, plannedSessions: revised }],
    sessionOverrides: { '0:0': { ...revised[0], name: 'One-off' } }, skippedSessions: { '0:1': now }, restDayChecks: { '0:rest': true } };
  const options = { reason: 'COMPLETED' as const, now, successorId: 'successor', microcycles: 8 };
  const preview = previewMesocycleSuccessor(routine, withEdits, [completed()], options);
  expect(previewMesocycleSuccessor(routine, withEdits, [completed()], options)).toEqual(preview);
  expect(preview.sourcePatch.status).toBe('COMPLETED');
  expect(preview.routinePatch.activeMesocycleId).toBe('successor');
  expect(preview.successor).toMatchObject({ routineId: routine.id, plannedSessions: revised, sessionOrder: [1, 0], projectedMicrocycles: 8, prescriptionMode: 'MANUAL' });
  expect(preview.successor.sessionOverrides).toBeUndefined();
  expect(preview.successor.skippedSessions).toBeUndefined();
  expect(preview.successor.restDayChecks).toBeUndefined();
  preview.successor.plannedSessions![0].name = 'Edited';
  expect(revised[0].name).toBe('Revised');
  expect(() => previewMesocycleSuccessor({ ...routine, activeMesocycleId: 'changed' }, withEdits, [completed()], options)).toThrow();
  expect(() => previewMesocycleSuccessor(routine, source, [completed()], options)).toThrow();
  expect(previewMesocycleSuccessor(routine, source, [completed()], { ...options, reason: 'INTERRUPTED' }).sourcePatch.status).toBe('INTERRUPTED');
});

it('keeps inherited effort and context changes out of a comparable performance signal', () => {
  const { source, completed } = fixture();
  const exercise = hybridFixture().exercises.values().next().value!;
  const histories: WorkoutSession[] = [20, 21, 24, 25].map((actualWeight, i) => {
    const date = now - (5 - i) * 86400000;
    const base = completed(0, { id: `history-${i}`, completedAt: date, performedAt: date - 60000 });
    const item = base.exercises[0];
    return { ...base, exercises: [{ ...item, exerciseId: exercise.id, exerciseSnapshot: exercise,
      sets: [{ ...item.sets[1], actualWeight, actualRIR: 2, actualRIRSource: 'ATHLETE' as const }] }] };
  });
  expect(continuityPerformanceEvidence(source, histories, new Map(), now)).toMatchObject([
    { exerciseId: exercise.id, direction: 'HIGHER', exposures: 4 },
  ]);
  histories[3].exercises[0].sets[0] = { ...histories[3].exercises[0].sets[0], actualRIRSource: 'INHERITED_TARGET' };
  expect(continuityPerformanceEvidence(source, histories, new Map(), now).every(item => item.direction === 'INSUFFICIENT')).toBe(true);
});

it('combines explicitly allowed earlier blocks without using unrelated routine history', () => {
  const { data, exercises } = continuityFixture();
  const splitHistory = data.history.map((record, i) => i < 2 ? { ...record, mesocycleId: 'previous' } : record);
  expect(continuityPerformanceEvidence(data.source, splitHistory, exercises, data.now)[0].direction).toBe('INSUFFICIENT');
  expect(continuityPerformanceEvidence(data.source, splitHistory, exercises, data.now, new Set([data.source.id, 'previous']))[0].direction).toBe('HIGHER');
});

it('carries both rep bounds into the successor after stronger results at the same load', () => {
  const { data, exercises } = continuityFixture();
  const { routine, source, history, now } = data;
  expect(continuityPerformanceEvidence(source, history, exercises, now)[0].direction).toBe('HIGHER');
  const successor = previewMesocycleSuccessor(routine, source, history, {
    successorId: 'next', reason: 'COMPLETED', microcycles: 4, now,
  }).successor;
  expect(successor.plannedSessions).toEqual(source.plannedSessions);
  expect(successor.plannedSessions![0].exercises[0].sets[0]).toMatchObject({ targetRepsMin: 8, targetReps: 10, targetRIR: 2 });
});

it.each(['AUTOMATIC', undefined] as const)('continues %s plans with their automatic RIR progression and final deload', mode => {
  const { data } = continuityFixture(now);
  const source = { ...data.source, prescriptionMode: mode };
  const next = previewMesocycleSuccessor(data.routine, source, data.history,
    { successorId: 'next', reason: 'COMPLETED', microcycles: 4, now }).successor;
  expect(next.prescriptionMode).toBe('AUTOMATIC');
  const stages = Array.from({ length: 4 }, (_, index) => sessionsForMicrocycle(next, data.routine.generation.goal, index)[0].exercises[0].sets);
  expect(stages.map(sets => sets.map(set => set.targetRIR))).toEqual([[2, 2, 2], [2, 1, 1], [1, 1, 1], [4, 4]]);
  expect(stages.flat().every(set => set.targetRepsMin === 8 && set.targetReps === 10)).toBe(true);
  expect(next.plannedSessions).toEqual(source.plannedSessions);
  expect(next.sessionOverrides).toBeUndefined();
});

it('resizes the automatic trajectory to the selected horizon and keeps a single cycle as loading', () => {
  const { data } = continuityFixture(now);
  const source = { ...data.source, prescriptionMode: 'AUTOMATIC' as const };
  const prepare = (microcycles: number) => previewMesocycleSuccessor(data.routine, source, data.history,
    { successorId: 'next', reason: 'COMPLETED', microcycles, now }).successor;
  const longer = prepare(6);
  const sets = (plan: typeof longer, index: number) => sessionsForMicrocycle(plan, data.routine.generation.goal, index)[0].exercises[0].sets;
  expect(sets(longer, 1).map(set => set.targetRIR)).toEqual([2, 2, 1]);
  expect(sets(longer, 4).map(set => set.targetRIR)).toEqual([1, 1, 1]);
  expect(sets(longer, 5)).toHaveLength(2);
  expect(sets(prepare(1), 0).map(set => set.targetRIR)).toEqual([2, 2, 2]);
});

it('continues fixed manual prescriptions and retained RIR pins without adding an automatic ramp', () => {
  const { data } = continuityFixture(now);
  const plannedSessions = data.source.plannedSessions.map(session => ({ ...session, exercises: session.exercises.map(entry => ({
    ...entry, manualRIRBySet: { 0: 4 }, sets: entry.sets.map((set, index) => ({ ...set, targetRIR: index === 0 ? 4 : 2 })),
  })) }));
  const source = { ...data.source, plannedSessions };
  const manual = previewMesocycleSuccessor(data.routine, source, data.history,
    { successorId: 'next', reason: 'COMPLETED', microcycles: 6, now }).successor;
  expect(manual.prescriptionMode).toBe('MANUAL');
  expect(sessionsForMicrocycle(manual, data.routine.generation.goal, 5)).toEqual(plannedSessions);
  const automatic = previewMesocycleSuccessor(data.routine, { ...source, prescriptionMode: 'AUTOMATIC' }, data.history,
    { successorId: 'next', reason: 'COMPLETED', microcycles: 4, now }).successor;
  expect(sessionsForMicrocycle(automatic, data.routine.generation.goal, 2)[0].exercises[0].sets.map(set => set.targetRIR)).toEqual([4, 1, 1]);
});

it('continues role-based strength with planned loads and preserves the source after preview', () => {
  const { data } = continuityFixture(now);
  const source = { ...data.source, prescriptionMode: 'AUTOMATIC' as const,
    plannedSessions: data.source.plannedSessions.map(session => ({ ...session, exercises: session.exercises.map(entry => ({
      ...entry, strengthRole: 'MAIN' as const, sets: entry.sets.map(set => ({ ...set, targetWeightKg: 100, targetRIR: 3 })),
    })) })) };
  const before = JSON.stringify(source);
  const routine = { ...data.routine, generation: { ...data.routine.generation, goal: 'STRENGTH' as const } };
  const next = previewMesocycleSuccessor(routine, source, data.history,
    { successorId: 'next', reason: 'COMPLETED', microcycles: 4, now }).successor;
  expect(sessionsForMicrocycle(next, 'STRENGTH', 0)[0].exercises[0].sets.map(set => set.targetRIR)).toEqual([3, 3, 3]);
  const peak = sessionsForMicrocycle(next, 'STRENGTH', 2)[0].exercises[0].sets;
  expect(peak.map(set => set.targetRIR)).toEqual([1, 1, 1]);
  expect(peak.every(set => set.targetWeightKg! > 100)).toBe(true);
  expect(sessionsForMicrocycle(next, 'STRENGTH', 3)[0].exercises[0].sets).toHaveLength(2);
  expect(JSON.stringify(source)).toBe(before);
});

it('opens the final review for the last unresolved planned workout, even when performed out of order', () => {
  const { data } = continuityFixture();
  const { source, routine, history, now } = data;
  const [last, ...earlier] = history;
  const goal = routine.generation.goal;
  expect(completedBlockAfterWorkout(source, goal, [...earlier, { ...last, completedAt: undefined }], last, now)).toBe(true);
  expect(completedBlockAfterWorkout(source, goal, earlier.slice(1), last, now)).toBe(false);
  expect(completedBlockAfterWorkout(source, goal, earlier, { ...last, plannedSessionIndex: 4 }, now)).toBe(false);
  expect(completedBlockAfterWorkout(source, goal, earlier, { ...last, completedAt: undefined }, now)).toBe(false);
  expect(completedBlockAfterWorkout(source, goal, earlier, { ...last, discardedAt: now }, now)).toBe(false);
  expect(completedBlockAfterWorkout(source, goal, earlier, { ...last, userId: 'someone-else' }, now)).toBe(false);
  expect(completedBlockAfterWorkout({ ...source, status: 'INTERRUPTED' }, goal, earlier, last, now)).toBe(false);
  expect(completedBlockAfterWorkout({ ...source, plannedSessions: [] }, goal, earlier, last, now)).toBe(false);
});
