import type { TFunction } from 'i18next';
import type { ManualCardioTargets } from '@/services/cardio/manualCardio';

export function paceText(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function manualTargetLabels(target: ManualCardioTargets, t: TFunction) {
  return [
    target.durationSeconds === undefined ? null : t('manualCardio.targetDuration', { value: paceText(target.durationSeconds) }),
    target.distanceMetres === undefined ? null : t('manualCardio.targetDistance', { value: target.distanceMetres / 1000 }),
    target.paceSecondsPerKm === undefined ? null : t('manualCardio.targetPace', {
      fast: paceText(target.paceSecondsPerKm.fast), slow: paceText(target.paceSecondsPerKm.slow),
    }),
    target.heartRateZone === undefined ? null : t('manualCardio.targetZone', { value: target.heartRateZone }),
  ].filter((value): value is string => value !== null);
}
