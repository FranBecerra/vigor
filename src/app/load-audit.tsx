import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { loadAudit, summarizeLoads } from '@/services/performance/loadAudit';

export default function LoadAuditScreen() {
  const { t } = useTranslation(), router = useRouter(), insets = useSafeAreaInsets();
  const { surfaces, colors, typography, radius } = useTheme();
  const [samples, setSamples] = useState(() => loadAudit.snapshot());
  const [shareError, setShareError] = useState(false);
  const action = (key: string, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress}
    style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t(key)}</Text></Pressable>;
  return <ScrollView style={{ ...surfaces.screen, flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}>
    {action('generate.back', () => { if (router.canGoBack()) router.back(); else router.replace('/settings'); })}
    <Text style={[typography.h1, { color: colors.textPrimary }]}>{t('loadAudit.title')}</Text>
    <Text style={[typography.body, { color: colors.textSecondary, marginVertical: 16 }]}>{t('loadAudit.explanation')}</Text>
    {action('loadAudit.refresh', () => setSamples(loadAudit.snapshot()))}
    {summarizeLoads(samples).map(row => <View key={`${row.stage}:${row.trigger}`} style={{ ...surfaces.card, padding: 16, borderRadius: radius.lg, marginBottom: 12 }}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`loadAudit.stages.${row.stage.replace('.', '_')}`)}</Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`loadAudit.${row.trigger}`)} · n={row.count}</Text>
      <Text style={[typography.body, { color: colors.textPrimary }]}>{t('loadAudit.times', { median: row.p50 === null ? '—' : Math.round(row.p50), p95: row.p95 === null ? '—' : Math.round(row.p95), max: row.max === null ? '—' : Math.round(row.max) })}</Text>
      {!row.sufficient && <Text style={[typography.caption, { color: colors.textMuted }]}>{t('loadAudit.smallSample')}</Text>}
      {!!(row.errors + row.cancelled) && <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('loadAudit.errors', row)}</Text>}
    </View>)}
    {!samples.length && <Text style={{ color: colors.textSecondary }}>{t('loadAudit.empty')}</Text>}
    {action('loadAudit.share', () => { void Share.share({ message: JSON.stringify({ version: 1, platform: Platform.OS, os: Platform.Version,
      mode: __DEV__ ? 'development' : 'release', scope: 'JS read completion, not native launch or frame timing', samples }, null, 2) }).catch(() => setShareError(true)); })}
    {shareError && <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('loadAudit.shareError')}</Text>}
    {action('loadAudit.clear', () => { loadAudit.clear(); setSamples([]); })}
  </ScrollView>;
}
