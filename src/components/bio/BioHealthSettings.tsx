import { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTheme } from '@/theme/useTheme';
import { bioHealthBridge } from '@/services/health/bioHealthClient';
import { BioNightSettings } from './BioNightSettings';
import { HealthAccessReview } from './HealthAccessReview';

export function BioHealthSettings() {
  const { uid } = useAuth(), preferences = useAppSettings(), { t } = useTranslation();
  const { colors, surfaces, typography, radius, semantic } = useTheme();
  const [available, setAvailable] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [reviewOwner, setReviewOwner] = useState<string | null>(null);
  const generation = useRef({ owner: uid, epoch: 0 });
  if (generation.current.owner !== uid) generation.current = { owner: uid, epoch: generation.current.epoch + 1 };
  const epoch = generation.current.epoch;
  const working = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true; setBusy(false); setError(false); setReviewOwner(null); working.current = false;
    bioHealthBridge.bioAvailable().then((value) => { if (current) setAvailable(value); }).catch(() => { if (current) setAvailable(false); });
    return () => { current = false; };
  }, [uid]);
  const enabled = preferences.settings.bioHealthEnabled === true;
  const connect = async (next: boolean) => {
    if (!uid || !preferences.ready || preferences.busy || working.current) return;
    const current = () => alive.current && generation.current.owner === uid && generation.current.epoch === epoch;
    working.current = true; setBusy(true); setError(false);
    try {
      if (next) await bioHealthBridge.authorizeBio();
      if (!current()) return false;
      if (!await preferences.change({ bioHealthEnabled: next })) throw Error('bioSettingsFailed');
      return current();
    } catch { if (current()) setError(true); return false; }
    finally { if (current()) { working.current = false; setBusy(false); } }
  };
  return <View style={{ ...surfaces.bio, padding: 20, borderRadius: radius.lg, marginTop: 20, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={[typography.title, { color: colors.textPrimary, flex: 1 }]}>{t('bioHealth.connection')}</Text>
      <Switch accessibilityLabel={t('bioHealth.connection')} value={enabled} disabled={!uid || !preferences.ready || preferences.busy || busy || (!available && !enabled)}
        onValueChange={(next) => { void connect(next); }} />
    </View>
    <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioHealth.consent')}</Text>
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioHealth.permissionHint')}</Text>
    {!available && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('health.unavailable')}</Text>}
    {error && <Text accessibilityRole="alert" style={[typography.body, { color: semantic.warning }]}>{t('bioHealth.error')}</Text>}
    {enabled && available && <Pressable accessibilityRole="button" disabled={busy || preferences.busy} accessibilityLabel={t('bioHealth.permissions')}
      onPress={() => setReviewOwner(uid)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[typography.title, { color: colors.bioText }]}>{t('bioHealth.permissions')}</Text>
    </Pressable>}
    {enabled && <BioNightSettings />}
    {uid && reviewOwner === uid && enabled && <HealthAccessReview key={uid} busy={busy || preferences.busy} onClose={() => setReviewOwner(null)} onRequest={() => connect(true)} />}
  </View>;
}
