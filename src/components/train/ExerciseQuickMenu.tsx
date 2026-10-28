import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { LinkIcon, SwapIcon, TrashIcon } from '@/components/icons/ActionIcons';
import { exerciseMenuLayout, type ExerciseMenuAnchor } from '@/services/training/exerciseMenuLayout';

interface Props {
  exercise: { id: string; name: string } | null;
  anchor?: ExerciseMenuAnchor;
  partners: readonly { id: string; name: string }[];
  grouped?: boolean;
  onClose: () => void;
  onRemove: () => void;
  onSwap: () => void;
  onLink: (id: string) => void;
  onUnlink: () => void;
}
/** A small in-place popover, not another bottom sheet or native modal. */
export function ExerciseQuickMenu({ exercise, anchor, partners, grouped, onClose, onRemove, onSwap, onLink, onUnlink }: Props) {
  const { t } = useTranslation(); const { surfaces, colors, semantic, radius } = useTheme(); const insets = useSafeAreaInsets(); const { width, height } = useWindowDimensions();
  const [choosing, setChoosing] = useState(false);
  useEffect(() => setChoosing(false), [exercise?.id]);
  if (!exercise) return null;
  const position = exerciseMenuLayout(width, height, insets.top, insets.bottom, anchor);
  const finish = (action: () => void) => { onClose(); action(); };
  return <View testID="exercise-quick-menu-overlay" style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 20 }]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('generate.cancel')} onPress={onClose} />
    <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={{ position: 'absolute', left: position.left, top: position.top,
      width: position.width, maxHeight: Math.min(position.maxHeight, height - insets.bottom - position.top - 12), borderRadius: radius.md,
      ...surfaces.sheet, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder, overflow: 'hidden' }}>
      {!choosing ? <>
        <Pressable accessibilityRole="button" accessibilityLabel={t('executionUpdates.removeExercise')} onPress={() => finish(onRemove)} style={styles.row}>
          <TrashIcon size={20} color={semantic.danger} /><Text style={[styles.label, { color: semantic.danger }]}>{t('executionUpdates.removeExercise')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('train.swap')} onPress={() => finish(onSwap)} style={styles.row}>
          <SwapIcon size={20} color={colors.textPrimary} /><Text style={[styles.label, { color: colors.textPrimary }]}>{t('train.swap')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('executionUpdates.superset')} onPress={() => setChoosing(true)} style={styles.row}>
          <LinkIcon size={20} color={colors.textPrimary} /><Text style={[styles.label, { color: colors.textPrimary }]}>{t('executionUpdates.superset')}</Text><Text style={{ color: colors.textSecondary }}>›</Text>
        </Pressable>
      </> : <>
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.back')} onPress={() => setChoosing(false)} style={styles.row}>
          <Text style={{ color: colors.accentText }}>‹</Text><Text style={[styles.label, { color: colors.textPrimary }]}>{t('executionUpdates.superset')}</Text>
        </Pressable>
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
          {grouped && <Pressable accessibilityRole="button" onPress={() => finish(onUnlink)} style={styles.row}><Text style={[styles.label, { color: semantic.danger }]}>{t('executionUpdates.unlink')}</Text></Pressable>}
          {partners.map((partner) => <Pressable key={partner.id} accessibilityRole="button" accessibilityLabel={partner.name} onPress={() => finish(() => onLink(partner.id))} style={styles.row}>
            <Text numberOfLines={2} style={[styles.label, { color: colors.textPrimary }]}>{partner.name}</Text>
          </Pressable>)}
        </ScrollView>
      </>}
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ row: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }, label: { fontSize: 16, flex: 1 } });
