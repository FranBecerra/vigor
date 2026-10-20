export const UI_BUDGETS = {
  'button.commit': { p95: 100, max: 250 },
  'wizard.commit': { p95: 150, max: 350 },
  'picker.ready': { p95: 600, max: 1000 },
  'js.frameGap': { p95: 50, max: 200 },
} as const;
export type UiMetric = keyof typeof UI_BUDGETS;
export interface UiSample { metric: UiMetric; milliseconds: number; cold: boolean }
export interface UiPerformanceReport {
  version: 1;
  environment: { platform: string; os: string; mode: 'release' | 'development'; viewport: string; target: string; workload?: string };
  samples: UiSample[];
}

export function percentile(values: readonly number[], fraction: number): number {
  const sorted = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1))];
}

/** Product budgets, not claims about a universal perceptual threshold or native FPS. */
export function assessUiPerformance(report: UiPerformanceReport, baseline?: UiPerformanceReport) {
  const failures: string[] = [];
  if (report.version !== 1 || report.environment.mode !== 'release') failures.push('A version-1 Release report is required');
  if (!['ios', 'android'].includes(report.environment.platform) || !report.environment.target) failures.push('A labelled native target is required');
  if (baseline && (baseline.version !== report.version || (['platform', 'os', 'mode', 'viewport', 'target', 'workload'] as const)
    .some((key) => baseline!.environment[key] !== report.environment[key]))) {
    failures.push('Baseline environment does not match'); baseline = undefined;
  }
  const metrics = Object.entries(UI_BUDGETS).map(([name, budget]) => {
    const metric = name as UiMetric;
    const all = report.samples.filter((sample) => sample.metric === metric);
    if (all.some((sample) => !Number.isFinite(sample.milliseconds) || sample.milliseconds < 0)) failures.push(`${metric}: invalid duration`);
    const warm = all.filter((sample) => !sample.cold).map((sample) => sample.milliseconds);
    const p95 = percentile(warm, 0.95); const max = Math.max(0, ...all.map((sample) => sample.milliseconds));
    if (warm.length < 20) failures.push(`${metric}: fewer than 20 warm samples`);
    if (p95 > budget.p95 || max > budget.max) failures.push(`${metric}: absolute budget exceeded`);
    const reference = baseline?.samples.filter((sample) => sample.metric === metric && !sample.cold).map((sample) => sample.milliseconds);
    if (reference && reference.length < 20) failures.push(`${metric}: baseline has fewer than 20 samples`);
    const referenceP95 = reference ? percentile(reference, 0.95) : undefined;
    if (referenceP95 !== undefined && p95 > referenceP95 + Math.max(20, referenceP95 * 0.2)) failures.push(`${metric}: p95 regressed beyond 20% / 20ms tolerance`);
    return { metric, count: warm.length, p95, max, cold: all.filter((sample) => sample.cold).map((sample) => sample.milliseconds), referenceP95 };
  });
  return { passed: failures.length === 0, failures, metrics };
}

/** Bounded, opt-in and anonymous. Disabled recording adds no timers or I/O. */
class UiPerformanceRecorder {
  enabled = false;
  private samples: UiSample[] = [];
  private pending = new Map<UiMetric, number>();
  private seen = new Set<UiMetric>();
  start() { this.enabled = true; this.samples = []; this.pending.clear(); this.seen.clear(); }
  stop() { this.enabled = false; this.pending.clear(); return [...this.samples]; }
  begin(metric: UiMetric, at = performance.now()) { if (this.enabled && !this.pending.has(metric)) this.pending.set(metric, at); }
  end(metric: UiMetric, at = performance.now()) {
    const start = this.pending.get(metric); this.pending.delete(metric);
    if (this.enabled && start !== undefined) this.record(metric, at - start);
  }
  record(metric: UiMetric, milliseconds: number) {
    if (!this.enabled || !Number.isFinite(milliseconds) || milliseconds < 0) return;
    this.samples.push({ metric, milliseconds, cold: !this.seen.has(metric) });
    this.seen.add(metric);
    if (this.samples.length > 4000) this.samples.shift();
  }
}
export const uiPerformance = new UiPerformanceRecorder();
