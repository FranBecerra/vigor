import { readinessBand, readinessInk } from '../readinessPresentation';
import { palette } from '@/theme/tokens';

it('maps existing experimental scores without inventing a value for missing or malformed data', () => {
  expect(readinessBand(100)).toBe('GREEN');
  for (const value of [99.999, 95, 75]) expect(readinessBand(value)).toBe('YELLOW');
  for (const value of [74.999, 50, 0]) expect(readinessBand(value)).toBe('ORANGE');
  for (const value of [undefined, NaN, Infinity, -1, 101]) expect(readinessBand(value)).toBe('UNKNOWN');
});
const luminance = (hex: string) => {
  const rgb = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255)
    .map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
it('keeps every status readable on both Subtle appearances, independently of colour recognition', () => {
  for (const scheme of ['light', 'dark'] as const) for (const ink of Object.values(readinessInk[scheme])) {
    for (const background of [palette[scheme].bg, palette[scheme].bgElevated, palette[scheme].bioTint]) {
      const levels = [luminance(ink), luminance(background)].sort((a, b) => a - b);
      expect((levels[1] + 0.05) / (levels[0] + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
});
