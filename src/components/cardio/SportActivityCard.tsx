import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { SportActivity } from '@/models/sportActivity';
import { sportActivityMinutes, sportActivityStart } from '@/services/cardio/sportActivities';
import { sessionEffortValue } from '@/services/training/sessionFeedback';
import { useTheme } from '@/theme/useTheme';

export function SportActivityCard({ activity, onPress }: { activity: SportActivity; onPress: () => void }) {
  const { t, i18n } = useTranslation(); const { colors, surfaces, radius } = useTheme();
  const effort = sessionEffortValue(activity.record?.feedback);
  const title = activity.name || t(`sportActivities.sports.${activity.sport}`);
  const timeZone = (activity.record ?? activity.planned)!.timeZone;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, marginVertical: 6, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={26} height={26} viewBox="0 0 24 24"><Path d="M2 12h4l3-7 5 14 3-7h5" fill="none" stroke={colors.accentText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
    </View>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600' }}>{title}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(sportActivityStart(activity))}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t(`sportActivities.${activity.record ? 'recorded' : 'planned'}`)} · {t('sportActivities.minutes', { value: sportActivityMinutes(activity) })}{effort !== null ? ` · ${effort}/10` : ''}</Text>
    </View>
    <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
  </Pressable>;
}
