import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { db } from '@/services/firebase';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { createTrainingNote, trainingNoteId, validTrainingNote, type SharedNoteScope, type TrainingNote } from '@/services/training/trainingNotes';
import { useAuth } from './useAuth';

interface NotesState { ready: boolean; error: boolean; get: (scope: SharedNoteScope, targetId: string) => string; save: (scope: SharedNoteScope, targetId: string, text: string) => Promise<void> }
const Context = createContext<NotesState | null>(null);
export function TrainingNotesProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth(); const owner = useRef(uid); owner.current = uid;
  const [state, setState] = useState<{ owner: string | null; entries: TrainingNote[]; ready: boolean; error: boolean }>({ owner: null, entries: [], ready: false, error: false });
  useEffect(() => {
    setState({ owner: uid, entries: [], ready: !uid, error: false });
    if (!uid) return;
    let alive = true;
    const stop = onSnapshot(collection(db, `users/${uid}/trainingNotes`), (snapshot) => {
      const received = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as TrainingNote));
      const entries = received.filter((entry) => validTrainingNote(entry, uid));
      if (alive) setState({ owner: uid, entries, ready: true, error: entries.length !== received.length });
    }, () => { if (alive) setState((old) => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; stop(); };
  }, [uid]);
  const entries = useMemo(() => new Map((state.owner === uid ? state.entries : []).map((entry) => [entry.id, entry.text])), [state.owner, state.entries, uid]);
  const value: NotesState = { ready: state.owner === uid && state.ready, error: state.owner === uid && state.error,
    get: (scope, targetId) => { try { return targetId ? entries.get(trainingNoteId(scope, targetId)) ?? '' : ''; } catch { return ''; } },
    save: async (scope, targetId, text) => {
      if (!uid || uid !== owner.current || !state.ready || state.owner !== uid || state.error) throw Error('notesUnavailable');
      const note = createTrainingNote(uid, scope, targetId, text, Date.now()); let rejected = false;
      await new BaseRepository<TrainingNote>(`users/${uid}/trainingNotes`).createLocally(note, undefined, () => {
        rejected = true; setState((old) => old.owner === uid ? { ...old, error: true } : old);
      });
      if (rejected || owner.current !== uid) throw Error('saveFailed');
      setState((old) => old.owner === uid ? { ...old, entries: [...old.entries.filter((entry) => entry.id !== note.id), note] } : old);
    } };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTrainingNotes() {
  const value = useContext(Context); if (!value) throw Error('TrainingNotesProvider is required'); return value;
}
