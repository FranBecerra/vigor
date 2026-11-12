import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { exerciseHistory } from '@/services/training/exerciseHistory';
import { WorkoutHistorySets } from './WorkoutHistoryDetails';

export function ExerciseHistoryTimeline({ entries, ready }: {
  entries: ReturnType<typeof exerciseHistory>; ready: boolean;
}) {
  const { t, i18n } = useTranslation(); const { colors, typography } = useTheme();
  return <View style={{ paddingTop: 20 }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('exerciseHistory.title')}</Text>
    {!ready || !entries.length ? <Text style={[typography.body, { color: colors.textMuted, marginVertical: 16 }]}>
      {t(ready ? 'exerciseHistory.empty' : 'exerciseHistory.unavailable')}
    </Text> : entries.map(entry => <View key={entry.id} style={{ borderTopWidth: 0.5,
      borderColor: colors.surfaceBorder, marginTop: 16, paddingTop: 16 }}>
      <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]}>
        {new Date(entry.at).toLocaleDateString(i18n?.resolvedLanguage ?? i18n?.language, { day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
        {[entry.sessionName, t('historyDetails.exerciseSets', { count: entry.exercises.reduce((sum, exercise) => sum + exercise.completed, 0) })].filter(Boolean).join(' · ')}
      </Text>
      {entry.exercises.map(exercise => <WorkoutHistorySets key={exercise.id} exercise={exercise} />)}
    </View>)}
  </View>;
}
