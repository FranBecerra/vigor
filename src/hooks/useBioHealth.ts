import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { BioHealthTrend } from '@/models/bioHealth';
import { buildHealthTrends, healthWindowStart } from '@/services/bio/healthTrends';
import { bioHealthBridge } from '@/services/health/bioHealthClient';
import { useAuth } from './useAuth';
import { useAppSettings } from './useAppSettings';

interface Snapshot { owner: string | null; state: 'OFF' | 'LOADING' | 'UNAVAILABLE' | 'READY' | 'ERROR'; trends: BioHealthTrend[]; fetchedAt?: number }
/** Samples exist only in the focused component's memory; no disk/cloud cache. */
export function useBioHealth() {
  const { uid } = useAuth(), preferences = useAppSettings();
  const enabled = !!uid && preferences.ready && preferences.settings.bioHealthEnabled === true;
  const [snapshot, setSnapshot] = useState<Snapshot>({ owner: null, state: 'OFF', trends: [] });
  const [revision, setRevision] = useState(0), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    let alive = true, sequence = 0;
    const epoch = ++generation.current;
    const load = async () => {
      const token = ++sequence;
      const current = () => alive && epoch === generation.current && sequence === token;
      setSnapshot({ owner: uid, state: enabled ? 'LOADING' : 'OFF', trends: [] });
      if (!enabled) return;
      try {
        if (!await bioHealthBridge.bioAvailable()) { if (current()) setSnapshot({ owner: uid, state: 'UNAVAILABLE', trends: [] }); return; }
        const now = Date.now(), data = await bioHealthBridge.readBio(healthWindowStart(now), now);
        if (current()) setSnapshot({ owner: uid, state: 'READY', trends: buildHealthTrends(data, now), fetchedAt: now });
      } catch { if (current()) setSnapshot({ owner: uid, state: 'ERROR', trends: [] }); }
    };
    void load();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => { alive = false; generation.current++; listener.remove(); };
  }, [uid, enabled, revision]));
  const visible: Snapshot = snapshot.owner === uid && enabled ? snapshot : { owner: uid, state: enabled ? 'LOADING' : 'OFF', trends: [] };
  return { ...visible, reload: () => setRevision((value) => value + 1) };
}
