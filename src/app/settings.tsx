import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAppSettings } from '@/hooks/useAppSettings';
import { HealthExportSettings } from '@/components/train/WorkoutHealthExport';
import { normalizeDisplayName, type AppAppearance, type AppLanguage } from '@/services/settings/appSettings';

export default function SettingsScreen() {
  const { t } = useTranslation(); const router = useRouter(); const insets = useSafeAreaInsets();
  const { colors, radius, typography, spacing, sectionAccent, semantic } = useTheme(); const preferences = useAppSettings();
  const [name, setName] = useState(preferences.displayName); const [invalidName, setInvalidName] = useState(false); const [savedName, setSavedName] = useState(false);
  useEffect(() => { setName(preferences.displayName); }, [preferences.displayName]);
  const row = (label: string, selected: boolean, onPress: () => void, group: string) => <Pressable key={label} accessibilityRole="radio"
    accessibilityLabel={`${group}: ${label}`} accessibilityState={{ selected, disabled: preferences.busy || !preferences.ready }}
    disabled={preferences.busy || !preferences.ready} onPress={onPress}
    style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderTopWidth: 0.5, borderColor: colors.surfaceBorder }}>
    <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 6 : 1, borderColor: selected ? sectionAccent.train : colors.textMuted }} />
  </Pressable>;
  const heading = (key: string) => <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 14 }]}>{t(key)}</Text>;
  const card = { padding: 18, borderRadius: radius.lg, backgroundColor: colors.surface, marginTop: 20 };
  return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 32 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('generate.back')} onPress={() => {
        if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile');
      }} style={{ paddingVertical: 12 }}><Text style={{ color: colors.accentText }}>‹ {t('tabs.profile')}</Text></Pressable>
      <Text style={[typography.emphasis, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      {!preferences.ready && !preferences.error && <ActivityIndicator color={sectionAccent.train} style={{ marginTop: 24 }} />}
      <View style={card}>
        {heading('settings.account')}
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8 }]}>{t('settings.displayName')}</Text>
        <TextInput accessibilityLabel={t('settings.displayName')} value={name} onChangeText={(value) => { setName(value); setInvalidName(false); setSavedName(false); }}
          editable={preferences.ready && !preferences.busy} autoCapitalize="words" autoCorrect={false} maxLength={80}
          placeholder={t('settings.namePlaceholder')} placeholderTextColor={colors.textMuted}
          style={[typography.body, { color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: radius.md, padding: 14 }]} />
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>{t('settings.nameHint')}</Text>
        {invalidName && <Text accessibilityRole="alert" style={{ color: semantic.warning, marginTop: 10 }}>{t('settings.invalidName')}</Text>}
        {savedName && <Text style={{ color: colors.accentText, marginTop: 10 }}>{t('settings.nameSaved')}</Text>}
        <Pressable accessibilityRole="button" disabled={preferences.busy || !preferences.ready} onPress={() => {
          try { normalizeDisplayName(name); } catch { setInvalidName(true); return; }
          void preferences.saveName(name).then((ok) => setSavedName(ok));
        }} style={{ paddingVertical: 16 }}><Text style={{ color: colors.accentText }}>{t('settings.saveName')}</Text></Pressable>
      </View>
      <View style={card}>
        {heading('settings.appearance')}
        {(['system', 'dark', 'light'] as AppAppearance[]).map((appearance) => row(t(`settings.${appearance}`), preferences.settings.appearance === appearance, () => { void preferences.change({ appearance }); }, t('settings.appearance')))}
      </View>
      <View style={card}>
        {heading('settings.language')}
        {(['system', 'es', 'en', 'fr', 'ja'] as AppLanguage[]).map((language) => row(t(`settings.language_${language}`), preferences.settings.language === language, () => { void preferences.change({ language }); }, t('settings.language')))}
      </View>
      <Text style={[typography.title, { color: colors.textPrimary, marginTop: 28 }]}>{t('settings.connections')}</Text>
      <HealthExportSettings />
      {preferences.error && <View style={{ marginTop: 18 }}>
        <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('settings.error')}</Text>
        <Pressable accessibilityRole="button" onPress={preferences.reload} style={{ paddingVertical: 14 }}><Text style={{ color: colors.accentText }}>{t('settings.retry')}</Text></Pressable>
      </View>}
    </ScrollView>
  </View>;
}
