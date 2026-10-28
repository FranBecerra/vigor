import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SetType, type Exercise } from '@/models';
import type { MockSetRow } from '@/mocks/session';
import { recordingOf } from '@/services/training/customExercises';
import { useTheme } from '@/theme/useTheme';
import { useTrainingUnits } from '@/hooks/useTrainingUnits';
import { SetRow, COLUMN_WIDTHS } from './SetRow';
import type { SetEntryValues } from './SetEntrySheet';

/** Recording mode changes field meaning, not the execution UI or gestures. */
export function CustomRecordingRows({ exercise, sets, update, onRemoveSet, onPressSetType, recordSetIds = [] }: {
  exercise: Exercise; sets: MockSetRow[]; update: (setId: string, patch: Partial<MockSetRow>) => void;
  onRemoveSet?: (exerciseId: string, setId: string) => void; onPressSetType?: (exerciseId: string, setId: string) => void;
  recordSetIds?: readonly string[];
}) {
  const { t } = useTranslation(); const { colors, spacing } = useTheme(); const units = useTrainingUnits(); const mode = recordingOf(exercise);
  const timed = mode.measure === 'SECONDS'; const level = mode.load === 'LEVEL';
  return <>
    <View style={{ paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <Text style={{ color: colors.textSecondary, width: COLUMN_WIDTHS.set }}>SET</Text>
      <Text style={{ color: colors.textSecondary, flex: 1 }}>{t('train.previous')}</Text>
      <Text style={{ color: colors.textSecondary, width: COLUMN_WIDTHS.weight, textAlign: 'center' }}>{mode.load === 'NONE' ? '' : level ? t('custom.LEVEL') : units.unit.toUpperCase()}</Text>
      <Text style={{ color: colors.textSecondary, width: COLUMN_WIDTHS.reps, textAlign: 'center' }}>{t(timed ? 'rehab.seconds' : 'train.reps')}</Text>
      <Text style={{ color: colors.textSecondary, width: COLUMN_WIDTHS.intensity, textAlign: 'center' }}>{timed ? '' : 'RIR'}</Text><View style={{ width: COLUMN_WIDTHS.done }} />
    </View>
    {sets.map((set, index) => {
      const actual = timed ? set.actualDurationSeconds : set.actualReps;
      const load = level ? set.actualLoadLevel : set.actualWeight;
      const reps = actual ?? (timed ? set.targetDurationSeconds : set.targetReps);
      const weight = load ?? (level ? set.targetLoadLevel : set.targetWeight);
      const completed = (value: boolean, values: SetEntryValues = { weight, reps, intensity: set.actualRIR ?? null, partialReps: set.actualPartialReps }) => update(set.id, {
        ...(timed ? { actualDurationSeconds: values.reps } : { actualReps: values.reps }),
        ...(mode.load === 'NONE' ? {} : level ? { actualLoadLevel: values.weight } : { actualWeight: values.weight }),
        actualRIR: values.intensity, actualPartialReps: values.partialReps, isCompleted: value,
      });
      return <SetRow key={set.id} recording={mode} scale="RIR" data={{ id: set.id, setType: set.setType, displayNumber: index + 1, weight, reps,
        intensity: set.actualRIR !== undefined ? set.actualRIR : (set.setType === SetType.WARMUP ? null : set.targetRIR), isCompleted: set.isCompleted,
        personalRecord: recordSetIds.includes(`${exercise.id}:${set.id}`),
        previous: set.previous ? { weight: set.previous.weight, reps: set.previous.reps, intensity: set.previous.rir } : undefined,
        weightIsPlanned: load === undefined, repsIsPlanned: actual === undefined, extensions: set.extensions, partialReps: set.actualPartialReps }}
        onPressSetType={() => onPressSetType?.(exercise.id, set.id)} onToggleDone={() => completed(!set.isCompleted)} onComplete={(values) => completed(true, values)}
        onChangeWeight={(value) => update(set.id, level ? { actualLoadLevel: value } : { actualWeight: value })}
        onChangeReps={(value) => update(set.id, timed ? { actualDurationSeconds: value } : { actualReps: value })}
        onChangeIntensity={(actualRIR) => update(set.id, { actualRIR })} onChangeExtensions={(extensions) => update(set.id, { extensions })}
        onChangePartialReps={(actualPartialReps) => update(set.id, { actualPartialReps })}
        onRemove={onRemoveSet ? () => onRemoveSet(exercise.id, set.id) : undefined} />;
    })}
  </>;
}
