import { SetType } from '@/models';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { workoutActivityState } from '../workoutActivityState';
import type { SessionSetState } from '../sessionMapper';
const exercises = EXERCISE_CATALOGUE.slice(0, 2);
const row = (patch: Partial<SessionSetState> = {}): SessionSetState => ({ id: 's', setType: SetType.NORMAL,
  targetWeight: 20, targetReps: 10, targetRIR: 2, isAutoFilled: false, isCompleted: false, ...patch });
const idle = { startedAt: null, anchorSetId: null, durationSeconds: 0 };

it('shows the next set for the focused exercise and serializes countdown dates, not remaining ticks', () => {
  const [a, b] = exercises; const sets = { [a.id]: [row()], [b.id]: [row({ setType: SetType.WARMUP }), row()] };
  expect(workoutActivityState(exercises, sets, b.id, { startedAt: 1000, durationSeconds: 120, anchorSetId: 's' }))
    .toMatchObject({ total: 2, completed: 0, nextExercise: b.name, nextSet: 'W', nextWeight: '20 kg', nextReps: '10 reps', restStart: 1000, restEnd: 121000 });
  sets[b.id][0] = row({ setType: SetType.WARMUP, isCompleted: true, actualReps: 8, actualWeight: 10 });
  expect(workoutActivityState(exercises, sets, b.id, idle)).toMatchObject({ nextSet: '1', restEnd: 0 });
});

it('ignores abandoned warmups once all working sets are complete and handles unknown focus/empty sessions', () => {
  const [a, b] = exercises;
  const done = row({ isCompleted: true, actualReps: 10, actualWeight: 20, completionState: 'PENDING' });
  const sets = { [a.id]: [row({ setType: SetType.WARMUP }), done], [b.id]: [row()] };
  expect(workoutActivityState(exercises, sets, a.id, idle).nextExercise).toBe(b.name);
  expect(workoutActivityState(exercises, sets, 'missing', idle).nextExercise).toBe(b.name);
  expect(workoutActivityState(exercises, { [a.id]: [done], [b.id]: [done] }, a.id, idle)).toMatchObject({ completed: 2, nextExercise: '' });
  expect(workoutActivityState([], {}, undefined, idle)).toMatchObject({ total: 0, nextExercise: '' });
  expect(workoutActivityState(exercises, {}, undefined, idle)).toMatchObject({ total: 0, nextExercise: '' });
});

it('keeps timed/no-load rehabilitation units distinct from kg and repetition targets', () => {
  const exercise = exercises[0];
  const timed = row({ recording: { measure: 'SECONDS', load: 'NONE' }, targetDurationSeconds: 30 });
  expect(workoutActivityState([exercise], { [exercise.id]: [timed] }, undefined, idle)).toMatchObject({ nextWeight: '', nextReps: '30 s' });
  expect(workoutActivityState([exercise], { [exercise.id]: [{ ...timed, targetDurationSeconds: undefined }] }, undefined, idle).nextReps).toBe('— s');
  expect(workoutActivityState([exercise], { [exercise.id]: [{ ...timed, actualDurationSeconds: 20 }] }, undefined, idle).nextReps).toBe('20 s');
  expect(workoutActivityState([exercise], { [exercise.id]: [row({ recording: { measure: 'REPETITIONS', load: 'TOTAL_KG' }, actualReps: 8, actualWeight: 35 })] }, undefined, idle))
    .toMatchObject({ nextReps: '8 reps', nextWeight: '35 kg' });
});

it('localizes the next shared exercise and exposes its own working-set count and effort', () => {
  const ex = exercises[0];
  const sets = { [ex.id]: [row({ id: 'w', setType: SetType.WARMUP, isCompleted: true, actualReps: 8, actualWeight: 10 }), row({ id: 'one', targetRIR: 1 }), row({ id: 'two' })] };
  expect(workoutActivityState([ex], sets, ex.id, idle, 'en')).toMatchObject({ nextExercise: 'Barbell bench press', nextSet: '1', nextSetTotal: 2, nextIntensity: 1, completed: 0, total: 2 });
  sets[ex.id][1].actualRIR = 0;
  expect(workoutActivityState([ex], sets, ex.id, idle, 'en').nextIntensity).toBe(0);
});
