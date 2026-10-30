import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSportActivities } from '@/hooks/useSportActivities';
import { useTheme } from '@/theme/useTheme';
import { SportActivityCard } from './SportActivityCard';
import { SavedCardioPlans } from './SavedCardioPlans';
import { CardioTrainingHome } from './CardioTrainingHome';

export function SportActivitiesHome() {
  const { t } = useTranslation(); const { colors, surfaces, radius } = useTheme(); const router = useRouter();
  const activities = useSportActivities();
  const upcoming = activities.entries.filter((item) => !item.record).sort((a, b) => a.planned!.startAt - b.planned!.startAt).slice(0, 3);
  return <View style={{ marginTop: 20, gap: 10 }}>
    <CardioTrainingHome />
    <Pressable accessibilityRole="button" accessibilityLabel={t('cardioPlan.create')} onPress={() => router.push('/cardio-plan')}
      style={{ ...surfaces.hero, padding: 20, borderRadius: radius.lg, minHeight: 100, justifyContent: 'center', gap: 8 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 23, fontWeight: '700' }}>{t('cardioPlan.create')} ›</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cardioPlan.foundation')}</Text>
    </Pressable>
    <SavedCardioPlans />
    <View style={{ ...surfaces.hero, padding: 20, borderRadius: radius.lg, gap: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 23, fontWeight: '700' }}>{t('sportActivities.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('sportActivities.intro')}</Text>
      {(['PLAN', 'RECORD'] as const).map((mode) => <Pressable key={mode} accessibilityRole="button" accessibilityLabel={t(`sportActivities.${mode === 'PLAN' ? 'plan' : 'record'}`)}
        onPress={() => router.push({ pathname: '/activity-editor', params: { mode } })} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: colors.accentText, fontSize: 17, fontWeight: '600' }}>+ {t(`sportActivities.${mode === 'PLAN' ? 'plan' : 'record'}`)}</Text>
      </Pressable>)}
    </View>
    {upcoming.map((activity) => <SportActivityCard key={activity.id} activity={activity} onPress={() => router.push({ pathname: '/activity', params: { id: activity.id } })} />)}
    {activities.error && <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('sportActivities.loadFailed')}</Text>}
    <Pressable accessibilityRole="button" onPress={() => router.push('/activities')} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ color: colors.accentText, fontSize: 17 }}>{t('sportActivities.viewAll')} ›</Text>
    </Pressable>
  </View>;
}
