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
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('calendar.templateSummary', {
      days: template.days, rest: template.slots.filter((s) => s.kind === 'rest').length,
    })}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {template.slots.map((slot, index) => <View key={index} style={{ borderWidth: 1,
        borderColor: colors.surfaceBorder, borderRadius: 10, padding: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
        {slot.kind === 'rest' && onMoveRest && index > 0 && <Pressable accessibilityRole="button"
          accessibilityLabel={t('calendar.moveRestEarlier')} onPress={() => onMoveRest(index, index - 1)}>
          <Text style={{ color: colors.textPrimary }}>‹</Text></Pressable>}
        <Text style={[typography.caption, { color: slot.kind === 'rest' ? colors.textMuted : colors.textPrimary }]}>
          {index + 1} · {slot.kind === 'rest' ? t('calendar.rest')
            : names[slot.sessionIndex] ?? t('calendar.session', { number: slot.sessionIndex + 1 })}
        </Text>
        {slot.kind === 'rest' && onMoveRest && index < template.days - 1 && <Pressable accessibilityRole="button"
          accessibilityLabel={t('calendar.moveRestLater')} onPress={() => onMoveRest(index, index + 1)}>
          <Text style={{ color: colors.textPrimary }}>›</Text></Pressable>}
      </View>)}
    </View>
    <Text style={[typography.caption, { color: colors.textMuted }]}>{t('calendar.templateDescription')}</Text>
  </View>;
}
