import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/models';
import { useTheme } from '@/theme/useTheme';
import {
  partitionSwapCandidates,
  searchExercises,
} from '@/services/training/exerciseSearch';

interface ExerciseSwapSheetProps {
  current: Exercise | null;
  candidates: readonly Exercise[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Searchable selector shared conceptually with the in-session swap flow. */
export function ExerciseSwapSheet({
  current,
  candidates,
  onSelect,
  onClose,
}: ExerciseSwapSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (current !== null) setQuery('');
  }, [current]);

  const visible = useMemo(
    () => searchExercises(query, candidates, (muscle) => t(`muscle.${muscle}`)),
    [candidates, query, t],
  );
  const groups = useMemo(
    () => current === null
      ? { related: [], other: visible }
      : partitionSwapCandidates(current, visible),
    [current, visible],
  );

  const renderRows = (title: string, exercises: readonly Exercise[]) => {
    if (exercises.length === 0) return null;
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
        {exercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => onSelect(exercise)}
            accessibilityRole="button"
            accessibilityLabel={exercise.name}
            style={[styles.row, { borderBottomColor: colors.surfaceBorder }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.textPrimary }]}>
                {exercise.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {t(`muscle.${exercise.primaryMuscle}`)} ·{' '}
                {t(`generate.equipment${exercise.equipment}`)}
              </Text>
            </View>
            <Text style={[typography.title, { color: sectionAccent.train }]}>›</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={current !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.surfaceBorder }]} />
        <Text style={[typography.h2, { color: colors.textPrimary }]}>
          {t('generate.swapTitle')}
        </Text>
        {current !== null && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
            {current.name}
          </Text>
        )}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('generate.swapSearch')}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          style={[
            typography.body,
            styles.search,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.surfaceBorder,
              borderRadius: radius.md,
            },
          ]}
        />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {renderRows(t('generate.swapRelated'), groups.related)}
          {renderRows(t('generate.swapOther'), groups.other)}
          {visible.length === 0 && (
            <Text style={[typography.body, { color: colors.textMuted, paddingVertical: spacing.xl }]}>
              {t('generate.swapEmpty')}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '82%', paddingHorizontal: 18, paddingTop: 10 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  search: { height: 46, borderWidth: 1, paddingHorizontal: 14, marginVertical: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});
