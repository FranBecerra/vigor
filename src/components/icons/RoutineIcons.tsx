/**
 * Catálogo de iconos para RUTINAS (PRD §8.5).
 *
 * Retained vector renderers for action/status pictograms and compatibility.
 * Routine identity badges now use the separate native emoji catalogue.
 *
 * Todos SVG propios, de trazo, lienzo 24×24.
 */
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { ICON_DEFAULTS, ICON_VIEWBOX, ROUTINE_ICON_STROKE_WIDTH, type IconProps } from './types';
import { ROUTINE_SYMBOL_ICONS } from './RoutineSymbolIcons';

// The key is what gets persisted, so it is owned by the model layer and only
// rendered here.
export type { RoutineIconKey } from '@/models';
import type { RoutineIconKey } from '@/models';

function base(size: number) {
  return { width: size, height: size, viewBox: ICON_VIEWBOX, fill: 'none' as const };
}

function strokeProps(color: string) {
  return {
    stroke: color,
    strokeWidth: ROUTINE_ICON_STROKE_WIDTH,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** Mancuerna — trabajo con mancuernas o rutina general de fuerza. */
export function DumbbellIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Rect x={5} y={7} width={3} height={10} rx={1} fill={color} fillOpacity={.14} {...strokeProps(color as string)} />
      <Rect x={16} y={7} width={3} height={10} rx={1} fill={color} fillOpacity={.14} {...strokeProps(color as string)} />
      <Path d="M3 10v4m18-4v4M8 12h8" {...strokeProps(color as string)} />
    </Svg>
  );
}

/** Barra olímpica — trabajo pesado, fuerza máxima. */
export function BarbellIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M2.5 12h19" {...strokeProps(color as string)} />
      <Rect x={5} y={8} width={2.6} height={8} rx={1} fill={color} fillOpacity={.14} {...strokeProps(color as string)} />
      <Rect x={16.4} y={8} width={2.6} height={8} rx={1} fill={color} fillOpacity={.14} {...strokeProps(color as string)} />
    </Svg>
  );
}

/** Kettlebell — trabajo funcional o balístico. */
export function KettlebellIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M9 6.5a3 3 0 0 1 6 0" {...strokeProps(color as string)} />
      <Path
        d="M8.6 8.6C6.6 10 5.5 12.2 5.5 14.8c0 2.4 1.4 4.2 6.5 4.2s6.5-1.8 6.5-4.2c0-2.6-1.1-4.8-3.1-6.2Z"
        fill={color} fillOpacity={.12}
        {...strokeProps(color as string)}
      />
      <Path d="M8 14c0 1.8.9 2.7 2.6 3" strokeOpacity={.45} {...strokeProps(color as string)} />
    </Svg>
  );
}

/** Peso corporal — calistenia, dominadas. */
export function BodyweightIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3.5 5h17" {...strokeProps(color as string)} />
      <Path d="M8 5v3M16 5v3" {...strokeProps(color as string)} />
      <Circle cx={12} cy={11.5} r={2.2} stroke={color as string} strokeWidth={ROUTINE_ICON_STROKE_WIDTH} />
      <Path d="M12 13.7V18M9 20l3-2 3 2" {...strokeProps(color as string)} />
    </Svg>
  );
}

/** Carrera — cardio a pie. */
export function RunIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx={15} cy={4} r={1.8} fill={color} fillOpacity={.18} {...strokeProps(color as string)} />
      <Path
        d="m8 8 4-1.5 3 4H20 M12 6.5 10 13l4.5 3L13 21 M10 13l-3 5H3"
        {...strokeProps(color as string)}
      />
      <Path d="M2 11h3m-4 3h3" stroke={color} strokeOpacity={.4} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Bicicleta — cardio en bici o rodillo. */
export function BikeIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx={5.6} cy={16.4} r={3.4} stroke={color as string} strokeWidth={ROUTINE_ICON_STROKE_WIDTH} />
      <Circle cx={18.4} cy={16.4} r={3.4} stroke={color as string} strokeWidth={ROUTINE_ICON_STROKE_WIDTH} />
      <Path d="M5.6 16.4 10 8h3.2l3.4 8.4M10 8h5.4M8.6 16.4h6" {...strokeProps(color as string)} />
    </Svg>
  );
}

/** Cronómetro — rutinas por tiempo, EMOM, circuitos. */
export function StopwatchIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx={12} cy={13.5} r={6.8} stroke={color as string} strokeWidth={ROUTINE_ICON_STROKE_WIDTH} />
      <Path d="M12 10.5v3.2l2.2 1.6M10 3.5h4M12 3.5v3.2" {...strokeProps(color as string)} />
    </Svg>
  );
}

/** Montaña — bloques de acumulación o preparación para un objetivo. */
export function MountainIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M2.5 18.5 9 7l4 6.4 2.3-3.4 6.2 8.5H2.5Z" fill={color} fillOpacity={.12} {...strokeProps(color as string)} />
      <Path d="m6.5 11.5 2.5 1.5 2-1 M13 13.4l-2 5" stroke={color} strokeOpacity={.5} strokeWidth={1.2} strokeLinejoin="round" />
    </Svg>
  );
}

/** Mapa clave → componente, para resolver el icono guardado en la rutina. */
export const ROUTINE_ICONS: Record<
  Exclude<RoutineIconKey, 'rocket' | 'satellite' | 'ufo' | 'fire' | 'target' | 'tower'>,
  (props: IconProps) => React.ReactElement
> = {
  ...ROUTINE_SYMBOL_ICONS,
  dumbbell: DumbbellIcon,
  barbell: BarbellIcon,
  kettlebell: KettlebellIcon,
  bodyweight: BodyweightIcon,
  run: RunIcon,
  bike: BikeIcon,
  stopwatch: StopwatchIcon,
  mountain: MountainIcon,
};

export { ROUTINE_ICON_ORDER } from '@/models';
