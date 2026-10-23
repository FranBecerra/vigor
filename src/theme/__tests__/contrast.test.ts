import { palette, sectionAccent } from '../tokens';
const luminance = (hex: string) => {
  const values = hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
it('keeps light-mode accent/muted text readable and lime buttons dark-labelled', () => {
  for (const background of [palette.light.bg, palette.light.bgElevated]) {
    expect(contrast(palette.light.accentText, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.light.textMuted, background)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(palette.light.onAccent, sectionAccent.train)).toBeGreaterThanOrEqual(4.5);
  expect(palette.dark.accentText).toBe(sectionAccent.train);
});
