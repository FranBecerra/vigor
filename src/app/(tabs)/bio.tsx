import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useBioHistory } from '@/hooks/useBioHistory';
import { useMicrocycleReviews } from '@/hooks/useMicrocycleReviews';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useTheme } from '@/theme/useTheme';
import { bioCycleExposure, buildBioCycles } from '@/services/bio/microcycleReview';
import { MicrocycleReviewSheet } from '@/components/bio/MicrocycleReviewSheet';
import type { MicrocycleReview } from '@/models/microcycleReview';
import { BioHealthCard } from '@/components/bio/BioHealthCard';
import { useBioHealth } from '@/hooks/useBioHealth';
import { BioEvolution } from '@/components/bio/BioEvolution';
import { BioVolumeReview } from '@/components/bio/BioVolumeReview';
import { reviewVolumeResponse } from '@/services/bio/volumeResponse';
import { useBioNight } from '@/hooks/useBioNight';
import { BioNightDetailsSheet } from '@/components/bio/BioNightDetailsSheet';
import { useBioReadiness } from '@/hooks/useBioReadiness';
import { BioReadinessCard } from '@/components/bio/BioReadinessCard';
import { useBioSessionContext } from '@/hooks/useBioSessionContext';
import { BioSessionContextCard } from '@/components/bio/BioSessionContextCard';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function BioScreen() {
  const { t, i18n } = useTranslation(), { uid } = useAuth();
  const { surfaces, colors, typography, radius, spacing, semantic } = useTheme();
  const insets = useSafeAreaInsets();
  const data = useBioHistory(), reviews = useMicrocycleReviews();
  const health = useBioHealth();
  const preferences = useAppSettings();
  const night = useBioNight();
  const readiness = useBioReadiness(night);
  const { exercisesById } = useExerciseCatalogue();
  const sessionLabels = useMemo(() => ({ focus: (focus: import('@/models').PlannedSessionFocus) => t(`generate.focus${focus}`),
    goal: (goal: string) => goal }), [t]);
  const sessionContext = useBioSessionContext(data, reviews, exercisesById, readiness, sessionLabels);
  const params = useLocalSearchParams<{ mesocycleId?: string }>();
  const [tab, setTab] = useState<'TODAY' | 'RESPONSE'>(params.mesocycleId ? 'RESPONSE' : 'TODAY');
  const [selected, setSelected] = useState<string | null>(params.mesocycleId ?? null);
  const [editing, setEditing] = useState<{ id: string; owner: string } | null>(null);
  const [actionError, setActionError] = useState(false);
  const [nightDetailsOwner, setNightDetailsOwner] = useState<string | null>(null);
  const nightOff = night.state === 'OFF';
  const nightDetails = !!uid && nightDetailsOwner === uid && tab === 'TODAY' && !nightOff;
  useEffect(() => { setNightDetailsOwner(null); }, [uid, tab, nightOff]);
  useEffect(() => {
    if (params.mesocycleId) { setSelected(params.mesocycleId); setTab('RESPONSE'); }
  }, [params.mesocycleId]);
  useFocusEffect(useCallback(() => {
    if (tab !== 'RESPONSE') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setTab('TODAY'); return true; });
    return () => listener.remove();
  }, [tab]));
  const cycles = useMemo(() => uid ? buildBioCycles(uid, data.plans, data.history, Date.now()) : [], [uid, data.plans, data.history]);
  const planId = data.plans.some((plan) => plan.id === selected) ? selected
    : data.plans.find((plan) => plan.status === 'ACTIVE' || plan.status === 'DELOAD')?.id ?? data.plans[0]?.id;
  const visible = cycles.filter((cycle) => cycle.mesocycleId === planId);
  const doseReview = useMemo(() => {
    const plan = data.plans.find((plan) => plan.id === planId);
    return uid && plan && reviews.ready && !reviews.error && !data.error
      ? reviewVolumeResponse(uid, plan, data.history, reviews.entries, exercisesById, Date.now()) : [];
  }, [uid, data.plans, data.history, data.error, reviews.ready, reviews.error, reviews.entries, exercisesById, planId]);
  const reviewMap = new Map(reviews.entries.map((entry) => [entry.id, entry]));
  const latestClosed = visible.filter((cycle) => cycle.closed).sort((a, b) => b.index - a.index)[0];
  const pending = latestClosed && !reviewMap.has(latestClosed.id) ? latestClosed : undefined;
  const editingCycle = editing?.owner === uid ? cycles.find((cycle) => cycle.id === editing.id && cycle.closed) : undefined;
  const titleFor = (id: string) => data.routines.find((routine) => routine.id === data.plans.find((plan) => plan.id === id)?.routineId)?.name ?? t('bio.program');
  const date = (time: number) => Number.isFinite(time) && !Number.isNaN(new Date(time).getTime())
    ? new Date(time).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language) : '—';
  const button = (label: string, onPress: () => void, selected = false, disabled = false) => <Pressable key={label}
    accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', borderRadius: radius.md,
      borderWidth: 1, borderColor: selected ? colors.bioText : colors.surfaceBorder, backgroundColor: selected ? colors.bioTint : colors.bgElevated }}>
    <Text style={[typography.title, { color: selected ? colors.bioText : colors.textPrimary }]}>{label}</Text>
  </Pressable>;
  const card = { ...surfaces.bio, backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: 20, marginBottom: 16 };
  const feedback = (review: MicrocycleReview) => <View style={{ gap: 8, marginTop: 14 }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bio.yourReview')}</Text>
    {review.answers.recovery && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.recoverySummary', { value: t(`bio.recovery.${review.answers.recovery}`) })}</Text>}
    {review.answers.unrecoveredMuscles && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.muscleSummary', {
      value: review.answers.unrecoveredMuscles.length ? review.answers.unrecoveredMuscles.map((muscle) => t(`muscle.${muscle}`)).join(' · ') : t('bio.none'),
    })}</Text>}
    {review.answers.discomfort && <Text style={[typography.body, { color: review.answers.discomfort === 'PRESENT' ? semantic.warning : colors.textSecondary }]}>
      {t('bio.discomfortSummary', { value: t(`bio.discomfort.${review.answers.discomfort}`) })}
      {review.answers.discomfortMuscles?.length ? ` · ${review.answers.discomfortMuscles.map((muscle) => t(`muscle.${muscle}`)).join(' · ')}` : ''}
    </Text>}
    {review.answers.sustainability && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.sustainableSummary', { value: t(`bio.sustainability.${review.answers.sustainability}`) })}</Text>}
    {!!review.answers.context?.length && <Text style={[typography.body, { color: colors.textSecondary }]}>{review.answers.context.map((value) => t(`bio.context.${value}`)).join(' · ')}</Text>}
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bio.reportedOn', { date: date(review.updatedAt) })}</Text>
  </View>;
  return <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <FlatList key={tab} data={tab === 'RESPONSE' ? visible : []} keyExtractor={(item) => item.id} initialNumToRender={8}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}
      ListHeaderComponent={<>
        {tab === 'RESPONSE' && <Pressable accessibilityRole="button" accessibilityLabel={t('bio.today')} onPress={() => setTab('TODAY')}
          style={{ minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: 8 }}>
          <Text style={[typography.title, { color: colors.bioText }]}>‹ {t('tabs.bio')}</Text>
        </Pressable>}
        <Text style={[typography.emphasis, { color: colors.textPrimary, marginBottom: 20 }]}>{t(tab === 'TODAY' ? 'tabs.bio' : 'bio.response')}</Text>
        {(data.error || reviews.error || actionError) && <View style={card}><Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bio.loadError')}</Text>
          {data.error && button(t('bio.retry'), data.reload)}
        </View>}
        {tab === 'TODAY' ? <>
          <BioReadinessCard view={readiness} />
          <BioHealthCard health={health} sleepGoalMinutes={preferences.ready ? preferences.settings.bioSleepGoalMinutes : undefined} />
          <BioSessionContextCard view={sessionContext} />
          {!nightOff && <View testID="bio-night-details-trigger" style={{ marginBottom: spacing.lg }}>
            {button(t('bioSummary.nightDetails'), () => setNightDetailsOwner(uid))}
          </View>}
          {pending && reviews.ready && !reviews.error && <View style={card}>
            <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 8 }]}>{t('bio.reviewAvailable')}</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 14 }]}>{titleFor(pending.mesocycleId)} · {t('bio.cycle', { count: pending.index + 1 })}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {button(t('bio.review'), () => setEditing({ id: pending.id, owner: uid! }))}
              {button(t('bio.seeResponse'), () => { setSelected(pending.mesocycleId); setTab('RESPONSE'); })}
            </View>
          </View>}
          <Pressable accessibilityRole="button" accessibilityLabel={t('bio.seeResponse')} onPress={() => setTab('RESPONSE')}
            style={[card, { minHeight: 88, gap: 8 }]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Text style={[typography.h2, { flex: 1, color: colors.textPrimary }]}>{t('bio.yourContext')}</Text>
              <Text style={[typography.h2, { color: colors.bioText }]}>›</Text>
            </View>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.contextIntro')}</Text>
          </Pressable>
        </> : <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            {data.plans.map((plan) => <View key={plan.id}>{button(`${titleFor(plan.id)} · ${date(typeof plan.startedAt === 'number' ? plan.startedAt : plan.startedAt?.seconds * 1000)}`,
              () => setSelected(plan.id), plan.id === planId)}</View>)}
          </ScrollView>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 16 }]}>{t('bio.responseIntro')}</Text>
          <BioEvolution key={`${uid}:${planId}`} owner={uid} history={data.history.filter((workout) => workout.mesocycleId === planId)} catalogue={exercisesById} />
          <BioVolumeReview items={doseReview} />
          {data.ready && !data.error && visible.length === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bio.empty')}</Text>}
        </>}
      </>}
      renderItem={({ item: cycle }) => {
        const exposure = bioCycleExposure(cycle, exercisesById), review = reviewMap.get(cycle.id);
        return <View style={card}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
            <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bio.cycle', { count: cycle.index + 1 })}</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t(cycle.closed ? 'bio.closed' : 'bio.inProgress')}</Text>
          </View>
          {cycle.observedFrom !== null && cycle.observedTo !== null && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
            {t('bio.observedDates', { from: date(cycle.observedFrom), to: date(cycle.observedTo) })}
          </Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 16 }}>
            {[[exposure.workouts, t('bio.workouts')], [exposure.workingSets, t('bio.workingSets')], [exposure.minutes, t('bio.minutes')]].map(([value, label]) => <View key={label}>
              <Text style={[typography.h2, { color: colors.accentText }]}>{value}</Text><Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
            </View>)}
          </View>
          {cycle.skippedSlots > 0 && <Text style={[typography.body, { color: colors.textSecondary, marginTop: 10 }]}>{t('bio.skipped', { count: cycle.skippedSlots })}</Text>}
          {review?.status === 'SUBMITTED' && feedback(review)}
          {cycle.closed && <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {button(t(review?.status === 'SUBMITTED' ? 'bio.editReview' : 'bio.review'), () => setEditing({ id: cycle.id, owner: uid! }), false, !reviews.ready || reviews.error)}
            {!review && button(t('bio.skip'), () => { setActionError(false); void reviews.save(cycle, {}, 'DISMISSED').catch(() => setActionError(true)); }, false, !reviews.ready || reviews.error)}
          </View>}
          {review?.status === 'DISMISSED' && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{t('bio.reviewSkipped')}</Text>}
        </View>;
      }} />
    {nightDetails && <BioNightDetailsSheet night={night} onClose={() => setNightDetailsOwner(null)} />}
    {editingCycle && <MicrocycleReviewSheet key={`${uid}:${editingCycle.id}`} cycleNumber={editingCycle.index + 1}
      initial={reviewMap.get(editingCycle.id)?.answers ?? {}} onClose={() => setEditing(null)}
      onSave={(answers) => reviews.save(editingCycle, answers)}
      onSkip={() => reviews.save(editingCycle, {}, 'DISMISSED')} />}
  </View>;
}
