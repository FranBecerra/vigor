import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from './useAuth';
import { db } from '@/services/firebase';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { validateRehabBlock, validateRehabLog } from '@/services/training/rehabilitation';
import type { RehabBlock, RehabLog } from '@/models';

interface RehabState { blocks: RehabBlock[]; logs: RehabLog[]; ready: boolean; error: boolean;
  saveBlock: (block: RehabBlock) => Promise<void>; saveLog: (log: RehabLog) => Promise<void> }
const Context = createContext<RehabState | null>(null);
export function RehabilitationProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const [state, setState] = useState<{ owner: string | null; blocks: RehabBlock[]; logs: RehabLog[]; reads: number; error: boolean }>(
    { owner: null, blocks: [], logs: [], reads: 0, error: false });
  useEffect(() => {
    setState({ owner: uid, blocks: [], logs: [], reads: 0, error: false });
    if (!uid) return;
    let alive = true;
    const loaded = new Set<string>();
    const stop = ['rehabBlocks', 'rehabLogs'].map((kind) => onSnapshot(collection(db, `users/${uid}/${kind}`), (snapshot) => {
      if (!alive) return;
      loaded.add(kind);
      let invalid = false;
      const values = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })).filter((value) => {
        try {
          if (kind === 'rehabBlocks') validateRehabBlock(value as RehabBlock); else validateRehabLog(value as RehabLog);
          return (value as RehabBlock).userId === uid;
        } catch { invalid = true; return false; }
      });
      setState((old) => ({ ...old, owner: uid, reads: loaded.size, error: old.error || invalid,
        ...(kind === 'rehabBlocks' ? { blocks: values as RehabBlock[] } : { logs: values as RehabLog[] }) }));
    }, () => { if (alive) setState((old) => ({ ...old, error: true })); }));
    return () => { alive = false; stop.forEach((unsubscribe) => unsubscribe()); };
  }, [uid]);
  const value: RehabState = { blocks: state.owner === uid ? state.blocks : [], logs: state.owner === uid ? state.logs : [],
    ready: !!uid && state.owner === uid && state.reads === 2, error: state.error,
    saveBlock: async (block) => {
      if (!uid || block.userId !== uid) throw new Error('invalidIdentity');
      validateRehabBlock(block);
      await new BaseRepository<RehabBlock>(`users/${uid}/rehabBlocks`).createLocally(block, undefined,
        () => setState((old) => old.owner === uid ? { ...old, error: true } : old));
    },
    saveLog: async (log) => {
      if (!uid || log.userId !== uid || log.blockSnapshot.userId !== uid) throw new Error('invalidIdentity');
      validateRehabLog(log);
      await new BaseRepository<RehabLog>(`users/${uid}/rehabLogs`).createLocally(log, undefined,
        () => setState((old) => old.owner === uid ? { ...old, error: true } : old));
    } };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRehabilitation() {
  const value = useContext(Context);
  if (!value) throw new Error('RehabilitationProvider is required');
  return value;
}
