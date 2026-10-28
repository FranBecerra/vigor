import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { doc, onSnapshot } from '@react-native-firebase/firestore';
import type { DailyCheckIn, DailyCheckInAnswers } from '@/models/dailyCheckIn';
import { createDailyCheckIn, localCheckInDate, validDailyCheckIn } from '@/services/bio/dailyCheckIn';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { db } from '@/services/firebase';
import { useAuth } from './useAuth';

interface State { owner: string | null; date: string; ready: boolean; error: boolean; pending: boolean; entry?: DailyCheckIn }

/** Subscribe only to today's owned document; no questionnaire appears automatically. */
export function useDailyCheckIn() {
  const { uid } = useAuth();
  const [date, setDate] = useState(() => localCheckInDate(Date.now()));
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({ owner: null, date, ready: false, error: false, pending: false });
  const generation = useRef({ uid, date, value: 0 });
  if (generation.current.uid !== uid || generation.current.date !== date) generation.current = { uid, date, value: generation.current.value + 1 };
  const epoch = generation.current.value;
  const busy = useRef(false);
  const subscription = useRef(0);
  useEffect(() => {
    const refresh = () => setDate(localCheckInDate(Date.now()));
    const interval = setInterval(refresh, 30_000);
    const listener = AppState.addEventListener('change', (status) => { if (status === 'active') refresh(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, []);
  useEffect(() => {
    const token = ++subscription.current;
    busy.current = false;
    setState((old) => ({ owner: uid, date, ready: !uid, error: false, pending: false,
      ...(old.owner === uid && old.date === date && old.entry ? { entry: old.entry } : {}) }));
    if (!uid) return;
    let alive = true;
    const stop = onSnapshot(doc(db, `users/${uid}/dailyCheckIns/${date}`), { includeMetadataChanges: true }, (snapshot) => {
      if (!alive) return;
      const entry = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : undefined;
      const valid = entry === undefined || validDailyCheckIn(entry, uid, date);
      setState({ owner: uid, date, ready: true, error: !valid, pending: snapshot.metadata.hasPendingWrites,
        ...(entry && valid ? { entry: entry as DailyCheckIn } : {}) });
    }, () => { if (alive) setState((old) => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; subscription.current = token + 1; stop(); };
  }, [uid, date, revision]);

  const current = () => generation.current.uid === uid && generation.current.date === date && generation.current.value === epoch
    && localCheckInDate(Date.now()) === date;
  const visible: State = state.owner === uid && state.date === date ? state : { owner: uid, date, ready: false, error: false, pending: false };
  return { ...visible, reload: () => setRevision((value) => value + 1), save: async (answers: DailyCheckInAnswers) => {
    if (!uid || !current() || !visible.ready || visible.error || busy.current) throw Error('checkInUnavailable');
    const token = subscription.current;
    const active = () => current() && token === subscription.current;
    busy.current = true;
    try {
      const entry = createDailyCheckIn(uid, date, answers, Date.now(), visible.entry);
      let rejected = false, synced = false;
      const result = await new BaseRepository<DailyCheckIn>(`users/${uid}/dailyCheckIns`).createLocally(entry, () => {
        synced = true;
        if (active()) setState((old) => ({ ...old, pending: false }));
      }, () => {
        rejected = true;
        if (active()) setState((old) => ({ ...old, error: true }));
      });
      if (rejected || !active()) throw Error('checkInSaveFailed');
      setState((old) => ({ ...old, entry, pending: !synced && result !== 'synced' }));
    } finally { if (active()) busy.current = false; }
  } };
}
