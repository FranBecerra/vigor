import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import type { BioSessionContextView } from '@/hooks/useBioSessionContext';

export function BioSessionContextCard({ view }: { view: BioSessionContextView }) {
  const { t, i18n } = useTranslation(), router = useRouter(), { colors, surfaces, radius, typography, semantic } = useTheme();
  const [details, setDetails] = useState(false), [picker, setPicker] = useState(false);
  const context = view.state === 'READY' ? view.context : undefined, target = context?.target;
  const date = (time: number) => new Date(time).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language);
  const button = (label: string, action: () => void, selected = false) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected }} onPress={action} style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 10 }}>
    <Text style={[typography.title, { color: colors.bioText }]}>{label}</Text>
  </Pressable>;
  return <View style={{ ...surfaces.bio, borderRadius: radius.lg, padding: 20, gap: 12, marginBottom: 16 }}>
    <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioSession.title')}</Text>
    {view.state === 'LOADING' && <ActivityIndicator color={colors.bioText} />}
    {view.state === 'ERROR' && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bio.loadError')}</Text>}
    {context && !target && <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioSession.status.${context.status}`)}</Text>}
    {context && target && <>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{target.name}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{target.routineName} · {t('bio.cycle', { count: target.microcycleIndex + 1 })}</Text>
      {target.restBefore && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSession.restBefore')}</Text>}
      <Text style={[typography.title, { color: context.prompts.length ? semantic.warning : colors.textPrimary }]}>{t(context.prompts.length ? 'bioSession.reviewContext' : 'bioSession.planUnchanged')}</Text>
      {context.prompts.map((prompt) => <Text key={prompt} style={[typography.body, { color: colors.textSecondary }]}>{t(`bioSession.prompt.${prompt}`)}</Text>)}
      {context.choices.length > 1 && button(t(picker ? 'bioSession.closePicker' : 'bioSession.choose'), () => setPicker(!picker))}
      {picker && context.choices.map((choice) => <View key={choice.index}>
        {button(choice.name, () => { view.select(choice.index); setPicker(false); }, target.session.index === choice.index)}
      </View>)}
      {button(t(details ? 'bioSession.hideDetails' : 'bioSession.details'), () => setDetails(!details))}
      {details && <View style={{ gap: 10 }}>
        <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioSession.general.${context.general.coverage}`)}</Text>
        {context.general.signals.map((signal) => <Text key={signal} style={[typography.body, { color: colors.textSecondary }]}>{t(`bioSession.signal.${signal}`)}</Text>)}
        <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bioSession.exposureTitle')}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioSession.exposureBoundary')}</Text>
        {!context.exposure.length && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSession.noMuscles')}</Text>}
        {context.exposure.map((entry) => <View key={entry.muscle} style={{ gap: 4, paddingVertical: 6 }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`muscle.${entry.muscle}`)}</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSession.exposure', { planned: entry.plannedSets, recent: entry.recentSets })}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{entry.lastAt === undefined ? t('bioSession.noRecentRecords') : t('bioSession.lastRecorded', { date: date(entry.lastAt) })}</Text>
        </View>)}
        {(context.unknownPlannedExercises > 0 || context.unknownRecentExercises > 0) && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSession.unknownMuscles', { planned: context.unknownPlannedExercises, recent: context.unknownRecentExercises })}</Text>}
        <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bioSession.performanceTitle')}</Text>
        {!context.dose.length && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSession.performanceMissing')}</Text>}
        {context.dose.map((entry) => <View key={entry.muscle} style={{ gap: 4 }}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`muscle.${entry.muscle}`)}</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioDose.${entry.reason}`)}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioDose.evidence', { count: entry.observations, cycles: entry.cycleIndexes.map((index) => index + 1).join(', ') })}</Text>
        </View>)}
        <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bioSession.reviewTitle')}</Text>
        {context.review ? <>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioSession.reviewDate', { cycle: context.review.microcycleIndex + 1,
            date: date(context.review.updatedAt), end: date(context.review.observedTo) })}</Text>
          {context.review.answers.discomfort && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.discomfortSummary', { value: t(`bio.discomfort.${context.review.answers.discomfort}`) })}</Text>}
          {context.review.answers.unrecoveredMuscles !== undefined && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.muscleSummary', {
            value: context.review.answers.unrecoveredMuscles.length ? context.review.answers.unrecoveredMuscles.map((muscle) => t(`muscle.${muscle}`)).join(', ') : t('bio.none'),
          })}</Text>}
        </> : <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioSession.reviewStatus.${context.reviewStatus}`)}</Text>}
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{context.policy}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioSession.boundary')}</Text>
      </View>}
      {button(t('bioSession.viewSession'), () => router.push({ pathname: '/routine', params: { mesocycleId: target.mesocycleId,
        goal: target.goal, microcycleIndex: String(target.microcycleIndex), plannedSessionIndex: String(target.session.index) } }))}
    </>}
  </View>;
}
