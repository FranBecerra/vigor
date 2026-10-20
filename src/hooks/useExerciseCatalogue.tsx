/** One private catalogue for all training surfaces; native Firestore owns persistence. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from './useAuth';
import { db } from '@/services/firebase';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { createCustomExercise, isValidCustomExercise, mergeExerciseCatalogue, type CustomExerciseInput } from '@/services/training/customExercises';
import type { Exercise } from '@/models';

interface CatalogueState {
  catalogue: readonly Exercise[];
  exercisesById: ReadonlyMap<string, Exercise>;
  ready: boolean;
  error: boolean;
  create: (input: CustomExerciseInput) => Promise<Exercise>;
  archive: (exercise: Exercise) => Promise<void>;
}
const Context = createContext<CatalogueState | null>(null);
export function ExerciseCatalogueProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const [state, setState] = useState<{ owner: string | null; entries: Exercise[]; ready: boolean; error: boolean }>(
    { owner: null, entries: [], ready: false, error: false });
  useEffect(() => {
    if (!uid) { setState({ owner: null, entries: [], ready: true, error: false }); return; }
    let alive = true;
    setState({ owner: uid, entries: [], ready: false, error: false });
    const stop = onSnapshot(collection(db, `users/${uid}/customExercises`), (snapshot) => {
      const received = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Exercise));
      const valid = received.filter((entry) => isValidCustomExercise(entry, uid));
      if (alive) setState({ owner: uid, entries: valid,
        ready: true, error: valid.length !== received.length });
    }, () => { if (alive) setState((old) => ({ ...old, owner: uid, ready: true, error: true })); });
    return () => { alive = false; stop(); };
  }, [uid]);
  const entries = state.owner === uid ? state.entries : [];
  const catalogue = useMemo(() => mergeExerciseCatalogue(EXERCISE_CATALOGUE, entries, uid), [entries, uid]);
  const exercisesById = useMemo(() => new Map(catalogue.map((exercise) => [exercise.id, exercise])), [catalogue]);
  const value: CatalogueState = { catalogue, exercisesById, ready: state.owner === uid && state.ready, error: state.error,
    create: async (input) => {
      if (!uid) throw new Error('invalidIdentity');
      const exercise = createCustomExercise(input, uid, `custom:${uid}:${Date.now()}-${Math.random().toString(36).slice(2)}`, entries, Date.now());
      await new BaseRepository<Exercise>(`users/${uid}/customExercises`).createLocally(exercise, undefined,
        () => setState((old) => old.owner === uid ? { ...old, error: true } : old));
      setState((old) => old.owner === uid ? { ...old, entries: [...old.entries.filter((entry) => entry.id !== exercise.id), exercise] } : old);
      return exercise;
    },
    archive: async (exercise) => {
      if (!uid || exercise.ownerId !== uid) throw new Error('invalidIdentity');
      await new BaseRepository<Exercise>(`users/${uid}/customExercises`).createLocally({ ...exercise, archivedAt: Date.now(), updatedAt: Date.now() }, undefined,
        () => setState((old) => old.owner === uid ? { ...old, error: true } : old));
    } };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useExerciseCatalogue() {
  const value = useContext(Context);
  if (!value) throw new Error('ExerciseCatalogueProvider is required');
  return value;
}
