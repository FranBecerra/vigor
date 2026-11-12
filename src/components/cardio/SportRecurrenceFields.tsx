import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumericField } from '@/components/train/NumericField';
import type { SportRepeatRule } from '@/models/sportActivity';
import { previewSportRecurrence, sportLocalDate, sportLocalWeekday } from '@/services/cardio/sportRecurrence';
import { shiftCalendarDate } from '@/services/training/trainingCalendar';
import { useTheme } from '@/theme/useTheme';

export function SportRecurrenceFields({ rule, startAt, timeZone, disabled, onChange, onPickUntil }: {
  rule: SportRepeatRule | undefined; startAt: number; timeZone: string; disabled: boolean;
  onChange: (rule: SportRepeatRule | undefined) => void; onPickUntil: () => void;
}) {
  const { t, i18n } = useTranslation(); const { colors, surfaces, radius, semantic } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const { preview, problem } = useMemo(() => {
    if (!rule) return { preview: null, problem: null };
    try { return { preview: previewSportRecurrence(startAt, timeZone, rule), problem: null }; }
    catch (cause) { return { preview: null, problem: cause instanceof Error && cause.message === 'sportRecurrenceTooLarge' ? 'sportRepeat.tooMany' : 'sportRepeat.invalid' }; }
  }, [rule, startAt, timeZone]);
  const text = { color: colors.textPrimary, fontSize: 17 };
  const choose = (frequency: SportRepeatRule['frequency'] | 'NONE') => {
    if (frequency === 'NONE') { onChange(undefined); return; }
    onChange({ frequency, interval: 1, untilDate: rule?.untilDate ?? shiftCalendarDate(sportLocalDate(startAt, timeZone), frequency === 'MONTHLY' ? 183 : 56),
      ...(frequency === 'WEEKLY' ? { weekdays: [sportLocalWeekday(startAt, timeZone)] } : {}) });
  };
  const civilDate = (date: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(Date.parse(`${date}T12:00:00Z`));
  return <View style={{ ...surfaces.card, borderRadius: radius.lg, padding: 16, gap: 14 }}>
    <Text style={[text, { fontWeight: '600' }]}>{t('sportRepeat.title')}</Text>
    <View accessibilityRole="radiogroup">
      {(['NONE', 'WEEKLY', 'MONTHLY'] as const).map((frequency) => {
        const selected = (rule?.frequency ?? 'NONE') === frequency;
        return <Pressable key={frequency} accessibilityRole="radio" accessibilityLabel={t(`sportRepeat.${frequency}`)} disabled={disabled}
          accessibilityState={{ selected, disabled }} onPress={() => choose(frequency)}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View accessible={false} style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.accentText : colors.surfaceBorder,
            alignItems: 'center', justifyContent: 'center' }}>{selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentText }} />}</View>
          <Text style={text}>{t(`sportRepeat.${frequency}`)}</Text>
        </Pressable>;
      })}
    </View>
    {rule && <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Text style={[text, { flex: 1 }]}>{t(rule.frequency === 'WEEKLY' ? 'sportRepeat.everyWeeks' : 'sportRepeat.everyMonths')}</Text>
        <View style={{ width: 85 }}><NumericField compact value={Number.isFinite(rule.interval) ? rule.interval : undefined}
          accessibilityLabel={t('sportRepeat.interval')} editable={!disabled} onChangeValue={(interval) => onChange({ ...rule, interval: interval ?? NaN })} /></View>
      </View>
      {rule.frequency === 'WEEKLY' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
          const selected = rule.weekdays!.includes(weekday);
          const title = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 10, 1 + weekday, 12));
          return <Pressable key={weekday} accessibilityRole="checkbox" accessibilityLabel={title} accessibilityState={{ checked: selected, disabled }} disabled={disabled}
            onPress={() => onChange({ ...rule, weekdays: [0, 1, 2, 3, 4, 5, 6].filter((day) => day === weekday ? !selected : rule.weekdays!.includes(day)) })}
            style={{ ...surfaces.field, minHeight: 48, minWidth: 55, padding: 10, borderRadius: radius.md, borderWidth: 1,
              borderColor: selected ? colors.accentText : colors.surfaceBorder, backgroundColor: selected ? colors.accentTint : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: selected ? colors.accentText : colors.textPrimary, fontSize: 16, fontWeight: selected ? '600' : '400' }}>{title}</Text>
          </Pressable>;
        })}
      </View>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('sportRepeat.until')} disabled={disabled} onPress={onPickUntil}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={text}>{t('sportRepeat.until')}</Text><Text style={{ color: colors.accentText, fontSize: 16 }}>{civilDate(rule.untilDate)} ›</Text>
      </Pressable>
      {preview && <View style={{ gap: 8 }}>
        <Text style={[text, { fontWeight: '600' }]}>{t('sportRepeat.preview', { count: preview.starts.length })}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>{(showAll ? preview.starts : preview.starts.slice(0, 3)).map((start) =>
          new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(start)).join('\n')}</Text>
        {preview.starts.length > 3 && <Pressable accessibilityRole="button" accessibilityLabel={t(showAll ? 'sportRepeat.fewerDates' : 'sportRepeat.allDates')}
          disabled={disabled} onPress={() => setShowAll(!showAll)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText, fontSize: 16 }}>{t(showAll ? 'sportRepeat.fewerDates' : 'sportRepeat.allDates')}</Text>
        </Pressable>}
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('sportRepeat.last', { date: civilDate(sportLocalDate(preview.starts[preview.starts.length - 1], timeZone)) })}</Text>
      </View>}
      <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>{t(rule.frequency === 'MONTHLY' ? 'sportRepeat.monthlyHint' : 'sportRepeat.weeklyHint')}</Text>
      {!!preview?.skippedDates.length && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('sportRepeat.dstSkipped', { count: preview.skippedDates.length })}</Text>}
      {problem && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t(problem)}</Text>}
    </>}
  </View>;
}
