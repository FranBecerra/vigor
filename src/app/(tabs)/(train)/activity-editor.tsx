import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useSportActivities } from '@/hooks/useSportActivities';
import { useTheme } from '@/theme/useTheme';
import { SportActivityForm } from '@/components/cardio/SportActivityForm';
import type { SportActivity } from '@/models/sportActivity';

function Editor({ activity, requestedMode, sports }: { activity: SportActivity | null; requestedMode: 'PLAN' | 'RECORD'; sports: ReturnType<typeof useSportActivities> }) {
  const router = useRouter(); const [id] = useState(() => activity?.id ?? sports.newId());
  const [original] = useState(activity);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const mode = original?.record ? 'RECORD' : requestedMode;
  return <SportActivityForm activity={original} mode={mode} onCancel={() => router.canGoBack() ? router.back() : router.replace('/activities')} onSave={async (draft) => {
    await sports.save(id, original, draft);
    if (alive.current) router.dismissTo('/activities');
  }} />;
}

function OwnedEditor() {
  const params = useLocalSearchParams<{ id?: string; mode?: string }>(); const { t } = useTranslation(); const { colors, surfaces } = useTheme(); const router = useRouter();
  const sports = useSportActivities();
  const activity = sports.entries.find((entry) => entry.id === params.id) ?? null;
  if (!sports.ready || sports.error || params.id && !activity) return <View style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' }}>
    {!sports.ready ? <ActivityIndicator color={colors.accentText} /> : <Text style={{ color: colors.textPrimary }}>{t('sportActivities.loadFailed')}</Text>}
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/activities')} style={{ minHeight: 48 }}><Text style={{ color: colors.accentText }}>{t('generate.back')}</Text></Pressable>
    {sports.error && <Pressable accessibilityRole="button" onPress={sports.reload} style={{ minHeight: 48 }}><Text style={{ color: colors.accentText }}>{t('home.retry')}</Text></Pressable>}
  </View>;
  return <Editor key={`${params.id ?? 'new'}:${params.mode}`} activity={activity} requestedMode={params.mode === 'RECORD' ? 'RECORD' : 'PLAN'} sports={sports} />;
}
export default function ActivityEditorScreen() {
  const { uid } = useAuth(); return <OwnedEditor key={uid} />;
}
