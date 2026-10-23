import React from 'react';
import { RestTimer } from '../RestTimer';
import { NumericField } from '../NumericField';
const { create, act } = require('react-test-renderer');
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { Text: require('react-native').Text },
  FadeIn: { duration: () => undefined }, FadeOut: { duration: () => undefined } }));
jest.mock('@/hooks/useRestAlert', () => ({ useRestAlert: () => false }));
jest.mock('@/components/GlassSurface', () => ({ GlassSurface: ({ children }: any) => children }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
it('closes adjustment controls without cancelling a rest and cancels only via the explicit action', async () => {
  jest.useFakeTimers(); const cancel = jest.fn(); let tree: any;
  await act(async () => { tree = create(<RestTimer state={{ startedAt: Date.now(), durationSeconds: 120, anchorSetId: 's' }}
    onAdjust={jest.fn()} onRestart={jest.fn()} onSetDuration={jest.fn()} onCancel={cancel} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function').at(-1);
  await act(async () => button('restControls.open').props.onPress());
  await act(async () => button('restControls.close').props.onPress()); expect(cancel).not.toHaveBeenCalled();
  await act(async () => button('restControls.open').props.onPress());
  await act(async () => button('restControls.cancel').props.onPress()); expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount()); jest.useRealTimers();
});
it('opens the exercise prescription even before the first rest and saves plan duration separately from quick adjustments', async () => {
  const save = jest.fn().mockResolvedValue(undefined), adjust = jest.fn(), setDuration = jest.fn(); let tree: any;
  await act(async () => { tree = create(<RestTimer state={{ startedAt: null, durationSeconds: 0, anchorSetId: null }}
    prescribedSeconds={150} exerciseName="Squat" onSetPrescription={save} onAdjust={adjust} onSetDuration={setDuration} onRestart={jest.fn()} onCancel={jest.fn()} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function').at(-1);
  await act(async () => button('restControls.open').props.onPress());
  const field = tree.root.findByType(NumericField); expect(field.props.value).toBe(150);
  await act(async () => field.props.onChangeValue(165)); expect(save).toHaveBeenCalledWith(165); expect(setDuration).not.toHaveBeenCalled(); expect(adjust).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
