/**
 * An exercise's muscles as tags: the primary muscle carries the train accent and
 * the secondary ones the neutral chip used on the home card.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { MuscleGroup } from '@/models';
import { exerciseMuscleTags } from '@/services/training/muscleGroups';

/** Lime at ~18 % alpha: readable as a tint in both appearances, with primary text on top. */
const PRIMARY_TINT_ALPHA = '2E';

interface MuscleTagsProps {
  /** Undefined for an id the catalogue no longer has: nothing is drawn. */
  exercise: { primaryMuscle: MuscleGroup; secondaryMuscles: readonly MuscleGroup[] } | undefined;
}

export function MuscleTags({ exercise }: MuscleTagsProps) {
  const { t } = useTranslation();
  const { colors, radius, sectionAccent } = useTheme();
  if (exercise === undefined) return null;

  return (
    <View style={styles.row}>
      {exerciseMuscleTags(exercise).map(({ muscle, role }) => {
        const primary = role === 'primary';
        return (
          <View key={muscle} style={[styles.tag, { borderRadius: radius.sm,
            backgroundColor: primary ? `${sectionAccent.train}${PRIMARY_TINT_ALPHA}` : colors.surface }]}>
            <Text style={[styles.label, primary
              ? { color: colors.textPrimary, fontWeight: '700' }
              : { color: colors.textSecondary }]}>
              {t(`muscle.${muscle}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  tag: { paddingHorizontal: 9, height: 22, justifyContent: 'center' },
  label: { fontSize: 11 },
});
