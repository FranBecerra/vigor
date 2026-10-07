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
import { previewVolumeBreakdownByMuscle, representativeSet, underfilledSessionIndexes } from '@/services/training/previewEditing';
import { MuscleVolumeCard } from '@/components/train/MuscleVolumeCard';
import { REGION_OF_MUSCLE } from '@/services/training/volumePlan';
import { SESSION_OVERHEAD_MINUTES } from '@/services/training/trainingCapacity';
import { buildScheduleTemplate } from '@/services/training/scheduleTemplate';
import { ScheduleTemplateView } from '@/components/train/ScheduleTemplateView';

interface PlanPreviewProps {
  sessions: readonly PlannedSession[];
  limitedBy?: LimitingFactor;
  performedSets: number;
  /** Catalogue entries by id, for exercise names. */
  exercisesById: ReadonlyMap<string, Exercise>;
  onSwap?: (sessionIndex: number, order: number) => void;
  onAdd?: (sessionIndex: number) => void;
  onRemove?: (sessionIndex: number, order: number) => void;
  isAdded?: (sessionIndex: number, exerciseId: string) => boolean;
  onChangeSets?: (sessionIndex: number, order: number, value: number | undefined) => void;
  onChangeRepMin?: (sessionIndex: number, order: number, value: number | undefined) => void;
  onChangeRepMax?: (sessionIndex: number, order: number, value: number | undefined) => void;
  onChangeSetRIR?: (sessionIndex: number, order: number, setIndex: number,
    value: number | undefined) => void;
  overTimeSessionIndexes?: readonly number[];
  minimumSessionSets?: number;
  volumeOutsideRange?: boolean;
  editable?: boolean;
  onPressSession?: (sessionIndex: number) => void;
  summaryLabel?: string;
}

const LIMIT_KEY: Record<LimitingFactor, string> = {
  catalogue: 'calendar.noEligibleExercises',
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
  onAdd,
  onRemove,
  isAdded,
  onChangeSets,
  onChangeRepMin,
  onChangeRepMax,
  onChangeSetRIR,
  overTimeSessionIndexes = [],
  minimumSessionSets,
  volumeOutsideRange = false,
  editable = true,
  onPressSession,
  summaryLabel,
}: PlanPreviewProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme();

  // Insufficient time is the only case that is an error rather than information.
  const limitTone =
    limitedBy === 'insufficient-time' ? semantic.danger : colors.textSecondary;
  const underfilled = minimumSessionSets === undefined
    ? []
    : underfilledSessionIndexes(sessions, minimumSessionSets);

  return (
    <View>
      <GlassSurface
        style={{
          borderRadius: radius.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
        }}
      >
        <Text style={[typography.body, { color: colors.textSecondary, fontWeight: '600' }]}>
          {summaryLabel ?? t('generate.previewSets', { performed: performedSets })}
        </Text>
        {limitedBy !== undefined && <Text style={[typography.caption, { color: limitTone, marginTop: spacing.sm }]}>
          {t(LIMIT_KEY[limitedBy])}
        </Text>}
        {overTimeSessionIndexes.length > 0 && (
          <Text style={[typography.caption, { color: semantic.warning, marginTop: spacing.sm }]}>
            {t('generate.previewOverTime', {
              sessions: overTimeSessionIndexes.map((index) => index + 1).join(', '),
            })}
          </Text>
        )}
        {underfilled.length > 0 && (
          <Text style={[typography.caption, { color: semantic.warning, marginTop: spacing.sm }]}>
            {t('generate.previewUnderfilled', {
              sessions: underfilled.map((index) => index + 1).join(', '),
              minimum: minimumSessionSets,
            })}
          </Text>
        )}
        {volumeOutsideRange && (
          <Text style={[typography.caption, { color: semantic.warning, marginTop: spacing.xs }]}>
            {t('generate.previewOutsideVolume')}
          </Text>
        )}
        {underfilled.length > 0 && minimumSessionSets !== undefined && minimumSessionSets > 0
          && performedSets >= 2 * minimumSessionSets
          && performedSets < sessions.length * minimumSessionSets && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            {t('calendar.underfilledCapacity', { sets: performedSets, sessions: sessions.length,
              minimum: minimumSessionSets, suggested: Math.floor(performedSets / minimumSessionSets) })}
          </Text>
        )}
      </GlassSurface>

      {sessions.length > 0 && <ScheduleTemplateView template={buildScheduleTemplate(sessions, exercisesById)} sessions={sessions} />}

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
          <Pressable
            key={session.index}
            onPress={onPressSession === undefined ? undefined : () => onPressSession(session.index)}
            disabled={onPressSession === undefined}
            accessibilityRole={onPressSession ? 'button' : undefined}
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
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.caption, {
                  color: underfilled.includes(session.index) ? semantic.warning : colors.textSecondary,
                }]}>
                  {t('generate.previewSetsShort', {
                    count: session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
                  })}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t('generate.previewMinutes', {
                    minutes: Math.ceil(session.estimatedWorkMinutes + SESSION_OVERHEAD_MINUTES),
                  })}
                </Text>
              </View>
              {onPressSession !== undefined && <Text style={[typography.body, { color: sectionAccent.train,
                marginLeft: spacing.sm }]}>›</Text>}
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
                    {onRemove !== undefined && isAdded?.(session.index, exercise.exerciseId) && (
                      <Pressable
                        onPress={() => onRemove(session.index, exercise.order)}
                        accessibilityRole="button"
                        accessibilityLabel={t('generate.removeExercise')}
                        style={[styles.swapButton, { borderColor: colors.surfaceBorder, borderRadius: radius.sm }]}
                      >
                        <Text style={[typography.caption, { color: colors.textMuted }]}>×</Text>
                      </Pressable>
                    )}
                  </View>

                  {editable ? <View style={styles.prescriptionRow}>
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
                  </View> : <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 5 }]}>
                    {exercise.sets.length} × {firstSet?.targetRepsMin ?? firstSet?.targetReps}
                    {firstSet?.targetRepsMin !== undefined && firstSet.targetRepsMin !== firstSet.targetReps
                      ? `–${firstSet.targetReps}` : ''}
                  </Text>}
                  {editable && onChangeSetRIR !== undefined && <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                    {exercise.sets.map((set, setIndex) => set.setType === SetType.TOP_SINGLE ? null :
                      <View key={setIndex} style={{ width: 55, alignItems: 'center' }}>
                        <Text style={[styles.numericLabel, { color: colors.textMuted }]}>
                          {setIndex + 1} · RIR
                        </Text>
                        <NumericField value={set.targetRIR} accessibilityLabel={`RIR ${setIndex + 1}`}
                          onChangeValue={(value) => onChangeSetRIR(session.index, exercise.order,
                            setIndex, value)} />
                      </View>)}
                  </View>}
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
            {onAdd !== undefined && (
              <Pressable
                onPress={() => onAdd(session.index)}
                accessibilityRole="button"
                style={{ paddingVertical: spacing.md, alignItems: 'center' }}
              >
                <Text style={[typography.body, { color: sectionAccent.train }]}>
                  + {t('generate.addExercise')}
                </Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}

      <MuscleVolumeCard title={t('generate.previewVolume')} hint={t('generate.previewVolumeHint')}
        entries={previewVolumeBreakdownByMuscle(sessions, exercisesById)} heatMap />
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
});
