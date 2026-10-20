import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { useTranslation } from 'react-i18next';

export function GenerationChoice({ title, description, selected, onPress, artwork, footer, compact = false, multiple = false }:
  { title: string; description?: string; selected: boolean; onPress: () => void; artwork?: React.ReactNode; footer?: React.ReactNode; compact?: boolean; multiple?: boolean }) {
  const { colors, typography, radius, sectionAccent } = useTheme();
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={title} accessibilityHint={description} accessibilityState={multiple ? { checked: selected } : { selected }} onPress={onPress}
    style={{ width: '100%', minHeight: compact ? 76 : 126, justifyContent: 'center', padding: 16,
      borderRadius: radius.lg, borderWidth: selected ? 1.5 : 1, borderColor: selected ? sectionAccent.train : colors.surfaceBorder,
      backgroundColor: colors.bgElevated, marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
    {artwork}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{title}</Text>
      {!!description && <Text style={[typography.body, { color: colors.textSecondary, lineHeight: 21, marginTop: 7 }]}>{description}</Text>}
    </View>
    <View style={{ width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: selected ? sectionAccent.train : colors.textMuted,
      alignItems: 'center', justifyContent: 'center' }}>
      {selected && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: sectionAccent.train }} />}
    </View>
    </View>
    {!!footer && <View style={{ marginTop: 12 }}>{footer}</View>}
  </Pressable>;
}

export function PriorityBudget({ used, total, hint }: { used: number; total: number; hint?: string }) {
  const { t } = useTranslation(); const { colors, sectionAccent, typography } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return <View style={{ marginBottom: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Text style={[typography.title, { color: colors.textPrimary }]}>{t('generate.priorityBudget')}</Text>
    {hint && <Pressable accessibilityRole="button" accessibilityLabel={t('generate.budgetInfo')} accessibilityState={{ expanded }}
      onPress={() => setExpanded((old) => !old)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.textSecondary, fontSize: 18 }}>ⓘ</Text>
    </Pressable>}
    <View accessibilityLabel={t('generate.slotsLeft', { used, total })} style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
    {Array.from({ length: total }, (_, index) => {
      const fill = Math.max(0, Math.min(1, used - index));
      return <View key={index} testID={`priority-point-${index}`} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
        borderColor: sectionAccent.train, backgroundColor: colors.bgElevated, overflow: 'hidden' }}>
        <View testID={`priority-fill-${index}`} style={{ height: '100%', width: `${fill * 100}%`, backgroundColor: sectionAccent.train }} />
      </View>;
    })}
    </View>
    </View>
    {expanded && <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>{hint}</Text>}
  </View>;
}
