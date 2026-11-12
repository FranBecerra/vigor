import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { CheckIcon } from '@/components/icons/ActionIcons';
import { CycleChevron } from '@/components/icons/CycleReviewIcons';

/** Compact controlled choice for the approved Sections form. */
export function CardioSelectRow({ label, value, options, onSelect, disabled = false }: {
  label: string; value: string; options: readonly { value: string; label: string }[];
  onSelect(value: string): void; disabled?: boolean;
}) {
  const { colors } = useTheme(), [open, setOpen] = useState(false);
  return <View style={{ borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder }}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      onPress={() => setOpen(v => !v)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.accentText, fontSize: 15, flexShrink: 1, textAlign: 'right' }}>{options.find(o => o.value === value)?.label ?? value}</Text>
      <View accessible={false} style={open ? undefined : { transform: [{ rotate: '90deg' }] }}><CycleChevron color={colors.accentText} expanded={open} size={16} /></View>
    </Pressable>
    {open && <View accessibilityRole="radiogroup" accessibilityLabel={label}>{options.map(option => <Pressable key={option.value}
      accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: option.value === value, disabled }} disabled={disabled}
      onPress={() => { onSelect(option.value); setOpen(false); }} style={{ minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ color: option.value === value ? colors.accentText : colors.textPrimary, fontSize: 15, flex: 1 }}>{option.label}</Text>
      {option.value === value && <View accessible={false}><CheckIcon size={18} color={colors.accentText} /></View>}
    </Pressable>)}</View>}
  </View>;
}
