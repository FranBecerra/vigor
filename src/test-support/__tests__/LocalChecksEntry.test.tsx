import React from 'react';
import { LocalChecksEntry } from '../LocalChecksEntry';
const { act, create } = require('react-test-renderer');
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const original = process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS;
afterEach(() => { if (original === undefined) delete process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS; else process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS = original; jest.clearAllMocks(); });
it.each([undefined, '', '0', 'true'])('does not render a QA entry for a normal or malformed flag: %p', async flag => {
  if (flag === undefined) delete process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS; else process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS = flag;
  let tree: any; await act(async () => { tree = create(<LocalChecksEntry />); });
  expect(tree.toJSON()).toBeNull(); expect(mockPush).not.toHaveBeenCalled(); await act(async () => tree.unmount());
});
it('navigates only to existing memory-only checks after an explicit QA tap', async () => {
  process.env.EXPO_PUBLIC_VIGOR_LOCAL_CHECKS = '1'; let tree: any;
  await act(async () => { tree = create(<LocalChecksEntry />); }); expect(mockPush).not.toHaveBeenCalled();
  const button = tree.root.findAll((n: any) => n.props.accessibilityLabel === 'Local checks · synthetic data' && n.props.onPress)[0];
  await act(async () => button.props.onPress()); expect(mockPush).toHaveBeenCalledWith('/cardio-check'); await act(async () => tree.unmount());
});
