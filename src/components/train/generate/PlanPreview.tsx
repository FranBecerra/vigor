/**
 * Preview of a generated plan, shown before anything is saved (PRD §8.8).
 *
 * The point is not the exercise list, which the athlete will read anyway. It is the
 * LIMITING FACTOR line: "time is the limit" and "recovery is the limit" have
 * different remedies, and a generator that shows a number without saying which one
 * bound it leaves the athlete adjusting the wrong dial. That distinction is the
 * engine's most defensible output, so it gets the most prominent line.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { GlassSurface } from '@/components/GlassSurface';
import type { Exercise } from '@/models';
import type { PlannedSession } from '@/models';
import type { LimitingFactor } from '@/services/training/mesocyclePlanner';

interface PlanPreviewProps {
  sessions: readonly PlannedSession[];
  limitedBy: LimitingFactor;
  performedSets: number;
  /** Catalogue entries by id, for exercise names. */
  exercisesById: ReadonlyMap<string, Exercise>;
}

const LIMIT_KEY: Record<LimitingFactor, string> = {
  time: 'generate.previewLimitedByTime',
  recovery: 'generate.previewLimitedByRecovery',
  'insufficient-time': 'generate.previewLimitedByInsufficientTime',
};

export function PlanPreview({
  sessions,
  limitedBy,
  performedSets,
  exercisesById,
}: PlanPreviewProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme();

  // Insufficient time is the only case that is an error rather than information.
  const limitTone =
    limitedBy === 'insufficient-time' ? semantic.danger : colors.textSecondary;

  return (
    <View>
      <GlassSurface
        style={{
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
        }}
      >
        <Text style={[typography.h2, { color: sectionAccent.train }]}>
          {t('generate.previewSets', { performed: performedSets })}
        </Text>
        <Text style={[typography.caption, { color: limitTone, marginTop: spacing.sm }]}>
          {t(LIMIT_KEY[limitedBy])}
        </Text>
      </GlassSurface>

      {sessions.map((session) => (
        <View
          key={session.index}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            padding: spacing.lg,
            marginBottom: spacing.md,
          }}
        >
          <View style={styles.sessionHeader}>
            <Text style={[typography.title, { color: colors.textPrimary, flex: 1 }]}>
              {t('generate.previewSession', { index: session.index + 1 })}
              {'  '}
              <Text style={{ color: colors.textMuted }}>
                {t(`generate.focus${session.focus}`)}
              </Text>
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {t('generate.previewMinutes', {
                minutes: Math.round(session.estimatedWorkMinutes),
              })}
            </Text>
          </View>

          {session.exercises.map((exercise) => (
            <View key={exercise.exerciseId} style={styles.exerciseRow}>
              <Text
                numberOfLines={1}
                style={[typography.body, { color: colors.textPrimary, flex: 1 }]}
              >
                {exercisesById.get(exercise.exerciseId)?.name ?? exercise.exerciseId}
              </Text>
              <Text style={[typography.metric, { color: colors.textSecondary }]}>
                {t('generate.previewSetsShort', { count: exercise.sets.length })}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    gap: 12,
  },
});
