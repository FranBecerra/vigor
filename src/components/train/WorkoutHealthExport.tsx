import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useHealthExport } from '@/hooks/useHealthExport';
import { useTheme } from '@/theme/useTheme';
import { healthWorkout } from '@/services/health/workoutExport';
import type { WorkoutSession } from '@/models';

export function HealthExportSettings() {
  const health = useHealthExport(); const { t } = useTranslation(); const { colors, radius, typography, semantic } = useTheme();
  const [busy, setBusy] = useState(false);
  return <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, marginTop: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={[typography.title, { color: colors.textPrimary, flex: 1 }]}>{t('health.title')}</Text>
      <Switch accessibilityLabel={t('health.enable')} value={health.enabled} disabled={busy || !health.owner || !health.ready || !health.available}
        onValueChange={(enabled) => {
          if (!health.owner || busy) return;
          setBusy(true); void health.service.setEnabled(health.owner, enabled).finally(() => setBusy(false));
        }} />
    </View>
    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 10 }]}>{t(health.available ? 'health.consent' : 'health.unavailable')}</Text>
    {health.error && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 10 }}>{t('health.settingsError')}</Text>}
    {health.error && health.owner && <Pressable accessibilityRole="button" onPress={() => { void health.service.activate(health.owner); }} style={{ paddingVertical: 12 }}>
      <Text style={{ color: colors.textPrimary }}>{t('health.retrySettings')}</Text>
    </Pressable>}
  </View>;
}

export function WorkoutHealthExport({ session }: { session: WorkoutSession }) {
  const health = useHealthExport(); const { t } = useTranslation(); const { colors, radius, sectionAccent, typography } = useTheme();
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  if (!health.owner || !health.ready || !health.available) return null;
  const workout = healthWorkout(session, health.owner);
  if (!workout) return null;
  const entry = health.entries[workout.identity];
  const status = entry?.status ?? 'idle';
  return <View style={{ padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: 14 }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('health.title')}</Text>
    <Text accessibilityRole={failed || status === 'failed' || status === 'denied' ? 'alert' : undefined}
      style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
      {t(health.error || (failed && status !== 'denied') ? 'health.failed' : `health.${status}`)}
    </Text>
    {!health.enabled && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>{t('health.enableInProfile')}</Text>}
    {health.enabled && status !== 'saved' && entry?.action !== 'delete' && <Pressable accessibilityRole="button"
      disabled={busy || status === 'queued'} onPress={() => {
        if (busy) return;
        setBusy(true); setFailed(false);
        void health.service.export(session).then((ok) => setFailed(!ok)).finally(() => setBusy(false));
      }} style={{ paddingVertical: 14 }}>
      <Text style={{ color: colors.accentText }}>{t(busy || status === 'queued' ? 'health.queued' : 'health.export')}</Text>
    </Pressable>}
  </View>;
}
