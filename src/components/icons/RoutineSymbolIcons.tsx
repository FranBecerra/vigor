import Svg, { Path } from 'react-native-svg';
import { ICON_DEFAULTS, ICON_VIEWBOX, ROUTINE_ICON_STROKE_WIDTH, type IconProps } from './types';

/** Own monochrome drawings, with the same 24-point canvas and rounded stroke as the sports set. */
export const ROUTINE_SYMBOL_PATHS = {
  planet: 'M18.5 12a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z M5.8 7.8C2.8 8 1.5 9 2.2 10.5c1 2.2 6.1 4.7 11.4 5.6s9 .1 8-2.1c-.4-.9-1.6-1.9-3.3-2.8',
  comet: 'M15 3 7.5 10.5 M21 3 11.5 12.5 M21 9 14.5 15.5 M13 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  moon: 'M20.3 14.4A8.7 8.7 0 0 1 9.6 3.7a8.8 8.8 0 1 0 10.7 10.7Z',
  sun: 'M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  star: 'm12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.5l6.4-.9Z',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z m-5-4-2.4 5.6L8 16l2.4-5.6Z',
  lighthouse: 'M8 21 9.5 9h5L16 21 M7 21h10 M8.5 9h7V5h-7Z M9 5l3-2 3 2 M9 15h6 M4.5 6H2 M19.5 6H22 M11 18h2',
  anchor: 'M14.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z M12 8v13 M8 11h8 M3 14v1c0 4 4 6 9 6s9-2 9-6v-1 M3 14l3 2 M21 14l-3 2',
  sailboat: 'M12 3v13 M9 5 3 14h6Z M15 5v9h6Z M3 17h18l-3 4H6Z',
  wave: 'M3 17c3.5 0 4-2 5-5 1.2-3.8 3.7-6 7.2-5.5-3.5 1.1-3.9 4.2-1.4 5.2 2 .8 4.1-.7 4.2-2.7 2.2 1.8 3.5 4.7 3 8 M3 21h18',
  pine: 'm12 2-6 7h3l-5 6h4l-5 5h18l-5-5h4l-5-6h3Z M12 20v2',
  leaf: 'M20 3C10 2 3 6 3 13a7 7 0 0 0 7 7c7 0 11-7 10-17Z M3 21 16 8 M9 15h5 M9 15v-5',
  lightning: 'm13.5 2-10 12H11l-.5 8 10-12H13Z',
  diamond: 'M7 3h10l5 6-10 13L2 9Z M2 9h20 M7 3l5 19 5-19',
  shield: 'M12 2.5c3 2 6 2.5 8 2.5v7c0 4.8-4.4 8-8 9.5C8.4 20 4 16.8 4 12V5c2 0 5-.5 8-2.5Z',
  telescope: 'm4 7 3-4 12 7-3 4Z M17 14l2 1 2-3-2-2 M11 12v4 M6 22l5-6 5 6 M11 16v6',
  constellation: 'M5 6 10 10 18 5 M10 10l-3 9 12-4 M10 10l9 5 M6.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0 M19.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0 M20.5 15a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0 M8.5 19a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0',
} as const;

/** Small facets and inner contours give depth without colour, gradients or raster shading. */
const details: Partial<Record<keyof typeof ROUTINE_SYMBOL_PATHS, string>> = {
  planet: 'M9 7.4c2-1.3 4.5-.9 5.8.4 M6 13.5c3.5 2 8 3.2 11.7 2.6',
  comet: 'M6 15c.6-.9 1.5-1.2 2.4-1 M16 7l3-3',
  moon: 'M6.7 8.6a6.8 6.8 0 0 0 5.4 10',
  sun: 'M10 9.5c1-.8 2.5-.8 3.5-.1',
  star: 'M12 6.2v8.1 M7.5 17l4.5-2.7 4.5 2.7',
  compass: 'M12 4.8v1 M19.2 12h-1 M12 18.2v1 M4.8 12h1',
  lighthouse: 'M11 6.5h2 M10.6 10.8l-.5 3 M16 6.5h3 M5 6.5h3',
  anchor: 'M8 18.2c1 .6 2.4 1 4 1s3-.4 4-1',
  sailboat: 'M5.8 19h12.4 M7.5 10.5v2 M16.5 10.5l2 2',
  wave: 'M10 17c2 1.7 5.5 2.2 8 .7',
  pine: 'M12 8v10 M9.5 11.5l2.5 2 2.5-2 M8 17l4 2 4-2',
  leaf: 'M12.5 11.5h3 M12.5 11.5v-3',
  lightning: 'm11.5 6-5 6H11',
  diamond: 'M7 3l5 6 5-6 M12 9v13',
  shield: 'M7 7.5v4c0 3 2 5.2 5 6.8',
  telescope: 'm6.3 6.1 10 5.8 M10 12l2-3.5',
};

/** Closed silhouettes only: translucent ink gives depth without muddying fine contours. */
const tints: Record<keyof typeof ROUTINE_SYMBOL_PATHS, string> = {
  planet: 'M18.5 12a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  comet: 'M13 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  moon: ROUTINE_SYMBOL_PATHS.moon,
  sun: 'M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z',
  star: ROUTINE_SYMBOL_PATHS.star,
  compass: 'm16 8-2.4 5.6L8 16l2.4-5.6Z',
  lighthouse: 'M9.5 9h5L16 21H8Z',
  anchor: 'M14.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  sailboat: 'M3 17h18l-3 4H6Z M15 5v9h6Z',
  wave: 'M3 17c3.5 0 4-2 5-5 1.2-3.8 3.7-6 7.2-5.5-3.5 1.1-3.9 4.2-1.4 5.2 2 .8 4.1-.7 4.2-2.7 2.2 1.8 3.5 4.7 3 8Z',
  pine: 'm12 2-6 7h3l-5 6h4l-5 5h18l-5-5h4l-5-6h3Z',
  leaf: 'M20 3C10 2 3 6 3 13a7 7 0 0 0 7 7c7 0 11-7 10-17Z',
  lightning: ROUTINE_SYMBOL_PATHS.lightning,
  diamond: 'M7 3h10l5 6-10 13L2 9Z',
  shield: ROUTINE_SYMBOL_PATHS.shield,
  telescope: 'm4 7 3-4 12 7-3 4Z',
  constellation: 'M5 6 10 10 18 5 19 15 7 19 10 10Z',
};

export const ROUTINE_SYMBOL_ICONS = Object.fromEntries(Object.entries(ROUTINE_SYMBOL_PATHS).map(([key, path]) => [key,
  function RoutineSymbolIcon({ size = ICON_DEFAULTS.size, color = '#fff' }: IconProps) {
    return <Svg width={size} height={size} viewBox={ICON_VIEWBOX} fill="none">
      <Path d={path} stroke={color as string} strokeWidth={ROUTINE_ICON_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={tints[key as keyof typeof tints]} fill={color} fillOpacity={.12} />
      {details[key as keyof typeof details] && <Path d={details[key as keyof typeof details]} stroke={color as string}
        strokeWidth={ROUTINE_ICON_STROKE_WIDTH * .72} strokeOpacity={.55} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>;
  },
])) as Record<keyof typeof ROUTINE_SYMBOL_PATHS, (props: IconProps) => React.ReactElement>;
