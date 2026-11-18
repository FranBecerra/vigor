import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { moveItem } from '@/services/training/workoutReview';

const HEIGHT = 64;
export interface DayListScroll { currentOffset: () => number; scrollBy: (delta: number) => void; top: number; bottom: number }
function Position({ y, active, height, children }: { y: number; active: boolean; height: number; children: ReactNode }) {
  const position = useSharedValue(y);
  useEffect(() => { position.value = active ? y : withTiming(y, { duration: 200 }); }, [y, active, position]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: position.value }] }));
  return <Animated.View exiting={FadeOut.duration(160)} style={[{ position: 'absolute', top: 0, left: 0, right: 0, height, zIndex: active ? 10 : 0 }, style]}>{children}</Animated.View>;
}
function DraggableDay({ index, disabled, height, onDrag, onDrop, onCancel, onHold, children }: {
  index: number; disabled: boolean; height: number; onDrag: (from: number, delta: number, y?: number) => void; onDrop: () => void;
  onCancel: () => void; onHold?: () => void; children: ReactNode;
}) {
  const moved = useRef(false);
  const hold = useRef(onHold); hold.current = onHold;
  const gesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Pan().enabled(!disabled).activateAfterLongPress(280).runOnJS(true)
      .onStart(() => { moved.current = false; onDrag(index, 0); })
      .onUpdate((event) => { if (Math.abs(event.translationY) > 8) moved.current = true; onDrag(index, event.translationY, event.absoluteY); })
      .onEnd(onDrop).onFinalize((_event, success) => { if (!success) onCancel(); }),
    Gesture.LongPress().enabled(!disabled && !!onHold).minDuration(350).maxDistance(8).runOnJS(true)
      .onEnd((_event, success) => { if (success && !moved.current) hold.current?.(); }),
  ), [index, disabled, onDrag, onDrop, onCancel, !!onHold]);
  return <GestureDetector gesture={gesture}><View style={{ height, justifyContent: 'center' }}>{children}</View></GestureDetector>;
}

export function routineDropIndex<T>(items: readonly T[], from: number, delta: number, height: number, canDrop?: (item: T, from: number, to: number) => boolean) {
  let target = Math.max(0, Math.min(items.length - 1, from + Math.round(delta / height)));
  while (target !== from && canDrop && !canDrop(items[target], from, target)) target += target > from ? -1 : 1;
  return target;
}

/** Reorder in place: adjacent days slide aside while stable workout/rest IDs move. */
export function RoutineDayList<T extends { id: string; kind: string }>({ items, renderItem, onReorder, onHold, disabled = false, edgeScroll, canDrag, canDrop, itemHeight = HEIGHT }: {
  items: readonly T[]; renderItem: (item: T) => ReactNode; onReorder: (from: number, to: number) => void;
  onHold?: (item: T) => void; disabled?: boolean; edgeScroll?: DayListScroll;
  canDrag?: (item: T, index: number) => boolean;
  canDrop?: (item: T, from: number, to: number) => boolean;
  itemHeight?: number;
}) {
  const [drag, setDrag] = useState<{ from: number; delta: number } | null>(null);
  const current = useRef(drag); const latest = useRef({ items, onReorder, canDrop }); latest.current = { items, onReorder, canDrop };
  const original = useRef<readonly T[] | null>(null);
  const scrollStart = useRef<number | null>(null), translation = useRef(0), direction = useRef(0);
  const edgeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopEdge = () => { if (edgeTimer.current !== null) clearInterval(edgeTimer.current); edgeTimer.current = null; scrollStart.current = null; };
  useEffect(() => stopEdge, []);
  const handlers = useMemo(() => ({
    update: (from: number, delta: number, y?: number) => {
      if (!current.current) original.current = latest.current.items;
      if (scrollStart.current === null) scrollStart.current = edgeScroll?.currentOffset() ?? 0;
      translation.current = delta;
      current.current = { from, delta: delta + (edgeScroll?.currentOffset() ?? 0) - scrollStart.current }; setDrag(current.current);
      direction.current = edgeScroll && y !== undefined ? y < edgeScroll.top ? -1 : y > edgeScroll.bottom ? 1 : 0 : 0;
      if (direction.current && edgeScroll && edgeTimer.current === null) edgeTimer.current = setInterval(() => {
        if (!current.current || scrollStart.current === null) return;
        edgeScroll.scrollBy(direction.current * 8);
        current.current = { ...current.current, delta: translation.current + edgeScroll.currentOffset() - scrollStart.current };
        setDrag(current.current);
      }, 16);
      else if (!direction.current && edgeTimer.current !== null) { clearInterval(edgeTimer.current); edgeTimer.current = null; }
    },
    end: () => {
      const value = current.current;
      if (value && original.current?.length === latest.current.items.length
        && original.current.every((item, index) => item.id === latest.current.items[index].id)) {
        const target = routineDropIndex(latest.current.items, value.from, value.delta, itemHeight, latest.current.canDrop);
        if (target !== value.from) latest.current.onReorder(value.from, target);
      }
      stopEdge(); current.current = null; setDrag(null);
    },
    cancel: () => { stopEdge(); current.current = null; setDrag(null); },
  }), [edgeScroll, itemHeight]);
  const target = drag ? routineDropIndex(items, drag.from, drag.delta, itemHeight, canDrop) : -1;
  const positions = drag ? moveItem(items.map((_, index) => index), drag.from, target) : items.map((_, index) => index);
  return <Animated.View layout={LinearTransition.duration(220)} style={{ height: items.length * itemHeight }}>
    {items.map((item, index) => <Position key={`${item.kind}:${item.id}`} active={drag?.from === index} height={itemHeight}
      y={drag?.from === index ? index * itemHeight + drag.delta : positions.indexOf(index) * itemHeight}>
      <DraggableDay index={index} height={itemHeight} disabled={disabled || canDrag?.(item, index) === false} onDrag={handlers.update} onDrop={handlers.end} onCancel={handlers.cancel}
        onHold={onHold ? () => onHold(item) : undefined}>{renderItem(item)}</DraggableDay>
    </Position>)}
  </Animated.View>;
}
