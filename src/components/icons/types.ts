/**
 * Contrato común de los iconos de Vigor (PRD §8.2).
 *
 * REGLA DE ICONOGRAFÍA: no se usan librerías de iconos ni emojis. Todos los
 * iconos son SVG vectoriales propios, definidos en este directorio.
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
