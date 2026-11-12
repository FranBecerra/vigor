import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useCardioPlans } from '@/hooks/useCardioPlans';
import { useProtectTrainingDraft } from '@/hooks/useTrainingDraftGuard';
import { useTheme } from '@/theme/useTheme';
import { buildCardioPreview, type CardioPreviewInput } from '@/services/cardio/cardioPreview';
import { saveCardioProposal, type SavedCardioPlan } from '@/services/cardio/savedCardioPlan';
import { backToTraining } from '@/services/training/backNavigation';
import { ManualCardioEditor } from './ManualCardioEditor';
import { CardioCycleView } from './CardioCycleView';

export function ManualCardioPlanFlow() {
  const { uid } = useAuth();
  return <OwnedManualCardioPlan key={uid ?? 'signed-out'} owner={uid} />;
}

function OwnedManualCardioPlan({ owner }: { owner: string | null }) {
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme(), insets = useSafeAreaInsets();
  const router = useRouter(), plans = useCardioPlans();
  const [review, setReview] = useState<{ input: CardioPreviewInput; name: string } | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const live = useRef(false), saving = useRef(false), frozen = useRef<SavedCardioPlan | null>(null);
  useProtectTrainingDraft(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const exit = () => { if (!saving.current) backToTraining(router); };
  const save = async () => {
    if (!review || !owner || !plans.ready || plans.error || saving.current || !live.current) return;
    saving.current = true; setBusy(true); setFailed(false);
    try {
      frozen.current ??= saveCardioProposal(plans.newId(), owner, review.name, review.input, null, Date.now());
      const plan = await plans.save(frozen.current);
      if (live.current) router.replace({ pathname: '/cardio-cycle', params: { id: plan.id } });
    } catch { if (live.current) setFailed(true); }
    finally { saving.current = false; if (live.current) setBusy(false); }
  };
  const action = (key: string, onPress: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button"
    disabled={disabled || busy} onPress={onPress} style={{ ...(primary ? surfaces.primary : surfaces.field), borderRadius: radius.md,
      minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, opacity: disabled ? .5 : 1 }}>
    <Text style={{ color: primary ? colors.onAccent : colors.accentText, textAlign: 'center', fontWeight: '600' }}>{t(key)}</Text>
  </Pressable>;
  return <View style={{ flex: 1, ...surfaces.screen }}>
    <View style={{ flex: 1, display: review ? 'none' : 'flex' }} accessibilityElementsHidden={!!review} importantForAccessibility={review ? 'no-hide-descendants' : 'auto'}>
      <ManualCardioEditor onBack={exit} onCancel={exit} onReview={(input, name) => { setFailed(false); frozen.current = null; setReview({ input, name }); }} />
    </View>
    {review && <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, gap: 16 }}>
      {action('generate.back', () => setReview(null))}
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '700', color: colors.textPrimary }}>{review.name}</Text>
      <CardioCycleView input={review.input} preview={buildCardioPreview(review.input)} />
      {(failed || plans.error) && <Text accessibilityRole="alert" style={{ color: semantic.danger }}>{t('cardioSaved.saveFailed')}</Text>}
      {plans.error && action('home.retry', plans.reload)}
      {action(busy ? 'generate.saving' : 'generate.save', () => void save(), true, !owner || !plans.ready || plans.error)}
    </ScrollView>}
  </View>;
}
