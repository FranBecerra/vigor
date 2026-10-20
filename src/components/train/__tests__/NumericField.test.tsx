import React from 'react';
import { TextInput } from 'react-native';
import { NumericField } from '../NumericField';
const { create, act } = require('react-test-renderer');

it('keeps the entered digits without inventing a different field value', async () => {
  const changed = jest.fn(); let tree: any;
  await act(async () => { tree = create(<NumericField value={10} onChangeValue={changed} accessibilityLabel="Maximum" />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('1'));
  expect(changed).toHaveBeenLastCalledWith(1);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('12'));
  expect(changed).toHaveBeenCalledTimes(2); expect(changed).toHaveBeenLastCalledWith(12);
  await act(async () => tree.unmount());
});
it('keeps a cleared entry empty instead of injecting zero or one', async () => {
  const changed = jest.fn(); let tree: any;
  await act(async () => { tree = create(<NumericField value={8} onChangeValue={changed} accessibilityLabel="Minimum" />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText(''));
  expect(changed).toHaveBeenLastCalledWith(undefined); expect(tree.root.findByType(TextInput).props.value).toBe('');
  await act(async () => tree.unmount());
});
it('retains immediate entry for performed workout values, including clearing and decimal commas', async () => {
  const changed = jest.fn(); let tree: any;
  await act(async () => { tree = create(<NumericField decimal value={10} onChangeValue={changed} accessibilityLabel="Kg" />); });
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('12,5'));
  expect(changed).toHaveBeenLastCalledWith(12.5);
  await act(async () => tree.root.findByType(TextInput).props.onChangeText(''));
  expect(changed).toHaveBeenLastCalledWith(undefined);
  await act(async () => tree.unmount());
});
