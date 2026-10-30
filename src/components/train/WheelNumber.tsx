import { useLayoutEffect, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, Text, View, useWindowDimensions, type ViewStyle, type GestureResponderEvent } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { wheelValues } from '@/services/training/numericWheel';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useWheelOverlay } from './WheelOverlay';
import { useWorkoutPagerGesture } from './WorkoutPagerGesture';

/** Tap keeps the keypad; hold opens a snapping wheel beside the original number. */
export function WheelNumber({ value, step, maximum, label, onChange, onPress, children, style }: {
  value?: number; step: number; maximum: number; label: string; onChange: (value: number) => void;
  onPress: () => void; children: ReactNode; style?: ViewStyle;
}) {
  const target = useRef<View>(null); const { height, width } = useWindowDimensions(); const { surfaces, colors, radius } = useTheme(); const { t } = useTranslation();
  const host = useWheelOverlay(), pager = useWorkoutPagerGesture();
  const owner = useRef(Symbol('number-wheel')).current, list = useRef<FlatList<number>>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const anchorRef = useRef(anchor); anchorRef.current = anchor;
  const [origin, setOrigin] = useState(value), [selected, setSelected] = useState(value);
  const options = useMemo(() => wheelValues(origin, step, maximum), [origin, step, maximum]);
  const start = Math.max(0, options.indexOf(origin ?? 0));
  const latest = useRef({ value, onChange }); latest.current = { value, onChange };
  const drag = useRef({ options: [] as number[], index: 0, selected: NaN });
  const interaction = useRef<'TAP' | 'HOLD' | 'SCROLL'>('SCROLL');
  const choose = (item: number, index: number) => {
    setSelected(item); latest.current.onChange(item); list.current?.scrollToOffset({ offset: index * 44, animated: false });
  };
  const close = () => { anchorRef.current = null; setAnchor(null); host?.clear(owner); };
  const show = (event?: GestureResponderEvent) => {
    if (anchorRef.current) return;
    setOrigin(value);
    setSelected(value);
    const position = { x: event?.nativeEvent.pageX ?? width / 2, y: event?.nativeEvent.pageY ?? height / 2 };
    anchorRef.current = position; setAnchor(position);
    target.current?.measureInWindow((x, y) => { if (anchorRef.current) setAnchor({ x, y }); });
  };
  const pan = useMemo(() => {
    const gesture = Gesture.Pan().activateAfterLongPress(300).runOnJS(true)
      .onStart(event => {
        interaction.current = 'HOLD';
        const value = latest.current.value;
        const values = wheelValues(value, step, maximum);
        drag.current = { options: values, index: Math.max(0, values.indexOf(value ?? 0)), selected: value ?? 0 };
        if (!anchorRef.current) {
          const position = { x: event.absoluteX, y: event.absoluteY };
          anchorRef.current = position; setAnchor(position); setOrigin(value); setSelected(value);
        }
      }).onUpdate(event => {
        if (!host || !anchorRef.current) return;
        const index = Math.max(0, Math.min(drag.current.options.length - 1, drag.current.index - Math.round(event.translationY / 12)));
        const item = drag.current.options[index];
        if (item === drag.current.selected) return;
        drag.current.selected = item; setSelected(item); latest.current.onChange(item);
        list.current?.scrollToOffset({ offset: index * 44, animated: false });
      });
    if (pager) gesture.blocksExternalGesture(pager);
    return gesture;
  }, [host, pager, step, maximum]);
  const pane = anchor && <>
    <Pressable accessibilityLabel={t('workout.done')} onPress={close} style={{ position: 'absolute', inset: 0, backgroundColor: '#0005' }} />
    <View accessibilityViewIsModal style={{ position: 'absolute', left: Math.max(12, Math.min(width - 160, anchor.x - 40)), top: Math.max(60, Math.min(height - 270, anchor.y - 90)), width: 148,
      ...surfaces.field, backgroundColor: colors.bgElevated, borderRadius: radius.lg, borderColor: colors.surfaceBorder, borderWidth: 1, padding: 10 }}>
      <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }}>{label}</Text>
      <View pointerEvents="none" style={{ position: 'absolute', top: 79, left: 10, right: 10, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface }} />
      <FlatList ref={list} keyboardShouldPersistTaps="always" style={{ height: 132 }} data={options} keyExtractor={item => String(item)} initialScrollIndex={start}
        getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })} snapToInterval={44} decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: 44 }} showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { interaction.current = 'SCROLL'; }}
        onScrollEndDrag={event => {
          if (interaction.current !== 'SCROLL') return;
          const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / 44)));
          choose(options[index], index);
        }}
        onMomentumScrollEnd={event => {
          if (interaction.current !== 'SCROLL') return;
          const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / 44)));
          choose(options[index], index);
        }}
        renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${item}`} accessibilityState={{ selected: selected === item }}
          onPress={() => { interaction.current = 'TAP'; choose(item, index); }} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: selected === item ? colors.accentText : colors.textPrimary, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{item.toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>
        </Pressable>} />
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 8 }}>± {step}</Text>
      <Pressable accessibilityRole="button" onPress={close} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.accentText }}>{t('workout.done')}</Text></Pressable>
    </View>
  </>;
  useLayoutEffect(() => {
    if (anchor && host) host.show({ owner, content: pane, dismiss: close });
    else host?.clear(owner);
  }, [anchor, host, owner, origin, selected, step, maximum, width, height, label, colors, surfaces]);
  useEffect(() => () => host?.clear(owner), [host, owner]);
  return <>
    <GestureDetector gesture={pan}>
    <Pressable ref={target} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={show} delayLongPress={300} style={style}
      accessibilityActions={[{ name: 'showMenu', label }]}
      onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'showMenu') show(); }}>
      {children}
    </Pressable>
    </GestureDetector>
    {anchor && !host && <Modal visible transparent animationType="fade" onRequestClose={close}>{pane}</Modal>}
  </>;
}
