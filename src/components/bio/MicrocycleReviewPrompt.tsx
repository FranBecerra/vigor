import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMicrocycleReviews } from '@/hooks/useMicrocycleReviews';
import { useTheme } from '@/theme/useTheme';
import { microcycleReviewId } from '@/services/bio/microcycleReview';
import type { RoutineView } from '@/services/training/routineView';

/** An optional inline invitation, never a modal between the athlete and training. */
export function MicrocycleReviewPrompt({ routines }: { routines: readonly RoutineView[] }) {
  const reviews = useMicrocycleReviews(), router = useRouter(), { t } = useTranslation();
  const { surfaces, colors, typography, radius } = useTheme();
  if (!reviews.ready || reviews.error) return null;
  const reviewed = new Set(reviews.entries.map((entry) => entry.id));
  const routine = routines.find((item) => item.isActive);
  const cycle = routine?.microcycles.filter((micro) => micro.sessions.length > 0
    && micro.sessions.every((session) => session.completedOn || session.skippedOn)).at(-1);
  if (!routine || !cycle || reviewed.has(microcycleReviewId(routine.mesocycleId, cycle.number - 1))) return null;
  return <View style={{ padding: 18, marginTop: 16, ...surfaces.bio, backgroundColor: colors.bgElevated, borderRadius: radius.lg }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('bio.reviewAvailable')}</Text>
    <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{routine.name} · {t('bio.cycle', { count: cycle.number })}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('bio.review')} onPress={() => router.navigate({ pathname: '/(tabs)/bio', params: { mesocycleId: routine.mesocycleId } })}
      style={{ minHeight: 48, justifyContent: 'center', marginTop: 6 }}>
      <Text style={[typography.title, { color: colors.accentText }]}>{t('bio.review')} ›</Text>
    </Pressable>
  </View>;
}
