import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  tone?: 'normal' | 'danger';
}

interface ActionMenuSheetProps {
  title: string | null;
  subtitle?: string;
  actions: readonly ActionMenuItem[];
  onClose: () => void;
}

/** App-styled contextual actions; never delegates the choice UI to a system alert. */
export function ActionMenuSheet({ title, subtitle, actions, onClose }: ActionMenuSheetProps) {
  const { colors, typography, spacing, radius, semantic, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible={title !== null} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
    <View style={[styles.sheet, { backgroundColor: colors.bgElevated,
      borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={[styles.grabber, { backgroundColor: colors.surfaceBorder }]} />
      <Text style={[typography.h2, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, { color: colors.textMuted,
        marginTop: spacing.xs, marginBottom: spacing.md }]}>{subtitle}</Text> : null}
      <View style={{ marginTop: spacing.md }}>
        {actions.map((action) => <Pressable key={action.label}
          onPress={() => { onClose(); action.onPress(); }} accessibilityRole="button"
          style={[styles.action, { borderTopColor: colors.surfaceBorder }]}>
          <Text style={[typography.body, { color: action.tone === 'danger'
            ? semantic.danger : colors.textPrimary }]}>{action.label}</Text>
          <Text style={[typography.body, { color: sectionAccent.train }]}>›</Text>
        </Pressable>)}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)' },
  sheet: { paddingHorizontal: 20, paddingTop: 12 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  action: { minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
