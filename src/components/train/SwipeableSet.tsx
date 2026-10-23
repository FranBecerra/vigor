import { useRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { TrashIcon } from '@/components/icons/ActionIcons';
import { setSwipeDestination } from '@/services/training/setSwipe';
import { useWorkoutPagerGesture } from './WorkoutPagerGesture';

/** Full swipe or trash tap removes a set; reversing a reveal closes it cleanly. */
export function SwipeableSet({ children, onRemove, removeLabel, backgroundColor }: { children: ReactNode; onRemove?: () => void | boolean | Promise<void | boolean>; removeLabel?: string; backgroundColor?: string }) {
  const { t } = useTranslation(); const { semantic, colors } = useTheme();
  const width = useSharedValue(360), x = useSharedValue(0), start = useSharedValue(0);
  const removed = useRef(false);
  const pager = useWorkoutPagerGesture();
  const reset = () => { removed.current = false; x.value = withTiming(0, { duration: 160 }); };
  const remove = () => {
    if (removed.current || !onRemove) return;
    removed.current = true;
    try {
      const result = onRemove();
      if (result === false) reset();
      else if (result instanceof Promise) void result.then((success) => { if (success === false) reset(); }).catch(reset);
    } catch { reset(); }
  };
  const gesture = Gesture.Pan().enabled(!!onRemove).activeOffsetX([-10, 10]).failOffsetY([-12, 12])
    .onStart(() => { start.value = x.value; })
    .onUpdate((event) => { x.value = Math.max(-width.value, Math.min(0, start.value + event.translationX)); })
    .onEnd(() => {
      const target = setSwipeDestination(x.value, width.value);
      if (target === 'remove') runOnJS(remove)();
      else x.value = withTiming(target === 'reveal' ? -72 : 0, { duration: 200 });
    }).onFinalize((_event, success) => { if (!success) x.value = withTiming(0, { duration: 200 }); });
  if (pager) gesture.blocksExternalGesture(pager);
  const translated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View collapsable={false} layout={LinearTransition.duration(240)} exiting={FadeOut.duration(160)}
    onLayout={(event) => { width.value = event.nativeEvent.layout.width; }} style={{ overflow: 'hidden' }}>
    {onRemove && <View style={{ position: 'absolute', inset: 0, backgroundColor: semantic.danger, alignItems: 'flex-end', justifyContent: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={removeLabel ?? t('workout.removeSet')} onPress={remove}
        style={{ width: 72, minHeight: 56, alignItems: 'center', justifyContent: 'center' }}><TrashIcon color="#FFFFFF" /></Pressable>
    </View>}
    <GestureDetector gesture={gesture}><Animated.View style={[{ backgroundColor: backgroundColor ?? colors.bg }, translated]}>{children}</Animated.View></GestureDetector>
  </Animated.View>;
}
