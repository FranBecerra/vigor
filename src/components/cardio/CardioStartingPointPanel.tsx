import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NumericField } from '@/components/train/NumericField';
import { CheckIcon, InfoIcon } from '@/components/icons/ActionIcons';
import { useTheme } from '@/theme/useTheme';
import type { CardioHealthRead } from '@/models/cardioHealth';
import { proposeCardioStartingPoint, type CardioStartContext } from '@/services/cardio/cardioStartingPoint';
import { acceptReviewedCardioStart, type ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';

/** Optional local preview after history review. No repository, router or Health read. */
export function CardioStartingPointPanel({ data, observedAt, sourceId, excludedIds, onPlan }: {
  data: CardioHealthRead; observedAt: number; sourceId?: string; excludedIds: readonly string[]; onPlan?: (baseline: ReviewedCardioStart) => void;
}) {
  const { t } = useTranslation(), { colors, surfaces, radius, semantic, sectionAccent } = useTheme();
  const [open, setOpen] = useState(false), [details, setDetails] = useState(false), [calculated, setCalculated] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const [answers, setAnswers] = useState<Partial<CardioStartContext>>({ modality: 'RUNNING', response: 'UNKNOWN',
    cycleDays: 7, maxSessions: 2, maxSessionMinutes: 40, totalMinutes: 80 });
  const patch = (value: Partial<CardioStartContext>) => { setAnswers(old => ({ ...old, ...value })); setCalculated(false); setApplyError(false); };
  const text = { color: colors.textPrimary, fontSize: 17 }, caption = { color: colors.textSecondary, fontSize: 14, lineHeight: 21 };
  const action = (key: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={t(`cardioStart.${key}`)} onPress={onPress}
    style={{ ...surfaces.field, minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: radius.md, marginTop: 10 }}>
    <Text style={{ ...text, color: colors.accentText, fontWeight: '600' }}>{t(`cardioStart.${key}`)}</Text>
  </Pressable>;
  const result = calculated ? proposeCardioStartingPoint(data, observedAt, Date.now(), answers as CardioStartContext, sourceId, excludedIds) : null;
  if (!open) return action('open', () => setOpen(true));
  return <View style={{ ...surfaces.card, padding: 18, borderRadius: radius.lg, gap: 12, marginVertical: 14 }}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Text accessibilityRole="header" style={{ ...text, fontSize: 21, fontWeight: '700', flex: 1 }}>{t('cardioStart.title')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cardioStart.info')} onPress={() => setDetails(v => !v)}
        style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><InfoIcon size={22} color={colors.accentText} /></Pressable>
    </View>
    <Text style={caption}>{t(onPlan ? 'healthPlanning.previewOnly' : 'cardioStart.previewOnly')}</Text>
    {details && <Text style={caption}>{t('cardioStart.method')}</Text>}
    <View accessibilityRole="radiogroup">{(['RUNNING', 'CYCLING'] as const).map(modality => <Pressable key={modality} accessibilityRole="radio"
      accessibilityLabel={t(`cardioPlan.${modality}`)} accessibilityState={{ selected: answers.modality === modality }} onPress={() => patch({ modality, representative: undefined, response: 'UNKNOWN', comfortableMinutes: undefined })}
      style={{ minHeight: 48, padding: 12, borderRadius: radius.md, backgroundColor: answers.modality === modality ? colors.accentTint : 'transparent' }}>
      <Text style={{ ...text, fontWeight: answers.modality === modality ? '700' : '400' }}>{t(`cardioPlan.${modality}`)}</Text>
    </Pressable>)}</View>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={t('cardioStart.representative')} accessibilityState={{ checked: answers.representative === true }}
      onPress={() => patch({ representative: answers.representative !== true })} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View accessible={false} style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.accentText,
        backgroundColor: answers.representative ? sectionAccent.train : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {answers.representative && <CheckIcon size={18} color={colors.onAccent} />}
      </View><Text style={{ ...text, flex: 1 }}>{t('cardioStart.representative')}</Text>
    </Pressable>
    <Text style={{ ...text, fontWeight: '600' }}>{t('cardioStart.response')}</Text>
    {(['RECOVERED', 'DIFFICULT', 'DISCOMFORT', 'UNKNOWN'] as const).map(response => <Pressable key={response} accessibilityRole="radio"
      accessibilityLabel={t(`cardioStart.response_${response}`)} accessibilityState={{ selected: answers.response === response }} onPress={() => patch({ response })}
      style={{ minHeight: 48, padding: 12, borderRadius: radius.md, backgroundColor: answers.response === response ? colors.accentTint : 'transparent' }}>
      <Text style={{ ...text, fontWeight: answers.response === response ? '700' : '400' }}>{t(`cardioStart.response_${response}`)}</Text>
    </Pressable>)}
    {(['comfortableMinutes', 'cycleDays', 'maxSessions', 'maxSessionMinutes', 'totalMinutes'] as const).map(field => <View key={field} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <Text style={{ ...text, flex: 1 }}>{t(`cardioStart.${field}`)}</Text>
      <View style={{ width: 86 }}><NumericField compact value={answers[field]} accessibilityLabel={t(`cardioStart.${field}`)} onChangeValue={value => patch({ [field]: value })} /></View>
    </View>)}
    {action('calculate', () => setCalculated(true))}
    {result && (result.state === 'READY' ? <View accessibilityLiveRegion="polite" style={{ ...surfaces.field, padding: 16, borderRadius: radius.md, gap: 10 }}>
      <Text style={{ ...text, fontSize: 23, fontWeight: '700', color: colors.accentText }}>{t('cardioStart.proposal', { sessions: result.sessions, minutes: result.sessionMinutes, days: result.cycleDays })}</Text>
      <Text style={text}>{t('cardioStart.total', { minutes: result.totalMinutes })}</Text>
      <Text style={caption}>{t('cardioStart.observed', { count: result.observedSessions, duration: Math.round(result.typicalMinutes * 10) / 10 })}</Text>
      {result.cappedBy.map(reason => <Text key={reason} style={caption}>{t(`cardioStart.cap_${reason}`)}</Text>)}
      <Text style={caption}>{t('cardioStart.easy')}</Text>
      {onPlan && <>
        <Text style={caption}>{t('healthPlanning.handoff')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('healthPlanning.use')} onPress={() => {
          try { const baseline = acceptReviewedCardioStart(data, observedAt, Date.now(), answers as CardioStartContext, sourceId, excludedIds); onPlan(baseline); }
          catch { setApplyError(true); }
        }} style={{ ...surfaces.primary, minHeight: 48, padding: 14, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...text, color: colors.onAccent, fontWeight: '600' }}>{t('healthPlanning.use')}</Text>
        </Pressable>
      </>}
    </View> : <Text accessibilityRole="alert" style={{ ...text, color: semantic.warning }}>{t(`cardioStart.issue_${result.state}`)}</Text>)}
    {applyError && <Text accessibilityRole="alert" style={{ ...text, color: semantic.warning }}>{t('healthPlanning.expired')}</Text>}
    {action('close', () => { setOpen(false); setCalculated(false); })}
  </View>;
}
