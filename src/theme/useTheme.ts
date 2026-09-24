/**
 * Hook de tema: resuelve el esquema activo (auto según el sistema, PRD §8.2)
 * y expone la paleta y los tokens de diseño.
 *
 * Uso:
 *   const { colors, motion } = useTheme();
 */
import { useColorScheme } from 'react-native';
import {
  palette,
  sectionAccent,
  semantic,
  typography,
  spacing,
  radius,
  motion,
  type ColorScheme,
} from './tokens';

export function useTheme() {
  const system = useColorScheme();
  const scheme: ColorScheme = system === 'light' ? 'light' : 'dark';
  return {
    scheme,
    colors: palette[scheme],
    sectionAccent,
    semantic,
    typography,
    spacing,
    radius,
    motion,
  };
}
