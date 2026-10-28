import { reviseSessionFeedback, sessionEffortValue, SESSION_EFFORT_SCALE } from '../sessionFeedback';
import type { SessionFeedback } from '@/models';

it('leaves optional feedback absent, accepts each integer and never converts set RIR', () => {
  expect(reviseSessionFeedback(undefined, null, 100, 'AT_FINISH')).toBeUndefined();
  for (let effort = 1; effort <= 10; effort++) {
    const feedback = reviseSessionFeedback(undefined, effort, 100, 'AT_FINISH');
    expect(feedback).toEqual({ scale: SESSION_EFFORT_SCALE, effort, recordedAt: 100, timing: 'AT_FINISH' });
    expect(sessionEffortValue(feedback)).toBe(effort);
  }
});

it.each([0, 11, -1, 2.5, NaN, Infinity, '5', undefined])('rejects malformed answers: %p', (effort) => {
  expect(() => reviseSessionFeedback(undefined, effort as number, 100, 'AT_FINISH')).toThrow('invalidSessionFeedback');
});
it.each([0, -1, NaN, Infinity])('rejects malformed observation times: %p', (now) => {
  expect(() => reviseSessionFeedback(undefined, 5, now, 'AT_FINISH')).toThrow();
});
it('rejects an unknown collection method', () => {
  expect(() => reviseSessionFeedback(undefined, 5, 100, 'IMPORTED' as never)).toThrow();
});

it('preserves unchanged observations and records corrections and explicit clearing without mutating history', () => {
  const first = reviseSessionFeedback(undefined, 7, 100, 'AT_FINISH')!;
  expect(reviseSessionFeedback(first, 7, 200, 'HISTORY_EDIT')).toBe(first);
  const second = reviseSessionFeedback(first, 5, 200, 'HISTORY_EDIT')!;
  expect(second.revisions).toEqual([{ effort: 7, recordedAt: 100, timing: 'AT_FINISH' }]);
  const cleared = reviseSessionFeedback(second, null, 300, 'HISTORY_EDIT')!;
  expect(sessionEffortValue(cleared)).toBeNull();
  expect(cleared.revisions).toHaveLength(2);
  expect(reviseSessionFeedback(cleared, 8, 400, 'HISTORY_EDIT')!.revisions!.at(-1)?.effort).toBeNull();
  expect(first).not.toHaveProperty('revisions');
});

it.each([undefined, null, false, 2, {}, { scale: 'UNKNOWN', effort: 5, recordedAt: 1, timing: 'AT_FINISH' },
  { scale: SESSION_EFFORT_SCALE, effort: 0, recordedAt: 1, timing: 'AT_FINISH' },
  { scale: SESSION_EFFORT_SCALE, effort: 5, recordedAt: 0, timing: 'AT_FINISH' },
  { scale: SESSION_EFFORT_SCALE, effort: 5, recordedAt: 1, timing: 'OTHER' }])('treats legacy, foreign scales and malformed feedback as missing: %p', (input) => {
  expect(sessionEffortValue(input)).toBeNull();
  expect(reviseSessionFeedback(input as SessionFeedback, null, 100, 'HISTORY_EDIT')).toBeUndefined();
  expect(reviseSessionFeedback(input as SessionFeedback, 6, 100, 'HISTORY_EDIT')).toMatchObject({ effort: 6, timing: 'HISTORY_EDIT' });
});

it('bounds revision history and excludes malformed previous observations', () => {
  let feedback = reviseSessionFeedback(undefined, 1, 100, 'AT_FINISH')!;
  for (let i = 1; i <= 30; i++) feedback = reviseSessionFeedback(feedback, i % 2 + 1, 100 + i, 'HISTORY_EDIT')!;
  expect(feedback.revisions).toHaveLength(20);
  const corrupt = { ...feedback, revisions: [null, { effort: 0 }, ...feedback.revisions!] } as SessionFeedback;
  expect(reviseSessionFeedback(corrupt, 10, 200, 'HISTORY_EDIT')!.revisions).toHaveLength(20);
  expect(reviseSessionFeedback({ ...feedback, revisions: {} as never }, 10, 200, 'HISTORY_EDIT')!.revisions).toHaveLength(1);
});

it('distinguishes recalled manual entries from observations collected at workout finish', () => {
  const manual = reviseSessionFeedback(undefined, 6, 1000, 'MANUAL_ENTRY')!;
  expect(manual).toMatchObject({ effort: 6, timing: 'MANUAL_ENTRY', recordedAt: 1000 });
  expect(sessionEffortValue(manual)).toBe(6);
  expect(reviseSessionFeedback(manual, 6, 2000, 'HISTORY_EDIT')).toBe(manual);
  expect(reviseSessionFeedback(manual, 7, 2000, 'HISTORY_EDIT')!.revisions).toEqual([
    { effort: 6, recordedAt: 1000, timing: 'MANUAL_ENTRY' },
  ]);
});
