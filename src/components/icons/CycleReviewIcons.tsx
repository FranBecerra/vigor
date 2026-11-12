import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { IconProps } from './types';

/** Quiet outline navigation and route symbols for the accepted cycle mockup. */
export function CycleChevron({ size = 18, color = 'currentColor', expanded = false }: IconProps & { expanded?: boolean }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d={expanded ? 'm6 15 6-6 6 6' : 'm9 6 6 6-6 6'} />
  </Svg>;
}
export function CardioRouteIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={6} cy={6} r={3} /><Circle cx={18} cy={18} r={3} />
    <Path d="M9 6h8a4 4 0 0 1 0 8H7a4 4 0 0 0 0 8h8" />
  </Svg>;
}

export function CardioHeartIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    <Path d="M4.5 12h4l2-3.4 2.5 6 2-2.6h4.5" />
  </Svg>;
}

export function CycleCalendarIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={3} y={5} width={18} height={16} rx={2} />
    <Path d="M8 3v4m8-4v4M3 10h18m-13 4h.01m4 0h.01m4 0h.01m-8 3h.01m4 0h.01m4 0h.01" />
  </Svg>;
}
