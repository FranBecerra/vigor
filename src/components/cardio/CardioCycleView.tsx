import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { RoutineDayIndicator } from '@/components/home/RoutineDayIndicator';
import { SportActivityIcon } from '@/components/icons/SportActivityIcon';
import { InfoIcon } from '@/components/icons/ActionIcons';
import type { EasyCardioPrescription } from '@/models/cardio';
import type { CardioPreview, CardioPreviewInput } from '@/services/cardio/cardioPreview';

const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The same immutable cycle and session detail in preview and saved proposals. */
export function CardioCycleView({ input, preview }: { input: CardioPreviewInput; preview: CardioPreview }) {
  const { t } = useTranslation(); const { colors, surfaces, radius, semantic } = useTheme(); const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<EasyCardioPrescription | null>(null);
  const [basisVisible, setBasisVisible] = useState(false);
  const text = { color: colors.textPrimary, fontSize: 16 }, caption = { color: colors.textSecondary, fontSize: 13, lineHeight: 19 };
  return <>
    <View style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, marginBottom: 14 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>{t('cardioPlan.days', { count: input.cycleDays })}</Text>
      <Text style={[caption, { marginTop: 8 }]}>{t('cardioPlan.summary', { sessions: preview.scheduled.length, minutes: preview.usedMinutes, budget: input.cardioMinutes })}</Text>
      {!!input.strength.length && <Text style={caption}>{t('cardioPlan.strengthFrequency', { count: input.strength.length, days: input.cycleDays })}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <Text style={[caption, { flex: 1 }]}>{t(input.healthBaseline ? 'healthPlanning.source' : 'editorFlow.cardioSource')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('editorFlow.cardioWhy')} onPress={() => setBasisVisible(true)}
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><InfoIcon color={colors.textSecondary} size={22} /></Pressable>
      </View>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{preview.days.map(day => <View key={day.dayIndex} style={{ width: '48%', ...surfaces.card, padding: 14, borderRadius: radius.md, minHeight: 100 }}>
      <Text style={[caption, { marginBottom: 10 }]}>{t('cardioPlan.day', { day: day.dayIndex + 1 })}</Text>
      {day.strength.map(s => <View key={s.id} style={{ gap: 8, marginBottom: 10 }}><RoutineDayIndicator /><Text style={[text, { fontWeight: '600' }]}>{s.name}</Text></View>)}
      {day.cardio.map(s => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={t('cardioPlan.openSession', { day: day.dayIndex + 1, modality: t(`cardioPlan.${s.modality}`) })}
        onPress={() => setDetails(preview.prescriptions.find(p => p.id === s.id)!)} style={{ minHeight: 48, paddingVertical: 6 }}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginBottom: 8 }}><SportActivityIcon sport={s.modality} color={colors.accentText} /></View>
        <Text style={{ color: colors.bioText, fontSize: 16, fontWeight: '600' }}>{t(`cardioPlan.${s.modality}`)} ›</Text><Text style={caption}>{s.durationMinutes} min</Text>
      </Pressable>)}
      {!day.strength.length && !day.cardio.length && <View style={{ gap: 8 }}><RoutineDayIndicator kind="rest" /><Text style={text}>{t('calendar.rest')}</Text></View>}
    </View>)}</View>
    {preview.omitted.map(item => <Text key={item.candidateId} accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 12 }}>{t(`cardioPlan.omitted_${item.reason}`)}</Text>)}
    {preview.closeDemandingSessions && <Text style={{ color: semantic.warning, marginTop: 12 }}>{t('cardioPlan.overlap')}</Text>}
    <Modal visible={basisVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBasisVisible(false)}>
      <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: insets.bottom + 30 }}>
        <Pressable accessibilityRole="button" onPress={() => setBasisVisible(false)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 17 }}>{t('workout.done')}</Text></Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginVertical: 22 }}>{t('editorFlow.cardioWhy')}</Text>
        <Text style={[text, { lineHeight: 25 }]}>{t(input.healthBaseline ? 'healthPlanning.explanation' : 'editorFlow.cardioExplanation')}</Text>
        {input.healthBaseline && <Text style={[caption, { marginTop: 16 }]}>{t('healthPlanning.provenance', { date: new Date(input.healthBaseline.observedAt).toLocaleDateString(), count: input.healthBaseline.observedSessions })}</Text>}
      </ScrollView>
    </Modal>
    <Modal visible={details !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetails(null)}>
      <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: insets.bottom + 30 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('workout.done')} onPress={() => setDetails(null)} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ color: colors.accentText, fontSize: 17 }}>{t('workout.done')}</Text>
        </Pressable>
        {details && <>
          <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginVertical: 22 }}>{t(`cardioPlan.${details.modality}`)}</Text>
          <Text style={[text, { marginBottom: 12 }]}>{duration(details.durationSeconds)} · {t('cardioPlan.easyEffort')}</Text>
          <Text style={[caption, { marginBottom: 20 }]}>{t(details.basis === 'REVIEWED_HISTORY' ? 'healthPlanning.source' : details.basis === 'FAMILIARIZATION' ? 'cardioPlan.familiarization' : 'cardioPlan.currentPractice')}</Text>
          {details.segments.map(segment => <View key={segment.phase} style={{ ...surfaces.card, borderRadius: radius.lg, padding: 18, marginBottom: 14 }}>
            <Text style={[text, { fontWeight: '600', marginBottom: 12 }]}>{t(`cardioPlan.${segment.phase}`)}</Text>
            <Text style={text}>{duration(segment.durationSeconds)}</Text><Text style={caption}>{t('cardioPlan.effortRange', { min: segment.effort.min, max: segment.effort.max })}</Text>
          </View>)}
          <Text style={caption}>{t('cardioPlan.talkTest')}</Text>
          {details.allowWalking && <Text style={[caption, { marginTop: 10 }]}>{t('cardioPlan.walking')}</Text>}
        </>}
      </ScrollView>
    </Modal>
  </>;
}
