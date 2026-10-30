import { palette, sectionAccent, type ColorScheme } from './tokens';

/** Preference identities, not arbitrary colours: each has accessible text variants. */
export const ACCENTS = {
  lime: { fill: '#9BE317', dark: '#B0E65C', light: '#426410', tintDark: '#31412B', tintLight: '#E1EDCE', rgb: '151,185,110' },
  mint: { fill: '#66DDB2', dark: '#8FE3C0', light: '#20634C', tintDark: '#253D33', tintLight: '#DCEEE5', rgb: '80,170,140' },
  sky: { fill: '#84BFFF', dark: '#A6D1FF', light: '#245B8E', tintDark: '#263B4E', tintLight: '#DFECFA', rgb: '100,155,215' },
  violet: { fill: '#C1A1F5', dark: '#D2B9FF', light: '#67418C', tintDark: '#3A304A', tintLight: '#EDE3F7', rgb: '165,125,205' },
  coral: { fill: '#F5AB91', dark: '#FFC4AD', light: '#883F2B', tintDark: '#49362F', tintLight: '#F5E4DB', rgb: '205,140,110' },
  amber: { fill: '#EBC466', dark: '#F4D48D', light: '#75530D', tintDark: '#433D2C', tintLight: '#F3EACF', rgb: '190,160,85' },
  slate: { fill: '#99A6B2', dark: '#B4C1CD', light: '#465460', tintDark: '#303940', tintLight: '#E6EAED', rgb: '130,145,160' },
  petrol: { fill: '#83B0AC', dark: '#9CC9C3', light: '#315D5A', tintDark: '#293D39', tintLight: '#DFEBE7', rgb: '95,145,140' },
  olive: { fill: '#A3AD89', dark: '#C1CCA5', light: '#52612F', tintDark: '#373E2C', tintLight: '#E8EBDC', rgb: '140,150,110' },
  taupe: { fill: '#B6A69B', dark: '#D0BDB0', light: '#685144', tintDark: '#40362F', tintLight: '#EFE6DE', rgb: '155,135,120' },
} as const;
export type Accent = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as Accent[];
export const validAccent = (value: unknown): value is Accent => typeof value === 'string' && Object.hasOwn(ACCENTS, value);
export type ThemeColors = { [K in keyof typeof palette.dark]: string };

export function accentTokens(scheme: ColorScheme, accent: Accent) {
  const choice = ACCENTS[accent], base = palette[scheme];
  const tint = scheme === 'dark' ? choice.tintDark : choice.tintLight;
  const text = choice[scheme];
  const colors: ThemeColors = { ...base, accentText: text, bioText: text, accentTint: tint, bioTint: tint,
    onAccent: '#192509', ambient: `rgba(${choice.rgb},0.14)`, ambientClear: `rgba(${choice.rgb},0)` };
  return { colors, sectionAccent: Object.fromEntries(Object.keys(sectionAccent).map(key => [key, choice.fill])) as Record<keyof typeof sectionAccent, string> };
}
