import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ja from '../locales/ja.json';
const leaves = (item: object): string[] => Object.entries(item).flatMap(([key, value]) => typeof value === 'string' ? [key] : leaves(value).map((leaf) => `${key}.${leaf}`));
it('translates every sport activity label and keeps interpolation parameters consistent', () => {
  const keys = leaves(en.sportActivities);
  const at = (item: object, key: string): string => key.split('.').reduce((value: any, part) => value[part], item);
  for (const locale of [es, fr, ja]) {
    expect(leaves(locale.sportActivities).sort()).toEqual([...keys].sort());
    expect(locale.sportActivitiesRequiredName.trim()).not.toBe('');
    for (const key of keys) {
      const value = at(locale.sportActivities, key); expect(value.trim()).not.toBe('');
      expect(value.match(/{{\w+}}/g) ?? []).toEqual(at(en.sportActivities, key).match(/{{\w+}}/g) ?? []);
    }
  }
});

it('keeps all cardio planning labels and interpolation parameters aligned in every language', () => {
  const expected = Object.keys(en.cardioPlan).sort();
  const parameters = (value: string) => (value.match(/{{\w+}}/g) ?? []).sort();
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.cardioPlan).sort()).toEqual(expected);
    for (const key of expected) {
      const value = (locale.cardioPlan as Record<string, string>)[key];
      expect(value.trim()).not.toBe('');
      expect(parameters(value)).toEqual(parameters((en.cardioPlan as Record<string, string>)[key]));
    }
  }
});

it('translates saved proposal state, actions and sync semantics in every language', () => {
  const keys = Object.keys(en.cardioSaved).sort();
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.cardioSaved).sort()).toEqual(keys);
    for (const key of keys) {
      const value = (locale.cardioSaved as Record<string, string>)[key]; expect(value.trim()).not.toBe('');
      expect((value.match(/{{\w+}}/g) ?? []).sort()).toEqual(((en.cardioSaved as Record<string, string>)[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});

it('translates the complete cardio execution and dated coordination flow', () => {
  const keys = Object.keys(en.cardioTraining).sort();
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.cardioTraining).sort()).toEqual(keys);
    for (const key of keys) {
      const value = (locale.cardioTraining as Record<string, string>)[key]; expect(value.trim()).not.toBe('');
      expect((value.match(/{{\w+}}/g) ?? []).sort()).toEqual(((en.cardioTraining as Record<string, string>)[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});
