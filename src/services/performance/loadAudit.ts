import { percentile } from './uiPerformance';

export const LOAD_STAGES = ['auth.restore', 'settings.read', 'training.routines', 'training.history', 'training.mesocycle',
  'training.home', 'training.activeDraft', 'history.read', 'bio.history', 'bio.health', 'bio.night', 'bio.dailyHistory'] as const;
export type LoadStage = typeof LOAD_STAGES[number];
export type LoadTrigger = 'mount' | 'focus' | 'foreground';
export type LoadOutcome = 'success' | 'error' | 'cancelled';
interface LoadSample { stage: LoadStage; trigger: LoadTrigger; outcome: LoadOutcome; milliseconds: number }

/** Memory-only diagnostic, bounded to 300 anonymous spans. No document IDs, values or timestamps. */
export class LoadAudit {
  private samples: LoadSample[] = [];
  private generation = 0;
  constructor(private clock: () => number = () => performance.now()) {}
  clear() { this.generation++; this.samples = []; }
  begin(stage: LoadStage, trigger: LoadTrigger = 'focus') {
    const start = this.clock(), generation = this.generation;
    let finished = false;
    return (outcome: LoadOutcome = 'success') => {
      if (finished || generation !== this.generation) return;
      finished = true;
      const milliseconds = this.clock() - start;
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
      this.samples.push({ stage, trigger, outcome, milliseconds });
      if (this.samples.length > 300) this.samples.shift();
    };
  }
  async measure<T>(stage: LoadStage, action: () => Promise<T>, trigger: LoadTrigger = 'focus'): Promise<T> {
    const end = this.begin(stage, trigger);
    try { const result = await action(); end(); return result; }
    catch (error) { end('error'); throw error; }
  }
  snapshot() { return this.samples.map(sample => ({ ...sample })); }
}
export const loadAudit = new LoadAudit();

/** Repeated operations remain separate: overlapping/nested spans must never be added as wall time. */
export function summarizeLoads(samples: ReturnType<LoadAudit['snapshot']>) {
  return LOAD_STAGES.flatMap(stage => (['mount', 'focus', 'foreground'] as const).flatMap(trigger => {
    const all = samples.filter(sample => sample.stage === stage && sample.trigger === trigger);
    if (!all.length) return [];
    const success = all.filter(sample => sample.outcome === 'success').map(sample => sample.milliseconds);
    return [{ stage, trigger, count: success.length, errors: all.filter(sample => sample.outcome === 'error').length,
      cancelled: all.filter(sample => sample.outcome === 'cancelled').length,
      p50: success.length ? percentile(success, 0.5) : null, p95: success.length ? percentile(success, 0.95) : null,
      max: success.length ? Math.max(...success) : null, sufficient: success.length >= 20 }];
  }));
}
