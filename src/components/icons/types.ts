/**
 * Contrato común de los iconos de Vigor (PRD §8.2).
 *
 * Owned SVGs are the cross-platform default. Running/navigation may use SF Symbols;
 * selectable routine badges use system emoji, separate from action pictograms.
 * Persisted identity keys stay independent of the platform rendering.
 *
 * Estilo: trazo (no relleno), grosor 1.8, extremos y uniones redondeados,
 * lienzo de 24×24. El trazo redondeado es coherente con los radios generosos
 * del sistema de diseño (referencia Bevel).
 */
import type { ColorValue } from 'react-native';

export interface IconProps {
  /** Lado del icono en puntos. Por defecto 24. */
  size?: number;
  /** Color del trazo. Hereda del contexto donde se use (acento, texto…). */
  color?: ColorValue;
}

/** Valores por defecto compartidos, para no repetirlos en cada icono. */
export const ICON_DEFAULTS = {
  size: 24,
  strokeWidth: 1.8,
} as const;

/** Lienzo canónico de todos los iconos. */
export const ICON_VIEWBOX = '0 0 24 24';

/** Slightly finer than actions, but legible at a real 24-point badge size. */
export const ROUTINE_ICON_STROKE_WIDTH = 1.6;
