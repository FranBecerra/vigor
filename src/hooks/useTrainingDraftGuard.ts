import { useEffect, useRef, useSyncExternalStore } from 'react';

// Ephemeral navigation state only; no athlete data or draft contents are stored here.
const owners = new Set<symbol>(), listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());
export const useTrainingDraftGuard = () => useSyncExternalStore(subscribe, () => owners.size > 0, () => false);
export function useProtectTrainingDraft(active: boolean) {
  const owner = useRef(Symbol('training-draft')).current;
  useEffect(() => {
    if (active) { owners.add(owner); notify(); }
    return () => { if (owners.delete(owner)) notify(); };
  }, [active, owner]);
}
