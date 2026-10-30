import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { db } from '@/services/firebase';
import { CardioPlanRepository, cardioPlanPath } from '@/services/cardio/cardioPlanRepository';
import { validSavedCardioPlan, type SavedCardioPlan } from '@/services/cardio/savedCardioPlan';
import { useAuth } from './useAuth';

interface PlanState { owner: string | null; entries: SavedCardioPlan[]; ready: boolean; error: boolean; pending: boolean }
const sorted = (entries: SavedCardioPlan[]) => entries.filter(p => p.archivedAt === null).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));

/** No writes on mount. Native local acceptance is distinct from cloud confirmation. */
export function useCardioPlans() {
  const { uid } = useAuth();
  const owner = useRef({ uid, epoch: 0 });
  if (owner.current.uid !== uid) owner.current = { uid, epoch: owner.current.epoch + 1 };
  const epoch = owner.current.epoch, live = useRef(false), busy = useRef(false), subscription = useRef(0), writeRejected = useRef(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<PlanState>({ owner: null, entries: [], ready: false, error: false, pending: false });
  const repository = useMemo(() => uid ? new CardioPlanRepository(uid) : null, [uid]);
  useEffect(() => {
    live.current = true; busy.current = false; writeRejected.current = false; subscription.current += 1; let alive = true;
    setState(old => ({ ...old, owner: uid, entries: old.owner === uid ? old.entries : [], ready: !uid, error: false, pending: old.owner === uid && old.pending }));
    if (!uid) return () => { alive = false; live.current = false; subscription.current += 1; };
    const stop = onSnapshot(collection(db, cardioPlanPath(uid)), { includeMetadataChanges: true }, snapshot => {
      if (!alive) return;
      const records = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
      const valid = records.filter((p): p is SavedCardioPlan => validSavedCardioPlan(p, uid));
      setState({ owner: uid, entries: sorted(valid), ready: true, error: writeRejected.current || valid.length !== records.length, pending: snapshot.metadata.hasPendingWrites });
    }, () => { if (alive) setState(old => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; live.current = false; subscription.current += 1; stop(); };
  }, [uid, retry]);
  const isCurrent = () => live.current && owner.current.uid === uid && owner.current.epoch === epoch;
  const visible = state.owner === uid ? state : { owner: uid, entries: [], ready: false, error: false, pending: false };
  const write = async (action: (repo: CardioPlanRepository, current: () => boolean, reject: () => void) => Promise<SavedCardioPlan>) => {
    if (!repository || !isCurrent() || !visible.ready || visible.error || busy.current) throw Error('cardioUnavailable');
    busy.current = true; const token = subscription.current;
    const current = () => isCurrent() && token === subscription.current;
    const reject = () => { if (current()) { writeRejected.current = true; setState(old => ({ ...old, error: true })); } };
    try {
      const plan = await action(repository, current, reject);
      if (!current()) throw Error('staleCardioOwner');
      setState(old => ({ ...old, entries: sorted([...old.entries.filter(p => p.id !== plan.id), plan]) }));
      return plan;
    } finally { if (current()) busy.current = false; }
  };
  return { ...visible, reload: () => setRetry(n => n + 1), newId: () => repository?.newId() ?? '',
    save: (plan: SavedCardioPlan) => write((repo, current, reject) => repo.save(plan, current, reject)),
    archive: (plan: SavedCardioPlan) => write((repo, current, reject) => repo.archive(plan, Date.now(), current, reject)),
  };
}
