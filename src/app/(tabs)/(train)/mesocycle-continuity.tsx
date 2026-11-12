import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { useMicrocycleReviews } from '@/hooks/useMicrocycleReviews';
import { backToTraining, finishToTraining } from '@/services/training/backNavigation';
import { MesocycleContinuityFlow } from '@/components/train/MesocycleContinuityFlow';
import { completedBlockAfterWorkout } from '@/services/training/mesocycleContinuity';
import { loadContinuityReview, saveMesocycleContinuation, type ContinuityReviewData } from '@/services/training/mesocycleContinuityRepository';

export default function MesocycleContinuityScreen() {
  const { t } = useTranslation(), router = useRouter(), insets = useSafeAreaInsets();
  const { uid } = useAuth(), { exercisesById } = useExerciseCatalogue();
  const reviews = useMicrocycleReviews();
  const { colors, surfaces, spacing } = useTheme();
  const { routineId, sourceId, afterWorkout } = useLocalSearchParams<{ routineId?: string; sourceId?: string; afterWorkout?: string }>();
  const [attempt, setAttempt] = useState(0);
  const identity = JSON.stringify([uid, routineId, sourceId, afterWorkout, attempt]);
  const [result, setResult] = useState<{ identity: string; data: ContinuityReviewData | null } | null>(null);
  const active = useRef('');
  active.current = identity;
  useEffect(() => {
    active.current = identity;
    const current = () => active.current === identity;
    if (uid && typeof routineId === 'string' && typeof sourceId === 'string' && routineId && sourceId) {
      loadContinuityReview(uid, routineId, sourceId).then(data => {
        if (!current()) return;
        if (afterWorkout) {
          const workout = data.history.find(record => record.id === afterWorkout);
          if (!workout || !completedBlockAfterWorkout(data.source, data.routine.generation.goal, data.history, workout, data.now)) {
            finishToTraining(router);
            return;
          }
        }
        setResult({ identity, data });
      }).catch(() => {
        if (!current()) return;
        if (afterWorkout) finishToTraining(router);
        else setResult({ identity, data: null });
      });
    } else setResult({ identity, data: null });
    return () => { active.current = ''; };
  }, [identity, uid, routineId, sourceId, afterWorkout, router]);

  const cancel = () => afterWorkout ? finishToTraining(router) : backToTraining(router);
  const reload = () => setAttempt(value => value + 1);
  const data = result?.identity === identity ? result.data : undefined;
  if (data) return <MesocycleContinuityFlow key={identity} data={data} catalogue={exercisesById}
    feedback={reviews.ready && !reviews.error ? reviews.entries : null} onCancel={cancel} onReload={reload}
    onSave={async selection => {
      await saveMesocycleContinuation(data, selection, () => active.current === identity);
      if (active.current === identity) finishToTraining(router);
    }} />;

  return <View style={{ ...surfaces.screen, flex: 1, gap: spacing.md, paddingTop: insets.top, paddingHorizontal: spacing.lg }}>
    <Pressable accessibilityRole="button" onPress={cancel} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.accentText }}>‹ {t('continuity.back')}</Text>
    </Pressable>
    {data === undefined ? <ActivityIndicator color={colors.accentText} accessibilityLabel={t('continuity.loading')} /> : <>
      <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{t('continuity.loadError')}</Text>
      <Pressable accessibilityRole="button" onPress={reload} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: colors.accentText }}>{t('continuity.retry')}</Text>
      </Pressable>
    </>}
  </View>;
}
