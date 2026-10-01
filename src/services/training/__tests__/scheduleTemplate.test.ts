import { buildScheduleTemplate, moveRestSlot, templateRecovery, validateScheduleTemplate } from '../scheduleTemplate';
import { EXERCISE_CATALOGUE } from '../exerciseCatalogue';
import { SetType, type PlannedSession } from '@/models';
const catalogue = new Map(EXERCISE_CATALOGUE.map((e) => [e.id, e]));
const session = (index: number, id = 'press-banca', warmup = false): PlannedSession => ({ index, focus: 'UPPER', estimatedWorkMinutes: 20,
  exercises: [{ exerciseId: id, order: 0, isEdited: false,
    sets: Array.from({ length: 3 }, () => ({ setType: warmup ? SetType.WARMUP : SetType.NORMAL, targetReps: 10, targetRIR: 2 })) }] });
it('includes rest without dates and preserves the session sequence', () => {
  const sessions = [session(0), session(1), session(2)];
  const result = buildScheduleTemplate(sessions, catalogue);
  expect(result.slots.filter((s) => s.kind === 'rest')).toHaveLength(4);
  expect(result.slots.flatMap((s) => s.kind === 'workout' ? [s.sessionIndex] : [])).toEqual([0, 1, 2]);
  expect(templateRecovery(result, sessions, catalogue).every((p) => p.gapDays > 1)).toBe(true);
});
it('supports a non-seven-day cycle and moving rest without advancing or reordering workouts', () => {
  const sessions = [session(0), session(1)];
  const result = buildScheduleTemplate(sessions, catalogue, 4);
  const snapshot = JSON.stringify(result);
  const from = result.slots.findIndex((s) => s.kind === 'rest');
  const moved = moveRestSlot(result, from, 3);
  expect(JSON.stringify(result)).toBe(snapshot);
  expect(moved.days).toBe(4);
  expect(moved.slots.filter((s) => s.kind === 'rest')).toHaveLength(2);
  expect(templateRecovery(moved, sessions, catalogue).some((p) => p.reviewSuggested)).toBe(true);
});
it('flags unresolved adjacent work but does not prescribe fake recovery days', () => {
  const sessions = Array.from({ length: 6 }, (_, i) => session(i));
  const result = buildScheduleTemplate(sessions, catalogue);
  expect(templateRecovery(result, sessions, catalogue).filter((p) => p.reviewSuggested)).toHaveLength(5);
  expect(buildScheduleTemplate([], catalogue).slots).toHaveLength(7);
  expect(templateRecovery(buildScheduleTemplate([session(0, 'press-banca', true)], catalogue), [session(0, 'press-banca', true)], catalogue)[0].muscles).toEqual([]);
});
it('spreads rest gaps instead of stacking all days behind the largest overlap', () => {
  const sessions = [session(0), session(1), session(2, 'curl-barra'), session(3, 'extension-cuadriceps')];
  const template = buildScheduleTemplate(sessions, catalogue);
  expect(template.slots.some((slot, i) => slot.kind === 'rest' && template.slots[i + 1]?.kind === 'rest')).toBe(false);
});
it('rejects invalid lengths, duplicate sessions and moves of a workout', () => {
  expect(() => buildScheduleTemplate([session(0)], catalogue, NaN)).toThrow();
  expect(() => buildScheduleTemplate([session(0), session(0)], catalogue)).toThrow();
  expect(() => validateScheduleTemplate({ days: 2, slots: [{ kind: 'workout', sessionIndex: 9 }, { kind: 'rest' }] }, [0])).toThrow();
  expect(() => moveRestSlot(buildScheduleTemplate([session(0)], catalogue), 0, 1)).toThrow();
});
