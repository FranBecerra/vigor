import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSportActivities } from '@/hooks/useSportActivities';
import { useTheme } from '@/theme/useTheme';
import { SportActivityCard } from '@/components/cardio/SportActivityCard';
import { backToTraining } from '@/services/training/backNavigation';

export default function ActivitiesScreen() {
  const { t } = useTranslation(); const { colors, surfaces, typography, spacing } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const activities = useSportActivities();
  return <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <FlatList data={activities.entries} keyExtractor={(item) => item.id} initialNumToRender={8} windowSize={5}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => backToTraining(router)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 17 }}>{t('generate.back')}</Text></Pressable>
        <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t('sportActivities.title')}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('sportActivities.intro')}</Text>
        {(['PLAN', 'RECORD'] as const).map((mode) => <Pressable key={mode} accessibilityRole="button" accessibilityLabel={t(`sportActivities.${mode === 'PLAN' ? 'plan' : 'record'}`)}
          onPress={() => router.push({ pathname: '/activity-editor', params: { mode } })} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText, fontSize: 17 }}>+ {t(`sportActivities.${mode === 'PLAN' ? 'plan' : 'record'}`)}</Text></Pressable>)}
        {!activities.ready && <ActivityIndicator color={colors.accentText} />}
        {activities.error && <Pressable accessibilityRole="button" onPress={activities.reload} style={{ minHeight: 44 }}><Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('sportActivities.loadFailed')} · {t('home.retry')}</Text></Pressable>}
      </View>}
      ListEmptyComponent={activities.ready && !activities.error ? <Text style={{ color: colors.textMuted }}>{t('sportActivities.empty')}</Text> : null}
      renderItem={({ item }) => <SportActivityCard activity={item} onPress={() => router.push({ pathname: '/activity', params: { id: item.id } })} />} />
  </View>;
}
