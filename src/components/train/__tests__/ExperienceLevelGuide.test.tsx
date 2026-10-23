import React from 'react';
import { Modal, Text } from 'react-native';
import { ExperienceLevelGuide } from '../generate/ExperienceLevelGuide';
import { GenerationChoice } from '../generate/GenerationChoice';
import { ExperienceLevel } from '@/models';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const button = (tree: any, label: string) => tree.root.findAll((node: any) => node.props.accessibilityRole === 'button'
  && typeof node.props.onPress === 'function' && (node.props.accessibilityLabel === label
    || node.findAllByType(Text).some((text: any) => text.props.children === label)))[0];
const choose = async (tree: any, option: string) => act(async () => tree.root.findAllByType(GenerationChoice)
  .find((node: any) => node.props.title === `experienceGuide.options.${option}.title`).props.onPress());
it('requires an answer per question and lets the athlete review or cancel the result before applying', async () => {
  const select = jest.fn(), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ExperienceLevelGuide onSelect={select} onClose={close} />); });
  expect(button(tree, 'exerciseWizard.next').props.disabled).toBe(true);
  for (const option of ['CONSISTENT_YEARS', 'ESTABLISHED', 'SLOW']) {
    await choose(tree, option);
    await act(async () => button(tree, 'exerciseWizard.next').props.onPress());
  }
  expect(JSON.stringify(tree.toJSON())).toContain('generate.levelADVANCED');
  expect(select).not.toHaveBeenCalled();
  await act(async () => button(tree, 'generate.back').props.onPress());
  await choose(tree, 'UNSURE');
  await act(async () => button(tree, 'exerciseWizard.next').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('generate.levelINTERMEDIATE');
  await act(async () => button(tree, 'experienceGuide.apply').props.onPress());
  expect(select).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledWith(ExperienceLevel.INTERMEDIATE);
  expect(close).toHaveBeenCalledTimes(1); await act(async () => tree.unmount());
});
it('closes through Cancel or the system dismissal without changing the selected level', async () => {
  const select = jest.fn(), close = jest.fn(); let tree: any;
  await act(async () => { tree = create(<ExperienceLevelGuide onSelect={select} onClose={close} />); });
  await choose(tree, 'STARTING_RETURNING');
  await act(async () => button(tree, 'experienceGuide.close').props.onPress());
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  expect(select).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(2);
  await act(async () => tree.unmount());
});
