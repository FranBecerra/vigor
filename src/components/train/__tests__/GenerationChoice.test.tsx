import React from 'react';
import { PriorityBudget, GenerationChoice } from '../generate/GenerationChoice';
import { Text, View } from 'react-native';
import { SplitDiagram, SplitLegend } from '../generate/SplitDiagram';
import { EquipmentIllustration } from '../generate/EquipmentIllustration';
import { BodyMap } from '../BodyMap';
import Svg, { LinearGradient } from 'react-native-svg';
import { DEFAULT_GENERATOR_EQUIPMENT } from '@/services/training/generatorDefaults';
import { Equipment, SplitStructure } from '@/models';
import { BODY_MAP } from '@/data/bodyMapPaths';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('shows a whole point and a half point without changing the budget', async () => {
  let tree: any;
  await act(async () => { tree = create(<PriorityBudget used={1.5} total={2} />); });
  expect(tree.root.findByProps({ testID: 'priority-fill-0' }).props.style.width).toBe('100%');
  expect(tree.root.findByProps({ testID: 'priority-fill-1' }).props.style.width).toBe('50%');
  await act(async () => tree.update(<PriorityBudget used={0} total={2} />));
  expect(tree.root.findByProps({ testID: 'priority-fill-0' }).props.style.width).toBe('0%');
  await act(async () => tree.unmount());
});
it('makes the entire card selectable and exposes single versus multiple choice', async () => {
  const select = jest.fn(); let tree: any;
  await act(async () => { tree = create(<GenerationChoice title="Goal" description="Description" selected onPress={select} />); });
  const radio = tree.root.findAll((node: any) => node.props.accessibilityRole === 'radio' && typeof node.props.onPress === 'function')[0];
  expect(radio.props.accessibilityState).toEqual({ selected: true });
  await act(async () => radio.props.onPress()); expect(select).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<GenerationChoice title="Equipment" multiple selected onPress={select} />));
  expect(tree.root.findAll((node: any) => node.props.accessibilityRole === 'checkbox')[0].props.accessibilityState).toEqual({ checked: true });
  await act(async () => tree.unmount());
});

it('keeps the budget help beside the label and hides explanatory copy until requested', async () => {
  let tree: any;
  await act(async () => { tree = create(<PriorityBudget used={1} total={2} hint="Budget help" />); });
  expect(tree.root.findAllByType(Text).some((node: any) => node.props.children === 'Budget help')).toBe(false);
  const info = () => tree.root.findAll((node: any) => node.props.accessibilityLabel === 'generate.budgetInfo' && typeof node.props.onPress === 'function')[0];
  expect(info().props.accessibilityState.expanded).toBe(false);
  await act(async () => info().props.onPress());
  expect(info().props.accessibilityState.expanded).toBe(true);
  expect(tree.root.findAllByType(Text).some((node: any) => node.props.children === 'Budget help')).toBe(true);
  await act(async () => info().props.onPress());
  expect(info().props.accessibilityState.expanded).toBe(false);
  await act(async () => tree.unmount());
});
it('renders complete bodies, reuses anatomy and creates unique colour-band references', async () => {
  let tree: any;
  await act(async () => { tree = create(<View><SplitDiagram split={SplitStructure.FULL_BODY} sessions={4} />
    <SplitDiagram split={SplitStructure.UPPER_LOWER} sessions={4} /></View>); });
  const boxes = tree.root.findAllByType(Svg).map((node: any) => node.props.viewBox);
  expect(boxes).toEqual([BODY_MAP.front.viewBox, BODY_MAP.back.viewBox, BODY_MAP.front.viewBox, BODY_MAP.back.viewBox]);
  const gradients = tree.root.findAllByType(LinearGradient).map((node: any) => node.props.id);
  expect(gradients.length).toBeGreaterThan(0); expect(new Set(gradients).size).toBe(gradients.length);
  await act(async () => tree.update(<SplitDiagram split={SplitStructure.AUTO} sessions={4} />));
  expect(tree.root.findAllByType(BodyMap)).toHaveLength(1);
  expect(tree.root.findAllByType(LinearGradient)).toHaveLength(0);
  await act(async () => tree.update(<SplitLegend split={SplitStructure.AUTO} sessions={4} />));
  expect(tree.root.findAllByType(Text).some((node: any) => node.props.children === 'generate.splitDiagramAuto')).toBe(true);
  await act(async () => tree.update(<SplitLegend split={SplitStructure.UPPER_LOWER} sessions={4} />));
  expect(tree.root.findAllByType(Text)).toHaveLength(4);
  await act(async () => tree.unmount());
});
it('provides a distinct editable equipment illustration for every selectable implement', async () => {
  const pictures: string[] = []; let tree: any;
  for (const equipment of [...DEFAULT_GENERATOR_EQUIPMENT, Equipment.UNSPECIFIED]) {
    await act(async () => { if (tree) tree.update(<EquipmentIllustration equipment={equipment} />);
      else tree = create(<EquipmentIllustration equipment={equipment} />); });
    expect(tree.root.findByType(Svg).props.testID).toBe(`equipment-art-${equipment}`);
    const json = tree.toJSON();
    pictures.push(JSON.stringify(json.children));
  }
  expect(new Set(pictures).size).toBe(pictures.length);
  await act(async () => tree.unmount());
});
