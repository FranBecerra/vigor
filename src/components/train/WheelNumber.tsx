import { useRef, useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, Text, View, useWindowDimensions, type ViewStyle, type GestureResponderEvent } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { wheelValues } from '@/services/training/numericWheel';
import { useTranslation } from 'react-i18next';

/** Tap keeps the keypad; hold opens a snapping wheel beside the original number. */
export function WheelNumber({ value, step, maximum, label, onChange, onPress, children, style }: {
  value?: number; step: number; maximum: number; label: string; onChange: (value: number) => void;
  onPress: () => void; children: ReactNode; style?: ViewStyle;
}) {
  const target = useRef<View>(null); const { height, width } = useWindowDimensions(); const { surfaces, colors, radius } = useTheme(); const { t } = useTranslation();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [origin, setOrigin] = useState(value); const options = anchor ? wheelValues(origin, step, maximum) : [];
  const start = Math.max(0, options.indexOf(origin ?? 0));
  const show = (event?: GestureResponderEvent) => {
    setOrigin(value);
    setAnchor({ x: event?.nativeEvent.pageX ?? width / 2, y: event?.nativeEvent.pageY ?? height / 2 });
    target.current?.measureInWindow((x, y) => setAnchor({ x, y }));
  };
  return <>
    <Pressable ref={target} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={show} delayLongPress={300} style={style}
      accessibilityActions={[{ name: 'showMenu', label }]}
      onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'showMenu') show(); }}>
      {children}
    </Pressable>
    {anchor && <Modal visible transparent animationType="fade" onRequestClose={() => setAnchor(null)}>
      <Pressable accessibilityLabel={t('workout.done')} onPress={() => setAnchor(null)} style={{ flex: 1, backgroundColor: '#0005' }} />
      {anchor && <View style={{ position: 'absolute', left: Math.max(12, Math.min(width - 160, anchor.x - 40)), top: Math.max(60, Math.min(height - 270, anchor.y - 90)), width: 148,
        ...surfaces.field, backgroundColor: colors.bgElevated, borderRadius: radius.lg, borderColor: colors.surfaceBorder, borderWidth: 1, padding: 10 }}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }}>{label}</Text>
        <View pointerEvents="none" style={{ position: 'absolute', top: 79, left: 10, right: 10, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface }} />
        <FlatList style={{ height: 132 }} data={options} keyExtractor={(item) => String(item)} initialScrollIndex={start}
          getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })} snapToInterval={44} decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: 44 }} showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={(event) => { const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / 44))); onChange(options[index]); }}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${item}`} onPress={() => onChange(item)} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{item.toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>
          </Pressable>} />
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 8 }}>± {step}</Text>
        <Pressable accessibilityRole="button" onPress={() => setAnchor(null)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>{t('workout.done')}</Text></Pressable>
      </View>}
    </Modal>}
  </>;
}
