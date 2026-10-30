import React from 'react';
import { Modal } from 'react-native';
import { HealthAccessReview } from '../HealthAccessReview';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const button = (tree: any, key: string) => tree.root.findAll((n: any) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function'
  && n.findAll((c: any) => c.props.children === key).length)[0];
it('always shows management instructions without prompting until a separate explicit request, then confirms completion without claiming a read grant', async () => {
  const request = jest.fn(async () => true), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<HealthAccessReview onClose={close} onRequest={request} busy={false} />); });
  expect(request).not.toHaveBeenCalled(); expect(JSON.stringify(tree.toJSON())).toContain('healthAccess.path');
  await act(async () => button(tree, 'healthAccess.request').props.onPress()); expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).toContain('healthAccess.reviewed');
  await act(async () => tree.root.findByType(Modal).props.onRequestClose()); expect(close).toHaveBeenCalledTimes(1);
  await act(async () => button(tree, 'workout.done').props.onPress()); expect(close).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
it('serializes taps, handles rejected/false requests and never completes a closed sheet', async () => {
  let finish!: (v: boolean) => void; const request = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; })); let tree: any;
  await act(async () => { tree = create(<HealthAccessReview onClose={() => {}} onRequest={request} busy={false} />); });
  await act(async () => { button(tree, 'healthAccess.request').props.onPress(); button(tree, 'healthAccess.request').props.onPress(); });
  expect(request).toHaveBeenCalledTimes(1); await act(async () => finish(false)); expect(JSON.stringify(tree.toJSON())).toContain('healthAccess.error');
  request.mockRejectedValueOnce(Error('no')); await act(async () => button(tree, 'healthAccess.request').props.onPress()); expect(JSON.stringify(tree.toJSON())).toContain('healthAccess.error');
  await act(async () => button(tree, 'healthAccess.request').props.onPress()); await act(async () => tree.unmount()); await act(async () => finish(true));
  await act(async () => { tree = create(<HealthAccessReview onClose={() => {}} onRequest={request} busy />); });
  expect(button(tree, 'healthAccess.request').props.disabled).toBe(true); await act(async () => button(tree, 'healthAccess.request').props.onPress()); expect(request).toHaveBeenCalledTimes(3);
  await act(async () => tree.unmount());
});
