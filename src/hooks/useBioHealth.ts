import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { BioHealthTrend } from '@/models/bioHealth';
import { buildHealthTrends, healthWindowStart } from '@/services/bio/healthTrends';
import { bioHealthBridge } from '@/services/health/bioHealthClient';
import { useAuth } from './useAuth';
import { useAppSettings } from './useAppSettings';
import { loadAudit, type LoadTrigger } from '@/services/performance/loadAudit';

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
    const load = async (trigger: LoadTrigger = 'focus') => {
      const token = ++sequence;
      const current = () => alive && epoch === generation.current && sequence === token;
      // Retain only this owner's in-memory readings during revalidation. LOADING
      // remains explicit: these are not newly fetched observations/readiness.
      setSnapshot(previous => enabled && previous.owner === uid && previous.fetchedAt !== undefined
        ? { ...previous, state: 'LOADING' } : { owner: uid, state: enabled ? 'LOADING' : 'OFF', trends: [] });
      if (!enabled) return;
      const end = loadAudit.begin('bio.health', trigger);
      try {
        if (!await bioHealthBridge.bioAvailable()) { if (current()) setSnapshot({ owner: uid, state: 'UNAVAILABLE', trends: [] }); return; }
        if (!current()) return;
        const now = Date.now(), data = await bioHealthBridge.readBio(healthWindowStart(now), now);
        if (current()) setSnapshot({ owner: uid, state: 'READY', trends: buildHealthTrends(data, now), fetchedAt: now });
      } catch { end('error'); if (current()) setSnapshot({ owner: uid, state: 'ERROR', trends: [] }); }
      finally { end(current() ? 'success' : 'cancelled'); }
    };
    void load();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void load('foreground'); });
    return () => { alive = false; generation.current++; listener.remove(); };
  }, [uid, enabled, revision]));
  const visible: Snapshot = uid && !preferences.ready ? { owner: uid, state: 'LOADING', trends: [] }
    : snapshot.owner === uid && enabled ? snapshot : { owner: uid, state: enabled ? 'LOADING' : 'OFF', trends: [] };
  return { ...visible, reload: () => setRevision((value) => value + 1) };
}
