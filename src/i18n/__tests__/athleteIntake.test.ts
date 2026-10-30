import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ja from '../locales/ja.json';
it('keeps the athlete intake complete in all supported locales', () => {
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.athleteIntake).sort()).toEqual(Object.keys(en.athleteIntake).sort());
    for (const key of Object.keys(en.athleteIntake)) {
      const value = (locale.athleteIntake as Record<string, string>)[key]; expect(value.trim()).not.toBe('');
      expect((value.match(/{{\w+}}/g) ?? []).sort()).toEqual(((en.athleteIntake as Record<string, string>)[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});
