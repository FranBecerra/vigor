/**
 * Attributed volume per muscle, as bars split into upper and lower body (PRD §8.8).
 *
 * Both halves share one scale, so a bar of the same length means the same number
 * of sets in either block.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { visibleVolumeComponents, type PreviewMuscleVolumeBreakdown } from '@/services/training/previewEditing';
import { groupByBodyHalf } from '@/services/training/muscleGroups';
import { heatPaint } from '@/services/training/bodyMap';
import { BodyMap } from '@/components/train/BodyMap';

interface MuscleVolumeCardProps {
  title: string;
  hint?: string;
  entries: readonly PreviewMuscleVolumeBreakdown[];
  /** Mesocycle summary only: the same volume as a body heat map above the bars. */
  heatMap?: boolean;
}

export function MuscleVolumeCard({ title, hint, entries, heatMap = false }: MuscleVolumeCardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, radius, sectionAccent } = useTheme();
  const maxVolume = Math.max(1, ...entries.map((entry) => entry.sets));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder,
      borderRadius: radius.md }]}>
      <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.md }]}>
        {title}
      </Text>
      {hint !== undefined && <Text style={[typography.caption, { color: colors.textMuted,
        marginBottom: spacing.md }]}>
        {hint}
      </Text>}
      {heatMap && (
        <View style={{ marginBottom: spacing.lg }}>
          <BodyMap height={220} paint={heatPaint(entries, sectionAccent.train)} />
        </View>
      )}
      {groupByBodyHalf(entries).map((group, groupIndex) => (
        <View key={group.half} style={groupIndex > 0 ? { marginTop: spacing.md } : undefined}>
          <Text style={[styles.blockLabel, { color: colors.textMuted }]}>
            {t(`generate.focus${group.half}`).toUpperCase()}
          </Text>
          {group.entries.map((entry) => (
            <View key={entry.muscle} style={styles.row}>
              <View style={styles.nameColumn}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.textSecondary }]}>
                  {t(`muscle.${entry.muscle}`)}
                </Text>
                {visibleVolumeComponents(entry).length > 0 &&
                  <Text numberOfLines={1} style={[styles.components, { color: colors.textMuted }]}>
                    {visibleVolumeComponents(entry).map((part) => part === 'direct'
                      ? t('generate.previewDirectSets', { count: entry.directSets })
                      : t('generate.previewIndirectSets', { count: entry.indirectSets })).join(' · ')}
                  </Text>}
              </View>
              <View style={[styles.track, { backgroundColor: colors.bgElevated }]}>
                <View style={[styles.fill, { backgroundColor: sectionAccent.train,
                  width: `${(entry.sets / maxVolume) * 100}%` }]} />
              </View>
              <Text style={[styles.value, { color: colors.textPrimary }]}>
                {Number.isInteger(entry.sets) ? entry.sets : entry.sets.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, marginTop: 4 },
  blockLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  nameColumn: { width: 118 },
  name: { fontSize: 11 },
  components: { fontSize: 9 },
  track: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  value: { width: 30, fontSize: 11, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
});
