import React from 'react';
import { SessionEffortInput } from '../SessionEffortInput';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, args?: { value: number }) => args ? `${key}:${args.value}` : key }) }));

it('has ten sufficiently large choices, no preselection and explicit optional clearing without a keyboard', async () => {
  const change = jest.fn(); let tree: any;
  await act(async () => { tree = create(<SessionEffortInput value={null} onChange={change} />); });
  const choices = () => tree.root.findAll((node: any) => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function');
  expect(choices()).toHaveLength(10);
  expect(choices().every((node: any) => !node.props.accessibilityState.selected && node.props.style.minHeight >= 44)).toBe(true);
  expect(change).not.toHaveBeenCalled();
  await act(async () => choices()[6].props.onPress()); expect(change).toHaveBeenLastCalledWith(7);
  await act(async () => tree.update(<SessionEffortInput value={7} onChange={change} />));
  expect(choices()[6].props.accessibilityState.selected).toBe(true);
  await act(async () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'sessionEffort.skip' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(change).toHaveBeenLastCalledWith(null);
  await act(async () => tree.update(<SessionEffortInput value={7} onChange={change} disabled />));
  expect(choices().every((node: any) => node.props.disabled)).toBe(true);
  await act(async () => tree.unmount());
});
