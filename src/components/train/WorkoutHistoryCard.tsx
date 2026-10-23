import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Exercise, WorkoutSession } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { formatSetVolume } from '@/services/training/sessionSummary';
import { timestampMillis } from '@/services/training/workoutRuntime';

export function WorkoutHistoryCard({ session, catalogue, onPress }: {
  session: WorkoutSession; catalogue: ReadonlyMap<string, Exercise>; onPress: () => void;
}) {
  const { t, i18n } = useTranslation(); const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const details = workoutHistoryDetails(session, catalogue);
  return <Pressable accessibilityRole="button" accessibilityLabel={session.sessionName || t('historyDetails.workout')} onPress={onPress}
    style={{ padding: spacing.lg, marginBottom: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgElevated }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{session.sessionName || t('historyDetails.workout')}</Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: 6 }]}>{new Date(timestampMillis(session.performedAt)).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
      </View><Text style={[typography.title, { color: colors.accentText }]}>›</Text>
    </View>
    <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>{details.working} {t('workout.workingSets')}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing.md }}>
      {details.volumes.map(({ muscle, sets }) => <View key={muscle} style={{ backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 9, minHeight: 26, justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, color: colors.textSecondary }}>{t(`muscle.${muscle}`)} <Text style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatSetVolume(sets)}</Text></Text>
      </View>)}
    </View>
    {!session.completedAt && <Text style={[typography.caption, { color: colors.accentText, marginTop: 8 }]}>{t('workout.inProgress')}</Text>}
  </Pressable>;
}
