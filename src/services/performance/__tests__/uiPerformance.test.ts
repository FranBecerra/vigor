import { assessUiPerformance, percentile, UI_BUDGETS, uiPerformance, type UiMetric, type UiPerformanceReport } from '../uiPerformance';
const report = (value = 30): UiPerformanceReport => ({ version: 1, environment: { platform: 'ios', os: '27', mode: 'release', viewport: '390x844', target: 'fixture-device' },
  samples: (Object.keys(UI_BUDGETS) as UiMetric[]).flatMap((metric) => Array.from({ length: 31 }, (_, index) => ({ metric, milliseconds: value, cold: index === 0 }))) });

afterEach(() => uiPerformance.stop());
it('uses nearest-rank p95, rejects empty runs and distinguishes cold from warm samples', () => {
  expect(percentile([], 0.95)).toBe(0);
  expect(percentile([NaN, -1, 30, 10, 20], 0.5)).toBe(20);
  expect(percentile([10, 20], 2)).toBe(20);
  expect(percentile([10, 20], -1)).toBe(10);
  const current = report(); current.samples[0].milliseconds = 240;
  const assessment = assessUiPerformance(current);
  expect(assessment.passed).toBe(true); expect(assessment.metrics[0]).toMatchObject({ p95: 30, max: 240, cold: [240], count: 30 });
  expect(assessUiPerformance({ ...current, samples: [] }).passed).toBe(false);
});
it('fails p95 stalls, isolated freezes, invalid values, insufficient repetitions and development mode', () => {
  const slow = report(); slow.samples.filter((sample) => sample.metric === 'button.commit').forEach((sample) => { sample.milliseconds = 120; });
  expect(assessUiPerformance(slow).failures).toContain('button.commit: absolute budget exceeded');
  const freeze = report(); freeze.samples[0].milliseconds = 251;
  expect(assessUiPerformance(freeze).passed).toBe(false);
  const invalid = report(); invalid.samples[0].milliseconds = NaN;
  expect(assessUiPerformance(invalid).failures).toContain('button.commit: invalid duration');
  expect(assessUiPerformance({ ...report(), environment: { ...report().environment, mode: 'development' } }).passed).toBe(false);
  expect(assessUiPerformance({ ...report(), environment: { ...report().environment, platform: 'web', target: '' } }).passed).toBe(false);
});
it('compares p95 only on matching environments and enforces relative tolerances', () => {
  expect(assessUiPerformance(report(55), report(30)).failures.some((message) => message.includes('regressed'))).toBe(true);
  expect(assessUiPerformance(report(45), report(30)).passed).toBe(true);
  const baseline = report(); baseline.environment.os = '26';
  expect(assessUiPerformance(report(), baseline).failures).toContain('Baseline environment does not match');
  expect(assessUiPerformance(report(), { ...report(), samples: [] }).passed).toBe(false);
  const illustrated = report(); illustrated.environment.workload = 'illustrated-options-v1';
  expect(assessUiPerformance(illustrated, report()).failures).toContain('Baseline environment does not match');
  expect(assessUiPerformance(illustrated, illustrated).passed).toBe(true);
});
it('records bounded, opt-in samples, preserves the first trigger and clears unfinished measurements', () => {
  uiPerformance.begin('button.commit', 1); uiPerformance.record('button.commit', 30);
  expect(uiPerformance.stop()).toEqual([]);
  uiPerformance.start(); uiPerformance.begin('button.commit', 1); uiPerformance.begin('button.commit', 40); uiPerformance.end('button.commit', 61);
  uiPerformance.end('button.commit', 100); uiPerformance.record('button.commit', NaN); uiPerformance.record('button.commit', -1);
  expect(uiPerformance.stop()).toEqual([{ metric: 'button.commit', milliseconds: 60, cold: true }]);
  uiPerformance.start();
  for (let index = 0; index < 4005; index++) uiPerformance.record('js.frameGap', 17);
  expect(uiPerformance.stop()).toHaveLength(4000);
  uiPerformance.start(); uiPerformance.begin('wizard.commit', 0); uiPerformance.stop(); uiPerformance.end('wizard.commit', 20);
  expect(uiPerformance.stop()).toEqual([]);
});
