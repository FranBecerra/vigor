import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import type { MicrocycleReview, MicrocycleReviewAnswers } from '@/models/microcycleReview';
import { db } from '@/services/firebase';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
import { buildBioCycles, createMicrocycleReview, validMicrocycleReview, type BioCycle } from '@/services/bio/microcycleReview';
import { useAuth } from './useAuth';

interface ReviewsState {
  ready: boolean;
  error: boolean;
  entries: MicrocycleReview[];
  save: (cycle: BioCycle, answers: MicrocycleReviewAnswers, status?: MicrocycleReview['status']) => Promise<void>;
}
const Context = createContext<ReviewsState | null>(null);

export function MicrocycleReviewsProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const generation = useRef({ uid, value: 0 });
  if (generation.current.uid !== uid) generation.current = { uid, value: generation.current.value + 1 };
  const epoch = generation.current.value;
  const [state, setState] = useState<{ owner: string | null; entries: MicrocycleReview[]; ready: boolean; error: boolean }>({ owner: null, entries: [], ready: false, error: false });
  const busy = useRef(false);
  useEffect(() => {
    busy.current = false;
    setState({ owner: uid, entries: [], ready: !uid, error: false });
    if (!uid) return;
    let alive = true;
    const stop = onSnapshot(collection(db, `users/${uid}/microcycleReviews`), (snapshot) => {
      const received = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      const entries = received.filter((entry): entry is MicrocycleReview => validMicrocycleReview(entry, uid));
      if (alive) setState({ owner: uid, entries, ready: true, error: entries.length !== received.length });
    }, () => { if (alive) setState((old) => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; stop(); };
  }, [uid]);

  const current = () => generation.current.uid === uid && generation.current.value === epoch;
  const value: ReviewsState = {
    ready: state.owner === uid && state.ready,
    error: state.owner === uid && state.error,
    entries: state.owner === uid ? state.entries : [],
    save: async (cycle, answers, status = 'SUBMITTED') => {
      if (!uid || !current() || state.owner !== uid || !state.ready || state.error || busy.current) throw Error('reviewsUnavailable');
      busy.current = true;
      try {
        // Revalidate against fresh owned history: a discarded workout may reopen a cycle.
        const [plan, history] = await Promise.all([
          mesocycleRepository.get(cycle.mesocycleId), workoutSessionRepository.listByUser(uid),
        ]);
        if (!current() || !plan || plan.userId !== uid) throw Error('reviewsUnavailable');
        const fresh = buildBioCycles(uid, [plan], history, Date.now()).find((item) => item.id === cycle.id);
        if (!fresh?.closed) throw Error('reviewReopened');
        const previous = state.entries.find((entry) => entry.id === cycle.id);
        const entry = createMicrocycleReview(uid, fresh, answers, status, previous, Date.now());
        let rejected = false;
        await new BaseRepository<MicrocycleReview>(`users/${uid}/microcycleReviews`).createLocally(entry, undefined, () => {
          rejected = true;
          if (current()) setState((old) => old.owner === uid ? { ...old, error: true } : old);
        });
        if (rejected || !current()) throw Error('reviewSaveFailed');
        setState((old) => old.owner === uid ? { ...old, entries: [...old.entries.filter((item) => item.id !== entry.id), entry] } : old);
      } finally { if (current()) busy.current = false; }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMicrocycleReviews() {
  const value = useContext(Context);
  if (!value) throw Error('MicrocycleReviewsProvider is required');
  return value;
}
