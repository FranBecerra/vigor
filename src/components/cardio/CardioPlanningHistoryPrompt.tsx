import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCardioPlanningHistory, type CardioPlanningHistory } from './CardioPlanningHistoryContext';
import { CardioStartingPointPanel } from './CardioStartingPointPanel';
import { reviewCardioHealth } from '@/services/cardio/cardioHealthReview';
import { applyVigorStartingPoint, planningHistoryContext, vigorPlanningHistory } from '@/services/cardio/planningHistory';
import { acceptReviewedCardioStart, freshReviewedCardioStart, reviewedCardioDefaults, type ReviewedCardioStart } from '@/services/cardio/reviewedCardioStart';
import { readCardioPlanningPreference, writeCardioPlanningPreference } from '@/services/health/cardioPlanningPreference';
import type { CardioPreviewInput } from '@/services/cardio/cardioPreview';

/** No route change, permission request, workout write or automatic estimate acceptance. */
interface PromptProps { plain?: boolean; input: CardioPreviewInput; applied?: boolean; allowAutomatic?: boolean; onApply(input: CardioPreviewInput): void }
export function CardioPlanningHistoryPrompt({ plain = false, ...props }: PromptProps) {
  const history = useCardioPlanningHistory();
  return history ? <OwnedHistoryPrompt key={history.owner ?? 'signed-out'} history={history} plain={plain} {...props} /> : null;
}
function OwnedHistoryPrompt({ history, input, onApply, plain, applied, allowAutomatic }: PromptProps & { history: CardioPlanningHistory }) {
  const { t } = useTranslation(), { colors, surfaces, radius } = useTheme(), insets = useSafeAreaInsets();
  const [open, setOpen] = useState<'VIGOR' | 'HEALTH' | null>(null), [failed, setFailed] = useState(false);
  const [preference, setPreference] = useState(() => history.owner && history.automaticHealth ? readCardioPlanningPreference(history.owner) : {});
  const [preferenceError, setPreferenceError] = useState(false);
  const requested = useRef(false), appliedAutomatically = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const snapshot = useMemo(() => {
    if (!history.owner || !history.ready || history.error) return null;
    try {
      const observedAt = Date.now(), data = vigorPlanningHistory(history.entries, history.owner, observedAt);
      return { data, observedAt, review: reviewCardioHealth(data, observedAt) };
    } catch { return null; }
  }, [history.owner, history.entries, history.ready, history.error]);
  const modality = input.modalities.length === 1 && input.modalities[0] !== 'MACHINE' ? input.modalities[0] : null;
  const remembered = modality ? preference[modality] : undefined;
  const health = history.automaticHealth;
  const seedHealth = (baseline: ReviewedCardioStart) => ({ ...input, ...reviewedCardioDefaults(baseline, input.profile),
    sessionMinutes: baseline.sessionMinutes, cardioMinutes: baseline.totalMinutes, availableDays: input.availableDays });
  let automaticBaseline: ReviewedCardioStart | undefined;
  if (allowAutomatic && !applied && !appliedAutomatically.current && !open && modality && remembered
    && health?.owner === history.owner && health?.data && health.observedAt) {
    const context = planningHistoryContext(input, modality);
    try {
      automaticBaseline = acceptReviewedCardioStart(health.data, health.observedAt, Date.now(), context);
    } catch { /* Missing, stale or ambiguous data require review. */ }
  }
  useEffect(() => {
    if (!allowAutomatic || applied || appliedAutomatically.current || open || !remembered || !health?.focused || health.owner !== history.owner) return;
    if (!requested.current && health.state === 'IDLE') { requested.current = true; void health.read(false); }
    if (automaticBaseline) { appliedAutomatically.current = true; onApply(seedHealth(automaticBaseline)); }
  }, [allowAutomatic, applied, open, remembered, health, input, onApply]);
  const changePreference = (minutes?: number) => {
    if (!history.owner || !modality || !writeCardioPlanningPreference(history.owner, modality, minutes)) { setPreferenceError(true); return; }
    setPreferenceError(false); setPreference(old => ({ ...old, [modality]: minutes }));
  };
  const current = useRef({ input, snapshot, open, owner: history.owner, onApply });
  const token = { input, snapshot, open, owner: history.owner, onApply }; current.current = token;
  const apply = (baseline: ReviewedCardioStart, remember?: boolean) => {
    if (!open || !live.current || current.current !== token || !history.owner || !freshReviewedCardioStart(baseline, Date.now())
      || baseline.modality !== modality || baseline.cycleDays !== input.cycleDays) return;
    try {
      const seeded = open === 'VIGOR' ? applyVigorStartingPoint(input, baseline, Date.now()) : seedHealth(baseline);
      if (open === 'HEALTH' && remember) changePreference(baseline.comfortableMinutes);
      appliedAutomatically.current = true;
      setOpen(null); setFailed(false); onApply(seeded);
    } catch { setFailed(true); }
  };
  const group = snapshot?.review.groups.find(item => item.kind === modality);
  const state = !history.owner ? 'unavailable' : !history.ready ? 'loading' : history.error || !snapshot ? 'error'
    : snapshot.review.truncated || snapshot.review.invalidCount || snapshot.review.conflictingCount || snapshot.review.overlappingIds.length ? 'incomplete'
      : group ? 'found' : 'empty';
  const text = { color: colors.textPrimary, fontSize: 16 }, caption = { color: colors.textSecondary, fontSize: 14, lineHeight: 21 };
  const action = (key: string, press: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={t(`planningHistory.${key}`)}
    accessibilityState={{ disabled }} disabled={disabled} onPress={press} style={{ minHeight: 48, justifyContent: 'center', opacity: disabled ? .4 : 1 }}>
    <Text style={{ ...text, color: colors.accentText, fontWeight: '600' }}>{t(`planningHistory.${key}`)}</Text></Pressable>;
  if (!modality) return !applied && input.modalities.some(m => m !== 'MACHINE') ? <Text style={caption}>{t('planningHistory.singleModality')}</Text> : null;
  const reuseControls = <>
    {!!remembered && action('forget', () => changePreference())}
    {preferenceError && <Text accessibilityRole="alert" style={caption}>{t('planningHistory.preferenceError')}</Text>}
  </>;
  if (applied) return reuseControls;
  return <View style={plain ? { marginTop: 8, marginBottom: 24, gap: 6 } : { ...surfaces.field, borderRadius: radius.md, padding: 16, marginTop: 18, gap: 6 }}>
    <Text style={{ ...text, fontWeight: '700' }}>{t('planningHistory.title')}</Text>
    <Text accessibilityLiveRegion="polite" style={caption}>{t(`planningHistory.${state}`, { count: group?.sessions, minutes: Math.round(group?.longestMinutes ?? 0) })}</Text>
    {!!remembered && (health?.state === 'LOADING' || health?.state === 'READY' || health?.state === 'ERROR' || health?.state === 'UNAVAILABLE') &&
      <Text style={caption}>{t(health.state === 'LOADING' ? 'planningHistory.reusing' : 'planningHistory.reuseUnavailable')}</Text>}
    {state === 'error' && action('retry', history.reload)}
    {action('reviewVigor', () => { setFailed(false); setOpen('VIGOR'); }, !snapshot?.review.canConfirm || !group)}
    {action('reviewHealth', () => { setFailed(false); setOpen('HEALTH'); }, !history.owner || !history.renderHealth)}
    {reuseControls}
    <Modal visible={!!open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(null)}>
      {open === 'HEALTH' && history.renderHealth?.({ input, onClose: () => setOpen(null), onApply: apply, canRemember: !!health })}
      {open === 'VIGOR' && snapshot && <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 22, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 30 }}>
        {action('close', () => setOpen(null))}
        <Text accessibilityRole="header" style={{ ...text, fontSize: 25, fontWeight: '700' }}>{t('planningHistory.vigorTitle')}</Text>
        <CardioStartingPointPanel key={JSON.stringify([input, snapshot.observedAt, snapshot.data])} data={snapshot.data} observedAt={snapshot.observedAt} excludedIds={[]}
          planningContext={planningHistoryContext(input, modality)} vigor onPlan={apply} />
        {failed && <Text accessibilityRole="alert" style={caption}>{t('healthPlanning.expired')}</Text>}
      </ScrollView>}
    </Modal>
  </View>;
}
