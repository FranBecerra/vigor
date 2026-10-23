/**
 * Pantalla Entrenamiento — registro de sesión de fuerza (PRD §8.5).
 *
 * La pantalla solo ORQUESTA: cabecera, carrusel de miniaturas, resumen y el
 * paginado. El contenido de cada ejercicio vive en `ExercisePage`, memoizada,
 * para que editar una serie no re-renderice las demás páginas (era la causa de
 * la lentitud percibida al pulsar).
 *
 * Data: persisted planned sessions and their matching execution document.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { WorkoutPagerGestureContext } from '@/components/train/WorkoutPagerGesture';
import { WorkoutPersistenceNotice } from '@/components/train/WorkoutPersistenceNotice';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { backToTraining } from '@/services/training/backNavigation';
import { useTranslation } from 'react-i18next';

import { ExercisePage } from '@/components/train/ExercisePage';
import { IntensityPickerProvider } from '@/components/train/IntensityCell';
import { RestTimer } from '@/components/train/RestTimer';
import { SELECTABLE_SET_TYPES, setTypeLabel } from '@/components/train/setTypeLabel';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { changeExerciseRest } from '@/services/training/restPrescription';
import { useExerciseName } from '@/hooks/useExerciseName';
import { useWorkoutRecordHistory } from '@/hooks/useWorkoutRecordHistory';
import { endWorkoutActivity, useWorkoutActivity } from '@/hooks/useWorkoutActivity';
import { clearWorkoutRestAlerts } from '@/hooks/useRestAlert';
import { sessionProgress, toWorkoutSession, type SessionSetsByExercise } from '@/services/training/sessionMapper';
import { useHealthExport } from '@/hooks/useHealthExport';
import { WorkoutHealthExport } from '@/components/train/WorkoutHealthExport';
import { nextExerciseAfterCompletion, replacementWorkoutSets, updateWorkoutSet } from '@/services/training/workoutExecution';
import { SetType, type Exercise, type PlannedSession, type SetExtension, type WorkoutSession } from '@/models';
import {
  type MockSetRow,
} from '@/mocks/session';
import { mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { WorkoutExerciseStrip } from '@/components/train/WorkoutExerciseStrip';
import { WorkoutClock } from '@/components/train/WorkoutClock';
import { timestampMillis } from '@/services/training/workoutRuntime';
import { uiPerformance } from '@/services/performance/uiPerformance';
import { ExerciseDetailSheet } from '@/components/train/ExerciseDetailSheet';
import { WorkoutFinishSheet } from '@/components/train/WorkoutFinishSheet';
import { ActionMenuSheet } from '@/components/train/ActionMenuSheet';
import { appendPreviewExercises } from '@/services/training/previewEditing';
import { TrainingGoal } from '@/services/training/volumePlan';
import { hasWorkoutPlanChanges, prescriptionFromWorkout, workoutReview } from '@/services/training/workoutReview';
import { changesForSessionEdit } from '@/services/training/mesocycleEditing';
import {
  addedSetTargetRIR,
  exercisesForPlannedSession,
  initialSetsForPlannedSession,
  plannedMicrocycleDocumentId,
  plannedSessionDocumentId,
} from '@/services/training/plannedSessionRuntime';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { PreWorkoutRehab } from '@/components/train/PreWorkoutRehab';
import { sessionsForMicrocycle } from '@/services/training/mesocycleEditing';
import { useTrainingNotes } from '@/hooks/useTrainingNotes';
import { WorkoutNotesSheet } from '@/components/train/WorkoutNotesSheet';
import { visibleWorkoutNotes, type WorkoutNoteScope } from '@/services/training/trainingNotes';
import { cleanImportedExerciseNotes } from '@/services/training/exerciseEditing';
import { supportsExtensions } from '@/services/training/advancedSets';
import { targetRIR } from '@/services/training/rirAutoregulation';
import {
  IDLE_REST_TIMER,
  adjustRest,
  cancelRest,
  flattenSessionSets,
  restDurationFor,
  restartRest,
  setRestDuration,
  shouldRestartRest,
  startRest,
} from '@/services/training/restTimer';
import type { IntensityScale } from '@/services/training/intensityScale';

export default function EntrenamientoScreen() {
  const { catalogue, exercisesById: exerciseById, ready: catalogueReady, notRecommendedExerciseIds = new Set<string>(), setExerciseNotRecommended = async () => {} } = useExerciseCatalogue();
  const { t } = useTranslation();
  const exerciseName = useExerciseName();
  const { colors, sectionAccent, semantic, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const accent = sectionAccent.train;
  const pagerRef = useRef<ScrollView>(null);
  const pagerGesture = useMemo(() => Gesture.Native(), []);
  const router = useRouter();
  const params = useLocalSearchParams<{
    mesocycleId?: string;
    goal?: string;
    microcycleIndex?: string;
    plannedSessionIndex?: string;
  }>();

  // Escala de intensidad: vendrá de los ajustes del perfil del usuario (§8.7).
  const [scale] = useState<IntensityScale>('RIR');
  const [plannedSession, setPlannedSession] = useState<PlannedSession | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [setsByExercise, setSetsByExercise] = useState<SessionSetsByExercise>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [typePickerFor, setTypePickerFor] = useState<{ exerciseId: string; setId: string } | null>(
    null,
  );
  const [restTimer, setRestTimer] = useState(IDLE_REST_TIMER);
  const [picker, setPicker] = useState<string | 'ADD' | null>(null);
  const [detail, setDetail] = useState<{ id: string; mode: 'info' | 'note'; scope?: WorkoutNoteScope } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sessionNote, setSessionNote] = useState('');
  const persistentNotes = useTrainingNotes();
  const noteSnapshots = useRef({ mesocycleNote: '', exerciseNotes: {} as Record<string, string> });
  const [swappedFrom, setSwappedFrom] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [completedAt, setCompletedAt] = useState<number | undefined>();
  const [performedAt, setPerformedAt] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [finishError, setFinishError] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [discardError, setDiscardError] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState(false);
  const [routineId, setRoutineId] = useState<string | undefined>();
  const [restOverrides, setRestOverrides] = useState<Record<string, number>>({});

  // Espeja el estado para poder leerlo dentro de callbacks ESTABLES sin meterlo
  // en sus dependencias (lo que rompería la memoización de ExercisePage).
  // Declarado aquí arriba a propósito: lo usan tanto la persistencia como los
  // callbacks de edición de más abajo.
  const setsRef = useRef(setsByExercise);
  setsRef.current = setsByExercise;

  // --- Persistencia -------------------------------------------------------
  const { uid } = useAuth();
  const { history, ready: historyReady } = useWorkoutRecordHistory(uid);
  const health = useHealthExport();
  const mesocycleId = typeof params.mesocycleId === 'string' ? params.mesocycleId : '';
  const goal = typeof params.goal === 'string' ? params.goal : '';
  const loadedIdentity = useRef('');
  const microcycleIndex = Number(params.microcycleIndex);
  const plannedSessionIndex = Number(params.plannedSessionIndex);
  const routeIdentity = `${uid}:${mesocycleId}:${goal}:${microcycleIndex}:${plannedSessionIndex}`;
  const activeRoute = useRef(routeIdentity); activeRoute.current = routeIdentity;
  const validRoute =
    mesocycleId !== '' && goal !== '' && Number.isInteger(microcycleIndex) && microcycleIndex >= 0 &&
    Number.isInteger(plannedSessionIndex) && plannedSessionIndex >= 0;
  const exerciseOrder = useMemo(() => exercises.map((exercise) => exercise.id), [exercises]);

  useEffect(() => {
    const identity = routeIdentity;
    if (!catalogueReady || loadedIdentity.current === identity) return;
    if (!validRoute) {
      setLoadError(true);
      return;
    }
    let cancelled = false;
    setLoadError(false);
    mesocycleRepository.get(mesocycleId).then((mesocycle) => {
      if (cancelled) return;
      const prescribed = mesocycle?.plannedSessions === undefined
        ? []
        : sessionsForMicrocycle(mesocycle, goal, microcycleIndex);
      // The goal is stored on the routine, not the mesocycle. For strength the
      // planned session already carries its first prescription; route callers
      // pass only sessions generated from the active routine, so resolve below.
      const session = prescribed.find((candidate) => candidate.index === plannedSessionIndex);
      if (session === undefined) {
        setLoadError(true);
        return;
      }
      const resolved = exercisesForPlannedSession(session, exerciseById).map((exercise) =>
        exercise.notes ? { ...exercise, notes: cleanImportedExerciseNotes(exercise.notes) } : exercise);
      if (resolved.length === 0) {
        setLoadError(true);
        return;
      }
      setPlannedSession(session);
      setRestOverrides(mesocycle?.exerciseRestOverrides ?? {});
      setRoutineId(mesocycle?.routineId);
      loadedIdentity.current = identity;
      setPerformedAt(Date.now()); setCompletedAt(undefined); setFinished(false); setFinishing(false);
      setRestTimer(IDLE_REST_TIMER); setNotes({}); setSwappedFrom({}); setPageIndex(0);
      setSessionNote(''); noteSnapshots.current = { mesocycleNote: '', exerciseNotes: {} };
      setExercises(resolved);
      setSessionName(session.name || session.focus);
      const initial = initialSetsForPlannedSession(session);
      setsRef.current = initial;
      setSetsByExercise(initial);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [exerciseById, catalogueReady, uid, goal, mesocycleId, microcycleIndex, plannedSessionIndex, validRoute, routeIdentity]);

  /**
   * Contexto de la sesión. Es `null` sin usuario, lo que deja la persistencia
   * inactiva en lugar de intentar escribir sin `uid` (las reglas lo rechazarían).
   *
   * `performedAt` se fija UNA vez al montar: si se recalculara en cada render,
   * cada guardado cambiaría la fecha del entrenamiento.
   */
  const liveNotes = useMemo(() => ({ mesocycleNote: persistentNotes.get('MESOCYCLE', mesocycleId),
    exerciseNotes: Object.fromEntries(exercises.map((exercise) => [exercise.id, persistentNotes.get('EXERCISE', exercise.id)])) }), [persistentNotes, mesocycleId, exercises]);
  if (!finished && completedAt === undefined && persistentNotes.ready && !persistentNotes.error) noteSnapshots.current = liveNotes;
  const sessionContext = useMemo(
    () =>
      uid === null || plannedSession === null || loadedIdentity.current !== routeIdentity
        ? null
        : {
            sessionId: plannedSessionDocumentId(mesocycleId, microcycleIndex, plannedSessionIndex),
            userId: uid,
            mesocycleId,
            microcycleId: plannedMicrocycleDocumentId(mesocycleId, microcycleIndex),
            microcycleIndex,
            plannedSessionIndex,
            performedAt,
            sessionName,
            trainingGoal: goal,
            activeExerciseId: exercises[pageIndex]?.id,
            restTimer,
            exerciseSnapshots: Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
            exerciseNotes: notes,
            sessionNote,
            mesocycleNote: noteSnapshots.current.mesocycleNote,
            persistentExerciseNotes: noteSnapshots.current.exerciseNotes,
            swappedFrom,
            persistDraft: true,
          },
    [uid, mesocycleId, microcycleIndex, plannedSession, plannedSessionIndex, exercises, notes, sessionNote, liveNotes, swappedFrom, goal, performedAt, sessionName, pageIndex, restTimer, routeIdentity],
  );

  const restoreSets = useCallback((restored: SessionSetsByExercise, saved: WorkoutSession) => {
    setsRef.current = restored;
    setSetsByExercise(restored);
    const restoredExercises = [...saved.exercises].sort((a, b) => a.order - b.order)
      .map((entry) => entry.exerciseSnapshot ?? exerciseById.get(entry.exerciseId)).filter((ex): ex is Exercise => !!ex);
    setExercises(restoredExercises);
    const index = Math.max(0, restoredExercises.findIndex((entry) => entry.id === saved.activeExerciseId));
    setPageIndex(index);
    requestAnimationFrame(() => pagerRef.current?.scrollTo({ x: index * width, animated: false }));
    setNotes(Object.fromEntries(saved.exercises.filter((entry) => entry.notes !== undefined).map((entry) => [entry.exerciseId, cleanImportedExerciseNotes(entry.notes)])));
    setSessionNote(saved.sessionNote ?? '');
    noteSnapshots.current = { mesocycleNote: saved.mesocycleNote ?? '', exerciseNotes: Object.fromEntries(saved.exercises.map((entry) => [entry.exerciseId, entry.exerciseNote ?? ''])) };
    setSwappedFrom(Object.fromEntries(saved.exercises.filter((entry) => entry.swappedFromExerciseId).map((entry) => [entry.exerciseId, entry.swappedFromExerciseId!])));
    setPerformedAt(timestampMillis(saved.performedAt));
    if (saved.restTimer) setRestTimer(saved.restTimer);
    if (saved.completedAt !== undefined) { setCompletedAt(timestampMillis(saved.completedAt)); setFinished(true); setFinishing(true); }
  }, [exerciseById, width]);

  const { status: saveStatus, hasRestored, flush, discard, restoreError, retryRestore } = useSessionPersistence({
    context: sessionContext,
    exerciseOrder,
    setsByExercise,
    onRestore: restoreSets,
  });
  useEffect(() => {
    if (hasRestored) { setRestoreNotice(false); return; }
    const timer = setTimeout(() => setRestoreNotice(true), 650);
    return () => clearTimeout(timer);
  }, [hasRestored, routeIdentity]);

  const { totalSets, completedSets } = useMemo(() => {
    const progress = sessionProgress(setsByExercise);
    return { totalSets: progress.total, completedSets: progress.completed };
  }, [setsByExercise]);
  const activityUnavailable = useWorkoutActivity(hasRestored ? sessionContext : null, exercises, setsByExercise, finished || completedAt !== undefined);

  const goToExercise = useCallback(
    (index: number) => {
      setPageIndex(index);
      pagerRef.current?.scrollTo({ x: index * width, animated: true });
    },
    [width],
  );

  const onPagerScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setPageIndex((current) => (next !== current ? next : current));
    },
    [width],
  );

  // Callbacks ESTABLES: necesarios para que la memoización de ExercisePage sirva.
  const updateSet = useCallback(
    (exerciseId: string, setId: string, patch: Partial<MockSetRow>) => {
      const previous = setsRef.current;
      const next = {
        ...previous,
        [exerciseId]: (previous[exerciseId] ?? []).map((s) =>
          s.id === setId ? updateWorkoutSet(s, patch) : s,
        ),
      };
      setsRef.current = next;
      setSetsByExercise(next);

      // REGLA DEL TEMPORIZADOR: solo reinicia si esta serie está en la FRONTERA
      // del progreso, es decir si ninguna serie posterior está ya completada.
      // Así, recompletar una serie anterior tras corregir un dato no destruye el
      // descanso en curso, y desmarcar nunca lo toca.
      if (patch.isCompleted === true) {
        if (!previous[exerciseId]?.find((set) => set.id === setId)?.isCompleted) {
          const following = nextExerciseAfterCompletion(exercises.map((exercise) => exercise.id), next, exerciseId);
          if (following !== null) goToExercise(following);
        }
        const order = flattenSessionSets(
          exercises.map((e) => e.id),
          next,
        );
        if (shouldRestartRest(order, setId)) {
          const exercise = exercises.find((e) => e.id === exerciseId);
          const duration = restOverrides[exerciseId] ?? plannedSession?.exercises.find((entry) => entry.exerciseId === exerciseId)?.restSeconds ?? (exercise ? restDurationFor(exercise.profile) : 180);
          setRestTimer(startRest(setId, duration, Date.now()));
        }
      }
    },
    [exercises, plannedSession, restOverrides, goToExercise],
  );

  const addSet = useCallback((exerciseId: string) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const rir = plannedSession === null ? (exercise ? targetRIR(exercise.profile) : 2) : addedSetTargetRIR(plannedSession, exerciseId);
    const previous = setsRef.current;
    const current = previous[exerciseId] ?? [];
    // Referencia: la última serie NO autorrellenada, para no heredar el peso
    // reducido por fatiga como si fuera el objetivo.
    const reference =
      [...current].reverse().find((s) => !s.isAutoFilled) ?? current[current.length - 1];
    const next = {
      ...previous,
      [exerciseId]: [
        ...current,
        {
          id: `${exerciseId}-${Date.now()}`,
          setType: SetType.NORMAL,
          targetWeight: reference?.targetWeight ?? 20,
          targetReps: reference?.targetReps ?? 8,
          targetRIR: rir,
          ...(reference?.recording ? { recording: reference.recording } : {}),
          ...(reference?.targetDurationSeconds === undefined ? {} : { targetDurationSeconds: reference.targetDurationSeconds }),
          ...(reference?.targetLoadLevel === undefined ? {} : { targetLoadLevel: reference.targetLoadLevel }),
          isAutoFilled: false,
          isCompleted: false,
          previous: reference?.previous,
        },
      ],
    };
    // El ref debe seguir espejando el estado: la regla del temporizador lo lee.
    setsRef.current = next;
    setSetsByExercise(next);
  }, [exercises, plannedSession]);

  const openTypePicker = useCallback((exerciseId: string, setId: string) => {
    setTypePickerFor({ exerciseId, setId });
  }, []);

  /**
   * Elegir DS, RP o Myo-Rep crea de inmediato un tramo vacío para que sus
   * parámetros (REPS/KG cuando corresponda) aparezcan debajo de la fila.
   */
  const selectSetType = useCallback(
    (type: SetType) => {
      if (typePickerFor === null) return;
      const current = (setsRef.current[typePickerFor.exerciseId] ?? []).find(
        (set) => set.id === typePickerFor.setId,
      );
      const extensions: SetExtension[] | undefined = supportsExtensions(type)
        ? (current?.extensions?.length ? current.extensions : [{}])
        : undefined;
      updateSet(typePickerFor.exerciseId, typePickerFor.setId, { setType: type, extensions });
      setTypePickerFor(null);
    },
    [typePickerFor, updateSet],
  );

  const summary = useMemo(() => workoutReview(exercises, setsByExercise, history, sessionContext?.sessionId ?? ''), [exercises, setsByExercise, history, sessionContext]);
  const completedSession = useMemo(() => completedAt !== undefined && sessionContext
    ? toWorkoutSession({ ...sessionContext, completedAt }, exerciseOrder, setsByExercise) : null,
  [completedAt, sessionContext, exerciseOrder, setsByExercise]);
  const changed = plannedSession ? hasWorkoutPlanChanges(plannedSession, exercises, setsByExercise) : false;
  const openFinish = () => {
    setFinishing(true); setFinishError(false);
  };
  const finishWorkout = async (savePlan: boolean) => {
    if (!sessionContext || !plannedSession || busy || !summary.completed) return;
    setBusy(true); setFinishError(false);
    try {
      if (savePlan) {
        const current = await mesocycleRepository.get(mesocycleId);
        if (!current || current.userId !== uid) throw new Error('Missing plan');
        const prescription = prescriptionFromWorkout(plannedSession, exercises, setsByExercise);
        await mesocycleRepository.update(mesocycleId, { ...changesForSessionEdit(current, goal, microcycleIndex, prescription, 'remaining-mesocycle', true), updatedAt: Date.now() });
      }
      const ended = Date.now();
      if (!await flush(ended)) throw new Error('Save failed');
      setCompletedAt(ended); setRestTimer(cancelRest()); setFinished(true);
      // Health failures never roll back or block the athlete's primary save.
      void health.service.export(toWorkoutSession({ ...sessionContext, completedAt: ended }, exerciseOrder, setsRef.current));
    } catch { setFinishError(true); } finally { setBusy(false); }
  };
  const chooseExercises = (chosen: Exercise[]) => {
    if (!plannedSession || !chosen.length) return;
    const map = new Map(exerciseById); chosen.forEach((ex) => map.set(ex.id, ex));
    const template = appendPreviewExercises([{ ...plannedSession, exercises: [] }], chosen.map((ex) => ({ sessionIndex: plannedSession.index, exerciseId: ex.id })), map, goal as TrainingGoal)[0];
    template.exercises.forEach((entry) => { entry.exerciseSnapshot = map.get(entry.exerciseId); });
    const added = initialSetsForPlannedSession(template);
    Object.entries(added).forEach(([id, rows]) => rows.forEach((row, index) => { row.id = `${id}:${Date.now()}:${index}`; }));
    const next = { ...setsRef.current };
    if (picker && picker !== 'ADD') {
      added[chosen[0].id] = replacementWorkoutSets(next[picker] ?? [], added[chosen[0].id] ?? [], `${chosen[0].id}:${Date.now()}`);
      // Preserve completed work on the original exercise; replacement starts as its own entry.
      const completed = (next[picker] ?? []).filter((row) => row.isCompleted);
      if (completed.length) next[picker] = completed; else delete next[picker];
      setSwappedFrom((old) => ({ ...old, [chosen[0].id]: old[picker] ?? picker }));
      const updated = exercises.flatMap((ex) => ex.id !== picker ? [ex] : completed.length ? [ex, chosen[0]] : [chosen[0]]);
      setExercises(updated);
      const index = updated.findIndex((ex) => ex.id === chosen[0].id); setPageIndex(index);
      requestAnimationFrame(() => pagerRef.current?.scrollTo({ x: index * width, animated: true }));
    } else setExercises((old) => [...old, ...chosen.filter((ex) => !old.some((item) => item.id === ex.id))]);
    Object.assign(next, added); setsRef.current = next; setSetsByExercise(next); setPicker(null);
  };
  // Auto-advancing the exercise rail must not change which exercise owns a running rest.
  const restExercise = exercises.find((exercise) => (setsByExercise[exercise.id] ?? []).some((set) => set.id === restTimer.anchorSetId)) ?? exercises[pageIndex];
  const prescribedRest = restExercise ? restOverrides[restExercise.id]
    ?? plannedSession?.exercises.find((entry) => entry.exerciseId === restExercise.id)?.restSeconds
    ?? restDurationFor(restExercise.profile) : 150;
  const saveRestPrescription = async (seconds: number) => {
    if (!uid || !restExercise || finished) throw Error('unavailableRestPrescription');
    const identity = routeIdentity, exerciseId = restExercise.id;
    const fresh = await mesocycleRepository.get(mesocycleId);
    if (!fresh || activeRoute.current !== identity) throw Error('staleRestPrescription');
    const patch = changeExerciseRest(fresh, uid, exerciseId, seconds);
    let rejected = false;
    await mesocycleRepository.updateLocally(mesocycleId, { ...patch, updatedAt: Date.now() }, () => { rejected = true; });
    if (rejected || activeRoute.current !== identity) throw Error('restPrescriptionFailed');
    setRestOverrides(patch.exerciseRestOverrides);
    setPlannedSession((session) => session ? { ...session, exercises: session.exercises.map((entry) =>
      entry.exerciseId === exerciseId ? { ...entry, restSeconds: seconds } : entry) } : session);
    setRestTimer((state) => setRestDuration(state, seconds));
  };

  if (loadError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <Text style={[styles.sessionName, { color: colors.textPrimary }]}>{t('train.sessionUnavailable')}</Text>
        <Pressable onPress={() => backToTraining(router)} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.accentText }}>{t('generate.back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (plannedSession === null) {
    return <View style={[styles.screen, { backgroundColor: colors.bg }]} />;
  }
  if (!hasRestored) return <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 32, paddingHorizontal: spacing.lg }]}>
    {(restoreError || restoreNotice) && <Text style={[typography.title, { color: colors.textPrimary }]}>{t(restoreError ? 'workout.restoreError' : 'workout.restoring')}</Text>}
    {restoreError && <Pressable onPress={retryRestore} style={{ paddingVertical: 20 }}><Text style={{ color: colors.accentText }}>{t('home.retry')}</Text></Pressable>}
    {(restoreError || restoreNotice) && <Pressable onPress={() => backToTraining(router)} style={{ paddingVertical: 16 }}><Text style={{ color: colors.textSecondary }}>{t('generate.back')}</Text></Pressable>}
  </View>;

  return (
    <IntensityPickerProvider>
      {sessionContext && hasRestored && <PreWorkoutRehab key={sessionContext.sessionId} workoutKey={sessionContext.sessionId} routineId={routineId} sessionIndex={plannedSessionIndex}
        hasStarted={Object.values(setsByExercise).some((rows) => rows.some((row) => row.isCompleted))} />}
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Cabecera: nombre de la sesión + estado de guardado + cronómetro */}
      <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => { void flush().then((saved) => { if (saved) backToTraining(router); }); }} accessibilityRole="button" accessibilityLabel={t('workout.pause')} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.accentText, fontSize: 24 }}>‹</Text>
            </Pressable>
            <Text numberOfLines={1} style={[typography.emphasis, { color: colors.textPrimary, flex: 1 }]}>{sessionName}</Text>
          </View>
          <WorkoutClock startedAt={performedAt} completedAt={completedAt} />
          <View style={{ height: 18 }}>
          <WorkoutPersistenceNotice status={saveStatus} activityUnavailable={activityUnavailable} />
          </View>
        </View>
        <RestTimer
          state={restTimer}
          onAdjust={(delta) => setRestTimer((s) => adjustRest(s, delta))}
          onRestart={() => setRestTimer((s) => restartRest(s, Date.now()))}
          onSetDuration={(seconds) => setRestTimer((s) => setRestDuration(s, seconds))}
          onCancel={() => setRestTimer(cancelRest())}
          prescribedSeconds={prescribedRest} exerciseName={restExercise ? exerciseName(restExercise) : ''}
          onSetPrescription={finished ? undefined : saveRestPrescription}
        />
      </View>

      <WorkoutExerciseStrip exercises={exercises} activeId={exercises[pageIndex]?.id} onSelect={goToExercise} onAdd={() => { uiPerformance.begin('picker.ready'); setPicker('ADD'); }}
        onReorder={(next) => { const active = exercises[pageIndex]?.id; setExercises(next);
          const index = Math.max(0, next.findIndex((ex) => ex.id === active)); setPageIndex(index);
          requestAnimationFrame(() => pagerRef.current?.scrollTo({ x: index * width, animated: false })); }} />

      {/* Series de todo el entrenamiento */}
      <View style={[styles.summary, { paddingHorizontal: spacing.lg }]}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          {t('train.sets')}
        </Text>
        <Text style={styles.summaryValue}>
          <Text style={{ color: colors.accentText }}>{completedSets}</Text>
          <Text style={{ color: colors.textMuted }}>/{totalSets}</Text>
        </Text>
      </View>

      {/* Paginado por ejercicio */}
      <WorkoutPagerGestureContext.Provider value={pagerGesture}><GestureDetector gesture={pagerGesture}><ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        style={styles.pager}>
        {exercises.map((exercise, exerciseIndex) => (
          <ExercisePage
            key={exercise.id}
            active={exerciseIndex === pageIndex}
            exercise={exercise}
            scopedNotes={visibleWorkoutNotes(sessionNote, noteSnapshots.current.exerciseNotes[exercise.id] ?? '', noteSnapshots.current.mesocycleNote, notes[exercise.id] ?? '')}
            onPressNote={(scope) => setDetail({ id: exercise.id, mode: 'note', scope })}
            sets={setsByExercise[exercise.id] ?? []}
            recordSetIds={historyReady ? summary.recordSetIds : []}
            scale={scale}
            width={width}
            bottomInset={insets.bottom}
            onUpdateSet={updateSet}
            onAddSet={addSet}
            onPressSetType={openTypePicker}
            onAction={(id, action) => { if (action === 'swap') { uiPerformance.begin('picker.ready'); setPicker(id); } else setDetail({ id, mode: action }); }}
            onRemoveSet={(exerciseId, setId) => {
              const next = { ...setsRef.current, [exerciseId]: (setsRef.current[exerciseId] ?? []).filter((row) => row.id !== setId) };
              setsRef.current = next; setSetsByExercise(next);
            }}
          />
        ))}
      </ScrollView></GestureDetector></WorkoutPagerGestureContext.Provider>

      <View style={[styles.finishBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.bg }]}>
        {discardError && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('workout.discardError')}</Text>}
        <Pressable
          disabled={!hasRestored}
          onPress={openFinish}
          accessibilityRole="button"
          style={[styles.finishButton, { backgroundColor: accent, borderRadius: radius.md }]}>
          <Text style={styles.finishText}>{t('train.finishWorkout')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !hasRestored} onPress={() => setDiscardConfirm(true)}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Text style={{ color: semantic.danger, fontWeight: '700' }}>{t('workout.discard')}</Text>
        </Pressable>
      </View>

      <ExerciseSwapSheet open={picker !== null} mode={picker === 'ADD' ? 'add' : 'swap'} current={exercises.find((ex) => ex.id === picker) ?? null}
        candidates={catalogue.filter((ex) => !ex.archivedAt && !exercises.some((item) => item.id === ex.id))}
        onSelect={(exercise) => chooseExercises([exercise])} onSelectMany={chooseExercises} onClose={() => setPicker(null)} />
      <ExerciseDetailSheet exercise={detail?.mode === 'info' ? exercises.find((ex) => ex.id === detail.id) ?? null : null} mode="info" note=""
        notRecommended={detail?.mode === 'info' ? notRecommendedExerciseIds.has(detail.id) : false}
        onToggleRecommendation={(exercise, value) => { void setExerciseNotRecommended(exercise.id, value).catch(() => Alert.alert(t('exercisePreference.saveFailed'))); }}
        onNote={() => {}} onClose={() => setDetail(null)} />
      {detail?.mode === 'note' && <WorkoutNotesSheet open exerciseName={exercises.find((ex) => ex.id === detail.id)?.name ?? ''} initialScope={detail.scope}
        executionNote={notes[detail.id] ?? ''}
        values={{ SESSION: sessionNote, EXERCISE: persistentNotes.get('EXERCISE', detail.id), MESOCYCLE: persistentNotes.get('MESOCYCLE', mesocycleId) }}
        unavailable={!persistentNotes.ready || persistentNotes.error || finished}
        onSave={async (scope, text, executionNote) => {
          if (scope === 'SESSION') {
            const next = executionNote === undefined ? notes : { ...notes, [detail.id]: executionNote };
            if (!await flush(undefined, { sessionNote: text, exerciseNotes: next })) throw Error('saveFailed');
            setSessionNote(text); setNotes(next);
          }
          else await persistentNotes.save(scope, scope === 'EXERCISE' ? detail.id : mesocycleId, text);
        }} onClose={() => setDetail(null)} />}
      <WorkoutFinishSheet open={finishing} saved={finished} busy={busy} error={finishError} summary={summary} exercises={exercises} changed={changed} historyReady={historyReady} startedAt={performedAt} completedAt={completedAt}
        healthContent={completedSession ? <WorkoutHealthExport session={completedSession} /> : undefined}
        onFinish={(savePlan) => { void finishWorkout(savePlan); }} onClose={() => { if (finished) backToTraining(router); else setFinishing(false); }} />
      <ActionMenuSheet title={discardConfirm ? t('workout.discard') : null} subtitle={t('workout.discardHint')} onClose={() => setDiscardConfirm(false)}
        actions={[{ label: t('workout.discardConfirm'), tone: 'danger', onPress: async () => {
          if (busy || !sessionContext) return;
          setBusy(true); setDiscardError(false);
          if (!await discard()) { setDiscardError(true); setBusy(false); return; }
          setRestTimer(cancelRest()); setFinished(true);
          await Promise.allSettled([clearWorkoutRestAlerts(), endWorkoutActivity(sessionContext.userId, sessionContext.sessionId)]);
          backToTraining(router);
        } }, { label: t('generate.cancel'), onPress: () => {} }]} />

      {/* Selector de tipo de serie */}
      <Modal
        visible={typePickerFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTypePickerFor(null)}>
          <View
            style={[styles.sheet, { backgroundColor: colors.bgElevated, borderRadius: radius.xl }]}>
            {SELECTABLE_SET_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => selectSetType(type)}
                accessibilityRole="button"
                style={styles.sheetRow}>
                <View style={[styles.sheetBadge, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.sheetBadgeText, { color: colors.textSecondary }]}>
                    {type === SetType.NORMAL ? '1' : setTypeLabel(type)}
                  </Text>
                </View>
                <Text style={[styles.sheetLabel, { color: colors.textPrimary }]}>
                  {t(`setType.${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      </View>
    </IntensityPickerProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  sessionName: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  thumbWrapper: { width: 84 },
  thumb: {
    width: 84,
    height: 72,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  thumbText: { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  thumbUnderline: { height: 3, borderRadius: 2, marginTop: 5 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pager: { flex: 1 },
  finishBar: { paddingHorizontal: 20, paddingTop: 8 },
  finishButton: { alignItems: 'center', paddingVertical: 13 },
  finishText: { color: '#16191C', fontSize: 13, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: { padding: 18, gap: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sheetBadge: {
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBadgeText: { fontSize: 11, fontWeight: '700' },
  sheetLabel: { fontSize: 14 },
});
