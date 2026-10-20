import { Pressable, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { backToTraining } from '@/services/training/backNavigation';

export default function CreateRoutineScreen() {
  const { t } = useTranslation(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, spacing, radius, sectionAccent } = useTheme();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg,
    paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 100 }}>
    <Pressable onPress={() => backToTraining(router)} style={{ paddingVertical: 12 }}><Text style={{ color: sectionAccent.train }}>{t('generate.back')}</Text></Pressable>
    <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700', marginVertical: 20 }}>{t('routineCreation.title')}</Text>
    {(['AUTOMATIC', 'MANUAL'] as const).map((mode) => <Pressable key={mode} accessibilityRole="button"
      onPress={() => router.push(mode === 'MANUAL' ? '/manual-routine' : '/generate')}
      style={{ padding: 22, borderRadius: radius.lg, backgroundColor: colors.bgElevated, marginBottom: 16 }}>
      <Text style={{ color: sectionAccent.train, fontSize: 21, fontWeight: '600' }}>{t(`routineCreation.${mode}`)}</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 10 }}>{t(`routineCreation.${mode}Hint`)}</Text>
    </Pressable>)}
  </ScrollView>;
}
