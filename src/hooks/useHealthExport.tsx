import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { workoutHealth } from '@/services/health/healthClient';
import type { HealthExportView } from '@/services/health/workoutExport';

const Context = createContext<HealthExportView | null>(null);
export function HealthExportProvider({ children }: { children: ReactNode }) {
  const { uid, isLoading } = useAuth();
  const state = useSyncExternalStore(workoutHealth.subscribe, workoutHealth.getSnapshot, workoutHealth.getSnapshot);
  useEffect(() => { if (!isLoading) void workoutHealth.activate(uid); }, [uid, isLoading]);
  useEffect(() => {
    if (!uid || isLoading) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void workoutHealth.retryPending(uid).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [uid, isLoading]);
  // Never show a previous account's local journal during an account switch.
  const visible = state.owner === uid && !isLoading ? state : { ...state, owner: uid, ready: false, enabled: false, entries: {}, error: false };
  return <Context.Provider value={visible}>{children}</Context.Provider>;
}
export function useHealthExport() {
  const value = useContext(Context);
  if (!value) throw Error('HealthExportProvider missing');
  return { ...value, service: workoutHealth };
}
