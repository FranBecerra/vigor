/** Saved routine overview and future-plan editor. */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { backToTraining } from '@/services/training/backNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useRoutines } from '@/hooks/useRoutines';
import { mesocycleRepository } from '@/services/repositories';
import { EXERCISE_CATALOGUE, filterCatalogue } from '@/services/training/exerciseCatalogue';
import { baseSessionsForMicrocycle, changesForSessionEdit, sessionsForMicrocycle, withPlanRevision,
  type SessionEditScope } from '@/services/training/mesocycleEditing';
import { applyPreviewEdits, appendPreviewExercises, previewEditKey, representativeSet, type PreviewAddition, type PreviewEdits, type PreviewExerciseEdit } from '@/services/training/previewEditing';
import { exerciseMinutes } from '@/services/training/trainingCapacity';
import { rankSwapCandidates } from '@/services/training/swapEngine';
import { PlanPreview } from '@/components/train/generate/PlanPreview';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { ActionMenuSheet, type ActionMenuItem } from '@/components/train/ActionMenuSheet';
import { NumericField } from '@/components/train/NumericField';
import { TrainingCalendarCard } from '@/components/train/TrainingCalendarCard';
import { MuscleVolumeCard } from '@/components/train/MuscleVolumeCard';
import { MuscleTags } from '@/components/train/MuscleTags';
import type { Exercise, Mesocycle, PlannedExercise, PlannedSession } from '@/models';
import { ExerciseProfile, SetType } from '@/models';
import { restDurationFor } from '@/services/training/restTimer';
import { TrainingGoal } from '@/services/training/volumePlan';
import { previewVolumeBreakdownByMuscle } from '@/services/training/previewEditing';
import { SESSION_OVERHEAD_MINUTES } from '@/services/training/trainingCapacity';
import { sessionKey } from '@/services/training/mesocycleEditing';
import { resizeExerciseSets } from '@/services/training/mesocycleEditing';
import { SafeAreaView } from 'react-native-screens/experimental';

const CATALOGUE = new Map(EXERCISE_CATALOGUE.map((exercise) => [exercise.id, exercise]));

export default function RoutineDetailScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mesocycleId, plannedSessionIndex, microcycleIndex } = useLocalSearchParams<{
    mesocycleId?: string; plannedSessionIndex?: string; microcycleIndex?: string;
  }>();
  const { routines, reload } = useRoutines();
  const routine = routines.find((entry) => entry.mesocycleId === mesocycleId);
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [loadFinished, setLoadFinished] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(() => {
    const parsed = Number(plannedSessionIndex);
    return plannedSessionIndex !== undefined && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  });
  const [menu, setMenu] = useState<'session' | 'exercise' | 'skip' | 'scope' | null>(null);
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null);
  const [draftExercise, setDraftExercise] = useState<PlannedExercise | null>(null);
  const [draftRIRBySet, setDraftRIRBySet] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
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
  }, [mesocycleId]));

  const current = routine?.currentMicrocycleIndex ?? 0;
  const requestedMicrocycle = Number(microcycleIndex);
  const sessionMicrocycle = microcycleIndex !== undefined && Number.isInteger(requestedMicrocycle)
    && requestedMicrocycle >= 0 && requestedMicrocycle < (routine?.microcycles.length ?? 0)
    ? requestedMicrocycle : current;
  const hasCompletedCurrent = routine?.microcycles[current]?.sessions.some(
    (session) => session.completedOn !== undefined || session.skippedOn !== undefined) ?? false;
  const fromIndex = hasCompletedCurrent ? current + 1 : current;
  const goal = routine?.generationGoal === TrainingGoal.STRENGTH
    ? TrainingGoal.STRENGTH : TrainingGoal.HYPERTROPHY;
  const planEdit = editing && selectedSessionIndex === null;
  const previewIndex = planEdit ? fromIndex : selectedSessionIndex === null ? current : sessionMicrocycle;
  const base = useMemo(() => mesocycle === null ? []
    : planEdit
      ? baseSessionsForMicrocycle(mesocycle, goal, previewIndex)
      : sessionsForMicrocycle(mesocycle, goal, previewIndex),
  [mesocycle, goal, planEdit, previewIndex]);
  const sessions = useMemo<PlannedSession[]>(() => {
    const filtered = base.map((session) => ({
      ...session,
      exercises: session.exercises.filter((exercise) =>
        !removed.includes(previewEditKey(session.index, exercise.order))),
    }));
    return applyPreviewEdits(appendPreviewExercises(filtered, additions, CATALOGUE, goal), edits)
      .map((session) => ({
        ...session,
        estimatedWorkMinutes: session.exercises.reduce((sum, entry) => {
          const exercise = CATALOGUE.get(entry.exerciseId);
          return sum + (exercise ? exerciseMinutes(exercise, entry.sets.length, entry.restSeconds) : 0);
        }, 0),
      }));
  }, [additions, base, edits, goal, removed]);
  const used = useMemo(() => new Set(sessions.flatMap((session) =>
    session.exercises.map((exercise) => exercise.exerciseId))), [sessions]);
  const available = routine ? filterCatalogue(EXERCISE_CATALOGUE, {
    availableEquipment: routine.availableEquipment,
  }) : [];
  const swapCurrent = useMemo(() => {
    if (swapTarget === null) return null;
    const id = sessions.find((session) => session.index === swapTarget.sessionIndex)
      ?.exercises.find((exercise) => exercise.order === swapTarget.order)?.exerciseId;
    return id ? CATALOGUE.get(id) ?? null : null;
  }, [sessions, swapTarget]);
  const swapCandidates = swapCurrent === null ? []
    : rankSwapCandidates(swapCurrent, available).filter((exercise) => !used.has(exercise.id));
  const addCandidates = available.filter((exercise) => !used.has(exercise.id));
  const selected = selectedSessionIndex === null ? null
    : sessions.find((session) => session.index === selectedSessionIndex) ?? null;
  const selectedView = selectedSessionIndex === null ? null
    : routine?.microcycles[previewIndex]?.sessions.find((session) =>
      session.plannedSessionIndex === selectedSessionIndex) ?? null;
  const pendingSelection = selectedView !== null && selectedView.completedOn === undefined &&
    selectedView.skippedOn === undefined;
  const selectedMicrocycleHasHistory = routine?.microcycles[previewIndex]?.sessions.some(
    (session) => session.completedOn !== undefined || session.skippedOn !== undefined) ?? false;
  const visibleSessions = selected === null ? sessions : [selected];
  const resetDraft = () => { setEdits({}); setAdditions([]); setRemoved([]); setEditing(false);
    setDraftExercise(null); };
  const updateEdit = (sessionIndex: number, order: number, patch: PreviewExerciseEdit) => {
    const key = previewEditKey(sessionIndex, order);
    setEdits((currentEdits) => ({ ...currentEdits, [key]: { ...currentEdits[key], ...patch } }));
  };

  const save = async (scope?: SessionEditScope) => {
    if (mesocycle === null || routine === undefined ||
      (selectedSessionIndex === null && fromIndex >= routine.microcycles.length)) return;
    if (visibleSessions.some((session) => session.exercises.length === 0)) {
      Alert.alert(t('routine.editError'), t('routine.emptySession'));
      return;
    }
    setSaving(true);
    try {
      const fresh = await mesocycleRepository.get(mesocycle.id);
      if (fresh === null) throw new Error('Mesocycle not found');
      if (selectedSessionIndex !== null && scope !== undefined && selected !== null && pendingSelection) {
        await mesocycleRepository.update(fresh.id, {
          ...changesForSessionEdit(fresh, goal, previewIndex, selected, scope,
            selectedMicrocycleHasHistory),
          updatedAt: Date.now(),
        });
      } else if (selectedSessionIndex === null) {
        await mesocycleRepository.update(fresh.id, {
          prescriptionRevisions: withPlanRevision(fresh, fromIndex, sessions),
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
    { label: t('routine.remainingMesocycle'), onPress: () => void save('remaining-mesocycle') },
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
      ...(Object.keys(draftRIRBySet).length === 0 ? {} : { rirBySet: draftRIRBySet }),
    });
    setDraftExercise(null);
    setEditing(true);
  };

  if (routine === undefined || mesocycle === null) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {loadFinished && routines.length > 0
        ? <Text style={[typography.body, { color: colors.textSecondary, padding: spacing.lg }]}>
          {t('train.sessionUnavailable')}
        </Text>
        : <ActivityIndicator color={sectionAccent.train} />}
    </View>;
  }

  return <SafeAreaView edges={{ bottom: true }} style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg,
      paddingBottom: insets.bottom + spacing.xl }}>
      <Pressable onPress={() => {
        if (selectedSessionIndex !== null && plannedSessionIndex === undefined) {
          resetDraft(); setSelectedSessionIndex(null);
        }
        else backToTraining(router);
      }} accessibilityRole="button">
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
            backgroundColor: colors.bgElevated, borderRadius: 20 }}>
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
            paddingHorizontal: spacing.md, borderRadius: 12, backgroundColor: colors.bgElevated,
            borderWidth: 1, borderColor: colors.surfaceBorder }}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>{t('home.viewMesocycle')} ↗</Text>
        </Pressable>}
        {!editing && (selectedSessionIndex === null
          ? fromIndex < routine.microcycles.length : pendingSelection) &&
          <Pressable onPress={() => { resetDraft(); setEditing(true); }} accessibilityRole="button"
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12,
              backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.surfaceBorder }}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>
              {selectedSessionIndex === null ? t('routine.edit') : t('routine.editSession')}
            </Text>
          </Pressable>}
        {editing && <>
          <Pressable onPress={resetDraft} accessibilityRole="button"
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('generate.cancel')}</Text>
          </Pressable>
          <Pressable onPress={() => selectedSessionIndex === null ? void save() : confirmSessionScope()}
            disabled={saving} accessibilityRole="button"
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12,
              backgroundColor: sectionAccent.train }}>
            <Text style={[typography.body, { color: '#16191C', fontWeight: '700' }]}>
              {t('routine.saveChanges')}
            </Text>
          </Pressable>
        </>}
      </View>
      {planEdit && <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
        {t('routine.futureOnly')}
      </Text>}
      {!editing && selectedSessionIndex === null && <Text
        style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
        {t('routine.tapSession')}
      </Text>}
      {selected !== null && !editing && <>
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
              {CATALOGUE.get(planned.exerciseId)?.name ?? planned.exerciseId}
            </Text>
            {pendingSelection && <Text style={[typography.title, { color: colors.textMuted }]}>⋮</Text>}
          </View>
          <MuscleTags exercise={CATALOGUE.get(planned.exerciseId)} />
          {planned.sets.map((set, setIndex) => <View key={setIndex}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              marginTop: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.textMuted, width: 22 }]}>
              {setIndex + 1}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>
              {set.targetRepsMin ?? set.targetReps}–{set.targetReps} {t('routine.reps')}
            </Text>
            <Text style={[typography.caption, { color: sectionAccent.train }]}>
              RIR {set.targetRIR}
            </Text>
          </View>)}
        </Pressable>)}
      </>}
      {selectedSessionIndex === null && !editing && <TrainingCalendarCard mesocycleId={mesocycle.id}
        microcycleIndex={previewIndex} goal={goal} durationFeedback={routine.durationFeedback} onChanged={reload} />}
      {(selectedSessionIndex === null || editing) && visibleSessions.length > 0 && <PlanPreview sessions={visibleSessions}
          editable={editing}
          summaryLabel={selectedSessionIndex === null ? undefined : t('generate.previewSetsShort', {
            count: visibleSessions.reduce((sum, session) => sum + session.exercises.reduce(
              (inner, exercise) => inner + exercise.sets.length, 0), 0),
          })}
          onPressSession={!editing && selectedSessionIndex === null ? (index) => {
            resetDraft(); setSelectedSessionIndex(index);
          } : undefined}
          performedSets={visibleSessions.reduce((sum, session) => sum + session.exercises.reduce(
            (inner, exercise) => inner + exercise.sets.length, 0), 0)} exercisesById={CATALOGUE}
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
          onChangeRepMin={editing ? (sessionIndex, order, value) => {
            const set = representativeSet(sessions.find((session) => session.index === sessionIndex)
              ?.exercises.find((exercise) => exercise.order === order)?.sets ?? []);
            if (value !== undefined && set !== undefined) {
              const min = Math.max(1, Math.min(100, Math.trunc(value)));
              updateEdit(sessionIndex, order, { targetRepsMin: min,
                targetReps: Math.max(min, set.targetReps), repsBySet: undefined });
            }
          } : undefined}
          onChangeRepMax={editing ? (sessionIndex, order, value) => {
            const set = representativeSet(sessions.find((session) => session.index === sessionIndex)
              ?.exercises.find((exercise) => exercise.order === order)?.sets ?? []);
            if (value !== undefined && set !== undefined) {
              const max = Math.max(1, Math.min(100, Math.trunc(value)));
              updateEdit(sessionIndex, order, { targetReps: max,
                targetRepsMin: Math.min(set.targetRepsMin ?? set.targetReps, max),
                repsBySet: undefined });
            }
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
    {selected !== null && !editing && canStartSelected && <View style={{ backgroundColor: colors.bg }}>
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
    <Modal visible={draftExercise !== null} transparent animationType="slide"
      onRequestClose={() => setDraftExercise(null)}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)' }}
        onPress={() => setDraftExercise(null)} />
      <View style={{ backgroundColor: colors.bgElevated, borderTopLeftRadius: 20,
        borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          {CATALOGUE.get(draftExercise?.exerciseId ?? '')?.name ?? t('routine.editExercise')}
        </Text>
        {draftExercise !== null && <>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{t('calendar.restSeconds')}</Text>
          <View style={{ width: 80, marginBottom: spacing.md }}>
            <NumericField value={draftExercise.restSeconds ?? restDurationFor(
              CATALOGUE.get(draftExercise.exerciseId)?.profile ?? ExerciseProfile.ISOLATION)}
              accessibilityLabel={t('calendar.restSeconds')}
              onChangeValue={(value) => { if (value !== undefined) setDraftExercise({ ...draftExercise,
                restSeconds: Math.max(0, Math.min(600, Math.round(value))) }); }} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {t('generate.previewSetsLabel')}
          </Text>
          <View style={{ width: 80, marginBottom: spacing.md }}>
            <NumericField value={draftExercise.sets.filter((set) =>
              set.setType !== SetType.TOP_SINGLE).length}
              onChangeValue={(value) => {
                if (value !== undefined) setDraftExercise(resizeExerciseSets(draftExercise, value));
              }} accessibilityLabel={t('generate.previewSetsLabel')} />
          </View>
          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
            {draftExercise.sets.map((set, setIndex) => <View key={setIndex}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                marginBottom: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted, width: 22 }]}>
                {setIndex + 1}
              </Text>
              {(['targetRepsMin', 'targetReps', 'targetRIR'] as const).map((field) =>
                <View key={field} style={{ width: 72, alignItems: 'center' }}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {field === 'targetRepsMin' ? t('generate.previewRepMin')
                      : field === 'targetReps' ? t('generate.previewRepMax') : 'RIR'}
                  </Text>
                  <NumericField value={field === 'targetRepsMin'
                    ? set.targetRepsMin ?? set.targetReps : set[field]}
                    editable={set.setType !== SetType.TOP_SINGLE}
                    accessibilityLabel={`${field} ${setIndex + 1}`}
                    onChangeValue={(value) => {
                      if (value === undefined) return;
                      const bounded = field === 'targetRIR'
                        ? Math.max(0, Math.min(5, Math.trunc(value)))
                        : Math.max(1, Math.min(100, Math.trunc(value)));
                      setDraftExercise({ ...draftExercise, sets: draftExercise.sets.map(
                        (entry, position) => {
                          if (position !== setIndex) return entry;
                          if (field === 'targetRIR') return { ...entry, targetRIR: bounded };
                          if (field === 'targetRepsMin') return { ...entry,
                            targetRepsMin: bounded, targetReps: Math.max(bounded, entry.targetReps) };
                          return { ...entry, targetReps: bounded,
                            targetRepsMin: Math.min(entry.targetRepsMin ?? entry.targetReps, bounded) };
                        }) });
                      if (field === 'targetRIR') setDraftRIRBySet((previous) => ({
                        ...previous, [setIndex]: bounded }));
                    }} />
                </View>)}
            </View>)}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg,
            marginTop: spacing.lg }}>
            <Pressable onPress={() => setDraftExercise(null)} accessibilityRole="button">
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {t('generate.cancel')}
              </Text>
            </Pressable>
            <Pressable onPress={saveExerciseDraft} accessibilityRole="button">
              <Text style={[typography.body, { color: sectionAccent.train }]}>
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
