import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';
import { CustomExerciseSheet } from '@/components/train/CustomExerciseSheet';
import { backToTraining } from '@/services/training/backNavigation';
import { primaryMusclesOf } from '@/services/training/exerciseMuscles';

export default function ExercisesScreen() {
  const { t } = useTranslation();
  const { catalogue, archive, ready, error } = useExerciseCatalogue();
  const { colors, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  return <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg, padding: spacing.lg,
      paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}>
      <Pressable onPress={() => backToTraining(router)}><Text style={{ color: sectionAccent.train }}>{t('rehab.back')}</Text></Pressable>
      <Text style={{ color: colors.textPrimary, fontSize: 27, fontWeight: '700', marginVertical: 18 }}>{t('custom.library')}</Text>
      {(!ready || error || failed) && <Text style={{ color: colors.textPrimary }}>{t(error || failed ? 'custom.saveFailed' : 'custom.loading')}</Text>}
      {catalogue.filter((exercise) => exercise.isCustom && exercise.archivedAt === undefined).map((exercise) => <View key={exercise.id}
        style={{ backgroundColor: colors.surface, padding: 16, borderRadius: radius.md, marginVertical: 8 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18 }}>{exercise.name}</Text>
        <Text style={{ color: colors.textMuted }}>{(primaryMusclesOf(exercise).length ? primaryMusclesOf(exercise) : [exercise.primaryMuscle]).map((muscle) => t(`muscle.${muscle}`)).join(' · ')} · {t(`custom.${exercise.recording?.measure ?? 'REPETITIONS'}`)}</Text>
        {!!exercise.notes && <Text style={{ color: colors.textSecondary }}>{exercise.notes}</Text>}
        <Pressable onPress={() => Alert.alert(t('custom.archive'), t('custom.archiveMessage'), [
          { text: t('generate.cancel'), style: 'cancel' }, { text: t('custom.archive'), onPress: () => { void archive(exercise).catch(() => setFailed(true)); } },
        ])} style={{ paddingTop: 14 }}><Text style={{ color: colors.textSecondary }}>{t('custom.archive')}</Text></Pressable>
      </View>)}
      <Pressable onPress={() => setCreating(true)} style={{ padding: 18, marginVertical: 18, backgroundColor: sectionAccent.train, borderRadius: radius.md }}>
        <Text style={{ color: colors.bg, fontWeight: '700', textAlign: 'center' }}>{t('custom.createInline')}</Text>
      </Pressable>
    </ScrollView>
    <CustomExerciseSheet open={creating} onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />
  </>;
}
