import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ja from '../locales/ja.json';

function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => typeof entry === 'string'
    ? [[`${prefix}${key}`, entry]] : Object.entries(leaves(entry as Record<string, unknown>, `${prefix}${key}.`))));
}
it('provides every readiness label and interpolation parameter in all supported languages', () => {
  const expected = leaves(en.bioReadiness);
  for (const locale of [es, fr, ja]) {
    const actual = leaves(locale.bioReadiness); expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected)) {
      expect(actual[key].trim()).not.toBe('');
      expect((actual[key].match(/{{\w+}}/g) ?? []).sort()).toEqual((expected[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});
it('provides every session-context label and interpolation parameter in all supported languages', () => {
  const expected = leaves(en.bioSession);
  for (const locale of [es, fr, ja]) {
    const actual = leaves(locale.bioSession); expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected)) {
      expect(actual[key].trim()).not.toBe('');
      expect((actual[key].match(/{{\w+}}/g) ?? []).sort()).toEqual((expected[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});
it('keeps compact status labels and missing-measurement explanations translated consistently', () => {
  const expected = leaves(en.bioSummary);
  for (const locale of [es, fr, ja]) {
    const actual = leaves(locale.bioSummary); expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected)) expect(actual[key].trim()).not.toBe('');
  }
});
it('keeps soft metric cards, positions and trend details translated with matching parameters', () => {
  const expected = leaves(en.bioMetric);
  for (const locale of [es, fr, ja]) {
    const actual = leaves(locale.bioMetric); expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected)) {
      expect(actual[key].trim()).not.toBe('');
      expect((actual[key].match(/{{\w+}}/g) ?? []).sort()).toEqual((expected[key].match(/{{\w+}}/g) ?? []).sort());
    }
  }
});
