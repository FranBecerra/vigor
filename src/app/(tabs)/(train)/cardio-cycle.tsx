import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useCardioPlans } from '@/hooks/useCardioPlans';
import { useRoutines } from '@/hooks/useRoutines';
import { useTheme } from '@/theme/useTheme';
import { CardioCycleView } from '@/components/cardio/CardioCycleView';
import { cardioStrengthChanged } from '@/services/cardio/savedCardioPlan';
import { CardioActivation } from '@/components/cardio/CardioActivation';

export default function CardioCycleScreen() {
  const { uid } = useAuth(); const { id } = useLocalSearchParams<{ id?: string }>();
  return <OwnedCycle key={`${uid}:${id}`} id={id} />;
}

function OwnedCycle({ id }: { id?: string }) {
  const plans = useCardioPlans(), strength = useRoutines(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { t } = useTranslation(); const { colors, surfaces, semantic } = useTheme();
  const plan = plans.entries.find(p => p.id === id);
  const routine = strength.routines.find(r => r.isActive && r.domain === 'STRENGTH');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false); const live = useRef(false), lock = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const back = () => router.dismissTo('/(tabs)/(train)');
  const button = (label: string, onPress: () => void, danger = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress}
    style={{ minHeight: 48, justifyContent: 'center', marginVertical: 10 }}><Text style={{ fontSize: 17, color: danger ? semantic.danger : colors.accentText }}>{label}</Text></Pressable>;
  return <ScrollView style={{ flex: 1, ...surfaces.screen }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
    {button(t('generate.back'), back)}
    {!plans.ready ? <ActivityIndicator color={colors.accentText} /> : !plan ? <View>
      <Text style={{ color: colors.textPrimary }}>{t('cardioSaved.loadFailed')}</Text>
    </View> : <>
      <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 29, fontWeight: '700', marginVertical: 16 }}>{plan.name}</Text>
      <Text style={{ color: colors.bioText, fontSize: 15, marginBottom: 16 }}>{t('cardioSaved.proposal')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginBottom: 20 }}>{t('cardioSaved.notActive')}</Text>
      {plan.strengthSource && (strength.status !== 'ready' || cardioStrengthChanged(plan, routine)) && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginBottom: 16 }}>{t(strength.status !== 'ready' ? 'cardioSaved.contextUnavailable' : 'cardioSaved.contextChanged')}</Text>}
      {strength.status === 'error' && button(t('cardioSaved.retryStrength'), strength.reload)}
      <CardioCycleView input={plan.input} preview={plan.preview} />
      <CardioActivation plan={plan} routine={routine} ready={strength.status === 'ready' && !plans.error} />
      {plans.pending && <Text style={{ color: colors.textSecondary, marginTop: 14 }}>{t('cardioSaved.pending')}</Text>}
      {!plans.error && button(t('cardioSaved.archive'), () => Alert.alert(t('cardioSaved.archive'), t('cardioSaved.confirmArchive'), [
        { text: t('generate.cancel'), style: 'cancel' }, { text: t('cardioSaved.archive'), style: 'destructive', onPress: async () => {
          if (lock.current || !live.current) return;
          lock.current = true; setBusy(true); setError(false);
          try { await plans.archive(plan); if (live.current) back(); }
          catch { if (live.current) setError(true); }
          finally { if (live.current) { lock.current = false; setBusy(false); } }
        } },
      ]), true)}
    </>}
    {(plans.error || error) && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioSaved.saveFailed')}</Text>}
    {plans.error && button(t('home.retry'), plans.reload)}
  </ScrollView>;
}
