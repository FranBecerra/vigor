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
