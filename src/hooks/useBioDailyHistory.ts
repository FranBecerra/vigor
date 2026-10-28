import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { collection, documentId, getDocs, limit, orderBy, query, where } from '@react-native-firebase/firestore';
import type { DailyCheckIn } from '@/models/dailyCheckIn';
import { db } from '@/services/firebase';
import { localCheckInDate, validDailyCheckIn } from '@/services/bio/dailyCheckIn';
import { healthWindowStart } from '@/services/bio/healthTrends';
import { useAuth } from './useAuth';

interface State { owner: string | null; ready: boolean; error: boolean; entries: DailyCheckIn[] }
/** A bounded, focus-scoped daily history; late owner/date results never become visible. */
export function useBioDailyHistory() {
  const { uid } = useAuth(), generation = useRef(0);
  const [state, setState] = useState<State>({ owner: null, ready: false, error: false, entries: [] });
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true, sequence = 0;
    const epoch = ++generation.current;
    const load = async () => {
      const token = ++sequence, now = Date.now(), date = localCheckInDate(now);
      const current = () => active && generation.current === epoch && sequence === token && localCheckInDate(Date.now()) === date;
      if (!uid) { setState({ owner: null, ready: true, error: false, entries: [] }); return; }
      try {
        const snapshot = await getDocs(query(collection(db, `users/${uid}/dailyCheckIns`),
          where(documentId(), '>=', localCheckInDate(healthWindowStart(now))), where(documentId(), '<=', date),
          orderBy(documentId(), 'desc'), limit(43)));
        const entries = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }))
          .filter((entry): entry is DailyCheckIn => validDailyCheckIn(entry, uid, entry.id) && entry.updatedAt <= now);
        if (current()) setState({ owner: uid, ready: true, error: false, entries });
      } catch { if (current()) setState({ owner: uid, ready: true, error: true, entries: [] }); }
    };
    void load();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => { active = false; generation.current++; listener.remove(); };
  }, [uid, revision]));
  return { ...(state.owner === uid ? state : { owner: uid, ready: false, error: false, entries: [] }), reload: () => setRevision((value) => value + 1) };
}
