import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/useTheme';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { workoutSessionRepository } from '@/services/repositories';
import type { WorkoutSession } from '@/models';
import { WorkoutHistoryCard } from '@/components/train/WorkoutHistoryCard';
import { backToTraining } from '@/services/training/backNavigation';
import { timestampMillis } from '@/services/training/workoutRuntime';

export default function HistoryScreen() {
  const { uid } = useAuth(); const { exercisesById } = useExerciseCatalogue(); const { t } = useTranslation();
  const { colors, typography, sectionAccent, spacing } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [state, setState] = useState<{ owner: string | null; items: WorkoutSession[]; loading: boolean; error: boolean }>({ owner: null, items: [], loading: true, error: false });
  useFocusEffect(useCallback(() => {
    let alive = true; setState({ owner: uid, items: [], loading: true, error: false });
    if (!uid) return () => { alive = false; };
    workoutSessionRepository.listByUser(uid).then((items) => {
      if (alive) setState({ owner: uid, items: items.filter((item) => item.userId === uid)
        .sort((a, b) => timestampMillis(b.performedAt) - timestampMillis(a.performedAt)), loading: false, error: false });
    }).catch(() => { if (alive) setState({ owner: uid, items: [], loading: false, error: true }); });
    return () => { alive = false; };
  }, [uid]));
  const visible = state.owner === uid ? state.items : [];
  return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
    <FlatList data={visible} keyExtractor={(item) => item.id} initialNumToRender={8} maxToRenderPerBatch={6} windowSize={5}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }}
      ListHeaderComponent={<>
        <Pressable accessibilityRole="button" onPress={() => backToTraining(router)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t('generate.back')}</Text></Pressable>
        <Text style={[typography.emphasis, { color: colors.textPrimary, marginBottom: 20 }]}>{t('workout.history')}</Text>
        {(state.loading || state.owner !== uid) && <ActivityIndicator color={sectionAccent.train} />}
        {state.error && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('workout.historyError')}</Text>}
      </>}
      ListEmptyComponent={!state.loading && !state.error ? <Text style={[typography.body, { color: colors.textMuted }]}>{t('workout.historyEmpty')}</Text> : null}
      renderItem={({ item }) => <WorkoutHistoryCard session={item} catalogue={exercisesById}
        onPress={() => router.push({ pathname: '/workout-history', params: { id: item.id } })} />} />
  </View>;
}
