import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { Exercise } from '@/models';
import { moveWorkoutExercise } from '@/services/training/workoutRuntime';

const PITCH = 92;

function ExercisePosition({ x, dragging, children }: { x: number; dragging: boolean; children: ReactNode }) {
  const position = useSharedValue(x);
  useEffect(() => { position.value = dragging ? x : withTiming(x, { duration: 180 }); }, [x, dragging, position]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }] }));
  return <Animated.View style={[{ position: 'absolute', top: 5, left: 0, zIndex: dragging ? 10 : 0 }, animated]}>{children}</Animated.View>;
}

function DraggableExercise({ exercise, index, active, dragging, onDrag, onDrop, onCancel, onSelect, onMove }:
  { exercise: Exercise; index: number; active: boolean; dragging: boolean;
    onDrag: (index: number, delta: number, x: number) => void; onDrop: () => void; onCancel: () => void;
    onSelect: () => void; onMove: (direction: number) => void }) {
  const { colors, radius, sectionAccent } = useTheme(); const { t } = useTranslation();
  const pan = useMemo(() => Gesture.Pan().activateAfterLongPress(280).runOnJS(true)
    .onStart((event) => onDrag(index, 0, event.absoluteX))
    .onUpdate((event) => onDrag(index, event.translationX, event.absoluteX))
    .onEnd(onDrop).onFinalize((_event, success) => { if (!success) onCancel(); }), [index, onDrag, onDrop, onCancel]);
  return <GestureDetector gesture={pan}>
    <View>
      <Pressable onPress={onSelect} accessibilityRole="button" accessibilityLabel={exercise.name}
        accessibilityHint={t('workout.dragHint')} accessibilityState={{ selected: active }}
        accessibilityActions={[{ name: 'decrement', label: t('rehab.moveUp') }, { name: 'increment', label: t('workout.moveDown') }]}
        onAccessibilityAction={({ nativeEvent }) => onMove(nativeEvent.actionName === 'decrement' ? -1 : 1)}
        style={{ width: 84, height: 72, borderRadius: radius.md, justifyContent: 'center', padding: 7, borderWidth: 1.5,
          backgroundColor: colors.bgElevated, borderColor: active || dragging ? sectionAccent.train : colors.surfaceBorder,
          transform: [{ scale: dragging ? 1.06 : 1 }] }}>
        <Text numberOfLines={3} style={{ color: active ? sectionAccent.train : colors.textSecondary, textAlign: 'center', fontSize: 10, lineHeight: 13, fontWeight: '600' }}>{exercise.name}</Text>
      </Pressable>
    </View>
  </GestureDetector>;
}

/** Long-press and drag directly in the existing exercise rail, with edge scrolling. */
export function WorkoutExerciseStrip({ exercises, activeId, onSelect, onReorder, onAdd }:
  { exercises: Exercise[]; activeId?: string; onSelect: (index: number) => void; onReorder: (items: Exercise[]) => void; onAdd: () => void }) {
  const { colors, sectionAccent, spacing, radius } = useTheme(); const { t } = useTranslation();
  const rail = useRef<ScrollView>(null); const viewport = useRef<View>(null);
  const offset = useRef(0); const bounds = useRef({ x: 0, width: 0 });
  const [drag, setDrag] = useState<{ from: number; delta: number } | null>(null);
  const dragRef = useRef<{ from: number; startOffset: number; delta: number } | null>(null);
  const latest = useRef({ exercises, onReorder }); latest.current = { exercises, onReorder };
  const activeIndex = exercises.findIndex((exercise) => exercise.id === activeId);
  const revealActive = () => {
    if (dragRef.current || activeIndex < 0) return;
    const width = bounds.current.width;
    if (!width) return;
    const left = spacing.lg + activeIndex * PITCH;
    const next = left < offset.current ? Math.max(0, left - spacing.lg)
      : left + 84 > offset.current + width ? left + 84 + spacing.lg - width : offset.current;
    rail.current?.scrollTo({ x: next, animated: true });
  };
  useEffect(revealActive, [activeIndex, exercises.length, spacing.lg]);
  const handlers = useMemo(() => ({
    update: (from: number, delta: number, x: number) => {
      if (!dragRef.current) {
        dragRef.current = { from, startOffset: offset.current, delta: 0 };
        viewport.current?.measureInWindow((left, _y, width) => { bounds.current = { x: left, width }; });
      }
      const { x: left, width } = bounds.current;
      if (width > 0) {
        const direction = x < left + 42 ? -1 : x > left + width - 42 ? 1 : 0;
        if (direction) {
          const max = Math.max(0, latest.current.exercises.length * PITCH + PITCH + spacing.lg * 2 - width);
          offset.current = Math.max(0, Math.min(max, offset.current + direction * 7));
          rail.current?.scrollTo({ x: offset.current, animated: false });
        }
      }
      dragRef.current.delta = delta + offset.current - dragRef.current.startOffset;
      setDrag({ from, delta: dragRef.current.delta });
    },
    end: () => {
      const current = dragRef.current;
      if (current) {
        const to = Math.max(0, Math.min(latest.current.exercises.length - 1, current.from + Math.round(current.delta / PITCH)));
        if (to !== current.from) latest.current.onReorder(moveWorkoutExercise(latest.current.exercises, current.from, to));
      }
      dragRef.current = null; setDrag(null);
    },
    cancel: () => { dragRef.current = null; setDrag(null); },
  }), [spacing.lg]);
  const target = drag ? Math.max(0, Math.min(exercises.length - 1, drag.from + Math.round(drag.delta / PITCH))) : -1;
  return <View ref={viewport} style={{ height: 86 }} onLayout={(event) => {
    bounds.current.width = event.nativeEvent.layout.width; revealActive();
  }}>
    <ScrollView ref={rail} horizontal scrollEnabled={!drag} showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
      onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.x; }}
      contentContainerStyle={{ height: 86, width: (exercises.length + 1) * PITCH + spacing.lg * 2, paddingHorizontal: spacing.lg }}>
      {exercises.map((exercise, index) => {
        const shift = !drag || index === drag.from ? 0 : drag.from < target && index > drag.from && index <= target ? -PITCH
          : drag.from > target && index < drag.from && index >= target ? PITCH : 0;
        return <ExercisePosition key={exercise.id} dragging={drag?.from === index}
          x={spacing.lg + index * PITCH + (drag?.from === index ? drag.delta : shift)}>
          <DraggableExercise exercise={exercise} index={index} active={exercise.id === activeId} dragging={drag?.from === index}
            onDrag={handlers.update} onDrop={handlers.end} onCancel={handlers.cancel} onSelect={() => onSelect(index)}
            onMove={(direction) => onReorder(moveWorkoutExercise(exercises, index, index + direction))} />
        </ExercisePosition>;
      })}
      <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={t('train.addExercise')}
        style={{ position: 'absolute', left: spacing.lg + exercises.length * PITCH, top: 5, width: 70, height: 72,
          borderRadius: radius.md, backgroundColor: colors.bgElevated, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 24, color: sectionAccent.train }}>+</Text>
      </Pressable>
    </ScrollView>
  </View>;
}
