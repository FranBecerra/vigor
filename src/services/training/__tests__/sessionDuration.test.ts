import { durationCalibration, exerciseDurationBreakdown } from '../sessionDuration';

it('explains duration as work, rests, setup and a conservative allowance', () => {
  const d = exerciseDurationBreakdown(3, 120);
  expect(d.total).toBe(d.work + d.rest + d.setup + d.allowance);
  expect(d.total).toBe(9);
  expect(exerciseDurationBreakdown(0, 180).total).toBe(0);
  expect(exerciseDurationBreakdown(NaN, 180).total).toBe(0);
  expect(exerciseDurationBreakdown(3, NaN).total).toBe(9);
});

it('requires five plausible completed samples and bounds the median calibration', () => {
  expect(durationCalibration([])).toEqual({ ready: false, sampleCount: 0, suggestedMultiplier: 1, observedMultiplier: null });
  expect(durationCalibration([{ estimatedMinutes: 60, actualMinutes: NaN }]).sampleCount).toBe(0);
  const samples = [66, 70, 72, 75, 80].map((actualMinutes) => ({ estimatedMinutes: 60, actualMinutes }));
  expect(durationCalibration(samples)).toEqual({ ready: true, sampleCount: 5, suggestedMultiplier: 1.2, observedMultiplier: 1.2 });
  expect(durationCalibration(samples.slice(0, 4)).ready).toBe(false);
  expect(durationCalibration(Array(6).fill({ estimatedMinutes: 60, actualMinutes: 120 })).suggestedMultiplier).toBe(1.5);
});
