import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useExerciseName } from '@/hooks/useExerciseName';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Exercise } from '@/models';
import { useTheme } from '@/theme/useTheme';
import { BodyMap } from './BodyMap';
import { primaryMusclesOf } from '@/services/training/exerciseMuscles';
import { cleanImportedExerciseNotes } from '@/services/training/exerciseEditing';

export function ExerciseDetailSheet({ exercise, mode, note, onNote, onClose, notRecommended = false, onToggleRecommendation }: {
  exercise: Exercise | null; mode: 'info' | 'note'; note: string; onNote: (note: string) => void; onClose: () => void;
  notRecommended?: boolean; onToggleRecommendation?: (exercise: Exercise, notRecommended: boolean) => void;
}) {
  const { colors, typography, spacing, sectionAccent, radius } = useTheme(); const { t } = useTranslation(); const insets = useSafeAreaInsets();
  const name = useExerciseName();
  return <Modal visible={exercise !== null} animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }}>
      <Text style={[typography.h2, { color: colors.textPrimary }]}>{name(exercise)}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {mode === 'note' ? <TextInput multiline value={note} onChangeText={onNote} maxLength={2000} autoFocus
          accessibilityLabel={t('train.note')} placeholder={t('workout.noteHint')} placeholderTextColor={colors.textMuted}
          style={{ color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, minHeight: 180, marginVertical: 20, textAlignVertical: 'top' }} /> : exercise && <>
          <BodyMap height={260} paint={(muscle) => primaryMusclesOf(exercise).includes(muscle)
            ? { color: colors.accentText, opacity: 1 } : exercise.secondaryMuscles.includes(muscle) ? { color: colors.accentText, opacity: 0.35 } : null} />
          <Text style={[typography.title, { color: colors.textPrimary, marginVertical: 12 }]}>{primaryMusclesOf(exercise).map((muscle) => t(`muscle.${muscle}`)).join(' · ')}</Text>
          <Text style={{ color: colors.textSecondary }}>{t(`generate.equipment${exercise.equipment}`)}</Text>
          {onToggleRecommendation && <Pressable accessibilityRole="button"
            accessibilityLabel={t(notRecommended ? 'exercisePreference.recommend' : 'exercisePreference.notRecommend')}
            onPress={() => onToggleRecommendation(exercise, !notRecommended)}
            style={{ minHeight: 48, marginTop: 16, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1,
              borderColor: notRecommended ? sectionAccent.train : colors.surfaceBorder, borderRadius: radius.md }}>
            <Text style={{ color: notRecommended ? colors.accentText : colors.textPrimary, fontWeight: '600' }}>
              {notRecommended ? `✓ ${t('exercisePreference.notRecommended')}` : `⊘ ${t('exercisePreference.notRecommend')}`}
            </Text>
          </Pressable>}
          {!!cleanImportedExerciseNotes(exercise.notes) && <Text style={{ color: colors.textSecondary, marginTop: 20 }}>{cleanImportedExerciseNotes(exercise.notes)}</Text>}
          {!!exercise.guidePage && <Text style={{ color: colors.textMuted, marginTop: 20 }}>{t('workout.guidePage', { page: exercise.guidePage })}</Text>}
        </>}
      </ScrollView>
      <Pressable onPress={onClose} style={{ padding: 18, backgroundColor: sectionAccent.train, borderRadius: radius.pill, marginBottom: insets.bottom + 12 }}>
        <Text style={{ color: colors.onAccent, textAlign: 'center', fontWeight: '700' }}>{t('workout.done')}</Text>
      </Pressable>
    </View>
  </Modal>;
}
