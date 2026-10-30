import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { SPORT_KINDS } from '@/models/sportActivity';
import { SportActivityIcon } from '../SportActivityIcon';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
const { create, act } = require('react-test-renderer');
beforeEach(() => { jest.replaceProperty(Platform, 'OS', 'android'); });
afterEach(() => { jest.restoreAllMocks(); });
it('uses the same native running figure as the Activities link on iPhone', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios'); let tree: any;
  await act(async () => { tree = create(<SportActivityIcon sport="RUNNING" size={28} color="#42746A" />); });
  expect(tree.root.findByType(SymbolView).props).toMatchObject({ name: 'figure.run', type: 'hierarchical', size: 28, tintColor: '#42746A' });
  await act(async () => tree.unmount());
});

it.each(SPORT_KINDS)('renders a monochrome scalable %s vector with no raster asset', async sport => {
  let tree: any;
  await act(async () => { tree = create(<SportActivityIcon sport={sport} color="#42746A" size={28} />); });
  expect(tree.root.findByType(Svg).props).toMatchObject({ width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none' });
  const paths = tree.root.findAllByType(Path);
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    expect(path.props.stroke).toBe('#42746A');
    expect(path.props.d).toEqual(expect.any(String));
    expect(path.props.d).not.toMatch(/NaN|undefined|Infinity/);
  }
  await act(async () => tree.unmount());
});
