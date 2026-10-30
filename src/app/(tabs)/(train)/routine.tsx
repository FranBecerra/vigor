/** Saved routine overview and future-plan editor. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { backToTraining } from '@/services/training/backNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useRoutines } from '@/hooks/useRoutines';
import { mesocycleRepository, routineRepository, workoutSessionRepository } from '@/services/repositories';
import { EXERCISE_CATALOGUE, filterCatalogue } from '@/services/training/exerciseCatalogue';
import { changesForSessionEdit, sessionsForMicrocycle, sessionProgressionProposal,
  type SessionEditScope } from '@/services/training/mesocycleEditing';
import { applyPreviewEdits, appendPreviewExercises, previewEditKey, representativeSet, type PreviewAddition, type PreviewEdits, type PreviewExerciseEdit } from '@/services/training/previewEditing';
import { exerciseMinutes } from '@/services/training/trainingCapacity';
import { rankSwapCandidates } from '@/services/training/swapEngine';
import { PlanPreview } from '@/components/train/generate/PlanPreview';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { ActionMenuSheet, type ActionMenuItem } from '@/components/train/ActionMenuSheet';
import { PrescriptionEditor } from '@/components/train/PrescriptionEditor';
import { RIRProgressionPreview } from '@/components/train/RIRProgressionPreview';
import { hasSessionRIRChanges, progressionFingerprint, type ProgressionStep } from '@/services/training/rirReplanning';
import { countWorkingSets } from '@/services/training/sessionSummary';
import { setTypeLabel } from '@/components/train/setTypeLabel';
import { mergePrescriptionEdit } from '@/services/training/prescriptionEntry';
import { orderedRoutineSessions } from '@/services/training/routineRestDays';
import { useExerciseName } from '@/hooks/useExerciseName';
import { MuscleVolumeCard } from '@/components/train/MuscleVolumeCard';
import { MuscleTags } from '@/components/train/MuscleTags';
import type { Exercise, Mesocycle, PlannedExercise, PlannedSession } from '@/models';
import { ExerciseProfile, SetType } from '@/models';
import { restDurationFor } from '@/services/training/restTimer';
import { TrainingGoal } from '@/services/training/volumePlan';
import { previewVolumeBreakdownByMuscle, hasInvalidRepRanges } from '@/services/training/previewEditing';
import { SESSION_OVERHEAD_MINUTES } from '@/services/training/trainingCapacity';
import { sessionKey } from '@/services/training/mesocycleEditing';
import { resizeExerciseSets } from '@/services/training/mesocycleEditing';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useProtectTrainingDraft } from '@/hooks/useTrainingDraftGuard';
import { RoutineSessionSelector } from '@/components/train/RoutineSessionSelector';
import { RecordedSessionEditor } from '@/components/train/RecordedSessionEditor';
import { useAuth } from '@/hooks/useAuth';
import { toRoutineView, type RoutineView } from '@/services/training/routineView';


export default function RoutineDetailScreen() {
  const { catalogue, exercisesById: CATALOGUE } = useExerciseCatalogue();
  const { uid } = useAuth();
  const { t } = useTranslation();
  const name = useExerciseName();
  const { surfaces, colors, typography, spacing, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { mesocycleId, plannedSessionIndex, microcycleIndex, edit } = useLocalSearchParams<{
    mesocycleId?: string; plannedSessionIndex?: string; microcycleIndex?: string; edit?: string;
  }>();
  const { routines, reload } = useRoutines();
  const homeRoutine = routines.find((entry) => entry.mesocycleId === mesocycleId);
  const [historicalRoutine, setHistoricalRoutine] = useState<{ owner: string; view: RoutineView } | null>(null);
  const [revision, setRevision] = useState(0);
  const routine = homeRoutine ?? (historicalRoutine?.owner === uid && historicalRoutine.view.mesocycleId === mesocycleId ? historicalRoutine.view : undefined);
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [loadFinished, setLoadFinished] = useState(false);
  const [editing, setEditing] = useState(edit === '1');
  const [actualDirty, setActualDirty] = useState(false), [actualBusy, setActualBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const [viewMicrocycle, setViewMicrocycle] = useState<number | null>(null);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(() => {
    const parsed = Number(plannedSessionIndex);
    return plannedSessionIndex !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  });
  const [menu, setMenu] = useState<'session' | 'exercise' | 'skip' | 'scope' | null>(null);
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null);
  const [draftExercise, setDraftExercise] = useState<PlannedExercise | null>(null);
  const [draftRIRBySet, setDraftRIRBySet] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [progression, setProgression] = useState<ProgressionStep[] | null>(null);
  const [edits, setEdits] = useState<PreviewEdits>({});
  const [additions, setAdditions] = useState<PreviewAddition[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [swapTarget, setSwapTarget] = useState<{ sessionIndex: number; order: number } | null>(null);
  const [addTarget, setAddTarget] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    if (!mesocycleId) return;
    let active = true;
    setLoadFinished(false);
    mesocycleRepository.get(mesocycleId)
      .then((value) => { if (active) setMesocycle(value); })
      .catch(() => { if (active) setMesocycle(null); })
      .finally(() => { if (active) setLoadFinished(true); });
    return () => { active = false; };
  }, [mesocycleId, uid]));

  useEffect(() => {
    let alive = true;
    if (homeRoutine || !uid || !mesocycle || mesocycle.userId !== uid || !mesocycle.routineId) return;
    Promise.all([routineRepository.get(mesocycle.routineId), workoutSessionRepository.listByUser(uid)]).then(([template, actuals]) => {
      if (!alive || !template || template.userId !== uid) return;
      const view = toRoutineView({ ...template, isActive: template.isActive && template.activeMesocycleId === mesocycle.id }, mesocycle, CATALOGUE, {
        focus: focus => t(`generate.focus${focus}`), goal: goal => t(goal === TrainingGoal.STRENGTH ? 'generate.goalStrength' : 'generate.goalHypertrophy'),
      }, actuals.filter(item => item.userId === uid));
      if (view) setHistoricalRoutine({ owner: uid, view });
    }).catch(() => { /* The unavailable-state exit remains on this screen. */ });
    return () => { alive = false; };
  }, [homeRoutine, uid, mesocycle, CATALOGUE, t, revision]);

  const current = routine?.currentMicrocycleIndex ?? 0;
  const requestedMicrocycle = Number(microcycleIndex);
  const sessionMicrocycle = viewMicrocycle ?? (microcycleIndex !== undefined && Number.isInteger(requestedMicrocycle)
    && requestedMicrocycle >= 0 && requestedMicrocycle < (routine?.microcycles.length ?? 0)
    ? requestedMicrocycle : current);
  const hasPendingPlan = routine?.microcycles.some((micro, index) => index >= current && micro.sessions.some(
    session => session.completedOn === undefined && session.skippedOn === undefined)) ?? false;
  const goal = routine?.generationGoal === TrainingGoal.STRENGTH
    ? TrainingGoal.STRENGTH : TrainingGoal.HYPERTROPHY;
  const previewIndex = selectedSessionIndex === null ? current : sessionMicrocycle;
  const base = useMemo(() => mesocycle === null ? []
    : sessionsForMicrocycle(mesocycle, goal, previewIndex),
  [mesocycle, goal, previewIndex]);
  const sessions = useMemo<PlannedSession[]>(() => {
    const filtered = orderedRoutineSessions(base, mesocycle?.sessionOrder).map((session) => ({
      ...session,
      exercises: session.exercises.filter((exercise) =>
        !removed.includes(previewEditKey(session.index, exercise.order))),
    }));
    return applyPreviewEdits(appendPreviewExercises(filtered, additions, CATALOGUE, goal), edits, CATALOGUE)
      .map((session) => ({
        ...session,
        estimatedWorkMinutes: session.exercises.reduce((sum, entry) => {
          const exercise = CATALOGUE.get(entry.exerciseId);
          return sum + (exercise ? exerciseMinutes(exercise, entry.sets.length, entry.restSeconds) : 0);
        }, 0),
      }));
  }, [additions, base, edits, goal, removed, CATALOGUE, mesocycle?.sessionOrder]);
  const used = useMemo(() => new Set(sessions.flatMap((session) =>
    session.exercises.map((exercise) => exercise.exerciseId))), [sessions]);
  const available = routine ? filterCatalogue(catalogue.filter((exercise) => exercise.archivedAt === undefined), {
    availableEquipment: routine.availableEquipment,
  }) : [];
  const swapCurrent = useMemo(() => {
    if (swapTarget === null) return null;
    const id = sessions.find((session) => session.index === swapTarget.sessionIndex)
      ?.exercises.find((exercise) => exercise.order === swapTarget.order)?.exerciseId;
    return id ? CATALOGUE.get(id) ?? null : null;
  }, [sessions, swapTarget, CATALOGUE]);
  const swapCandidates = swapCurrent === null ? []
    : rankSwapCandidates(swapCurrent, available).filter((exercise) => !used.has(exercise.id));
  const addCandidates = available.filter((exercise) => !used.has(exercise.id));
  const selected = selectedSessionIndex === null ? null
    : sessions.find((session) => session.index === selectedSessionIndex) ?? null;
  const selectedView = selectedSessionIndex === null ? null
    : routine?.microcycles[previewIndex]?.sessions.find((session) =>
      session.plannedSessionIndex === selectedSessionIndex) ?? null;
  const completedWorkoutId = selectedView?.completedWorkoutId;
  const pendingSelection = selectedView !== null && selectedView.completedOn === undefined &&
    selectedView.skippedOn === undefined;
  const selectedMicrocycleHasHistory = routine?.microcycles[previewIndex]?.sessions.some(
    (session) => session.completedOn !== undefined || session.skippedOn !== undefined) ?? false;
  const visibleSessions = selected === null ? sessions : [selected];
  const rirChanged = !!selected && !!mesocycle && hasSessionRIRChanges(sessionsForMicrocycle(mesocycle, goal, previewIndex).find((entry) => entry.index === selected.index) ?? selected, selected);
  const lockedMicrocycles = routine?.microcycles.flatMap((microcycle, index) => microcycle.sessions.some((entry) => entry.plannedSessionIndex === selected?.index && (entry.completedOn !== undefined || entry.skippedOn !== undefined)) ? [index] : []) ?? [];
  const resetDraft = () => { setEdits({}); setAdditions([]); setRemoved([]); setEditing(false); setActualDirty(false);
    setDraftExercise(null); setProgression(null); };
  const dirty = actualDirty || Object.keys(edits).length > 0 || additions.length > 0 || removed.length > 0;
  const editorBusy = saving || actualBusy;
  useProtectTrainingDraft(editing || dirty || editorBusy);
  useEffect(() => { navigation.setOptions({ gestureEnabled: !editing && !dirty && !editorBusy }); }, [navigation, editing, dirty, editorBusy]);
  const confirmDiscard = (action: () => void) => {
    if (!dirty) action();
    else Alert.alert(t('sharedRoutineEditor.unsaved'), t('sharedRoutineEditor.unsavedHint'), [
      { text: t('generate.cancel'), style: 'cancel' }, { text: t('sharedRoutineEditor.discard'), style: 'destructive', onPress: action },
    ]);
  };
  const back = () => {
    if (editorBusy) return;
    confirmDiscard(() => {
      if (selectedSessionIndex !== null && plannedSessionIndex === undefined) { resetDraft(); setSelectedSessionIndex(null); }
      else backToTraining(router);
    });
  };
  useEffect(() => {
    if (!editing && !dirty && !editorBusy) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  });
  const switchSelection = (cycle: number, session: number) => {
    if (editorBusy) return;
    if (cycle === previewIndex && session === selectedSessionIndex) return;
    const change = () => { resetDraft(); setViewMicrocycle(cycle); setSelectedSessionIndex(session); setEditing(true);
      scroll.current?.scrollTo({ y: 0, animated: false }); };
    confirmDiscard(change);
  };
  const beginEditing = () => {
    if (selectedSessionIndex !== null) { resetDraft(); setEditing(true); return; }
    const first = routine?.microcycles[current]?.sessions[0];
    if (first) switchSelection(current, first.plannedSessionIndex);
  };
  const updateEdit = (sessionIndex: number, order: number, patch: PreviewExerciseEdit) => {
    const key = previewEditKey(sessionIndex, order);
    setEdits((currentEdits) => ({ ...currentEdits, [key]: { ...currentEdits[key], ...patch } }));
  };

  const save = async (scope?: SessionEditScope) => {
    if (mesocycle === null || routine === undefined || selectedSessionIndex === null) return;
    if (hasInvalidRepRanges(visibleSessions)) {
      Alert.alert(t('routine.editError'), t('exerciseEditor.invalidRange')); return;
    }
    if (visibleSessions.some((session) => session.exercises.length === 0)) {
      Alert.alert(t('routine.editError'), t('routine.emptySession'));
      return;
    }
    setSaving(true);
    try {
      const fresh = await mesocycleRepository.get(mesocycle.id);
      if (fresh === null || fresh.userId !== mesocycle.userId) throw new Error('Mesocycle not found');
      if (scope === 'recalculate-progression' && selected && progressionFingerprint(sessionProgressionProposal(fresh, goal, previewIndex, selected, lockedMicrocycles)) !== progressionFingerprint(progression)) throw new Error(t('progression.stale'));
      if (selectedSessionIndex !== null && scope !== undefined && selected !== null && pendingSelection) {
        await mesocycleRepository.update(fresh.id, {
          ...changesForSessionEdit(fresh, goal, previewIndex, selected, scope,
            selectedMicrocycleHasHistory,
            lockedMicrocycles),
          updatedAt: Date.now(),
        });
      } else return;
      setMesocycle(await mesocycleRepository.get(fresh.id));
      resetDraft();
      reload();
    } catch (error) {
      Alert.alert(t('routine.editError'), String(error));
    } finally { setSaving(false); }
  };

  const confirmSessionScope = () => {
    if (!pendingSelection) return;
    setMenu('scope');
  };

  const startSelected = () => {
    if (!routine || !selected || !pendingSelection || !routine.isActive || previewIndex !== current) return;
    router.push({ pathname: '/session', params: {
      mesocycleId: routine.mesocycleId,
      goal: routine.generationGoal,
      microcycleIndex: String(previewIndex),
      plannedSessionIndex: String(selected.index),
    } });
  };

  const skipSelected = async () => {
    if (!mesocycle || !selected || !pendingSelection || !routine?.isActive ||
      previewIndex !== current) return;
    try {
      const fresh = await mesocycleRepository.get(mesocycle.id);
      if (!fresh) throw new Error('Mesocycle not found');
      await mesocycleRepository.update(fresh.id, {
        skippedSessions: { ...fresh.skippedSessions,
          [sessionKey(previewIndex, selected.index)]: Date.now() },
        updatedAt: Date.now(),
      });
      setMesocycle(await mesocycleRepository.get(fresh.id));
      reload();
    } catch (error) { Alert.alert(t('routine.editError'), String(error)); }
  };

  const menuExercise = selected?.exercises.find((exercise) =>
    exercise.exerciseId === menuExerciseId) ?? null;
  const canStartSelected = pendingSelection && routine?.isActive === true && previewIndex === current;
  const openExerciseEditor = (exercise: PlannedExercise) => {
    setDraftExercise({ ...exercise, sets: exercise.sets.map((set) => ({ ...set })) });
    setDraftRIRBySet({});
  };
  const menuTitle = menu === 'session' ? selectedView?.name ?? t('routine.sessionActions')
    : menu === 'exercise' ? CATALOGUE.get(menuExerciseId ?? '')?.name ?? t('routine.editExercise')
      : menu === 'skip' ? t('routine.skipSession')
        : menu === 'scope' ? t('routine.saveScopeTitle') : null;
  const menuActions: ActionMenuItem[] = menu === 'session' ? [
    ...(canStartSelected ? [{ label: t('routine.startSession'), onPress: startSelected }] : []),
    ...(pendingSelection ? [{ label: t('routine.editSession'), onPress: () => setEditing(true) }] : []),
    ...(canStartSelected ? [{ label: t('routine.skipSession'), tone: 'danger' as const,
      onPress: () => setMenu('skip') }] : []),
  ] : menu === 'exercise' && menuExercise ? [
    { label: t('routine.editExercise'), onPress: () => openExerciseEditor(menuExercise) },
    { label: t('generate.previewSwap'), onPress: () => {
      setEditing(true);
      setSwapTarget({ sessionIndex: selected?.index ?? 0, order: menuExercise.order });
    } },
  ] : menu === 'skip' ? [
    { label: t('routine.skipSession'), tone: 'danger', onPress: () => void skipSelected() },
  ] : menu === 'scope' ? [
    { label: t('routine.onlyThisMicrocycle'), onPress: () => void save('microcycle') },
    ...(selected && mesocycle && rirChanged
      ? [{ label: t('progression.recalculate'), onPress: () => {
        try { setProgression(sessionProgressionProposal(mesocycle, goal, previewIndex, selected, lockedMicrocycles)); }
        catch { Alert.alert(t('routine.editError'), t('progression.failed')); }
      } }] : []),
    { label: t(rirChanged ? 'progression.keepFixed' : 'routine.remainingMesocycle'), onPress: () => void save('remaining-mesocycle') },
  ] : [];

  const saveExerciseDraft = () => {
    if (!draftExercise || !selected) return;
    const finalSet = draftExercise.sets.at(-1);
    if (!finalSet) return;
    updateEdit(selected.index, draftExercise.order, {
      sets: draftExercise.sets.length,
      restSeconds: draftExercise.restSeconds,
      repsBySet: Object.fromEntries(draftExercise.sets.map((set, index) => [index, {
        min: set.targetRepsMin ?? set.targetReps, max: set.targetReps,
      }])),
      secondsBySet: Object.fromEntries(draftExercise.sets.flatMap((set, index) => set.targetDurationSeconds === undefined ? [] : [[index, set.targetDurationSeconds]])),
      typeBySet: Object.fromEntries(draftExercise.sets.map((set, index) => [index, set.setType])),
      ...(Object.keys(draftRIRBySet).length === 0 ? {} : { rirBySet: draftRIRBySet }),
    });
    setDraftExercise(null);
    setEditing(true);
  };

  if (routine === undefined || mesocycle === null) {
    return <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Pressable accessibilityRole="button" onPress={() => backToTraining(router)} style={{ minHeight: 48, paddingHorizontal: spacing.lg, justifyContent: 'center' }}>
        <Text style={[typography.body, { color: colors.accentText }]}>‹ {t('generate.back')}</Text>
      </Pressable>
      {loadFinished && routines.length > 0
        ? <Text style={[typography.body, { color: colors.textSecondary, padding: spacing.lg }]}>
          {t('train.sessionUnavailable')}
        </Text>
        : <ActivityIndicator color={sectionAccent.train} />}
    </View>;
  }

  return <SafeAreaView edges={{ bottom: true }} style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg }}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.xl }}>
      <Pressable onPress={back} accessibilityRole="button">
        <Text style={[typography.body, { color: colors.textSecondary }]}>‹ {selectedSessionIndex === null
          ? t('tabs.train') : routine.name}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.textPrimary, flex: 1 }]}>
          {selectedSessionIndex === null ? routine.name : selectedView?.name ??
            t('generate.previewSession', { index: selectedSessionIndex + 1 })}
        </Text>
        {selectedSessionIndex !== null && pendingSelection && <Pressable
          onPress={() => setMenu('session')} onLongPress={() => setMenu('session')}
          accessibilityRole="button" accessibilityLabel={t('routine.sessionActions')}
          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            ...surfaces.card, backgroundColor: colors.bgElevated, borderRadius: 20 }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>⋮</Text>
        </Pressable>}
      </View>
      <Text style={[typography.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
        {routine.objective} · {t('home.microcycle')} {Math.min(previewIndex + 1, routine.microcycles.length)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
        marginBottom: spacing.lg }}>
        {selectedSessionIndex === null && <Pressable
          onPress={() => router.push({ pathname: '/mesocycle', params: { mesocycleId } })}
          accessibilityRole="button" style={{ paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md, borderRadius: 12, ...surfaces.card, backgroundColor: colors.bgElevated,
            borderWidth: 1, borderColor: colors.surfaceBorder }}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>{t('home.viewMesocycle')} ↗</Text>
        </Pressable>}
        {!editing && (selectedSessionIndex === null
          ? hasPendingPlan || routine.microcycles.some(micro => micro.sessions.some(session => session.completedWorkoutId)) : pendingSelection || !!completedWorkoutId) &&
          <Pressable onPress={beginEditing} accessibilityRole="button"
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12,
              ...surfaces.card, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.surfaceBorder }}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>
              {selectedSessionIndex === null ? t('routine.edit') : t('routine.editSession')}
            </Text>
          </Pressable>}
        {editing && !completedWorkoutId && <>
          <Pressable onPress={() => confirmDiscard(resetDraft)} accessibilityRole="button"
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('generate.cancel')}</Text>
          </Pressable>
          <Pressable onPress={confirmSessionScope}
            disabled={saving || !pendingSelection} accessibilityRole="button"
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12,
              backgroundColor: sectionAccent.train }}>
            <Text style={[typography.body, { color: '#16191C', fontWeight: '700' }]}>
              {t('routine.saveChanges')}
            </Text>
          </Pressable>
        </>}
      </View>
      {editing && selectedSessionIndex !== null && <RoutineSessionSelector cycle={previewIndex} cycles={routine.microcycles.length}
        sessions={routine.microcycles[previewIndex]?.sessions ?? []} selected={selectedSessionIndex} disabled={editorBusy} onSelect={switchSelection} />}
      {completedWorkoutId && selectedSessionIndex !== null && <RecordedSessionEditor key={`${mesocycleId}:${completedWorkoutId}`}
        workoutId={completedWorkoutId} mesocycleId={routine.mesocycleId} cycle={previewIndex} sessionIndex={selectedSessionIndex}
        editing={editing} onClose={saved => saved ? resetDraft() : confirmDiscard(resetDraft)} onSaved={() => { setRevision(value => value + 1); reload(); }} onDirtyChange={setActualDirty} onBusyChange={setActualBusy} />}
      {!editing && selectedSessionIndex === null && <Text
        style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
        {t('routine.tapSession')}
      </Text>}
      {selected !== null && !editing && !completedWorkoutId && <>
        <View style={{ marginBottom: spacing.xl }}>
          <MuscleVolumeCard title={t('routine.targetMuscles')} hint={t('generate.previewVolumeHint')}
            entries={previewVolumeBreakdownByMuscle([selected], CATALOGUE)} />
        </View>
        <Text style={[typography.title, { color: colors.textPrimary }]}>
          {selected.exercises.length} {t('home.exercises')}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          {t('generate.previewMinutes', {
            minutes: Math.ceil(selected.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES),
          })}
        </Text>
        {selected.exercises.map((planned) => <Pressable
          key={`${planned.exerciseId}:${planned.order}`}
          onPress={() => pendingSelection && openExerciseEditor(planned)}
          onLongPress={() => { if (pendingSelection) {
            setMenuExerciseId(planned.exerciseId); setMenu('exercise');
          } }}
          accessibilityRole="button"
          style={{ paddingVertical: spacing.lg, borderTopColor: colors.surfaceBorder,
            borderTopWidth: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textPrimary,
              fontWeight: '700', flex: 1 }]}>
              {name(planned.exerciseSnapshot ?? CATALOGUE.get(planned.exerciseId)) || planned.exerciseId}
            </Text>
            {pendingSelection && <Text style={[typography.title, { color: colors.textMuted }]}>⋮</Text>}
          </View>
          <MuscleTags exercise={CATALOGUE.get(planned.exerciseId)} />
          {planned.sets.map((set, setIndex) => <View key={setIndex}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              marginTop: spacing.xs }}>
            <Text style={[typography.body, { color: colors.textMuted, width: 22, lineHeight: 24, fontVariant: ['tabular-nums'] }]}>
              {setTypeLabel(set.setType) || setIndex + 1}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>
              {set.targetDurationSeconds !== undefined ? `${set.targetDurationSeconds} ${t('rehab.seconds')}` : `${set.targetRepsMin ?? set.targetReps}–${set.targetReps} ${t('routine.reps')}`}
            </Text>
            {set.targetDurationSeconds === undefined && <Text style={[typography.body, { color: colors.accentText, lineHeight: 24, fontVariant: ['tabular-nums'] }]}>
              RIR {set.targetRIR}
            </Text>}
          </View>)}
        </Pressable>)}
      </>}
      {!completedWorkoutId && (selectedSessionIndex === null || editing) && visibleSessions.length > 0 && <PlanPreview sessions={visibleSessions}
          showCycle={selectedSessionIndex === null} scheduleTemplate={mesocycle.scheduleTemplate}
          editable={editing && pendingSelection}
          summaryLabel={selectedSessionIndex === null ? undefined : t('generate.previewSetsShort', {
            count: visibleSessions.reduce((sum, session) => sum + session.exercises.reduce(
              (inner, exercise) => inner + countWorkingSets(exercise.sets), 0), 0),
          })}
          onPressSession={!editing && selectedSessionIndex === null ? (index) => {
            const completed = routine.microcycles[current]?.sessions.find((entry) => entry.plannedSessionIndex === index)?.completedWorkoutId;
            resetDraft(); setSelectedSessionIndex(index); setEditing(!!completed);
          } : undefined}
          performedSets={visibleSessions.reduce((sum, session) => sum + session.exercises.reduce(
            (inner, exercise) => inner + countWorkingSets(exercise.sets), 0), 0)} exercisesById={CATALOGUE}
          onSwap={editing ? (sessionIndex, order) => setSwapTarget({ sessionIndex, order }) : undefined}
          onAdd={editing ? setAddTarget : undefined}
          isAdded={() => editing}
          onRemove={editing ? (sessionIndex, order) => {
            const planned = sessions.find((session) => session.index === sessionIndex)
              ?.exercises.find((exercise) => exercise.order === order);
            if (planned === undefined) return;
            setAdditions((currentAdditions) => currentAdditions.filter((entry) =>
              entry.sessionIndex !== sessionIndex || entry.exerciseId !== planned.exerciseId));
            if (!additions.some((entry) =>
              entry.sessionIndex === sessionIndex && entry.exerciseId === planned.exerciseId)) {
              setRemoved((currentRemoved) => [...currentRemoved, previewEditKey(sessionIndex, order)]);
            }
          } : undefined}
          onChangeSets={editing ? (sessionIndex, order, value) => {
            if (value !== undefined) updateEdit(sessionIndex, order, { sets: Math.max(1, Math.min(30, Math.trunc(value))) });
          } : undefined}
          onChangeSet={editing ? (sessionIndex, order, setIndex, patch) => {
            const key = previewEditKey(sessionIndex, order);
            const sets = sessions.find((session) => session.index === sessionIndex)?.exercises.find((exercise) => exercise.order === order)?.sets ?? [];
            setEdits((currentEdits) => ({ ...currentEdits, [key]: mergePrescriptionEdit(currentEdits[key], sets, setIndex, patch) }));
          } : undefined}
          onChangeRepMin={editing ? (sessionIndex, order, value) => {
            const set = representativeSet(sessions.find((session) => session.index === sessionIndex)
              ?.exercises.find((exercise) => exercise.order === order)?.sets ?? []);
            if (value !== undefined && set !== undefined) {
              const min = Math.max(1, Math.min(100, Math.trunc(value)));
              updateEdit(sessionIndex, order, { targetRepsMin: min,
                repsBySet: undefined });
            }
          } : undefined}
          onChangeRepMax={editing ? (sessionIndex, order, value) => {
            const set = representativeSet(sessions.find((session) => session.index === sessionIndex)
              ?.exercises.find((exercise) => exercise.order === order)?.sets ?? []);
            if (value !== undefined && set !== undefined) {
              const max = Math.max(1, Math.min(set.targetDurationSeconds === undefined ? 100 : 3600, Math.trunc(value)));
              updateEdit(sessionIndex, order, { targetReps: max,
                targetRepsMin: set.targetRepsMin ?? set.targetReps,
                repsBySet: undefined });
            }
          } : undefined}
          onChangeRest={editing ? (sessionIndex, order, value) => {
            if (value !== undefined && Number.isFinite(value)) updateEdit(sessionIndex, order, { restSeconds: value });
          } : undefined}
          onChangeSetRIR={editing && selectedSessionIndex !== null ? (sessionIndex, order, setIndex, value) => {
            if (value === undefined) return;
            const key = previewEditKey(sessionIndex, order);
            setEdits((currentEdits) => ({ ...currentEdits, [key]: {
              ...currentEdits[key],
              rirBySet: { ...currentEdits[key]?.rirBySet,
                [setIndex]: Math.max(0, Math.min(5, Math.trunc(value))) },
            } }));
          } : undefined} />}
    </ScrollView>
    {selected !== null && !editing && canStartSelected && <View style={{ ...surfaces.screen, backgroundColor: colors.bg }}>
      <Pressable onPress={startSelected} accessibilityRole="button"
        style={{ height: 52, marginHorizontal: spacing.lg, marginVertical: spacing.sm,
          justifyContent: 'center', alignItems: 'center', borderRadius: 14,
          backgroundColor: sectionAccent.train }}>
        <Text style={[typography.title, { color: '#16191C' }]}>{t('routine.startSession')}</Text>
      </Pressable>
    </View>}
    <ActionMenuSheet title={menuTitle}
      subtitle={menu === 'skip' ? t('routine.skipConfirm')
        : menu === 'scope' ? t('routine.saveScopeMessage') : undefined}
      actions={menuActions} onClose={() => setMenu(null)} />
    <RIRProgressionPreview steps={progression} catalogue={CATALOGUE} busy={saving} onApply={() => void save('recalculate-progression')} onClose={() => setProgression(null)} />
    <Modal visible={draftExercise !== null} transparent animationType="slide"
      onRequestClose={() => setDraftExercise(null)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)' }}
        onPress={() => setDraftExercise(null)} />
      <View style={{ ...surfaces.sheet, backgroundColor: colors.bgElevated, borderTopLeftRadius: 20,
        borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          {name(draftExercise?.exerciseSnapshot ?? CATALOGUE.get(draftExercise?.exerciseId ?? '')) || t('routine.editExercise')}
        </Text>
        {draftExercise !== null && <>
          <ScrollView style={{ maxHeight: 340 }}>
            <PrescriptionEditor exercise={draftExercise} restSeconds={draftExercise.restSeconds ?? restDurationFor(
              (draftExercise.exerciseSnapshot ?? CATALOGUE.get(draftExercise.exerciseId))?.profile ?? ExerciseProfile.ISOLATION)}
              onChangeRest={(seconds) => setDraftExercise((previous) => previous ? { ...previous, restSeconds: seconds } : previous)}
              onChangeCount={(count) => setDraftExercise((previous) => previous ? resizeExerciseSets(previous, count) : previous)}
              onChangeSet={(index, patch) => {
                setDraftExercise((previous) => previous ? { ...previous, sets: previous.sets.map((set, position) => position === index ? { ...set, ...patch } : set) } : previous);
                if (patch.targetRIR !== undefined) setDraftRIRBySet((previous) => ({ ...previous, [index]: patch.targetRIR! }));
              }} />
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg,
            marginTop: spacing.lg }}>
            <Pressable onPress={() => setDraftExercise(null)} accessibilityRole="button">
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {t('generate.cancel')}
              </Text>
            </Pressable>
            <Pressable onPress={saveExerciseDraft} accessibilityRole="button">
              <Text style={[typography.body, { color: colors.accentText }]}>
                {t('routine.applyExerciseChanges')}
              </Text>
            </Pressable>
          </View>
        </>}
      </View>
    </Modal>
    <ExerciseSwapSheet current={swapCurrent} candidates={swapCandidates}
      onClose={() => setSwapTarget(null)} onSelect={(exercise: Exercise) => {
        if (swapTarget === null) return;
        updateEdit(swapTarget.sessionIndex, swapTarget.order, { exerciseId: exercise.id });
        setSwapTarget(null);
      }} />
    <ExerciseSwapSheet open={addTarget !== null} mode="add" current={null} candidates={addCandidates}
      onClose={() => setAddTarget(null)} onSelect={(exercise: Exercise) => {
        if (addTarget === null) return;
        setAdditions((currentAdditions) => [...currentAdditions, { sessionIndex: addTarget, exerciseId: exercise.id }]);
        setAddTarget(null);
      }} />
  </SafeAreaView>;
}
