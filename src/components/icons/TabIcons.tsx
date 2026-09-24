/**
 * Iconos de la barra de pestañas (PRD §8.1, §8.2).
 *
 * Uno por sección: Entrenamiento, Bio, Nutrición y Perfil. Todos SVG propios,
 * de trazo, sobre lienzo 24×24, sin dependencia de ninguna librería de iconos.
 *
 * Reciben el color desde la barra de pestañas, así que el mismo icono sirve para
 * el estado activo e inactivo sin duplicarse.
 */
import Svg, { Path, Circle } from 'react-native-svg';
import { ICON_DEFAULTS, ICON_VIEWBOX, type IconProps } from './types';

/**
 * ENTRENAMIENTO — mancuerna.
 * Barra central con dos discos a cada lado. Lectura inmediata de "fuerza".
 */
export function TrainIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Path
        d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5M7 12h10"
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * BIO — pulso sobre una silueta de torso.
 * La onda comunica biomarcadores y readiness; evita el corazón genérico, que se
 * confunde con "favoritos".
 */
export function BioIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Path
        d="M3 12h3l2-4 2.5 8L13 9l1.5 3H21"
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 6.5V5.5M19 6.5V5.5M5 17.5v1M19 17.5v1"
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
        opacity={0.45}
      />
    </Svg>
  );
}

/**
 * NUTRICIÓN — llama/hoja sobre un cuenco.
 * Comunica energía e ingesta sin recurrir a una fruta concreta, que sesgaría el
 * significado hacia "dieta" en lugar de "nutrición".
 */
export function NutritionIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Path
        d="M3.5 12.5h17a8.5 8.5 0 0 1-8.5 7.5 8.5 8.5 0 0 1-8.5-7.5Z"
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 9.5c2-1 2.2-3.2.8-5.5 2.8 1 4 3.4 2.6 5.5"
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * PERFIL — busto.
 * Círculo de cabeza y arco de hombros, la convención más legible a 22 px.
 */
export function ProfileIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Circle
        cx={12}
        cy={8}
        r={3.6}
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
      />
      <Path
        d="M4.8 20c0-3.6 3.2-6.2 7.2-6.2s7.2 2.6 7.2 6.2"
        stroke={color as string}
        strokeWidth={ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
