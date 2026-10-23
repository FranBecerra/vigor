import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/models';
import type { MockSetRow } from '@/mocks/session';
import { recordingOf } from '@/services/training/customExercises';
import { customCompletionPatch } from '@/services/training/customRecording';
import { useTheme } from '@/theme/useTheme';
import { NumericField } from './NumericField';
import { SwipeableSet } from './SwipeableSet';

export function CustomRecordingRows({ exercise, sets, update, onRemoveSet }: {
  exercise: Exercise; sets: MockSetRow[]; update: (setId: string, patch: Partial<MockSetRow>) => void;
  onRemoveSet?: (exerciseId: string, setId: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, sectionAccent, spacing } = useTheme();
  const [error, setError] = useState('');
  const mode = recordingOf(exercise);
  return <View style={{ padding: spacing.lg }}>
    <Text style={{ color: colors.textMuted }}>{t(`custom.${mode.measure}`)} · {t(`custom.${mode.load}`)}
      {exercise.laterality === 'PER_SIDE' ? ` · ${t('custom.perSide')}` : ''}</Text>
    {sets.map((set, index) => <SwipeableSet key={set.id} onRemove={onRemoveSet ? () => onRemoveSet(exercise.id, set.id) : undefined}><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
      <Text style={{ color: colors.textPrimary }}>{index + 1}</Text>
      <View style={{ width: 64 }}><NumericField compact value={mode.measure === 'SECONDS' ? set.actualDurationSeconds ?? set.targetDurationSeconds : set.actualReps ?? set.targetReps}
        editable={!set.isCompleted} isPlanned={mode.measure === 'SECONDS' ? set.actualDurationSeconds === undefined : set.actualReps === undefined}
        accessibilityLabel={t(`custom.${mode.measure}`)} onChangeValue={(value) => update(set.id,
          mode.measure === 'SECONDS' ? { actualDurationSeconds: value } : { actualReps: value })} /></View>
      {mode.load !== 'NONE' && <View style={{ width: 72 }}><NumericField compact value={mode.load === 'LEVEL' ? set.actualLoadLevel ?? set.targetLoadLevel : set.actualWeight ?? set.targetWeight}
        editable={!set.isCompleted} decimal accessibilityLabel={t(`custom.${mode.load}`)}
        onChangeValue={(value) => update(set.id, mode.load === 'LEVEL' ? { actualLoadLevel: value } : { actualWeight: value })} /></View>}
      {mode.measure === 'REPETITIONS' && <View style={{ width: 48 }}><Text style={{ color: colors.textMuted }}>RIR</Text>
        <NumericField compact value={typeof set.actualRIR === 'number' ? set.actualRIR : undefined}
          accessibilityLabel="RIR" onChangeValue={(value) => { if (value === undefined || (value >= 0 && value <= 5)) update(set.id, { actualRIR: value }); }} />
      </View>}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: set.isCompleted }} onPress={() => {
        try { update(set.id, customCompletionPatch(exercise, set)); setError(''); }
        catch { setError(t('rehab.invalidActual')); }
      }} style={{ padding: 12 }}><Text style={{ color: colors.accentText, fontSize: 23 }}>{set.isCompleted ? '✓' : '○'}</Text></Pressable>
      {onRemoveSet && <Pressable accessibilityRole="button" accessibilityLabel={t('workout.removeSet')}
        onPress={() => onRemoveSet(exercise.id, set.id)} style={{ padding: 12 }}><Text style={{ color: colors.textMuted }}>−</Text></Pressable>}
    </View></SwipeableSet>)}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{error}</Text>}
  </View>;
}
