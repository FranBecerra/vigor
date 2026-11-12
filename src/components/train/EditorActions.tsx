import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

/** Shared actions below the title, before cycle/session selection or editable content. */
export function EditorActions({ onCancel, onSave, busy = false, saveDisabled = false }: {
  onCancel: () => void; onSave: () => void; busy?: boolean; saveDisabled?: boolean;
}) {
  const { t } = useTranslation(); const { colors, surfaces, radius, spacing, typography, sectionAccent } = useTheme();
  return <View testID="editor-actions" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, marginBottom: spacing.lg }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} disabled={busy} onPress={onCancel}
      style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', opacity: busy ? .5 : 1 }}>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t('generate.cancel')}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t('routine.saveChanges')} disabled={busy || saveDisabled} onPress={onSave}
      style={{ ...surfaces.primary, minHeight: 44, minWidth: 150, paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: radius.md, backgroundColor: sectionAccent.train, justifyContent: 'center', alignItems: 'center',
        opacity: busy || saveDisabled ? .5 : 1, marginLeft: 'auto' }}>
      <Text style={[typography.body, { color: colors.onAccent, fontWeight: '700' }]}>{t('routine.saveChanges')}</Text>
    </Pressable>
  </View>;
}

export function EditorEditButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, surfaces, radius, typography } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={{ ...surfaces.card, backgroundColor: colors.bgElevated, minHeight: 44, paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: radius.md, borderWidth: 1, borderColor: colors.surfaceBorder, justifyContent: 'center', alignSelf: 'flex-start', opacity: disabled ? .5 : 1 }}>
    <Text style={[typography.body, { color: colors.textPrimary }]}>{label}</Text>
  </Pressable>;
}

export function EditorBackButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors, typography } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: disabled ? .5 : 1 }}>
    <Text style={[typography.body, { color: colors.textSecondary }]}>‹ {label}</Text>
  </Pressable>;
}
