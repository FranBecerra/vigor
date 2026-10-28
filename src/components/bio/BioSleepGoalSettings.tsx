import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTheme } from '@/theme/useTheme';
import { MAX_SLEEP_GOAL, MIN_SLEEP_GOAL } from '@/services/bio/sleepGoal';

export function BioSleepGoalSettings() {
  const { uid } = useAuth(), preferences = useAppSettings();
  if (!uid || !preferences.ready || !preferences.settings.bioHealthEnabled || !preferences.settings.bioNightEnabled) return null;
  return <SleepGoalEditor key={uid} preferences={preferences} />;
}
function SleepGoalEditor({ preferences }: { preferences: ReturnType<typeof useAppSettings> }) {
  const { t } = useTranslation(), { colors, typography, semantic } = useTheme();
  const [draft, setDraft] = useState<number | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const working = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const goal = preferences.settings.bioSleepGoalMinutes;
  const format = (minutes: number) => t('bioHealth.sleepValue', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  const button = (label: string, action: () => void, disabled = false, visible = label) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={[typography.title, { color: disabled ? colors.textSecondary : colors.bioText }]}>{visible}</Text>
  </Pressable>;
  const save = async () => {
    if (draft === null || preferences.busy || working.current) return;
    working.current = true; setBusy(true); setError(false);
    try {
      if (!await preferences.change({ bioSleepGoalMinutes: draft })) throw Error('sleepGoalSaveFailed');
      if (alive.current) setDraft(null);
    } catch { if (alive.current) setError(true); }
    finally { if (alive.current) { working.current = false; setBusy(false); } }
  };
  return <View style={{ gap: 8, borderTopWidth: 0.5, borderColor: colors.surfaceBorder, paddingTop: 16 }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bioReadiness.sleepGoal')}</Text>
    <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioReadiness.goalHint')}</Text>
    {draft === null ? button(goal === undefined ? t('bioReadiness.setGoal') : t('bioReadiness.editGoal', { value: format(goal) }),
      () => { setDraft(goal ?? 480); setError(false); }, preferences.busy) : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {button(t('bioReadiness.lessSleep'), () => setDraft(Math.max(MIN_SLEEP_GOAL, draft - 15)), busy || draft <= MIN_SLEEP_GOAL, '−')}
        <Text accessibilityLiveRegion="polite" style={[typography.h2, { color: colors.textPrimary }]}>{format(draft)}</Text>
        {button(t('bioReadiness.moreSleep'), () => setDraft(Math.min(MAX_SLEEP_GOAL, draft + 15)), busy || draft >= MAX_SLEEP_GOAL, '+')}
      </View>
      <View style={{ flexDirection: 'row', gap: 24 }}>
        {button(t('bioReadiness.cancelGoal'), () => { setDraft(null); setError(false); }, busy)}
        {button(t('bioReadiness.saveGoal'), () => { void save(); }, busy || preferences.busy)}
      </View>
    </>}
    {error && <Text accessibilityRole="alert" style={[typography.body, { color: semantic.warning }]}>{t('bioHealth.error')}</Text>}
  </View>;
}
