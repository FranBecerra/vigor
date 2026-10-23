import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { setTypeLabel } from './setTypeLabel';
import type { workoutHistoryDetails } from '@/services/training/workoutHistory';
import { useExerciseName } from '@/hooks/useExerciseName';
import { TrophyIcon } from '@/components/icons/ActionIcons';

export function WorkoutHistoryDetails({ details, recordSetIds = [] }: { details: ReturnType<typeof workoutHistoryDetails>; recordSetIds?: readonly string[] }) {
  const { t } = useTranslation(); const { colors, typography, sectionAccent } = useTheme();
  const name = useExerciseName();
  const value = (number: number | null) => number === null ? '—' : String(number);
  return <View>
    {(['sessionNote', 'mesocycleNote'] as const).map((key) => details[key] ? <View key={key} style={{ marginTop: 16 }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{t(key === 'sessionNote' ? 'notes.SESSION' : 'notes.MESOCYCLE')}</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>{details[key]}</Text>
    </View> : null)}
    {details.exercises.map((exercise) => <View key={exercise.id} style={{ paddingTop: 20, marginTop: 12, borderTopWidth: 0.5, borderColor: colors.surfaceBorder }}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{exercise.name ? name({ id: exercise.exerciseId, name: exercise.name }) : t('historyDetails.unknownExercise')}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{t('historyDetails.exerciseSets', { count: exercise.completed })}</Text>
      {exercise.sets[0] && exercise.sets[0].load !== 'TOTAL_KG' && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>{t(`custom.${exercise.sets[0].load}`)}</Text>}
      <View style={{ flexDirection: 'row', paddingVertical: 12, gap: 8 }}>
        <Text style={{ color: colors.textMuted, width: 36 }}>{t('historyDetails.set')}</Text>
        <Text style={{ color: colors.textMuted, flex: 1 }}>{t('historyDetails.performed')}</Text>
        <Text style={{ color: colors.textMuted, width: 56, textAlign: 'right' }}>RIR</Text>
      </View>
      {exercise.sets.map((set) => <View key={set.id} style={{ paddingVertical: 7, opacity: set.done ? 1 : 0.65 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 36, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ color: set.done ? colors.accentText : colors.textMuted }}>{setTypeLabel(set.setType) || set.number}</Text>
            {recordSetIds.includes(`${exercise.exerciseId}:${set.id}`) && <View accessibilityLabel="PR"><TrophyIcon size={14} color={colors.textPrimary} /></View>}
          </View>
          <Text style={{ color: colors.textPrimary, flex: 1 }}>
            {set.load === 'NONE' ? '' : `${value(set.weight)} ${set.load === 'LEVEL' ? t('custom.LEVEL') : 'kg'} × `}
            {value(set.quantity)} {set.seconds ? 's' : t('train.reps').toLowerCase()}
            {set.partialReps ? ` + ${set.partialReps} ${t('workout.partialReps').toLowerCase()}` : ''}
          </Text>
          <Text style={{ color: colors.textPrimary, width: 56, textAlign: 'right' }}>{value(set.rir)}</Text>
        </View>
        {!set.done && <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 44 }]}>{t('historyDetails.notCompleted')}</Text>}
        {set.extensions.map((extension, index) => <Text key={index} style={[typography.caption, { color: colors.textSecondary, marginLeft: 44, marginTop: 4 }]}>
          + {extension.weight === null ? '' : `${extension.weight} kg × `}{value(extension.reps)} {t('train.reps').toLowerCase()}
        </Text>)}
      </View>)}
      {!!exercise.note && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 10 }]}>{exercise.note}</Text>}
      {!!exercise.exerciseNote && <View style={{ marginTop: 10 }}><Text style={[typography.caption, { color: colors.textMuted }]}>{t('notes.EXERCISE')}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 5 }]}>{exercise.exerciseNote}</Text></View>}
    </View>)}
  </View>;
}
