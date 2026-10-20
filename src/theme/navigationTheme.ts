import { DarkTheme, DefaultTheme } from 'expo-router';
import { palette, sectionAccent, type ColorScheme } from './tokens';

/** Native glass samples these surfaces, including safe areas and stack transitions. */
export function navigationThemeFor(scheme: ColorScheme) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = palette[scheme];
  return { ...base, colors: { ...base.colors, background: colors.bg, card: colors.bg,
    text: colors.textPrimary, border: colors.surfaceBorder, primary: sectionAccent.train } };
}
