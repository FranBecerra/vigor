import Svg, { Path } from 'react-native-svg';
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SportKind } from '@/models/sportActivity';
import { BikeIcon, MountainIcon, RunIcon, StopwatchIcon } from './RoutineIcons';
import type { IconProps } from './types';

const paths = {
  PADEL: 'M15.5 3.5c3 2 4 6.5 1.5 9s-6.7 2-9-1-2.1-6.5.5-8 4.5-1.3 7 .0Z M8 12l-4 7 2 2 5-7 M10 6h.1 M13 5h.1 M15 8h.1 M11 9h.1 M14 11h.1',
  TENNIS: 'M16 3c3 2 4 6.5 1 9s-7 2-9-1-2-6.5 1-8 4.5-1.5 7 0Z M8 12l-4 7 2 2 5-7 M9 4l7 8 M8 7l5 6 M12 3l6 6 M9 10l6-7 M12 13l6-7',
  FOOTBALL: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z m-9-4 4 3-1.5 4.5h-5L8 11Z M12 8V3 M16 11l5-2 M14.5 15.5l3 4 M9.5 15.5l-3 4 M8 11 3 9',
  BASKETBALL: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3v18 M6 5.3c6 2.5 6 11 0 13.4 M18 5.3c-6 2.5-6 11 0 13.4',
  OTHER: 'M5 6h14 M5 12h14 M5 18h14 M9 3v6 M15 9v6 M9 15v6',
} as const;

export function SportActivityIcon({ sport, size = 24, color = '#fff' }: IconProps & { sport: SportKind }) {
  if (sport === 'RUNNING' && Platform.OS === 'ios') return <SymbolView name="figure.run" type="hierarchical" weight="regular"
    tintColor={color} size={size} style={{ width: size, height: size }} />;
  const Existing = sport === 'RUNNING' ? RunIcon : sport === 'CYCLING' ? BikeIcon : sport === 'HIKING' ? MountainIcon : sport === 'MACHINE' ? StopwatchIcon : null;
  if (Existing) return <Existing size={size} color={color} />;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d={paths[sport as keyof typeof paths]} stroke={color as string} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
