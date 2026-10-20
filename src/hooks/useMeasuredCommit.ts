import { useEffect } from 'react';
import { uiPerformance, type UiMetric } from '@/services/performance/uiPerformance';

/** JS-trigger to committed layout plus two frame callbacks; not input-to-photon latency. */
export function measureNextFrame(metric: UiMetric, onReady?: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(() => { uiPerformance.end(metric); onReady?.(); }));
}

export function useMeasuredCommit(value: unknown, metric: UiMetric) {
  useEffect(() => {
    if (!uiPerformance.enabled) return;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => uiPerformance.end(metric)); });
    let second: number | undefined;
    return () => { cancelAnimationFrame(first); if (second !== undefined) cancelAnimationFrame(second); };
  }, [value, metric]);
}
