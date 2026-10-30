import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from './useAuth';
import { db } from '@/services/firebase';
import { CardioTrainingRepository, cardioTrainingPath, type CardioCollection, type CardioEntity } from '@/services/cardio/cardioTrainingRepository';
import { validCardioBlock } from '@/services/cardio/cardioBlock';
import { validCardioWorkout } from '@/services/cardio/cardioWorkout';

/** Each entity has its own private document; unrelated sessions cannot overwrite one another. */
function useCardioEntities<T extends CardioEntity>(name: CardioCollection, validate: (value: unknown, owner: string) => value is T) {
  const { uid } = useAuth(); const owner = useRef({ uid, epoch: 0 });
  if (owner.current.uid !== uid) owner.current = { uid, epoch: owner.current.epoch + 1 };
  const epoch = owner.current.epoch, live = useRef(false), busy = useRef(false), generation = useRef(0), rejection = useRef(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ owner: string | null; entries: T[]; ready: boolean; error: boolean; pending: boolean }>({ owner: null, entries: [], ready: false, error: false, pending: false });
  const repo = useMemo(() => uid ? new CardioTrainingRepository(uid, name, validate) : null, [uid, name, validate]);
  useEffect(() => {
    let alive = true; live.current = true; busy.current = false; rejection.current = false; generation.current += 1;
    setState(old => ({ owner: uid, entries: old.owner === uid ? old.entries : [], ready: !uid, error: false, pending: old.owner === uid && old.pending }));
    if (!uid) return () => { alive = false; live.current = false; generation.current += 1; };
    const stop = onSnapshot(collection(db, cardioTrainingPath(uid, name)), { includeMetadataChanges: true }, snapshot => {
      if (!alive) return;
      const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      const entries = all.filter((value): value is T => validate(value, uid)).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
      setState({ owner: uid, entries, ready: true, error: rejection.current || all.length !== entries.length, pending: snapshot.metadata.hasPendingWrites });
    }, () => { if (alive) setState(old => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; live.current = false; generation.current += 1; stop(); };
  }, [uid, name, retry, validate]);
  const isCurrent = () => live.current && owner.current.uid === uid && owner.current.epoch === epoch;
  const visible = state.owner === uid ? state : { owner: uid, entries: [] as T[], ready: false, error: false, pending: false };
  return { ...visible, newId: () => repo?.newId() ?? '', reload: () => setRetry(n => n + 1),
    save: async (next: T, previous: T | null) => {
      if (!repo || !visible.ready || visible.error || !isCurrent() || busy.current) throw Error('cardioUnavailable');
      busy.current = true; const token = generation.current; const current = () => isCurrent() && token === generation.current;
      try {
        const entry = await repo.save(next, previous, current, () => { if (current()) { rejection.current = true; setState(old => ({ ...old, error: true })); } });
        if (!current()) throw Error('staleCardioOwner');
        setState(old => ({ ...old, entries: [...old.entries.filter(e => e.id !== entry.id), entry].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)) }));
        return entry;
      } finally { if (current()) busy.current = false; }
    },
  };
}
export const useCardioBlocks = () => useCardioEntities('cardioBlocks', validCardioBlock);
export const useCardioWorkouts = () => useCardioEntities('cardioWorkouts', validCardioWorkout);
