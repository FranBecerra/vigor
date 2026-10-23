import React from 'react';
import { Text } from 'react-native';
import { RerollFeedback, type RerollNotice } from '../generate/RerollFeedback';
const { act, create } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
it.each([
  ['updated', 'generate.rerollUpdated'], ['unchanged', 'generate.rerollUnchanged'],
  ['edited', 'generate.rerollEdited'], ['failed', 'generate.rerollFailed'],
] as [RerollNotice, string][])('keeps the %s result visible with a polite announcement', async (notice, message) => {
  let tree: any;
  await act(async () => { tree = create(<RerollFeedback notice={notice} />); });
  expect(tree.root.findByType(Text).props.children).toBe(message);
  expect(tree.root.findByType(Text).props.accessibilityLiveRegion).toBe('polite');
  await act(async () => tree.unmount());
});
it('renders no message before a variation result', async () => {
  let tree: any; await act(async () => { tree = create(<RerollFeedback notice={null} />); });
  expect(tree.toJSON()).toBeNull(); await act(async () => tree.unmount());
});
