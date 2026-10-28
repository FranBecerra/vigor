import { createDailyCheckIn, localCheckInDate, normalizeDailyCheckInAnswers, validDailyCheckIn } from '../dailyCheckIn';
const now = new Date(2026, 9, 26, 12).getTime();
const date = localCheckInDate(now);
const entry = () => createDailyCheckIn('owner', date, { recovery: 'USUAL', discomfort: 'PRESENT' }, now);

it('records a local calendar occurrence, optional answers and a distinct discomfort observation without a score', () => {
  expect(localCheckInDate(new Date(2026, 9, 26, 0, 1).getTime())).toBe('2026-10-26');
  expect(entry()).toMatchObject({ id: date, localDate: date, userId: 'owner', questionnaireVersion: 1,
    answers: { recovery: 'USUAL', discomfort: 'PRESENT' }, createdAt: now, updatedAt: now });
  expect(entry()).not.toHaveProperty('score');
  expect(validDailyCheckIn(entry(), 'owner', date)).toBe(true);
  expect(createDailyCheckIn('owner', date, { sleep: 'WORSE' }, now).answers).toEqual({ sleep: 'WORSE' });
});
it('removes invalid/default/unknown answers without treating missing data as usual or healthy', () => {
  for (const input of [null, undefined, [], false, 2, 'USUAL', {}, { energy: 0, recovery: null, discomfort: false }]) {
    expect(normalizeDailyCheckInAnswers(input)).toEqual({});
    expect(() => createDailyCheckIn('owner', date, input, now)).toThrow('invalidCheckIn');
  }
  expect(normalizeDailyCheckInAnswers({ recovery: 'BETTER', energy: 'LOWER', sleep: 'USUAL', discomfort: 'NONE', score: 100 }))
    .toEqual({ recovery: 'BETTER', energy: 'LOWER', sleep: 'USUAL', discomfort: 'NONE' });
});
it('corrects one occurrence without duplicating it or importing another owner/date’s original timestamp', () => {
  const original = entry();
  expect(createDailyCheckIn('owner', date, { energy: 'HIGHER' }, now + 1000, original)).toMatchObject({
    id: original.id, createdAt: now, updatedAt: now + 1000, answers: { energy: 'HIGHER' },
  });
  for (const previous of [{ ...original, userId: 'foreign' }, { ...original, localDate: '2026-10-25' }]) {
    expect(createDailyCheckIn('owner', date, { recovery: 'WORSE' }, now + 1000, previous).createdAt).toBe(now + 1000);
  }
});
it('rejects malformed, foreign, unknown-version and impossible captured-calendar records', () => {
  for (const value of [null, undefined, 1, {}, { ...entry(), userId: 'other' }, { ...entry(), id: 'other' },
    { ...entry(), localDate: '2026-02-31' }, { ...entry(), questionnaireVersion: 2 }, { ...entry(), timezoneOffsetMinutes: 1.5 },
    { ...entry(), timezoneOffsetMinutes: 841 }, { ...entry(), createdAt: -1 }, { ...entry(), createdAt: now + 1 },
    { ...entry(), updatedAt: NaN }, { ...entry(), updatedAt: Infinity }, { ...entry(), updatedAt: 1e100 },
    { ...entry(), updatedAt: now + 86400000 }, { ...entry(), answers: {} }, { ...entry(), answers: null },
    { ...entry(), answers: { recovery: 'INVALID' } }, { ...entry(), answers: { energy: 'USUAL', extra: 1 } }]) {
    expect(validDailyCheckIn(value, 'owner', date)).toBe(false);
  }
  expect(() => localCheckInDate(NaN)).toThrow('invalidCheckInDate');
  expect(() => createDailyCheckIn('', date, { recovery: 'USUAL' }, now)).toThrow();
  expect(() => createDailyCheckIn('owner', '2026-10-25', { recovery: 'USUAL' }, now)).toThrow();
  expect(() => createDailyCheckIn('owner', date, { recovery: 'USUAL' }, -1)).toThrow();
});
it('uses the captured time-zone offset for historical records rather than the current device time zone', () => {
  const time = Date.UTC(2026, 9, 25, 23, 30);
  const value = { ...entry(), id: date, localDate: date, createdAt: time, updatedAt: time, timezoneOffsetMinutes: -120 };
  expect(validDailyCheckIn(value, 'owner', date)).toBe(true);
  expect(validDailyCheckIn({ ...value, timezoneOffsetMinutes: 0 }, 'owner', date)).toBe(false);
});
it('retains one local occurrence across a daylight-saving offset transition', () => {
  for (const [time, offset] of [[Date.UTC(2026, 2, 29, 0, 30), -60], [Date.UTC(2026, 2, 29, 1, 30), -120]]) {
    expect(validDailyCheckIn({ ...entry(), id: '2026-03-29', localDate: '2026-03-29', createdAt: time,
      updatedAt: time, timezoneOffsetMinutes: offset }, 'owner', '2026-03-29')).toBe(true);
  }
});
