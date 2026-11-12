import { CardioRoutineCard, CardioSessionRow } from '../CardioRoutineCard';
import { MesoRail } from '@/components/home/HomeHeader';
import { RoutineDayIndicator } from '@/components/home/RoutineDayIndicator';
import { cardioHomeFixture } from '@/test-support/cardioHomeFixture';
import { cardioHomeSessions } from '@/services/cardio/cardioHome';
const { create, act } = require('react-test-renderer');
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));

it('keeps the existing accordion/rail behavior, independent cycle counts and cardio row preview', async () => {
  const { block } = cardioHomeFixture(), open = jest.fn(), openBlock = jest.fn(); let tree: any;
  await act(async () => { tree = create(<CardioRoutineCard block={block} workouts={[]} sports={[]} onOpen={open} onOpenBlock={openBlock} />); });
  const rail = tree.root.findByType(MesoRail); expect(rail.props.microcycles).toHaveLength(4); expect(rail.props.caption).toBe('home.microcycle 1/4');
  await act(async () => rail.props.onPress()); expect(openBlock).toHaveBeenCalledWith(0);
  const row = tree.root.findAllByType(CardioSessionRow)[0];
  await act(async () => row.findAll((n: any) => n.props.accessibilityRole === 'button' && n.props.onPress)[0].props.onPress());
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ block, slot: block.slots[0] }));
  const toggle = tree.root.findAll((n: any) => typeof n.props.onPress === 'function' && n.props.accessibilityState?.expanded === true)[0];
  await act(async () => toggle.props.onPress()); expect(tree.root.findAllByType(MesoRail)).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('shows skip and sport states without awarding completed cardio to a reserved activity', async () => {
  const { block } = cardioHomeFixture();
  block.slots[0].disposition = 'SPORT'; block.slots[0].sportId = 'reserved';
  const entry = cardioHomeSessions(block, [])[0]; let tree: any;
  await act(async () => { tree = create(<CardioSessionRow entry={entry} onOpen={() => {}} />); });
  expect(tree.root.findByType(RoutineDayIndicator).props.completed).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('cardioTraining.sportReserved');
  entry.slot.disposition = 'SKIPPED';
  await act(async () => tree.update(<CardioSessionRow entry={entry} onOpen={() => {}} />));
  expect(tree.root.findByType(RoutineDayIndicator).props.completed).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('line-through');
  await act(async () => tree.unmount());
});
