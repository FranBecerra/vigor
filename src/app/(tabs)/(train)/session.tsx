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
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import type { SessionSetsByExercise } from '@/services/training/sessionMapper';
import { SetType, type Exercise, type PlannedSession, type SetExtension, type WorkoutSession } from '@/models';
import {
  type MockSetRow,
} from '@/mocks/session';
import { mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { ExerciseOrderSheet } from '@/components/train/ExerciseOrderSheet';
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
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { PreWorkoutRehab } from '@/components/train/PreWorkoutRehab';
import { sessionsForMicrocycle } from '@/services/training/mesocycleEditing';
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

/** Altura fija del carrusel: sin esto el ScrollView horizontal se expandía. */
const THUMB_STRIP_HEIGHT = 84;

export default function EntrenamientoScreen() {
  const { catalogue, exercisesById: exerciseById, ready: catalogueReady } = useExerciseCatalogue();
  const { t } = useTranslation();
  const { colors, sectionAccent, semantic, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const accent = sectionAccent.train;
  const pagerRef = useRef<ScrollView>(null);
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
  const [ordering, setOrdering] = useState(false);
  const [detail, setDetail] = useState<{ id: string; mode: 'info' | 'note' } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [swappedFrom, setSwappedFrom] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finishError, setFinishError] = useState(false);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [removeSet, setRemoveSet] = useState<{ exerciseId: string; setId: string } | null>(null);
  const [routineId, setRoutineId] = useState<string | undefined>();

  // Espeja el estado para poder leerlo dentro de callbacks ESTABLES sin meterlo
  // en sus dependencias (lo que rompería la memoización de ExercisePage).
  // Declarado aquí arriba a propósito: lo usan tanto la persistencia como los
  // callbacks de edición de más abajo.
  const setsRef = useRef(setsByExercise);
  setsRef.current = setsByExercise;

  // --- Persistencia -------------------------------------------------------
  const { uid } = useAuth();
  const mesocycleId = typeof params.mesocycleId === 'string' ? params.mesocycleId : '';
  const goal = typeof params.goal === 'string' ? params.goal : '';
  const loadedIdentity = useRef('');
  const microcycleIndex = Number(params.microcycleIndex);
  const plannedSessionIndex = Number(params.plannedSessionIndex);
  const validRoute =
    mesocycleId !== '' && goal !== '' && Number.isInteger(microcycleIndex) && microcycleIndex >= 0 &&
    Number.isInteger(plannedSessionIndex) && plannedSessionIndex >= 0;
  const exerciseOrder = useMemo(() => exercises.map((exercise) => exercise.id), [exercises]);

  useEffect(() => {
    const identity = `${uid}:${mesocycleId}:${goal}:${microcycleIndex}:${plannedSessionIndex}`;
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
      const resolved = exercisesForPlannedSession(session, exerciseById);
      if (resolved.length === 0) {
        setLoadError(true);
        return;
      }
      setPlannedSession(session);
      setRoutineId(mesocycle?.routineId);
      loadedIdentity.current = identity;
      setExercises(resolved);
      setSessionName(session.name || session.focus);
      const initial = initialSetsForPlannedSession(session);
      setsRef.current = initial;
      setSetsByExercise(initial);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [exerciseById, catalogueReady, uid, goal, mesocycleId, microcycleIndex, plannedSessionIndex, validRoute]);

  /**
   * Contexto de la sesión. Es `null` sin usuario, lo que deja la persistencia
   * inactiva en lugar de intentar escribir sin `uid` (las reglas lo rechazarían).
   *
   * `performedAt` se fija UNA vez al montar: si se recalculara en cada render,
   * cada guardado cambiaría la fecha del entrenamiento.
   */
  const performedAtRef = useRef(Date.now());
  const sessionContext = useMemo(
    () =>
      uid === null || plannedSession === null
        ? null
        : {
            sessionId: plannedSessionDocumentId(mesocycleId, microcycleIndex, plannedSessionIndex),
            userId: uid,
            mesocycleId,
            microcycleId: plannedMicrocycleDocumentId(mesocycleId, microcycleIndex),
            microcycleIndex,
            plannedSessionIndex,
            performedAt: performedAtRef.current,
            exerciseSnapshots: Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
            exerciseNotes: notes,
            swappedFrom,
            persistDraft: Object.values(notes).some(Boolean) || hasWorkoutPlanChanges(plannedSession, exercises, setsByExercise),
          },
    [uid, mesocycleId, microcycleIndex, plannedSession, plannedSessionIndex, validRoute, exercises, notes, swappedFrom, setsByExercise],
  );

  const restoreSets = useCallback((restored: SessionSetsByExercise, saved: WorkoutSession) => {
    setsRef.current = restored;
    setSetsByExercise(restored);
    setExercises([...saved.exercises].sort((a, b) => a.order - b.order)
      .map((entry) => entry.exerciseSnapshot ?? exerciseById.get(entry.exerciseId)).filter((ex): ex is Exercise => !!ex));
    setNotes(Object.fromEntries(saved.exercises.map((entry) => [entry.exerciseId, entry.notes ?? ''])));
    setSwappedFrom(Object.fromEntries(saved.exercises.filter((entry) => entry.swappedFromExerciseId).map((entry) => [entry.exerciseId, entry.swappedFromExerciseId!])));
    performedAtRef.current = typeof saved.performedAt === 'number' ? saved.performedAt : saved.performedAt.seconds * 1000;
  }, [exerciseById]);

  const { status: saveStatus, hasRestored, flush } = useSessionPersistence({
    context: sessionContext,
    exerciseOrder,
    setsByExercise,
    onRestore: restoreSets,
  });

  const { totalSets, completedSets } = useMemo(() => {
    const all = Object.values(setsByExercise).flat();
    return { totalSets: all.length, completedSets: all.filter((s) => s.isCompleted).length };
  }, [setsByExercise]);

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
          s.id === setId ? { ...s, ...patch } : s,
        ),
      };
      setsRef.current = next;
      setSetsByExercise(next);

      // REGLA DEL TEMPORIZADOR: solo reinicia si esta serie está en la FRONTERA
      // del progreso, es decir si ninguna serie posterior está ya completada.
      // Así, recompletar una serie anterior tras corregir un dato no destruye el
      // descanso en curso, y desmarcar nunca lo toca.
      if (patch.isCompleted === true) {
        const order = flattenSessionSets(
          exercises.map((e) => e.id),
          next,
        );
        if (shouldRestartRest(order, setId)) {
          const exercise = exercises.find((e) => e.id === exerciseId);
          const duration = plannedSession?.exercises.find((entry) => entry.exerciseId === exerciseId)?.restSeconds ?? (exercise ? restDurationFor(exercise.profile) : 180);
          setRestTimer(startRest(setId, duration, Date.now()));
        }
      }
    },
    [exercises, plannedSession],
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
  const changed = plannedSession ? hasWorkoutPlanChanges(plannedSession, exercises, setsByExercise) : false;
  const openFinish = () => {
    setFinishing(true); setFinishError(false); setHistoryReady(false);
    if (uid) workoutSessionRepository.listByUser(uid).then((items) => { setHistory(items); setHistoryReady(true); }).catch(() => setHistoryReady(false));
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
      if (!await flush(Date.now())) throw new Error('Save failed');
      setRestTimer(cancelRest()); setFinished(true);
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
      // Preserve completed work on the original exercise; replacement starts as its own entry.
      const completed = (next[picker] ?? []).filter((row) => row.isCompleted);
      if (completed.length) next[picker] = completed; else delete next[picker];
      setSwappedFrom((old) => ({ ...old, [chosen[0].id]: old[picker] ?? picker }));
      setExercises((old) => old.flatMap((ex) => ex.id !== picker ? [ex] : completed.length ? [ex, chosen[0]] : [chosen[0]]));
    } else setExercises((old) => [...old, ...chosen.filter((ex) => !old.some((item) => item.id === ex.id))]);
    Object.assign(next, added); setsRef.current = next; setSetsByExercise(next); setPicker(null);
  };

  if (loadError) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
        <Text style={[styles.sessionName, { color: colors.textPrimary }]}>{t('train.sessionUnavailable')}</Text>
        <Pressable onPress={() => backToTraining(router)} style={{ marginTop: spacing.md }}>
          <Text style={{ color: accent }}>{t('generate.back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (plannedSession === null) {
    return <View style={[styles.screen, { backgroundColor: colors.bg }]} />;
  }

  return (
    <IntensityPickerProvider>
      {sessionContext && hasRestored && <PreWorkoutRehab key={sessionContext.sessionId} workoutKey={sessionContext.sessionId} routineId={routineId} sessionIndex={plannedSessionIndex} hasStarted={completedSets > 0} />}
      <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Cabecera: nombre de la sesión + estado de guardado + cronómetro */}
      <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[typography.emphasis, { color: colors.textPrimary }]}>{sessionName}</Text>
          <View style={{ height: 18 }}>
          {/* Solo se muestra cuando hay algo que decir: un "guardado" permanente
              sería ruido. El error sí es persistente, porque implica riesgo. */}
          {saveStatus === 'saving' ? (
            <Text style={[styles.saveStatus, { color: colors.textMuted }]}>
              {t('train.saving')}
            </Text>
          ) : saveStatus === 'error' ? (
            <Text style={[styles.saveStatus, { color: semantic.warning }]}>
              {t('train.saveError')}
            </Text>
          ) : saveStatus === 'queued' ? <Text style={[styles.saveStatus, { color: colors.textMuted }]}>{t('custom.pending')}</Text> : null}
          </View>
        </View>
        <RestTimer
          state={restTimer}
          onAdjust={(delta) => setRestTimer((s) => adjustRest(s, delta))}
          onRestart={() => setRestTimer((s) => restartRest(s, Date.now()))}
          onSetDuration={(seconds) => setRestTimer((s) => setRestDuration(s, seconds))}
          onCancel={() => setRestTimer(cancelRest())}
        />
      </View>

      {/* Carrusel de miniaturas (altura fija) */}
      <View style={{ height: THUMB_STRIP_HEIGHT, marginTop: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            alignItems: 'flex-start',
          }}>
          {exercises.map((exercise, index) => {
            const isActive = index === pageIndex;
            return (
              <Pressable
                key={exercise.id}
                onPress={() => goToExercise(index)}
                onLongPress={() => setOrdering(true)}
                accessibilityRole="button"
                accessibilityLabel={exercise.name}
                style={styles.thumbWrapper}>
                <View
                  style={[
                    styles.thumb,
                    {
                      borderRadius: radius.md,
                      backgroundColor: isActive ? 'rgba(155,227,23,0.12)' : colors.bgElevated,
                      borderColor: isActive ? accent : 'transparent',
                    },
                  ]}>
                  <Text
                    numberOfLines={3}
                    style={[
                      styles.thumbText,
                      { color: isActive ? accent : colors.textSecondary },
                    ]}>
                    {exercise.name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.thumbUnderline,
                    { backgroundColor: isActive ? accent : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
          <View style={styles.thumbWrapper}>
            <Pressable
              onPress={() => setPicker('ADD')}
              accessibilityRole="button"
              accessibilityLabel={t('train.addExercise')}
              style={[
                styles.thumb,
                {
                  borderRadius: radius.md,
                  backgroundColor: colors.bgElevated,
                  borderColor: 'transparent',
                },
              ]}>
              <Text style={{ color: colors.textMuted, fontSize: 20 }}>+</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      {/* Series de todo el entrenamiento */}
      <View style={[styles.summary, { paddingHorizontal: spacing.lg }]}>
        <Pressable onPress={() => setOrdering(true)} style={{ marginRight: 'auto', paddingVertical: 8 }}><Text style={{ color: accent }}>{t('workout.order')} ≡</Text></Pressable>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          {t('train.sets')}
        </Text>
        <Text style={styles.summaryValue}>
          <Text style={{ color: accent }}>{completedSets}</Text>
          <Text style={{ color: colors.textMuted }}>/{totalSets}</Text>
        </Text>
      </View>

      {/* Paginado por ejercicio */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        style={styles.pager}>
        {exercises.map((exercise) => (
          <ExercisePage
            key={exercise.id}
            exercise={exercise}
            sets={setsByExercise[exercise.id] ?? []}
            scale={scale}
            width={width}
            bottomInset={insets.bottom}
            onUpdateSet={updateSet}
            onAddSet={addSet}
            onPressSetType={openTypePicker}
            onAction={(id, action) => action === 'swap' ? setPicker(id) : setDetail({ id, mode: action })}
            onRemoveSet={(exerciseId, setId) => setRemoveSet({ exerciseId, setId })}
          />
        ))}
      </ScrollView>

      <View style={[styles.finishBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.bg }]}>
        <Pressable
          disabled={!hasRestored}
          onPress={openFinish}
          accessibilityRole="button"
          style={[styles.finishButton, { backgroundColor: accent, borderRadius: radius.md }]}>
          <Text style={styles.finishText}>{t('train.finishWorkout')}</Text>
        </Pressable>
      </View>

      <ExerciseSwapSheet open={picker !== null} mode={picker === 'ADD' ? 'add' : 'swap'} current={exercises.find((ex) => ex.id === picker) ?? null}
        candidates={catalogue.filter((ex) => !ex.archivedAt && !exercises.some((item) => item.id === ex.id))}
        onSelect={(exercise) => chooseExercises([exercise])} onSelectMany={chooseExercises} onClose={() => setPicker(null)} />
      <ExerciseOrderSheet open={ordering} exercises={exercises} onChange={(next) => { const active = exercises[pageIndex]?.id; setExercises(next);
        const index = next.findIndex((ex) => ex.id === active); setPageIndex(Math.max(0, index)); pagerRef.current?.scrollTo({ x: Math.max(0, index) * width, animated: false }); }} onClose={() => setOrdering(false)} />
      <ExerciseDetailSheet exercise={exercises.find((ex) => ex.id === detail?.id) ?? null} mode={detail?.mode ?? 'info'} note={notes[detail?.id ?? ''] ?? ''}
        onNote={(note) => { if (detail) setNotes((old) => ({ ...old, [detail.id]: note })); }} onClose={() => setDetail(null)} />
      <WorkoutFinishSheet open={finishing} saved={finished} busy={busy} error={finishError} summary={summary} exercises={exercises} changed={changed} historyReady={historyReady}
        onFinish={(savePlan) => { void finishWorkout(savePlan); }} onClose={() => { if (finished) backToTraining(router); else setFinishing(false); }} />
      <ActionMenuSheet title={removeSet ? t('workout.removeSet') : null} onClose={() => setRemoveSet(null)}
        actions={[{ label: t('workout.removeSet'), tone: 'danger', onPress: () => { if (!removeSet) return;
          const next = { ...setsRef.current, [removeSet.exerciseId]: setsRef.current[removeSet.exerciseId].filter((row) => row.id !== removeSet.setId) };
          setsRef.current = next; setSetsByExercise(next); } }]} />

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
  saveStatus: { fontSize: 10, marginTop: 1 },
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
