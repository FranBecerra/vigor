import { Equipment, MuscleGroup as M, SplitStructure as S } from '@/models';
import { splitDiagramPaint, splitDiagramSessions, sortEquipmentOptions } from '../generationPresentation';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import { DEFAULT_GENERATOR_EQUIPMENT } from '../generatorDefaults';

it('shows numbered sessions with unique colours and no invented AUTO assignment', () => {
  expect(splitDiagramSessions(S.AUTO, 4)).toEqual([]);
  expect(splitDiagramPaint(S.AUTO, 4)(M.CHEST)).toBeNull();
  expect(splitDiagramSessions(S.UPPER_LOWER, 4).map((day) => day.focus)).toEqual(['UPPER', 'LOWER', 'UPPER', 'LOWER']);
  for (const split of Object.values(S)) for (let count = 2; count <= 7; count++) {
    const entries = splitDiagramSessions(split, count);
    expect(entries).toHaveLength(split === S.AUTO ? 0 : count);
    expect(new Set(entries.map((day) => day.color)).size).toBe(entries.length);
    const paint = splitDiagramPaint(split, count);
    for (const muscle of Object.values(M)) {
      if (muscle === M.UNCLASSIFIED || split === S.AUTO) expect(paint(muscle)).toBeNull();
      else if (count >= 3 || split === S.FULL_BODY || split === S.UPPER_LOWER) expect(paint(muscle)?.opacity).toBe(1);
      else expect([0, 1]).toContain(paint(muscle)?.opacity ?? 0);
    }
  }
});
it('adapts the shared PPL illustration to PPL / PPLU / PPLUL / PPLPPL', () => {
  expect(splitDiagramSessions(S.PUSH_PULL_LEGS, 3).map((day) => day.focus)).toEqual(['PUSH', 'PULL', 'LEGS']);
  expect(splitDiagramSessions(S.PUSH_PULL_LEGS, 4).map((day) => day.focus)).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER']);
  expect(splitDiagramSessions(S.PUSH_PULL_LEGS, 5).map((day) => day.focus)).toEqual(['PUSH', 'PULL', 'LEGS', 'UPPER', 'LOWER']);
  expect(splitDiagramSessions(S.PUSH_PULL_LEGS, 6).map((day) => day.focus)).toEqual(['PUSH', 'PULL', 'LEGS', 'PUSH', 'PULL', 'LEGS']);
  expect(splitDiagramSessions(S.PUSH_PULL_LEGS_UPPER, 5)).toEqual(splitDiagramSessions(S.PUSH_PULL_LEGS, 5));
});
it('uses bands for shared muscle groups, including flexible push/pull leg work', () => {
  const upperLower = splitDiagramSessions(S.UPPER_LOWER, 4);
  const paint = splitDiagramPaint(S.UPPER_LOWER, 4);
  expect(paint(M.CHEST)?.bands).toEqual([upperLower[0].color, upperLower[2].color]);
  expect(paint(M.FOREARMS)).toEqual(paint(M.CHEST));
  expect(paint(M.QUADS)?.bands).toEqual([upperLower[1].color, upperLower[3].color]);
  const ppl = splitDiagramSessions(S.PUSH_PULL_LEGS, 4);
  expect(splitDiagramPaint(S.PUSH_PULL_LEGS, 4)(M.QUADS)?.bands).toEqual([ppl[0].color, ppl[2].color]);
  expect(splitDiagramPaint(S.PUSH_PULL_LEGS, 4)(M.GLUTES)?.bands).toEqual([ppl[1].color, ppl[2].color]);
  expect(splitDiagramPaint(S.FULL_BODY, 1)(M.CHEST)).toEqual({ color: splitDiagramSessions(S.FULL_BODY, 1)[0].color, opacity: 1 });
  expect(splitDiagramPaint(S.FULL_BODY, 0)(M.CHEST)).toBeNull();
});
it('bounds malformed counts and handles an empty or incomplete illustrative cycle', () => {
  for (const count of [0, -1, NaN, Infinity]) expect(splitDiagramSessions(S.FULL_BODY, count)).toEqual([]);
  expect(splitDiagramSessions(S.FULL_BODY, 20)).toHaveLength(7);
  expect(splitDiagramSessions(S.FULL_BODY, 2.9)).toHaveLength(2);
  expect(splitDiagramPaint(S.PUSH_PULL_LEGS, 1)(M.CALVES)).toBeNull();
});
it('sorts translated equipment alphabetically without changing the preset or selections', () => {
  const original = [...DEFAULT_GENERATOR_EQUIPMENT];
  for (const [locale, dictionary] of [['en', en], ['es', es]] as const) {
    const label = (entry: Equipment) => dictionary.generate[`equipment${entry}` as keyof typeof dictionary.generate] as string;
    const sorted = sortEquipmentOptions(original, label, locale);
    expect(sorted.map(label)).toEqual([...original.map(label)].sort(new Intl.Collator(locale, { sensitivity: 'base', numeric: true }).compare));
    for (const entry of original) expect(dictionary.generate.equipmentHelp[entry as keyof typeof dictionary.generate.equipmentHelp]).toBeTruthy();
  }
  expect(original).toEqual(DEFAULT_GENERATOR_EQUIPMENT);
  expect(sortEquipmentOptions([], String)).toEqual([]);
  expect(sortEquipmentOptions([Equipment.MACHINE, Equipment.BARBELL], () => 'Same')).toEqual([Equipment.BARBELL, Equipment.MACHINE]);
});
