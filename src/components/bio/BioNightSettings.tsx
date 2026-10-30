import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { bioNightBridge } from '@/services/health/bioHealthClient';
import { useTheme } from '@/theme/useTheme';
import { BioSleepGoalSettings } from './BioSleepGoalSettings';
import { HealthAccessReview } from './HealthAccessReview';

/** Only explicit interaction requests additional pulse/RMSSD permissions. */
export function BioNightSettings() {
  const { uid } = useAuth(), preferences = useAppSettings(), { t } = useTranslation();
  const { colors, typography, semantic } = useTheme();
  const [available, setAvailable] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [reviewOwner, setReviewOwner] = useState<string | null>(null);
  const owner = useRef({ uid, epoch: 0 }), working = useRef(false), alive = useRef(true);
  if (owner.current.uid !== uid) owner.current = { uid, epoch: owner.current.epoch + 1 };
  const epoch = owner.current.epoch;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true; working.current = false; setBusy(false); setError(false); setReviewOwner(null);
    bioNightBridge.available().then((value) => { if (current) setAvailable(value); }).catch(() => { if (current) setAvailable(false); });
    return () => { current = false; };
  }, [uid]);
  const enabled = preferences.settings.bioNightEnabled === true;
  const change = async (next: boolean) => {
    if (!uid || !preferences.ready || preferences.busy || preferences.settings.bioHealthEnabled !== true || working.current) return;
    const current = () => alive.current && owner.current.uid === uid && owner.current.epoch === epoch;
    working.current = true; setBusy(true); setError(false);
    try {
      if (next) await bioNightBridge.authorize();
      if (!current()) return false;
      if (!await preferences.change({ bioNightEnabled: next })) throw Error('bioNightSettingsFailed');
      return current();
    } catch { if (current()) setError(true); return false; }
    finally { if (current()) { working.current = false; setBusy(false); } }
  };
  return <View style={{ gap: 12, borderTopWidth: 0.5, borderColor: colors.surfaceBorder, paddingTop: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={[typography.title, { color: colors.textPrimary, flex: 1 }]}>{t('bioNight.connection')}</Text>
      <Switch accessibilityLabel={t('bioNight.connection')} value={enabled}
        disabled={!uid || !preferences.ready || preferences.busy || busy || (!available && !enabled)} onValueChange={(next) => { void change(next); }} />
    </View>
    <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioNight.consent')}</Text>
    {!available && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioNight.updateRequired')}</Text>}
    {error && <Text accessibilityRole="alert" style={[typography.body, { color: semantic.warning }]}>{t('bioHealth.error')}</Text>}
    {enabled && available && <Pressable accessibilityRole="button" accessibilityLabel={t('bioNight.permissions')}
      disabled={busy || preferences.busy} onPress={() => setReviewOwner(uid)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[typography.title, { color: colors.bioText }]}>{t('bioNight.permissions')}</Text>
    </Pressable>}
    <BioSleepGoalSettings />
    {uid && reviewOwner === uid && enabled && preferences.settings.bioHealthEnabled === true && <HealthAccessReview key={uid} busy={busy || preferences.busy} onClose={() => setReviewOwner(null)} onRequest={() => change(true)} />}
  </View>;
}
