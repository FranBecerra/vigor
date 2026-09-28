/**
 * Preview of a generated plan, shown before anything is saved (PRD §8.8).
 *
 * The point is not the exercise list, which the athlete will read anyway. It is the
 * LIMITING FACTOR line: "time is the limit" and "recovery is the limit" have
 * different remedies, and a generator that shows a number without saying which one
 * bound it leaves the athlete adjusting the wrong dial. That distinction is the
 * engine's most defensible output, so it gets the most prominent line.
 */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { GlassSurface } from '@/components/GlassSurface';
import { NumericField } from '@/components/train/NumericField';
import { SetType, type Exercise } from '@/models';
import type { PlannedSession } from '@/models';
import type { LimitingFactor } from '@/services/training/mesocyclePlanner';
import { previewVolumeByMuscle, representativeSet } from '@/services/training/previewEditing';
import { REGION_OF_MUSCLE } from '@/services/training/volumePlan';

interface PlanPreviewProps {
  sessions: readonly PlannedSession[];
  limitedBy: LimitingFactor;
  performedSets: number;
  /** Catalogue entries by id, for exercise names. */
  exercisesById: ReadonlyMap<string, Exercise>;
  onSwap?: (sessionIndex: number, order: number) => void;
  onChangeSets?: (sessionIndex: number, order: number, value: number | undefined) => void;
  onChangeRepMin?: (sessionIndex: number, order: number, value: number | undefined) => void;
  onChangeRepMax?: (sessionIndex: number, order: number, value: number | undefined) => void;
  overTimeSessionIndexes?: readonly number[];
  volumeOutsideRange?: boolean;
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
  onSwap,
  onChangeSets,
  onChangeRepMin,
  onChangeRepMax,
  overTimeSessionIndexes = [],
  volumeOutsideRange = false,
}: PlanPreviewProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme();

  // Insufficient time is the only case that is an error rather than information.
  const limitTone =
    limitedBy === 'insufficient-time' ? semantic.danger : colors.textSecondary;
  const volume = previewVolumeByMuscle(sessions, exercisesById);
  const maxVolume = volume[0]?.sets ?? 1;

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
        {overTimeSessionIndexes.length > 0 && (
          <Text style={[typography.caption, { color: semantic.warning, marginTop: spacing.sm }]}>
            {t('generate.previewOverTime', {
              sessions: overTimeSessionIndexes.map((index) => index + 1).join(', '),
            })}
          </Text>
        )}
        {volumeOutsideRange && (
          <Text style={[typography.caption, { color: semantic.warning, marginTop: spacing.xs }]}>
            {t('generate.previewOutsideVolume')}
          </Text>
        )}
      </GlassSurface>

      {sessions.map((session) => {
        const regions = [
          ...new Set(
            session.exercises
              .map((entry) => exercisesById.get(entry.exerciseId)?.primaryMuscle)
              .filter((muscle) => muscle !== undefined)
              .map((muscle) => REGION_OF_MUSCLE[muscle]),
          ),
        ];
        return (
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
              <View style={{ flex: 1 }}>
                <Text style={[typography.title, { color: colors.textPrimary }]}>
                  {t('generate.previewSession', { index: session.index + 1 })}
                  {'  '}
                  <Text style={{ color: colors.textMuted }}>
                    {t(`generate.focus${session.focus}`)}
                  </Text>
                </Text>
                <Text
                  numberOfLines={1}
                  style={[typography.caption, { color: sectionAccent.train, marginTop: 2 }]}
                >
                  {regions.map((region) => t(`region.${region}`)).join(' · ')}
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {t('generate.previewMinutes', {
                  minutes: Math.round(session.estimatedWorkMinutes),
                })}
              </Text>
            </View>

            {session.exercises.map((exercise) => {
              const firstSet = representativeSet(exercise.sets);
              return (
                <View
                  key={`${exercise.exerciseId}-${exercise.order}`}
                  style={[styles.exerciseEditor, { borderTopColor: colors.surfaceBorder }]}
                >
                  <View style={styles.exerciseNameRow}>
                    <Text
                      numberOfLines={1}
                      style={[typography.body, { color: colors.textPrimary, flex: 1 }]}
                    >
                      {exercisesById.get(exercise.exerciseId)?.name ?? exercise.exerciseId}
                    </Text>
                    {onSwap !== undefined && (
                      <Pressable
                        onPress={() => onSwap(session.index, exercise.order)}
                        accessibilityRole="button"
                        accessibilityLabel={t('generate.previewSwap')}
                        style={[
                          styles.swapButton,
                          {
                            borderColor: colors.surfaceBorder,
                            backgroundColor: colors.bgElevated,
                            borderRadius: radius.sm,
                          },
                        ]}
                      >
                        <Text style={[typography.caption, { color: sectionAccent.train }]}>
                          {t('generate.previewSwap')}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.prescriptionRow}>
                    <View style={styles.numericGroup}>
                      <Text style={[styles.numericLabel, { color: colors.textMuted }]}>
                        {t('generate.previewSetsLabel')}
                      </Text>
                      <NumericField
                        value={exercise.sets.length}
                        onChangeValue={(value) =>
                          onChangeSets?.(session.index, exercise.order, value)
                        }
                        accessibilityLabel={t('generate.previewSetsLabel')}
                      />
                    </View>
                    <View style={styles.numericGroup}>
                      <Text style={[styles.numericLabel, { color: colors.textMuted }]}>
                        {t('generate.previewRepMin')}
                      </Text>
                      <NumericField
                        value={firstSet?.targetRepsMin ?? firstSet?.targetReps}
                        onChangeValue={(value) =>
                          onChangeRepMin?.(session.index, exercise.order, value)
                        }
                        accessibilityLabel={t('generate.previewRepMin')}
                      />
                    </View>
                    <Text style={[typography.body, { color: colors.textMuted, paddingTop: 18 }]}>–</Text>
                    <View style={styles.numericGroup}>
                      <Text style={[styles.numericLabel, { color: colors.textMuted }]}>
                        {t('generate.previewRepMax')}
                      </Text>
                      <NumericField
                        value={firstSet?.targetReps}
                        onChangeValue={(value) =>
                          onChangeRepMax?.(session.index, exercise.order, value)
                        }
                        accessibilityLabel={t('generate.previewRepMax')}
                      />
                    </View>
                  </View>
                  {(exercise.restSeconds !== undefined ||
                    exercise.sets[0]?.setType === SetType.TOP_SINGLE) && (
                    <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>
                      {[
                        exercise.sets[0]?.setType === SetType.TOP_SINGLE
                          ? t('generate.previewTopSingle')
                          : null,
                        exercise.restSeconds !== undefined
                          ? t('generate.previewRest', { minutes: exercise.restSeconds / 60 })
                          : null,
                      ]
                        .filter((part) => part !== null)
                        .join(' · ')}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      <View
        style={[
          styles.volumeCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderRadius: radius.md,
          },
        ]}
      >
        <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          {t('generate.previewVolume')}
        </Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
          {t('generate.previewVolumeHint')}
        </Text>
        {volume.map((entry) => (
          <View key={entry.muscle} style={styles.volumeRow}>
            <Text numberOfLines={1} style={[styles.volumeName, { color: colors.textSecondary }]}>
              {t(`muscle.${entry.muscle}`)}
            </Text>
            <View style={[styles.volumeTrack, { backgroundColor: colors.bgElevated }]}>
              <View
                style={[
                  styles.volumeFill,
                  {
                    backgroundColor: sectionAccent.train,
                    width: `${(entry.sets / maxVolume) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.volumeValue, { color: colors.textPrimary }]}>
              {Number.isInteger(entry.sets) ? entry.sets : entry.sets.toFixed(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exerciseEditor: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swapButton: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  prescriptionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  numericGroup: { width: 64, alignItems: 'center' },
  numericLabel: { fontSize: 9, fontWeight: '700', marginBottom: 2 },
  volumeCard: { borderWidth: 1, padding: 16, marginTop: 4 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  volumeName: { width: 92, fontSize: 11 },
  volumeTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  volumeFill: { height: 7, borderRadius: 4 },
  volumeValue: {
    width: 30,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
