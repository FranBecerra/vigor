import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { BioNightAnalysis } from '@/models/bioNight';
import { buildNightObservations, nightWindowStart } from '@/services/bio/nightObservations';
import { bioNightBridge } from '@/services/health/bioHealthClient';
import { useAuth } from './useAuth';
import { useAppSettings } from './useAppSettings';

interface Snapshot { owner: string | null; state: 'OFF' | 'LOADING' | 'UNAVAILABLE' | 'READY' | 'ERROR'; analysis?: BioNightAnalysis; fetchedAt?: number }
/** No raw/derived Health observation is persisted. Owners and read generations stay isolated. */
export function useBioNight() {
  const { uid } = useAuth(), preferences = useAppSettings();
  const enabled = !!uid && preferences.ready && preferences.settings.bioHealthEnabled === true && preferences.settings.bioNightEnabled === true;
  const [snapshot, setSnapshot] = useState<Snapshot>({ owner: null, state: 'OFF' });
  const [revision, setRevision] = useState(0), generation = useRef(0);
  useFocusEffect(useCallback(() => {
    let alive = true, sequence = 0;
    const epoch = ++generation.current;
    const load = async () => {
      const token = ++sequence;
      const current = () => alive && epoch === generation.current && sequence === token;
      setSnapshot({ owner: uid, state: enabled ? 'LOADING' : 'OFF' });
      if (!enabled) return;
      try {
        if (!await bioNightBridge.available()) { if (current()) setSnapshot({ owner: uid, state: 'UNAVAILABLE' }); return; }
        // Availability can complete after disconnect/account changes; do not initiate an obsolete read.
        if (!current()) return;
        const now = Date.now(), data = await bioNightBridge.read(nightWindowStart(now), now);
        if (current()) setSnapshot({ owner: uid, state: 'READY', analysis: buildNightObservations(data, now), fetchedAt: now });
      } catch { if (current()) setSnapshot({ owner: uid, state: 'ERROR' }); }
    };
    void load();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => { alive = false; generation.current++; listener.remove(); };
  }, [uid, enabled, revision]));
  const visible: Snapshot = snapshot.owner === uid && enabled ? snapshot : { owner: uid, state: enabled ? 'LOADING' : 'OFF' };
  return { ...visible, reload: () => setRevision((value) => value + 1) };
}
