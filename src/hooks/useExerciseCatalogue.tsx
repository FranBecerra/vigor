/** One private catalogue for all training surfaces; native Firestore owns persistence. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from '@react-native-firebase/firestore';
import { useAuth } from './useAuth';
import { db } from '@/services/firebase';
import { BaseRepository } from '@/services/repositories/BaseRepository';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { createCustomExercise, isValidCustomExercise, mergeExerciseCatalogue, type CustomExerciseInput } from '@/services/training/customExercises';
import type { Exercise } from '@/models';
import { exercisePreference, isValidExercisePreference, recommendedExerciseIds, type ExercisePreference } from '@/services/training/exercisePreferences';
import { createExerciseOverride, mergeExerciseOverrides, validExerciseOverride, type ExerciseEditInput, type ExerciseOverride } from '@/services/training/exerciseEditing';

interface CatalogueState {
  catalogue: readonly Exercise[];
  exercisesById: ReadonlyMap<string, Exercise>;
  ready: boolean;
  error: boolean;
  create: (input: CustomExerciseInput) => Promise<Exercise>;
  archive: (exercise: Exercise) => Promise<void>;
  edit: (exercise: Exercise, input: ExerciseEditInput) => Promise<Exercise>;
  notRecommendedExerciseIds: ReadonlySet<string>;
  preferencesReady: boolean;
  setExerciseNotRecommended: (exerciseId: string, notRecommended: boolean) => Promise<void>;
}
const Context = createContext<CatalogueState | null>(null);
export function ExerciseCatalogueProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const activeOwner = useRef(uid); activeOwner.current = uid;
  const [state, setState] = useState<{ owner: string | null; entries: Exercise[]; ready: boolean; error: boolean }>(
    { owner: null, entries: [], ready: false, error: false });
  const [overrides, setOverrides] = useState<{ owner: string | null; entries: ExerciseOverride[]; ready: boolean; error: boolean }>({ owner: null, entries: [], ready: false, error: false });
  const [preferences, setPreferences] = useState<{ owner: string | null; entries: ExercisePreference[]; ready: boolean; error: boolean }>({ owner: null, entries: [], ready: false, error: false });
  useEffect(() => {
    setOverrides({ owner: uid, entries: [], ready: !uid, error: false });
    if (!uid) return;
    let alive = true;
    const stop = onSnapshot(collection(db, `users/${uid}/exerciseOverrides`), (snapshot) => {
      const received = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as ExerciseOverride));
      const entries = received.filter((entry) => validExerciseOverride(entry, uid));
      if (alive) setOverrides({ owner: uid, entries, ready: true, error: entries.length !== received.length });
    }, () => { if (alive) setOverrides((old) => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; stop(); };
  }, [uid]);
  useEffect(() => {
    setPreferences({ owner: uid, entries: [], ready: !uid, error: false });
    if (!uid) return;
    let alive = true;
    const stop = onSnapshot(collection(db, `users/${uid}/exercisePreferences`), (snapshot) => {
      const received = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as ExercisePreference));
      const entries = received.filter((entry) => isValidExercisePreference(entry, uid));
      if (alive) setPreferences({ owner: uid, entries, ready: true, error: entries.length !== received.length });
    }, () => { if (alive) setPreferences((old) => ({ ...old, ready: true, error: true })); });
    return () => { alive = false; stop(); };
  }, [uid]);
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
  const privateOverrides = overrides.owner === uid ? overrides.entries : [];
  const privatePreferences = preferences.owner === uid ? preferences.entries : [];
  const vetoedExerciseIds = useMemo(() => recommendedExerciseIds(privatePreferences), [privatePreferences]);
  const catalogue = useMemo(() => mergeExerciseOverrides(mergeExerciseCatalogue(EXERCISE_CATALOGUE, entries, uid), privateOverrides, uid), [entries, privateOverrides, uid]);
  const exercisesById = useMemo(() => new Map(catalogue.map((exercise) => [exercise.id, exercise])), [catalogue]);
  const value: CatalogueState = { catalogue, exercisesById, notRecommendedExerciseIds: vetoedExerciseIds,
    preferencesReady: preferences.owner === uid && preferences.ready && !preferences.error,
    ready: state.owner === uid && state.ready && overrides.owner === uid && overrides.ready && preferences.owner === uid && preferences.ready,
    error: (state.owner === uid && state.error) || (overrides.owner === uid && overrides.error) || (preferences.owner === uid && preferences.error),
    setExerciseNotRecommended: async (exerciseId, notRecommended) => {
      if (!uid || uid !== activeOwner.current || !exercisesById.has(exerciseId)) throw Error('invalidIdentity');
      if (state.owner !== uid || !state.ready || state.error || overrides.owner !== uid || !overrides.ready || overrides.error || preferences.owner !== uid || !preferences.ready || preferences.error) throw Error('saveFailed');
      const saved = exercisePreference(exerciseId, uid, notRecommended, Date.now());
      let rejected = false;
      await new BaseRepository<ExercisePreference>(`users/${uid}/exercisePreferences`).createLocally(saved, undefined, () => {
        rejected = true;
        setPreferences((old) => old.owner === uid ? { ...old, error: true } : old);
      });
      if (rejected || uid !== activeOwner.current) throw Error('saveFailed');
      setPreferences((old) => old.owner === uid ? { ...old, entries: [...old.entries.filter((entry) => entry.id !== exerciseId), saved] } : old);
    },
    edit: async (exercise, input) => {
      const current = exercisesById.get(exercise.id);
      if (!uid || uid !== activeOwner.current || !current) throw Error('invalidIdentity');
      if (state.owner !== uid || !state.ready || overrides.owner !== uid || !overrides.ready || overrides.error) throw Error('saveFailed');
      const saved = createExerciseOverride(current, input, uid, Date.now()); let rejected = false;
      await new BaseRepository<ExerciseOverride>(`users/${uid}/exerciseOverrides`).createLocally(saved, undefined, () => {
        rejected = true; setOverrides((old) => old.owner === uid ? { ...old, error: true } : old);
      });
      if (rejected || uid !== activeOwner.current) throw Error('saveFailed');
      setOverrides((old) => old.owner === uid ? { ...old, entries: [...old.entries.filter((entry) => entry.id !== saved.id), saved] } : old);
      return mergeExerciseOverrides([current], [saved], uid)[0];
    },
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
export function useOptionalExerciseCatalogue() {
  return useContext(Context);
}
