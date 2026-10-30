import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppSettings';
import { AthleteIntakeForm } from '@/components/profile/AthleteIntakeForm';
import { useTheme } from '@/theme/useTheme';

export default function AthleteProfileScreen() {
  const { uid } = useAuth();
  return <OwnedAthleteProfile key={uid} />;
}
function OwnedAthleteProfile() {
  const { uid } = useAuth(), preferences = useAppSettings(), router = useRouter(), { colors } = useTheme();
  const { t } = useTranslation();
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/settings'); };
  if (!preferences.ready) return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 70 }}>
    <Pressable accessibilityRole="button" onPress={close}><Text style={{ color: colors.accentText }}>{t('generate.back')}</Text></Pressable>
    {preferences.error ? <Pressable accessibilityRole="button" onPress={preferences.reload}><Text style={{ color: colors.accentText }}>{t('settings.retry')}</Text></Pressable> : <ActivityIndicator color={colors.accentText} />}
  </View>;
  return <><Stack.Screen options={{ gestureEnabled: false }} /><AthleteIntakeForm key={uid} initial={preferences.settings.athleteIntake} onCancel={close}
    onSave={async athleteIntake => { const ok = await preferences.change({ athleteIntake }); if (ok && live.current) close(); return ok && live.current; }} /></>;
}
