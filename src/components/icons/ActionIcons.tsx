import Svg, { Circle, Path } from 'react-native-svg';
import type { IconProps } from './types';

export function CheckIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m5 12 4 4L19 6" />
  </Svg>;
}
export function MoonIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.8 13.1A9 9 0 0 1 10.9 3.2a9 9 0 1 0 9.9 9.9Z" />
  </Svg>;
}

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
export function SwapIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
  </Svg>;
}
export function LinkIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m10 13 4-4m-5 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" />
  </Svg>;
}
export function InfoIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={9} /><Path d="M12 11v5m0-9h.01" />
  </Svg>;
}
export function NoteIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9l-7-7Zm0 0v5a2 2 0 0 0 2 2h5" />
  </Svg>;
}
