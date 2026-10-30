import { LoadAudit, summarizeLoads } from '../loadAudit';

it('uses the runtime monotonic clock when no test clock is supplied', () => {
  const audit = new LoadAudit(); audit.begin('auth.restore', 'mount')();
  expect(audit.snapshot()[0].milliseconds).toBeGreaterThanOrEqual(0);
});

it('times overlapped same-stage reads separately and ends spans only once', async () => {
  let now = 0; const audit = new LoadAudit(() => now);
  const a = audit.begin('bio.health'), b = audit.begin('bio.health', 'foreground');
  now = 100; a(); a('error'); now = 240; b();
  expect(audit.snapshot()).toEqual([
    { stage: 'bio.health', trigger: 'focus', outcome: 'success', milliseconds: 100 },
    { stage: 'bio.health', trigger: 'foreground', outcome: 'success', milliseconds: 240 },
  ]);
  await expect(audit.measure('history.read', async () => 42)).resolves.toBe(42);
  const error = Error('private document content'); await expect(audit.measure('history.read', async () => { throw error; })).rejects.toBe(error);
  expect(JSON.stringify(audit.snapshot())).not.toContain('private');
});
it('bounds retained data, isolates cleared generations and returns defensive snapshots', () => {
  let now = 0; const audit = new LoadAudit(() => now++), obsolete = audit.begin('auth.restore', 'mount');
  audit.clear(); obsolete(); expect(audit.snapshot()).toEqual([]);
  for (let i = 0; i < 305; i++) audit.begin('training.home')();
  expect(audit.snapshot()).toHaveLength(300);
  const snapshot = audit.snapshot(); snapshot[0].milliseconds = 1000; expect(audit.snapshot()[0].milliseconds).toBe(1);
});
it('does not retain invalid clock durations and distinguishes missing from zero', () => {
  let now = 10; const audit = new LoadAudit(() => now);
  const negative = audit.begin('training.home'); now = 0; negative();
  const invalid = audit.begin('training.home'); now = Infinity; invalid();
  expect(audit.snapshot()).toHaveLength(0);
  now = 0; audit.begin('history.read')('cancelled'); audit.begin('bio.night')('error'); audit.begin('bio.health')();
  const summary = summarizeLoads(audit.snapshot());
  expect(summary.find(row => row.stage === 'history.read')).toMatchObject({ count: 0, cancelled: 1, p95: null });
  expect(summary.find(row => row.stage === 'bio.night')).toMatchObject({ count: 0, errors: 1, p50: null });
  expect(summary.find(row => row.stage === 'bio.health')).toMatchObject({ count: 1, p50: 0, p95: 0, sufficient: false });
});
it('summarizes 20 successful controlled-delay reads without mixing triggers or errors', async () => {
  let now = 0; const audit = new LoadAudit(() => now);
  for (let n = 1; n <= 20; n++) await audit.measure('bio.health', async () => { now += n * 10; }, 'foreground');
  audit.begin('bio.health', 'foreground')('error');
  expect(summarizeLoads(audit.snapshot())).toEqual([{ stage: 'bio.health', trigger: 'foreground', count: 20, errors: 1,
    cancelled: 0, p50: 100, p95: 190, max: 200, sufficient: true }]);
});
