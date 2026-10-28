import { SetType, MuscleGroup, type WorkoutSession, type WorkoutSet } from '@/models';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { bioExposureRows, bioPerformanceSeries, ownedBioWorkouts } from '../observations';
const exercise = EXERCISE_CATALOGUE[0], catalogue = new Map([[exercise.id, exercise]]);
const row = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({ id: 'set', setType: SetType.NORMAL, targetReps: 10,
  targetRIR: 2, targetWeight: 20, actualWeight: 40, actualReps: 10, actualRIR: 2, actualRIRSource: 'ATHLETE',
  isAutoFilled: false, completionState: 'DONE', ...patch });
const workout = (patch: Partial<WorkoutSession> = {}): WorkoutSession => ({ id: 'workout', userId: 'owner', mesocycleId: 'plan', microcycleId: 'm0', microcycleIndex: 0,
  performedAt: 1000, completedAt: 61000, exercises: [{ id: 'entry', exerciseId: exercise.id, exerciseSnapshot: exercise, order: 0,
    sets: [row()], isSwap: false }], ...patch });
const series = (sessions: WorkoutSession[]) => bioPerformanceSeries('owner', sessions, catalogue, 1e9);
it('isolates owners, completion, timestamps and discards, including corrected duplicate tombstones', () => {
  const valid = workout();
  const bad = [{ userId: 'other' }, { id: '' }, { completedAt: undefined }, { performedAt: NaN }, { completedAt: Infinity },
    { completedAt: 1e10 }, { completedAt: -1 }, { performedAt: -1 }, { completedAt: { seconds: 1, nanoseconds: 1e9 } },
    { completedAt: {} }, { discardedAt: 1 }, { exercises: null }];
  for (const patch of bad) expect(ownedBioWorkouts('owner', [workout(patch as any)], 1e9)).toEqual([]);
  expect(ownedBioWorkouts('', [valid], 1e9)).toEqual([]); expect(ownedBioWorkouts('owner', [valid], NaN)).toEqual([]);
  expect(ownedBioWorkouts('owner', [valid, workout({ editedAt: 90000, discardedAt: 90000 }), valid], 1e9)).toEqual([]);
  expect(ownedBioWorkouts('owner', [valid, workout({ editedAt: 90000, sessionName: 'corrected' })], 1e9)[0].sessionName).toBe('corrected');
  expect(ownedBioWorkouts('owner', [workout({ completedAt: { seconds: 61, nanoseconds: 0 } })], 1e9)).toHaveLength(1);
});
it.each([
  { completionState: 'PENDING' }, { setType: SetType.WARMUP }, { setType: SetType.TOP_SINGLE }, { setType: SetType.DROP_SET },
  { actualWeight: 0 }, { actualWeight: NaN }, { actualWeight: 10001 }, { actualReps: 0 }, { actualReps: 13 }, { actualReps: 2.5 },
  { actualPartialReps: 1 }, { extensions: [{ reps: 2 }] }, { recording: { measure: 'SECONDS', load: 'TOTAL_KG' } },
  { recording: { measure: 'REPETITIONS', load: 'ASSISTANCE_KG' } }, { recording: { measure: 'REPETITIONS', load: 'LEVEL' } },
])('excludes ineligible performance row %j', (patch) => {
  const session = workout(); session.exercises[0].sets = [row(patch as any)]; expect(series([session])).toEqual([]);
});
it('keeps actual main work, picks one best per workout and never turns an inherited effort into measured effort', () => {
  const session = workout(); session.exercises[0].sets = [row(), row({ id: 'lighter', actualWeight: 30 }), row({ id: 'better', actualWeight: 50 })];
  const result = series([session]); expect(result).toHaveLength(1); expect(result[0].points).toHaveLength(1);
  expect(result[0].points[0]).toMatchObject({ weight: 50, reps: 10, rir: 2 }); expect(result[0].comparableEffort).toBe(true);
  for (const patch of [{ actualRIRSource: undefined }, { actualRIRSource: 'INHERITED_TARGET' }, { actualRIR: null }, { actualRIR: 6 }]) {
    const unknown = workout(); unknown.exercises[0].sets = [row(patch as any)];
    expect(series([unknown])[0]).toMatchObject({ comparableEffort: false, points: [expect.objectContaining({ rir: null })] });
  }
});
it('separates exercise/setup/order/superset/load/effort contexts and supports custom per-hand sets', () => {
  const base = workout(); const changed = workout({ id: 'second', completedAt: 90000 });
  changed.exercises = [{ ...changed.exercises[0], exerciseSnapshot: { ...exercise, stimulusTags: ['GRIP:NEUTRAL'] } }];
  expect(series([base, changed])).toHaveLength(2);
  changed.exercises = [{ ...base.exercises[0], sets: [row({ actualRIR: 3 })] }]; expect(series([base, changed])).toHaveLength(2);
  changed.exercises = [{ ...base.exercises[0], exerciseSnapshot: undefined }]; expect(series([base, changed])).toHaveLength(2);
  changed.exercises = [base.exercises[0]]; changed.supersets = { [exercise.id]: 'a', partner: 'a' }; expect(series([base, changed])).toHaveLength(2);
  const custom = workout(); custom.exercises[0] = { ...custom.exercises[0], exerciseId: 'custom:fixture',
    exerciseSnapshot: { ...exercise, id: 'custom:fixture', isCustom: true, recording: { measure: 'REPETITIONS', load: 'PER_HAND_KG' } } };
  expect(series([custom])[0].recordingLoad).toBe('PER_HAND_KG');
  const failure = workout(); failure.exercises[0].sets = [row({ setType: SetType.FAILURE, actualRIR: 0, actualRIRSource: 'FAILURE' })];
  expect(series([failure])[0].points[0].rir).toBe(0);
});
it('aggregates actual work by day/session/cycle/block without assuming seven-day cycles or counting warmups', () => {
  const first = workout(); first.exercises[0].sets.push(row({ id: 'warmup', setType: SetType.WARMUP }));
  const second = workout({ id: 'other', performedAt: 8 * 86400000, completedAt: 8 * 86400000 + 61000 });
  const third = workout({ id: 'third', microcycleIndex: 1, performedAt: 10 * 86400000, completedAt: 10 * 86400000 + 61000 });
  const history = [first, first, second, third];
  expect(bioExposureRows('owner', history, catalogue, 1e9, 'SESSION')).toHaveLength(3);
  expect(bioExposureRows('owner', history, catalogue, 1e9, 'DAY')).toHaveLength(3);
  expect(bioExposureRows('owner', history, catalogue, 1e9, 'MICROCYCLE').map((entry) => entry.sets)).toEqual([1, 2]);
  const rows = bioExposureRows('owner', history, catalogue, 1e9, 'MESOCYCLE');
  expect(rows[0]).toMatchObject({ workouts: 3, sets: 3, minutes: 3 });
  expect(rows[0].muscles.find((entry) => entry.muscle === exercise.primaryMuscle)?.sets).toBe(3);
  expect(rows[0].muscles.every((entry) => entry.muscle !== MuscleGroup.UNCLASSIFIED)).toBe(true);
});
it('keeps preceding exercise order, source snapshots, ties and open-ended effort explicit', () => {
  const session = workout(); session.exercises = [{ ...session.exercises[0], id: 'second', exerciseId: 'other', order: 1 },
    { ...session.exercises[0], sets: [row({ actualRIR: 5 })], exerciseSnapshot: { ...exercise, requiredApparatus: [] } }];
  const result = series([session]); expect(result).toHaveLength(2);
  expect(result.find((item) => item.exerciseId === exercise.id)!.comparableEffort).toBe(false);
  expect(result.find((item) => item.exerciseId === 'other')!.key).toContain(exercise.id);
  expect(bioExposureRows('owner', [session, workout({ id: 'tied' })], catalogue, 1e9, 'SESSION')).toHaveLength(2);
  const noSnapshot = workout(); delete noSnapshot.exercises[0].exerciseSnapshot;
  expect(bioPerformanceSeries('owner', [noSnapshot], new Map(), 1e9)[0].exercise).toBeUndefined();
  const noTime = workout({ completedAt: undefined });
  expect(ownedBioWorkouts('owner', [noTime, noTime], 1e9)).toEqual([]);
  for (const exercises of [null, [{ exerciseId: 'bad', order: 0, sets: null }], [{ exerciseId: 'bad', order: -1, sets: [] }],
    [{ exerciseId: 'bad', order: 0, sets: [null] }], [{ exerciseId: 'bad', order: 0, sets: [{ setType: SetType.NORMAL, extensions: [null] }] }]]) {
    expect(ownedBioWorkouts('owner', [workout({ exercises: exercises as any })], 1e9)).toEqual([]);
  }
});
