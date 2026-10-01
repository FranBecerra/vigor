/** Shared duration model. Constants are planning assumptions, not physiology. */
export const WORK_SECONDS_PER_SET = 40;
export const SESSION_OVERHEAD_MINUTES = 6;
export const EXERCISE_SETUP_SECONDS = 60;
export const MINUTES_PER_WORKING_SET_FLOOR = 3;

export function exerciseDurationBreakdown(sets: number, restSeconds: number, appearances = 1) {
  if (!Number.isFinite(sets) || sets <= 0) return { work: 0, rest: 0, setup: 0, allowance: 0, total: 0 };
  const work = sets * WORK_SECONDS_PER_SET / 60;
  const rest = sets * Math.max(0, Number.isFinite(restSeconds) ? restSeconds : 0) / 60;
  const setup = Math.max(1, appearances) * EXERCISE_SETUP_SECONDS / 60;
  const allowance = Math.max(0, sets * MINUTES_PER_WORKING_SET_FLOOR - work - rest - setup);
  return { work, rest, setup, allowance, total: work + rest + setup + allowance };
}

/** Robust observational calibration; pauses/delays cannot be inferred from timestamps. */
export function durationCalibration(samples: readonly { estimatedMinutes: number; actualMinutes: number }[]) {
  const ratios = samples.filter((s) => Number.isFinite(s.estimatedMinutes) && Number.isFinite(s.actualMinutes)
    && s.estimatedMinutes >= 10 && s.actualMinutes >= 10 && s.actualMinutes <= 240)
    .map((s) => s.actualMinutes / s.estimatedMinutes).filter((r) => r >= 0.5 && r <= 2).sort((a, b) => a - b);
  const count = ratios.length;
  const median = count ? (ratios[Math.floor((count - 1) / 2)] + ratios[Math.floor(count / 2)]) / 2 : 1;
  return { sampleCount: count, ready: count >= 5,
    observedMultiplier: count ? median : null,
    suggestedMultiplier: count >= 5 ? Math.max(0.75, Math.min(1.5, median)) : 1 };
}
