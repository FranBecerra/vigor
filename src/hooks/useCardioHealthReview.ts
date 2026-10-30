import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import { cardioHealthBridge } from '@/services/health/cardioHealthClient';
import { cardioHealthWindow, reviewCardioHealth } from '@/services/cardio/cardioHealthReview';
import type { CardioHealthBridge, CardioHealthRead } from '@/models/cardioHealth';

export type CardioHealthState = 'IDLE' | 'AUTHORIZING' | 'LOADING' | 'READY' | 'UNAVAILABLE' | 'ERROR';
interface Snapshot { owner: string | null; epoch: number; state: CardioHealthState; data?: CardioHealthRead; observedAt?: number }

/** Explicit, one-screen review. No automatic authorization/read, persistence or foreground reread. */
export function useCardioHealthReview(bridge: CardioHealthBridge = cardioHealthBridge) {
  const { uid, isLoading } = useAuth();
  const life = useRef({ owner: uid, authLoading: isLoading, epoch: 0, focused: false, mounted: true, busy: false });
  if (life.current.owner !== uid || life.current.authLoading !== isLoading) {
    life.current.owner = uid; life.current.authLoading = isLoading; life.current.epoch++; life.current.busy = false;
  }
  const [snapshot, setSnapshot] = useState<Snapshot>({ owner: uid, epoch: 0, state: 'IDLE' });
  const clear = useCallback(() => {
    life.current.epoch++; life.current.busy = false;
    if (life.current.mounted) setSnapshot({ owner: life.current.owner, epoch: life.current.epoch, state: 'IDLE' });
  }, []);
  useEffect(() => { life.current.mounted = true; return () => { life.current.mounted = false; life.current.epoch++; }; }, []);
  useFocusEffect(useCallback(() => {
    life.current.focused = true;
    return () => { life.current.focused = false; clear(); };
  }, [uid, isLoading, clear]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      // The Health authorization sheet can make the app inactive; do not cancel that explicit request.
      if (state === 'background') clear();
    });
    return () => listener.remove();
  }, [clear]);
  const read = async () => {
    if (!uid || isLoading || life.current.owner !== uid || !life.current.focused || life.current.busy || AppState.currentState === 'background') return;
    const owner = uid, epoch = ++life.current.epoch;
    life.current.busy = true; setSnapshot({ owner, epoch, state: 'AUTHORIZING' });
    const current = () => life.current.mounted && life.current.focused && life.current.owner === owner && life.current.epoch === epoch;
    try {
      if (!await bridge.available()) { if (current()) setSnapshot({ owner, epoch, state: 'UNAVAILABLE' }); return; }
      if (!current()) return;
      await bridge.authorize();
      if (!current()) return;
      setSnapshot({ owner, epoch, state: 'LOADING' });
      const now = Date.now(), window = cardioHealthWindow(now), data = await bridge.read(window.start, window.end);
      if (!current()) return;
      // Validate before publishing; malformed native envelopes never become an apparently empty history.
      reviewCardioHealth(data, now);
      setSnapshot({ owner, epoch, state: 'READY', data, observedAt: now });
    } catch { if (current()) setSnapshot({ owner, epoch, state: 'ERROR' }); }
    finally { if (current()) life.current.busy = false; }
  };
  const visible: Snapshot = !isLoading && uid && snapshot.owner === uid && snapshot.epoch === life.current.epoch ? snapshot : { owner: uid, epoch: life.current.epoch, state: 'IDLE' };
  return { ...visible, read, clear };
}
