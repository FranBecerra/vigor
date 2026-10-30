/**
 * Hook de tema: resuelve el esquema activo (auto según el sistema, PRD §8.2)
 * y expone la paleta y los tokens de diseño.
 *
 * Uso:
 *   const { colors, motion } = useTheme();
 */
import { useColorScheme } from 'react-native';
import { useContext } from 'react';
import { createSurfaceStyles } from './surfaces';
import { AccentContext } from './AccentContext';
import { ACCENT_KEYS, accentTokens } from './accent';
import {
  semantic,
  typography,
  spacing,
  radius,
  motion,
  type ColorScheme,
} from './tokens';

/** Prebuilt finite variants: no gradient/style allocation on a set or timer tick. */
const themes = Object.fromEntries(ACCENT_KEYS.map(accent => [accent, Object.fromEntries((['dark', 'light'] as const).map(scheme => {
  const tokens = accentTokens(scheme, accent);
  return [scheme, { ...tokens, surfaces: createSurfaceStyles(scheme, undefined, tokens.colors, tokens.sectionAccent.train) }];
}))])) as Record<typeof ACCENT_KEYS[number], Record<ColorScheme, ReturnType<typeof accentTokens> & { surfaces: ReturnType<typeof createSurfaceStyles> }>>;

export function useTheme() {
  const system = useColorScheme();
  const scheme: ColorScheme = system === 'light' ? 'light' : 'dark';
  const theme = themes[useContext(AccentContext)][scheme];
  return {
    scheme,
    ...theme,
    semantic: scheme === 'light' ? { ...semantic, danger: '#B82822', warning: '#805000', success: '#365E00' } : semantic,
    typography,
    spacing,
    radius,
    motion,
  };
}
