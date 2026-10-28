import { BIO_HEALTH_METRICS, type BioHealthTrend } from '@/models/bioHealth';
import { previewReadinessEvidence } from '../readinessEvidence';
const now = new Date(2026, 9, 26, 10).getTime();
function trends(): BioHealthTrend[] {
  return BIO_HEALTH_METRICS.map((metric) => {
    const days = Array.from({ length: 36 }, (_, index) => {
      const date = new Date(now); date.setDate(date.getDate() - (35 - index));
      return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        value: 50 + index % 3, at: date.getTime(), samples: 1 };
    });
    return { metric, days, latest: days.at(-1), sourceId: 'synthetic', status: 'AVAILABLE', fresh: true };
  });
}
it('computes a personal-range POC from observed metrics without subjective answers or an invented numeric score', () => {
  const input = trends(), before = JSON.stringify(input), result = previewReadinessEvidence(input, now);
  expect(result.state).toBe('IN_RANGE'); expect(result.signals.every((signal) => signal.referenceDays === 28 && signal.state === 'IN_RANGE')).toBe(true);
  expect(result.signals[0].recentDays).toBe(1); expect(result.signals[1].recentDays).toBe(7);
  expect(result).not.toHaveProperty('score'); expect(JSON.stringify(input)).toBe(before);
});
it('reports one/multiple changes without interpreting very high HRV as automatically good', () => {
  const input = trends(); input[0].days.at(-1)!.value = 40;
  expect(previewReadinessEvidence(input, now).state).toBe('MIXED');
  for (const day of input[2].days.slice(-8)) day.value = 80;
  expect(previewReadinessEvidence(input, now).state).toBe('MULTIPLE_CHANGES');
  expect(previewReadinessEvidence(input, now).signals[2].state).toBe('OUTSIDE_RANGE');
});
it('requires fresh source-specific observations, enough reference days and enough recent cardiac days', () => {
  for (const patch of [{ sourceId: undefined }, { status: 'ERROR' }, { status: 'EMPTY' }, { fresh: false }, { latest: undefined },
    { latest: { ...trends()[0].latest!, at: now + 1 } }, { latest: { ...trends()[0].latest!, at: now - 40 * 3600000 } }]) {
    const input = trends(); Object.assign(input[0], patch); expect(previewReadinessEvidence(input, now).state).toBe('INSUFFICIENT');
  }
  const input = trends(); input[0].days = input[0].days.slice(-10); expect(previewReadinessEvidence(input, now).state).toBe('INSUFFICIENT');
  input[0] = trends()[0]; input[1].days = [...input[1].days.slice(0, 28), input[1].days.at(-1)!];
  expect(previewReadinessEvidence(input, now).signals[1].state).toBe('INSUFFICIENT');
  expect(previewReadinessEvidence([], now).state).toBe('INSUFFICIENT');
  expect(previewReadinessEvidence(input, NaN).state).toBe('INSUFFICIENT');
});
it('deduplicates dates, excludes future/invalid/nonpositive points and does not renormalize a partial picture', () => {
  const input = trends(); input[0].days.push(input[0].days[0], { ...input[0].days[0], date: 'bad' },
    { ...input[0].days[0], at: now + 1 }, { ...input[0].days[0], value: NaN }, { ...input[0].days[0], value: 0 });
  expect(previewReadinessEvidence(input, now).signals[0].referenceDays).toBe(28);
  input[1].days = []; input[2].days = [];
  expect(previewReadinessEvidence(input, now).state).toBe('INSUFFICIENT');
  expect(previewReadinessEvidence(input, now).signals[0].state).toBe('IN_RANGE');
});
