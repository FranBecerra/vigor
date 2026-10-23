import React from 'react';
import { Alert, Text } from 'react-native';
import { RoutineDayFixture } from '../RoutineDayFixture';
import { RoutineDayList } from '../RoutineDayList';
import { SwipeableSet } from '../SwipeableSet';
const { act, create } = require('react-test-renderer');
jest.mock('../RoutineDayList', () => {
  const React = require('react');
  return { RoutineDayList: ({ items, renderItem }: any) => <>{items.map((item: any) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)}</> };
});
jest.mock('../SwipeableSet', () => ({ SwipeableSet: ({ children }: any) => children }));
it('exercises append, reorder, remove and confirmed skip entirely in memory', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); let tree: any;
  await act(async () => { tree = create(<RoutineDayFixture />); });
  const list = () => tree.root.findByType(RoutineDayList);
  act(() => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'Append fixture rest' && node.props.onPress)[0].props.onPress());
  expect(list().props.items.at(-1).kind).toBe('rest');
  act(() => list().props.onReorder(0, 2));
  expect(list().props.items.map((item: any) => item.id).slice(0, 3)).toEqual(['rest-1', 'lower', 'upper']);
  act(() => tree.root.findAllByType(SwipeableSet)[0].props.onRemove());
  expect(list().props.items.some((item: any) => item.id === 'rest-1')).toBe(false);
  act(() => list().props.onHold(list().props.items.find((item: any) => item.id === 'upper')));
  expect(alert).toHaveBeenCalled();
  expect(tree.root.findAllByType(Text).some((node: any) => node.props.style?.textDecorationLine === 'line-through')).toBe(false);
  act(() => (alert.mock.calls[0][2]![1].onPress as () => void)());
  expect(tree.root.findAllByType(Text).some((node: any) => node.props.style?.textDecorationLine === 'line-through')).toBe(true);
  await act(async () => tree.unmount()); alert.mockRestore();
});
