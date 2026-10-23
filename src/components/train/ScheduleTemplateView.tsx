import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { ScheduleTemplate } from '@/services/training/scheduleTemplate';
import { sessionNames } from '@/services/training/routineView';
import type { PlannedSession } from '@/models';

export function ScheduleTemplateView({ template, sessions, onMoveRest }: {
  template: ScheduleTemplate; sessions: readonly PlannedSession[]; onMoveRest?: (from: number, to: number) => void;
}) {
  const { t } = useTranslation(); const { colors, spacing, typography } = useTheme();
  const names = sessionNames(sessions, (focus) => t(`generate.focus${focus}`));
  return <View style={{ gap: spacing.sm, marginVertical: spacing.sm }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('calendar.cycleOrder')}</Text>
    <View style={{ borderRadius: 16, backgroundColor: colors.bgElevated, paddingHorizontal: spacing.md }}>
      {template.slots.map((slot, index) => <View key={index} style={{ minHeight: 52, alignItems: 'center',
        borderBottomWidth: index === template.days - 1 ? 0 : 1, borderColor: colors.surfaceBorder, flexDirection: 'row', gap: spacing.md }}>
        <Text style={{ width: 28, color: colors.textMuted, fontVariant: ['tabular-nums'], fontSize: 14 }}>{index + 1}</Text>
        {slot.kind === 'rest' && onMoveRest && index > 0 && <Pressable accessibilityRole="button"
          accessibilityLabel={t('calendar.moveRestEarlier')} onPress={() => onMoveRest(index, index - 1)}>
          <Text style={{ color: colors.textPrimary }}>‹</Text></Pressable>}
        <Text style={{ flex: 1, fontSize: 16, fontWeight: slot.kind === 'rest' ? '400' : '600', color: slot.kind === 'rest' ? colors.textMuted : colors.textPrimary }}>
          {slot.kind === 'rest' ? t('calendar.rest')
            : names[sessions.findIndex((session) => session.index === slot.sessionIndex)] ?? t('calendar.session', { number: slot.sessionIndex + 1 })}
        </Text>
        {slot.kind === 'rest' && onMoveRest && index < template.days - 1 && <Pressable accessibilityRole="button"
          accessibilityLabel={t('calendar.moveRestLater')} onPress={() => onMoveRest(index, index + 1)}>
          <Text style={{ color: colors.textPrimary }}>›</Text></Pressable>}
      </View>)}
    </View>
  </View>;
}
