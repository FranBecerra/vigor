import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/models';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';
import { PlanPreview } from '@/components/train/generate/PlanPreview';
import { ExerciseSwapSheet } from '@/components/train/generate/ExerciseSwapSheet';
import { Chip, ChipRow, Stepper } from '@/components/train/generate/GenerateControls';
import { TrainingGoal } from '@/services/training/volumePlan';
import { appendPreviewExercises, applyPreviewEdits, previewEditKey, representativeSet, type PreviewExerciseEdit } from '@/services/training/previewEditing';
import { manualRoutineDocuments, resizeManualSessions, timeManualSessions } from '@/services/training/manualRoutine';
import { routineNameProblem, shouldActivateNewRoutine, MAX_ROUTINE_NAME_LENGTH } from '@/services/training/routineMapper';
import { mesocycleRepository, routineRepository } from '@/services/repositories';
import { backToTraining } from '@/services/training/backNavigation';

export default function ManualRoutineScreen() {
  const { t } = useTranslation(); const router = useRouter(); const insets = useSafeAreaInsets(); const { uid } = useAuth();
  const { catalogue, exercisesById } = useExerciseCatalogue(); const { colors, spacing, radius, sectionAccent } = useTheme();
  const [name, setName] = useState(''); const [goal, setGoal] = useState(TrainingGoal.HYPERTROPHY);
  const [microcycles, setMicrocycles] = useState(6);
  const [sessions, setSessions] = useState(() => resizeManualSessions([], 3));
  const [picker, setPicker] = useState<{ sessionIndex: number; order?: number } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const saveIdentity = useRef<{ id: string; time: number } | null>(null);
  const planned = useMemo(() => timeManualSessions(sessions, exercisesById), [sessions, exercisesById]);
  const currentSession = planned.find((session) => session.index === picker?.sessionIndex);
  const currentEntry = currentSession?.exercises.find((entry) => entry.order === picker?.order);
  const current = currentEntry?.exerciseSnapshot ?? (currentEntry ? exercisesById.get(currentEntry.exerciseId) : null) ?? null;
  const candidates = catalogue.filter((ex) => ex.archivedAt === undefined && !currentSession?.exercises.some((entry) => entry.exerciseId === ex.id));
  const edit = (sessionIndex: number, order: number, patch: PreviewExerciseEdit) =>
    setSessions((old) => applyPreviewEdits(old, { [previewEditKey(sessionIndex, order)]: patch }, exercisesById));
  const choose = (exercise: Exercise) => {
    if (!picker) return;
    const selectedCatalogue = new Map(exercisesById).set(exercise.id, exercise);
    if (picker.order !== undefined) setSessions((old) => applyPreviewEdits(old,
      { [previewEditKey(picker.sessionIndex, picker.order!)]: { exerciseId: exercise.id } }, selectedCatalogue));
    else setSessions((old) => appendPreviewExercises(old, [{ sessionIndex: picker.sessionIndex, exerciseId: exercise.id }], selectedCatalogue, goal));
    setPicker(null);
  };
  const save = async () => {
    if (!uid || busy) return;
    setBusy(true); setError('');
    try {
      const existing = (await routineRepository.listByUser(uid)).filter((routine) => routine.id !== saveIdentity.current?.id);
      const problem = routineNameProblem(name, existing.map((routine) => routine.name));
      if (problem) throw new Error(problem === 'empty' ? 'invalidName' : 'duplicateName');
      const identity = saveIdentity.current ?? { id: `${uid}-manual-${Date.now()}-${Math.random().toString(36).slice(2)}`, time: Date.now() };
      saveIdentity.current = identity;
      const documents = manualRoutineDocuments({ userId: uid, routineId: identity.id, now: identity.time, name, goal, microcycles,
        sessions: planned, catalogue: exercisesById, accentColor: sectionAccent.train, active: shouldActivateNewRoutine(existing) });
      // Persist the prescription before exposing a routine pointing to it. Retry uses the same identity.
      await mesocycleRepository.create(documents.mesocycle);
      await routineRepository.create(documents.routine);
      router.dismissTo('/(tabs)/(train)');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'saveFailed'); }
    finally { setBusy(false); }
  };
  const field = { color: colors.textPrimary, backgroundColor: colors.bgElevated, padding: spacing.md, borderRadius: radius.md, marginVertical: spacing.md };
  return <SafeAreaView edges={{ bottom: true }} style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView pointerEvents={busy ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg }}>
      <Text style={{ color: colors.textPrimary, fontSize: 27, fontWeight: '700' }}>{t('routineCreation.manualTitle')}</Text>
      <Text style={{ color: colors.textMuted, marginVertical: spacing.md }}>{t('routineCreation.manualHint')}</Text>
      <TextInput value={name} onChangeText={setName} maxLength={MAX_ROUTINE_NAME_LENGTH} style={field}
        accessibilityLabel={t('generate.name')} placeholder={t('generate.namePlaceholder')} placeholderTextColor={colors.textMuted} />
      <ChipRow>{Object.values(TrainingGoal).map((value) => <Chip key={value} selected={goal === value} onPress={() => setGoal(value)}
        label={t(value === TrainingGoal.STRENGTH ? 'generate.goalStrength' : 'generate.goalHypertrophy')} />)}</ChipRow>
      <View style={{ gap: spacing.md, marginVertical: spacing.lg }}>
        <Stepper label={t('generate.sessions')} value={sessions.length} min={1} max={7} onChange={(count) => {
          const apply = () => setSessions((old) => resizeManualSessions(old, count));
          if (sessions.slice(count).some((session) => session.exercises.length > 0)) {
            Alert.alert(t('routineCreation.removeSessions'), t('routineCreation.removeSessionsHint'), [
              { text: t('generate.cancel'), style: 'cancel' }, { text: t('routineCreation.confirmRemove'), style: 'destructive', onPress: apply }]);
          } else apply();
        }} />
        <Stepper label={t('routineCreation.microcycles')} value={microcycles} min={1} max={12} onChange={setMicrocycles} />
      </View>
      <PlanPreview sessionTabs sessions={planned} performedSets={planned.reduce((sum, session) => sum + session.exercises.reduce((count, entry) => count + entry.sets.length, 0), 0)}
        exercisesById={exercisesById} onAdd={(sessionIndex) => setPicker({ sessionIndex })} onSwap={(sessionIndex, order) => setPicker({ sessionIndex, order })}
        onChangeSessionName={(index, value) => setSessions((old) => old.map((session) => session.index === index ? { ...session, name: value } : session))}
        isAdded={() => true} onRemove={(index, order) => setSessions((old) => old.map((session) => session.index === index
          ? { ...session, exercises: session.exercises.filter((entry) => entry.order !== order) } : session))}
        onChangeSets={(index, order, value) => { if (value !== undefined && Number.isFinite(value)) edit(index, order, { sets: Math.max(1, Math.min(30, Math.trunc(value))) }); }}
        onChangeRepMin={(index, order, value) => {
          if (value === undefined || !Number.isFinite(value)) return;
          const set = representativeSet(planned.find((session) => session.index === index)?.exercises.find((entry) => entry.order === order)?.sets ?? []);
          if (set) { const min = Math.max(1, Math.min(100, Math.trunc(value))); edit(index, order, { targetRepsMin: min }); }
        }}
        onChangeRepMax={(index, order, value) => {
          if (value === undefined || !Number.isFinite(value)) return;
          const set = representativeSet(planned.find((session) => session.index === index)?.exercises.find((entry) => entry.order === order)?.sets ?? []);
          if (set) { const max = Math.max(1, Math.min(set.targetDurationSeconds === undefined ? 100 : 3600, Math.trunc(value)));
            edit(index, order, { targetReps: max, targetRepsMin: set.targetRepsMin ?? set.targetReps }); }
        }}
        onChangeRest={(index, order, value) => { if (value !== undefined && Number.isFinite(value)) edit(index, order, { restSeconds: value }); }}
        onChangeSetRIR={(index, order, setIndex, value) => { if (value !== undefined && Number.isFinite(value)) edit(index, order, { rirBySet: { [setIndex]: Math.max(0, Math.min(5, Math.trunc(value))) } }); }} />
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary, marginVertical: spacing.md }}>{t(`routineCreation.${error}`, { defaultValue: t('routineCreation.saveFailed') })}</Text>}
    </ScrollView>
    <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg }}>
      <Pressable disabled={busy} onPress={() => backToTraining(router)} style={{ padding: 16 }}><Text style={{ color: colors.textSecondary }}>{t('generate.cancel')}</Text></Pressable>
      <Pressable disabled={busy} onPress={() => { void save(); }} style={{ flex: 1, padding: 16, borderRadius: radius.pill, backgroundColor: sectionAccent.train }}>
        <Text style={{ textAlign: 'center', color: colors.bg, fontWeight: '700' }}>{t(busy ? 'generate.saving' : 'generate.save')}</Text>
      </Pressable>
    </View>
    <ExerciseSwapSheet open={picker !== null} current={current} mode={picker?.order === undefined ? 'add' : 'swap'} candidates={candidates} onSelect={choose}
      onSelectMany={(chosen) => { if (!picker) return; const map = new Map(exercisesById); chosen.forEach((ex) => map.set(ex.id, ex));
        setSessions((old) => appendPreviewExercises(old, chosen.map((ex) => ({ sessionIndex: picker.sessionIndex, exerciseId: ex.id })), map, goal)); setPicker(null); }}
      onClose={() => setPicker(null)} />
  </SafeAreaView>;
}
