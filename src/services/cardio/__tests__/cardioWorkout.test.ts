import { cardioFixture, CARDIO_FIXTURE_NOW as now } from '@/test-support/cardioFixture';
import { cardioElapsed, cardioPhase, correctCardioWorkout, startCardioWorkout, transitionCardioWorkout, validCardioWorkout } from '../cardioWorkout';
const make = () => { const block = cardioFixture(); return startCardioWorkout(block, block.slots[0].id, now, 'run'); };
it('runs all phases, survives background time, excludes pauses and does not auto-complete at the target', () => {
  const w = make(); expect(validCardioWorkout(w, 'owner')).toBe(true); expect(cardioPhase(w, now).phase).toBe('WARMUP');
  expect(cardioPhase(w, now + 240000).phase).toBe('EASY'); expect(cardioPhase(w, now + 960000).phase).toBe('COOLDOWN');
  expect(cardioPhase(w, now + 1200000)).toMatchObject({ phase: 'READY', remaining: 0 }); expect(w.status).toBe('RUNNING');
  const paused = transitionCardioWorkout(w, 'PAUSE', now + 300000); expect(cardioElapsed(paused, now + 900000)).toBe(300000);
  const resumed = transitionCardioWorkout(paused, 'RESUME', now + 900000); expect(cardioElapsed(resumed, now + 1000000)).toBe(400000);
  const finished = transitionCardioWorkout(resumed, 'FINISH', now + 1000000, 400, 7);
  expect(finished).toMatchObject({ status: 'FINISHED', actualSeconds: 400, feedback: { effort: 7, timing: 'AT_FINISH' } });
  expect(cardioElapsed(finished, now + 2000000)).toBe(400000); expect(cardioElapsed(w, now - 1)).toBe(0);
});
it('records optional effort without zero, supports actual-time/effort corrections and recoverable discard', () => {
  const w = make(), finished = transitionCardioWorkout(w, 'FINISH', now + 60000, 60);
  expect(finished.feedback).toBeNull(); const edited = correctCardioWorkout(finished, 55, 4, now + 61000);
  expect(edited.finishedAt).toBe(finished.finishedAt); expect(edited.feedback).toMatchObject({ timing: 'HISTORY_EDIT', effort: 4 });
  const cleared = correctCardioWorkout(edited, 55, null, now + 62000); expect(cleared.feedback!.effort).toBeNull();
  const discarded = transitionCardioWorkout(edited, 'DISCARD', now + 63000); expect(discarded.actualSeconds).toBe(55); expect(discarded.finishedAt).toBe(finished.finishedAt);
  expect(validCardioWorkout(discarded, 'owner')).toBe(true); expect(transitionCardioWorkout(w, 'DISCARD', now + 1).status).toBe('DISCARDED');
});
it.each([null, { schemaVersion: 2 }, { userId: 'other' }, { blockId: '../bad' }, { slotId: '' }, { name: '' }, { status: 'BAD' }, { startedAt: 0 },
  { updatedAt: now - 1 }, { revision: 0 }, { elapsedMs: -1 }, { elapsedMs: 1 }, { source: 'SENSOR' }, { prescription: null }, { actualSeconds: 60 }, { feedback: {} }])('rejects malformed workout %p', patch => {
  expect(validCardioWorkout(patch === null ? null : { ...make(), ...patch }, 'owner')).toBe(false);
});
it('rejects malformed prescriptions and inconsistent actual records without inventing sensor metrics', () => {
  const w = make(), p = w.prescription;
  for (const patch of [{ policy: 'UNKNOWN' }, { modality: 'HIIT' }, { stimulus: 'QUALITY' }, { basis: 'BAD' }, { durationSeconds: 0 }, { allowWalking: null }, { adjustments: ['BAD'] }, { segments: [] },
    { segments: p.segments.map((s, i) => i ? s : { ...s, phase: 'EASY' }) }, { segments: p.segments.map(s => ({ ...s, durationSeconds: 0 })) },
    { segments: p.segments.map(s => ({ ...s, effort: { ...s.effort, max: 10 } })) }, { durationSeconds: 1500 }]) expect(validCardioWorkout({ ...w, prescription: { ...p, ...patch } }, 'owner')).toBe(false);
  const finished = transitionCardioWorkout(w, 'FINISH', now + 60000, 60, 5);
  for (const patch of [{ finishedAt: null }, { actualSeconds: 0 }, { actualSeconds: 86401 }, { feedback: { ...finished.feedback, scale: 'RIR' } }, { feedback: { ...finished.feedback, timing: 'BAD' } }, { feedback: { ...finished.feedback, recordedAt: now } }]) expect(validCardioWorkout({ ...finished, ...patch }, 'owner')).toBe(false);
  expect(validCardioWorkout(w, '')).toBe(false);
});
it('rejects duplicate/stale transitions, invalid corrections and non-cardio/ended starts', () => {
  const w = make(), block = cardioFixture();
  expect(() => transitionCardioWorkout(w, 'RESUME', now)).toThrow(); expect(() => transitionCardioWorkout(w, 'PAUSE', now - 1)).toThrow();
  const paused = transitionCardioWorkout(w, 'PAUSE', now); expect(() => transitionCardioWorkout(paused, 'PAUSE', now)).toThrow();
  for (const seconds of [null, 0, NaN, 86401]) expect(() => transitionCardioWorkout(w, 'FINISH', now + 1, seconds)).toThrow();
  expect(() => transitionCardioWorkout(w, 'FINISH', now + 1, 60, 0)).toThrow(); expect(() => correctCardioWorkout(w, 60, 5, now)).toThrow();
  const finished = transitionCardioWorkout(w, 'FINISH', now, 60);
  expect(() => transitionCardioWorkout(finished, 'FINISH', now + 1, 60)).toThrow(); expect(() => correctCardioWorkout(finished, 0, null, now + 1)).toThrow();
  expect(() => correctCardioWorkout(finished, 60, null, now - 1)).toThrow(); expect(() => transitionCardioWorkout({ ...w, revision: Number.MAX_SAFE_INTEGER }, 'PAUSE', now)).toThrow();
  expect(() => startCardioWorkout({ ...block, endedAt: now }, block.slots[0].id, now, 'run')).toThrow();
  expect(() => startCardioWorkout(block, 'missing', now, 'run')).toThrow(); expect(() => startCardioWorkout({ ...block, slots: block.slots.map(s => ({ ...s, disposition: 'SKIPPED' })) }, block.slots[0].id, now, 'run')).toThrow();
  expect(() => startCardioWorkout({ ...block, schemaVersion: 99 } as any, block.slots[0].id, now, 'run')).toThrow('invalidCardioStart');
  const early = cardioFixture({}, now - 3600000); expect(startCardioWorkout(early, early.slots[0].id, now - 3600000, 'early').startedAt).toBe(now - 3600000);
});
