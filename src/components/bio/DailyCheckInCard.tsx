import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DAILY_CHECK_IN_FIELDS } from '@/services/bio/dailyCheckIn';
import { useDailyCheckIn } from '@/hooks/useDailyCheckIn';
import { useTheme } from '@/theme/useTheme';
import { DailyCheckInSheet } from './DailyCheckInSheet';
export { DailyCheckInSheet } from './DailyCheckInSheet';

export function DailyCheckInCard() {
  const checkIn = useDailyCheckIn();
  const { t } = useTranslation();
  const { colors, surfaces, typography, radius } = useTheme();
  const [editing, setEditing] = useState<{ owner: string | null; date: string } | null>(null);
  useEffect(() => setEditing(null), [checkIn.owner, checkIn.date]);
  return <View style={{ ...surfaces.bio, backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: 20, marginBottom: 16, gap: 14 }}>
    <Text style={[typography.caption, { color: colors.bioText }]}>{t('bio.today')}</Text>
    <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('dailyCheckIn.title')}</Text>
    {checkIn.entry ? <View style={{ gap: 10 }}>
      {DAILY_CHECK_IN_FIELDS.filter((field) => checkIn.entry!.answers[field] !== undefined).map((field) => <View key={field} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`dailyCheckIn.${field}`)}</Text>
        <Text style={[typography.body, { color: field === 'discomfort' && checkIn.entry!.answers[field] === 'PRESENT' ? colors.textPrimary : colors.bioText,
          fontWeight: '600' }]}>{t(`dailyCheckIn.${checkIn.entry!.answers[field]}`)}</Text>
      </View>)}
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('dailyCheckIn.subjective')}</Text>
      {checkIn.pending && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('custom.pending')}</Text>}
    </View> : <Text style={[typography.body, { color: colors.textSecondary }]}>{t('dailyCheckIn.intro')}</Text>}
    {checkIn.error ? <>
      <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bio.loadError')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('bio.retry')} onPress={checkIn.reload} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={[typography.title, { color: colors.bioText }]}>{t('bio.retry')}</Text>
      </Pressable>
    </> : <Pressable accessibilityRole="button" accessibilityLabel={t(checkIn.entry ? 'dailyCheckIn.edit' : 'dailyCheckIn.start')}
      accessibilityState={{ disabled: !checkIn.ready || !checkIn.owner }} disabled={!checkIn.ready || !checkIn.owner}
      onPress={() => setEditing({ owner: checkIn.owner, date: checkIn.date })}
      style={{ minHeight: 48, justifyContent: 'center', opacity: checkIn.ready ? 1 : 0.5 }}>
      <Text style={[typography.title, { color: colors.bioText }]}>{t(checkIn.entry ? 'dailyCheckIn.edit' : 'dailyCheckIn.start')} →</Text>
    </Pressable>}
    {editing && editing.owner === checkIn.owner && editing.date === checkIn.date && <DailyCheckInSheet key={`${editing.owner}:${editing.date}`}
      initial={checkIn.entry?.answers ?? {}} onClose={() => setEditing(null)} onSave={checkIn.save}
      unavailable={!checkIn.ready || checkIn.error} onRetry={checkIn.reload} />}
  </View>;
}
