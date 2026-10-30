import { DarkTheme, DefaultTheme } from 'expo-router';
import { palette, type ColorScheme } from './tokens';

/** Native glass samples these surfaces, including safe areas and stack transitions. */
export function navigationThemeFor(scheme: ColorScheme, colors = palette[scheme] as { bg: string; textPrimary: string; surfaceBorder: string; accentText: string }) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return { ...base, colors: { ...base.colors, background: colors.bg, card: colors.bg,
    text: colors.textPrimary, border: colors.surfaceBorder, primary: colors.accentText } };
}
