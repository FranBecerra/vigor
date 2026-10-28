import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { InfoIcon, NoteIcon, SwapIcon } from '@/components/icons/ActionIcons';
import { useTheme } from '@/theme/useTheme';

export type ExerciseAction = 'swap' | 'info' | 'note';
const actions = [{ id: 'swap', Icon: SwapIcon }, { id: 'info', Icon: InfoIcon }, { id: 'note', Icon: NoteIcon }] as const;

/** One shared surface, equal touch areas and visible labels for every action. */
export function ExerciseActionsBar({ hasNote, onAction }: { hasNote: boolean; onAction?: (action: ExerciseAction) => void }) {
  const { t } = useTranslation(); const { surfaces, colors, radius } = useTheme();
  return <View testID="exercise-actions-bar" style={[styles.bar, { borderRadius: radius.md, ...surfaces.card, backgroundColor: colors.bgElevated }]}>
    {actions.map(({ id, Icon }, index) => <View key={id} style={styles.segment}>
      {index > 0 && <View pointerEvents="none" style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />}
      <Pressable accessibilityRole="button" accessibilityLabel={t(`train.${id}`)} disabled={!onAction}
        accessibilityState={{ disabled: !onAction }} onPress={() => onAction?.(id)}
        style={({ pressed }) => [styles.action, { opacity: !onAction ? 0.5 : pressed ? 0.7 : 1 }]}>
        <View style={styles.icon} accessible={false}>
          <Icon size={23} color={colors.textSecondary} />
          {id === 'note' && hasNote && <View testID="exercise-note-indicator" style={[styles.dot, { backgroundColor: colors.accentText }]} />}
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t(`train.${id}`)}</Text>
      </Pressable>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', padding: 3, overflow: 'hidden' },
  segment: { flex: 1, minWidth: 0 },
  action: { flexGrow: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 5, paddingVertical: 9 },
  label: { fontSize: 13, textAlign: 'center', flexShrink: 1 },
  icon: { width: 23, height: 23, position: 'relative' },
  dot: { position: 'absolute', top: -1, right: -4, width: 5, height: 5, borderRadius: 3 },
  divider: { position: 'absolute', left: 0, top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
});
