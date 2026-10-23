import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useExerciseName } from '@/hooks/useExerciseName';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';
import { BodyMap } from '@/components/train/BodyMap';
import { CustomExerciseSheet } from '@/components/train/CustomExerciseSheet';
import { primaryMusclesOf } from '@/services/training/exerciseMuscles';
import { cleanImportedExerciseNotes, CRITERIA_KEYS } from '@/services/training/exerciseEditing';
import { SharedNoteButton } from '@/components/train/SharedNoteButton';
import { ExerciseGenerationTier } from '@/models';

export default function ExerciseDetailsScreen() {
  const name = useExerciseName();
  const { id } = useLocalSearchParams<{ id: string }>(); const router = useRouter(); const { t } = useTranslation();
  const { exercisesById, ready, archive, error, notRecommendedExerciseIds = new Set<string>(), setExerciseNotRecommended } = useExerciseCatalogue(); const exercise = exercisesById.get(id);
  const [editing, setEditing] = useState(false); const [failed, setFailed] = useState(false);
  const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme(); const insets = useSafeAreaInsets();
  const back = () => router.canGoBack() ? router.back() : router.replace('/exercises');
  const description = cleanImportedExerciseNotes(exercise?.notes);
  const section = (title: string, value: string) => <View style={{ marginTop: spacing.md }}>
    <Text style={[typography.caption, { color: colors.textMuted }]}>{title}</Text>
    <Text style={[typography.body, { color: colors.textPrimary, marginTop: 5 }]}>{value}</Text>
  </View>;
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
      <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t('generate.back')}</Text></Pressable>
      {(error || failed) && <Text accessibilityRole="alert" style={[typography.body, { color: semantic.danger }]}>{t('custom.saveFailed')}</Text>}
      {!exercise && <Text style={[typography.body, { color: colors.textMuted }]}>{t(ready ? 'historyDetails.unknownExercise' : 'custom.loading')}</Text>}
      {exercise && <>
        <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{name(exercise)}</Text>
        <BodyMap height={230} paint={(muscle) => primaryMusclesOf(exercise).includes(muscle) ? { color: colors.accentText, opacity: 1 }
          : exercise.secondaryMuscles.includes(muscle) ? { color: colors.accentText, opacity: 0.35 } : null} />
        <View style={{ padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface }}>
          {section(t('custom.muscle'), primaryMusclesOf(exercise).map((muscle) => t(`muscle.${muscle}`)).join(' · ') || t('custom.UNCLASSIFIED'))}
          {!!exercise.secondaryMuscles.length && section(t('custom.secondary'), exercise.secondaryMuscles.map((muscle) => t(`muscle.${muscle}`)).join(' · '))}
          {section(t('custom.equipment'), t(`generate.equipment${exercise.equipment}`))}
          {section(t('custom.movement'), (exercise.movementVectors ?? [exercise.movementVector]).map((vector) => t(`custom.movements.${vector}`)).join(' · '))}
          {section(t('custom.profile'), t(`custom.${exercise.profile}`))}
          {section(t('custom.recording'), `${t(`custom.${exercise.recording?.measure ?? 'REPETITIONS'}`)} · ${t(`custom.${exercise.recording?.load ?? 'TOTAL_KG'}`)}`)}
          {exercise.laterality === 'PER_SIDE' && section(t('custom.execution'), t('custom.perSide'))}
          {!!exercise.requiredApparatus?.length && section(t('library.apparatus'), exercise.requiredApparatus.map((value) => t(`library.apparatusNames.${value}`, { defaultValue: value.toLowerCase().replace(/_/g, ' ') })).join(' · '))}
        </View>
        {section(t('library.description'), description || t('library.noDescription'))}
        <SharedNoteButton scope="EXERCISE" targetId={exercise.id} title={name(exercise)} />
        <Pressable accessibilityRole="button" disabled={!ready || error}
          accessibilityLabel={t(notRecommendedExerciseIds.has(exercise.id) ? 'exercisePreference.recommend' : 'exercisePreference.notRecommend')}
          onPress={() => { void setExerciseNotRecommended(exercise.id, !notRecommendedExerciseIds.has(exercise.id)).catch(() => setFailed(true)); }}
          style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: notRecommendedExerciseIds.has(exercise.id) ? sectionAccent.train : colors.surfaceBorder, borderRadius: radius.md, marginTop: spacing.md }}>
          <Text style={[typography.body, { color: notRecommendedExerciseIds.has(exercise.id) ? colors.accentText : colors.textPrimary, fontWeight: '600' }]}>
            {notRecommendedExerciseIds.has(exercise.id) ? `✓ ${t('exercisePreference.notRecommended')}` : `⊘ ${t('exercisePreference.notRecommend')}`}
          </Text>
        </Pressable>
        {exercise.referenceUrl && /^https:\/\/[^\s]+$/i.test(exercise.referenceUrl) && <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(exercise.referenceUrl!).catch(() => setFailed(true)); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t('custom.reference')} ↗</Text></Pressable>}
        <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.xl }]}>{t('library.ratings')}</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginVertical: spacing.sm }]}>{t(exercise.isPersonalized ? 'library.personalRatingHint' : 'library.ratingHint')}</Text>
        {exercise.generationTier === ExerciseGenerationTier.MANUAL_ONLY && <Text style={[typography.caption, { color: colors.textMuted, marginVertical: spacing.sm }]}>{t('library.manualOnlyHint')}</Text>}
        {CRITERIA_KEYS.map((key) => <View key={key} style={{ paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceBorder }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}><Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{t(`library.criteria.${key}`)}</Text>
            <Text style={[typography.title, { color: colors.accentText }]}>{exercise.criteria ? `${exercise.criteria[key]} / 5` : '—'}</Text></View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>{t(`library.criteriaHints.${key}`)}</Text>
        </View>)}
        <Pressable accessibilityRole="button" disabled={!ready || error} onPress={() => setEditing(true)} style={{ minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: sectionAccent.train, borderRadius: radius.md, marginTop: spacing.xl }}>
          <Text style={[typography.body, { color: colors.onAccent, fontWeight: '700' }]}>{t('library.edit')}</Text>
        </Pressable>
        {exercise.isCustom && <Pressable accessibilityRole="button" onPress={() => Alert.alert(t('custom.archive'), t('custom.archiveMessage'), [
          { text: t('generate.cancel'), style: 'cancel' }, { text: t('custom.archive'), onPress: () => { void archive(exercise).then(back).catch(() => setFailed(true)); } },
        ])} style={{ minHeight: 52, justifyContent: 'center' }}><Text style={[typography.body, { color: semantic.danger }]}>{t('custom.archive')}</Text></Pressable>}
      </>}
    </ScrollView>
    {exercise && editing && <CustomExerciseSheet open exercise={exercise} onClose={() => setEditing(false)} onCreated={() => setEditing(false)} />}
  </View>;
}
