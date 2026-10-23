import React from 'react';
import { TextInput } from 'react-native';
import { NumericKeypad } from '../NumericKeypad';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'workout.done' ? require('@/i18n/locales/es.json').workout.done : key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
it('retains a private numeric draft and commits only on Enter, without an OS keyboard', async () => {
  const save = jest.fn(), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<NumericKeypad label="Max" value={12} onSave={save} onClose={close} />); });
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await act(async () => button('2').props.onPress()); await act(async () => button('0').props.onPress());
  expect(save).not.toHaveBeenCalled(); expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await act(async () => button('Listo').props.onPress()); expect(save).toHaveBeenCalledWith(20); expect(close).toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('cancels without committing a cleared field or changing a neighbouring field', async () => {
  const save = jest.fn(), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<NumericKeypad label="Min" value={8} onSave={save} onClose={close} />); });
  const erase = tree.root.findAll((node: any) => node.props.accessibilityLabel === 'workout.eraseDigit' && typeof node.props.onLongPress === 'function')[0];
  await act(async () => erase.props.onLongPress());
  await act(async () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'generate.cancel' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(save).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
