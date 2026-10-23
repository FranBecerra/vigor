import React from 'react';
import { Modal } from 'react-native';
import { ExerciseSwapSheet } from '../generate/ExerciseSwapSheet';
jest.mock('@/hooks/useExerciseCatalogue', () => ({ useOptionalExerciseCatalogue: () => null }));
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
const { create, act } = require('react-test-renderer');
jest.mock('@/hooks/useMeasuredCommit', () => ({ measureNextFrame: (_metric: string, ready?: () => void) => ready?.() }));
let mockGesture: any;
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: any) => children, Gesture: { Pan: () => {
  const chain: any = { callbacks: {} };
  for (const method of ['activeOffsetY', 'failOffsetX']) chain[method] = () => chain;
  for (const method of ['onUpdate', 'onEnd', 'onFinalize']) chain[method] = (callback: unknown) => { chain.callbacks[method] = callback; return chain; };
  mockGesture = chain; return chain;
} } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../CustomExerciseSheet', () => ({ CustomExerciseSheet: () => null }));
it('returns a short downward drag to its place and dismisses after a deliberate downward drag only once', async () => {
  const close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ExerciseSwapSheet open current={EXERCISE_CATALOGUE[0]} candidates={EXERCISE_CATALOGUE.slice(1, 4)} onSelect={jest.fn()} onClose={close} />); });
  act(() => { mockGesture.callbacks.onUpdate({ translationY: 30 }); mockGesture.callbacks.onEnd({ translationY: 30, velocityY: 0 }); });
  expect(close).not.toHaveBeenCalled();
  act(() => mockGesture.callbacks.onFinalize({}, false)); expect(close).not.toHaveBeenCalled();
  await act(async () => { mockGesture.callbacks.onUpdate({ translationY: 100 }); mockGesture.callbacks.onEnd({ translationY: 100, velocityY: 0 }); });
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => mockGesture.callbacks.onEnd({ translationY: 100, velocityY: 0 })); expect(close).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('reports readiness after the native modal is shown and its entry animation completes, not on mount', async () => {
  const ready = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ExerciseSwapSheet open current={EXERCISE_CATALOGUE[0]} candidates={[]}
    onSelect={jest.fn()} onClose={jest.fn()} onPresented={ready} />); });
  expect(ready).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType(Modal).props.onShow());
  expect(ready).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
