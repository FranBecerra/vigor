import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import type { SportActivity, SportActivityDraft } from '@/models/sportActivity';
import { db } from '@/services/firebase';
import { SportActivityRepository, sportActivityPath } from '@/services/cardio/sportActivityRepository';
import { sportActivityStart, validSportActivity } from '@/services/cardio/sportActivities';
import { useAuth } from './useAuth';

/** Owner-scoped subscription. No athlete record is created by mounting a screen. */
export function useSportActivities() {
  const { uid } = useAuth();
  const owner = useRef({ uid, epoch: 0 });
  if (owner.current.uid !== uid) owner.current = { uid, epoch: owner.current.epoch + 1 };
  const epoch = owner.current.epoch;
  const live = useRef(false), busy = useRef(false);
  const subscription = useRef(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ owner: string | null; entries: SportActivity[]; ready: boolean; error: boolean }>({ owner: null, entries: [], ready: false, error: false });
  const repository = useMemo(() => uid ? new SportActivityRepository(uid) : null, [uid]);
  useEffect(() => {
    live.current = true; busy.current = false;
    subscription.current += 1;
    let alive = true;
    setState((old) => ({ owner: uid, entries: old.owner === uid ? old.entries : [], ready: !uid, error: false }));
    if (!uid) return () => { alive = false; live.current = false; subscription.current += 1; };
    const stop = onSnapshot(collection(db, sportActivityPath(uid)), { includeMetadataChanges: true }, (snapshot) => {
      if (!alive) return;
      const received = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
      const valid = received.filter((item): item is SportActivity => validSportActivity(item, uid));
      setState({ owner: uid, entries: valid.filter((item) => item.discardedAt === null)
        .sort((a, b) => sportActivityStart(b) - sportActivityStart(a) || a.id.localeCompare(b.id)), ready: true, error: valid.length !== received.length });
    }, () => { if (alive) setState((old) => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; live.current = false; subscription.current += 1; stop(); };
  }, [uid, retry]);
  const isCurrent = () => live.current && owner.current.uid === uid && owner.current.epoch === epoch;
  const visible = state.owner === uid ? state : { owner: uid, entries: [], ready: false, error: false };
  const write = async (action: (repo: SportActivityRepository, current: () => boolean, reject: () => void) => Promise<SportActivity>) => {
    if (!repository || !isCurrent() || !visible.ready || visible.error || busy.current) throw Error('sportsUnavailable');
    busy.current = true;
    const token = subscription.current;
    const current = () => isCurrent() && token === subscription.current;
    const reject = () => { if (current()) setState((old) => ({ ...old, error: true })); };
    try {
      const entry = await action(repository, current, reject);
      if (!current()) throw Error('staleSportOwner');
      setState((old) => ({ ...old, entries: [...old.entries.filter((item) => item.id !== entry.id), ...(entry.discardedAt === null ? [entry] : [])]
        .sort((a, b) => sportActivityStart(b) - sportActivityStart(a) || a.id.localeCompare(b.id)) }));
      return entry;
    } finally { if (current()) busy.current = false; }
  };
  return { ...visible, reload: () => setRetry((value) => value + 1),
    newId: () => repository?.newId() ?? '',
    save: (id: string, original: SportActivity | null, draft: SportActivityDraft) => write((repo, current, reject) => repo.save(id, original, draft, Date.now(), current, reject)),
    discard: (original: SportActivity) => write((repo, current, reject) => repo.discard(original, Date.now(), current, reject)),
  };
}
