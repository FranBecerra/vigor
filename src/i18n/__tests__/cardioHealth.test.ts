import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ja from '../locales/ja.json';
import { HEALTH_CARDIO_KINDS } from '@/models/cardioHealth';
it('translates the review, provenance/uncertainty and every supported activity without changing interpolation', () => {
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.cardioHealth).sort()).toEqual(Object.keys(en.cardioHealth).sort());
    for (const key of Object.keys(en.cardioHealth)) {
      const value = (locale.cardioHealth as Record<string, string>)[key]; expect(value.trim()).not.toBe('');
      expect((value.match(/{{\w+}}/g) ?? []).sort()).toEqual(((en.cardioHealth as Record<string, string>)[key].match(/{{\w+}}/g) ?? []).sort());
    }
    for (const kind of HEALTH_CARDIO_KINDS) expect((locale.cardioHealth as Record<string, string>)[`kind_${kind}`]).toBeTruthy();
  }
});
it('keeps the local starting-point preview complete and interpolation-equivalent', () => {
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.cardioStart).sort()).toEqual(Object.keys(en.cardioStart).sort());
    for (const key of Object.keys(en.cardioStart)) {
      const value = (locale.cardioStart as Record<string, string>)[key]; expect(value.trim()).not.toBe('');
      expect((value.match(/{{\w+}}/g) ?? []).sort()).toEqual(((en.cardioStart as Record<string, string>)[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});
it('translates reviewed-plan handoff, provenance and explicit private-account save disclosure', () => {
  for (const locale of [en, es, fr, ja]) {
    expect(Object.keys(locale.healthPlanning).sort()).toEqual(Object.keys(en.healthPlanning).sort());
    for (const key of Object.keys(en.healthPlanning)) {
      const value = (locale.healthPlanning as Record<string, string>)[key]; expect(value.trim()).not.toBe('');
      expect((value.match(/{{\w+}}/g) ?? []).sort()).toEqual(((en.healthPlanning as Record<string, string>)[key].match(/{{\w+}}/g) ?? []).sort());
    }
    expect(locale.cardioPlan.issue_HEALTH_BASELINE).toBeTruthy();
  }
});
