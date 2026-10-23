import { parseNumericText } from '../numericDraft';
it('preserves empty drafts and parses canonical weight/repetition input without zero prefixes', () => {
  expect(parseNumericText('', false)).toBeUndefined(); expect(parseNumericText('  ', true)).toBeUndefined();
  expect(parseNumericText('35,5', true)).toBe(35.5); expect(parseNumericText('035', false)).toBe(35);
  expect(parseNumericText('12', false)).toBe(12); expect(parseNumericText('bad', true)).toBeUndefined();
  expect(parseNumericText('Infinity', true)).toBeUndefined(); expect(parseNumericText('bad', false)).toBeUndefined();
});
