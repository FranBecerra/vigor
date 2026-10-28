import React from 'react';
import { Modal } from 'react-native';
import { BioNightDetailsSheet } from '../BioNightDetailsSheet';
const { create, act } = require('react-test-renderer');
const close = jest.fn(), reload = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
it('uses an independent dismissible page sheet and preserves explicit refresh semantics', async () => {
  let tree: any; await act(async () => { tree = create(<BioNightDetailsSheet night={{ owner: 'owner', state: 'READY', analysis: { status: 'EMPTY' } as any, reload }} onClose={close} />); });
  const modal = tree.root.findByType(Modal);
  expect(modal.props.presentationStyle).toBe('pageSheet');expect(modal.props.allowSwipeDismissal).toBe(true);expect(modal.props.animationType).toBe('slide');
  expect(reload).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('bioHealth.noData');
  const button = (label: string) => tree.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await act(async () => button('bio.close').props.onPress());expect(close).toHaveBeenCalledTimes(1);
  await act(async () => modal.props.onRequestClose());expect(close).toHaveBeenCalledTimes(2);
  await act(async () => button('bioNight.refresh').props.onPress());expect(reload).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
