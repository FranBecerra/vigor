import React from 'react';
import { Text } from 'react-native';
import { RoutineDayList } from '../RoutineDayList';
const { create, act } = require('react-test-renderer');
const mockGestures: any[] = [];
jest.mock('react-native-gesture-handler', () => {
  const chain = (kind: string) => {
    const gesture: any = { kind, callbacks: {} };
    for (const method of ['enabled', 'activateAfterLongPress', 'runOnJS', 'minDuration', 'maxDistance']) gesture[method] = () => gesture;
    for (const method of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[method] = (callback: unknown) => { gesture.callbacks[method] = callback; return gesture; };
    mockGestures.push(gesture); return gesture;
  };
  return { GestureDetector: ({ children }: any) => children, Gesture: { Pan: () => chain('pan'), LongPress: () => chain('hold'), Simultaneous: (...items: unknown[]) => items } };
});
it('keeps a live drag gesture stable as siblings move and opens hold actions without reordering', async () => {
  const reorder = jest.fn(), hold = jest.fn(); let tree: any;
  mockGestures.length = 0;
  await act(async () => { tree = create(<RoutineDayList items={[{ id: 'a', kind: 'workout' }, { id: 'b', kind: 'rest' }]}
    onReorder={reorder} onHold={hold} renderItem={(item) => <Text>{item.id}</Text>} />); });
  const pan = mockGestures[0], longPress = mockGestures[1]; const count = mockGestures.length;
  act(() => { pan.callbacks.onStart(); pan.callbacks.onUpdate({ translationY: 70 }); });
  expect(mockGestures).toHaveLength(count);
  act(() => pan.callbacks.onEnd()); expect(reorder).toHaveBeenCalledWith(0, 1);
  act(() => { pan.callbacks.onStart(); longPress.callbacks.onEnd({}, true); pan.callbacks.onEnd(); });
  expect(hold).toHaveBeenCalledWith({ id: 'a', kind: 'workout' }); expect(reorder).toHaveBeenCalledTimes(1);
  act(() => pan.callbacks.onFinalize({}, false));
  await act(async () => tree.unmount());
});
it('edge-scrolls while a day is held near the screen boundary and stops when the drag is cancelled', async () => {
  jest.useFakeTimers(); let offset = 0; const scrollBy = jest.fn((delta: number) => { offset += delta; });
  const reorder = jest.fn(); let tree: any; mockGestures.length = 0;
  await act(async () => { tree = create(<RoutineDayList items={[{ id: 'a', kind: 'workout' }, { id: 'b', kind: 'rest' }]}
    edgeScroll={{ currentOffset: () => offset, scrollBy, top: 70, bottom: 700 }} onReorder={reorder} renderItem={(item) => <Text>{item.id}</Text>} />); });
  const pan = mockGestures[0];
  act(() => { pan.callbacks.onStart(); pan.callbacks.onUpdate({ translationY: 20, absoluteY: 750 }); jest.advanceTimersByTime(96); });
  expect(scrollBy).toHaveBeenCalled(); expect(offset).toBeGreaterThan(0);
  act(() => pan.callbacks.onFinalize({}, false)); const calls = scrollBy.mock.calls.length;
  act(() => jest.advanceTimersByTime(96)); expect(scrollBy).toHaveBeenCalledTimes(calls); expect(reorder).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); jest.useRealTimers();
});
