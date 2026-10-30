import { useCallback, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { useAppSettings } from './useAppSettings';
import type { useBioNight } from './useBioNight';
import { buildReadinessIndex } from '@/services/bio/readinessIndex';
import type { BioReadinessIndex } from '@/models/bioReadiness';

export interface BioReadinessView { state: ReturnType<typeof useBioNight>['state']; index?: BioReadinessIndex }
/** Reuses the existing read; never requests permissions, persists scores or changes training. */
export function useBioReadiness(night: ReturnType<typeof useBioNight>): BioReadinessView {
  const { uid } = useAuth(), preferences = useAppSettings();
  const [clock, setClock] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') setClock(Date.now()); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []));
  const enabled = !!uid && preferences.ready && preferences.settings.bioHealthEnabled === true && preferences.settings.bioNightEnabled === true;
  const state = uid && !preferences.ready ? 'LOADING' : !enabled ? 'OFF' : night.owner !== uid ? 'LOADING' : night.state;
  return useMemo(() => ({ state, index: state === 'READY'
    ? buildReadinessIndex(night.analysis, preferences.settings.bioSleepGoalMinutes, Math.max(clock, Date.now())) : undefined }),
  [state, night.analysis, preferences.settings.bioSleepGoalMinutes, clock]);
}
