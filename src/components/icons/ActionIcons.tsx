import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './types';

/** Monochrome outline assets; the caller supplies the display colour. */
export function TrophyIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 13v5m-4 3h8m-6-3h4v3h-4v-3Z" />
  </Svg>;
}
export function TrashIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
  </Svg>;
}
