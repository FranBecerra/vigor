import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/useTheme';

/** Small code-native illustrations share the theme and stay crisp in either appearance. */
export function GenerationArtwork({ kind, height = 110 }: { kind: 'goal' | 'level' | 'capacity' | 'split' | 'equipment'; height?: number }) {
  const { colors, sectionAccent } = useTheme(); const accent = sectionAccent.train;
  return <Svg width="100%" height={height} viewBox="0 0 300 120" accessibilityElementsHidden>
    <Rect x={5} y={5} width={290} height={110} rx={28} fill={colors.surface} />
    {kind === 'goal' || kind === 'equipment' ? <G stroke={accent} strokeWidth={8} strokeLinecap="round">
      <Line x1={90} y1={60} x2={210} y2={60} /><Line x1={102} y1={30} x2={102} y2={90} /><Line x1={198} y1={30} x2={198} y2={90} />
      <Line x1={82} y1={42} x2={82} y2={78} /><Line x1={218} y1={42} x2={218} y2={78} />
    </G> : kind === 'level' ? <G fill={accent}>
      {[0, 1, 2, 3].map((i) => <Rect key={i} x={65 + i * 46} y={80 - i * 18} width={32} height={20 + i * 18} rx={8} opacity={0.35 + i * 0.2} />)}
    </G> : kind === 'capacity' ? <G stroke={accent} strokeWidth={5} fill="none">
      <Circle cx={150} cy={60} r={40} /><Path d="M150 32 V60 L175 74" strokeLinecap="round" />
    </G> : <G fill={accent}>{Array.from({ length: 7 }, (_, i) => <Rect key={i} x={29 + i * 36} y={35} width={28} height={50} rx={10} opacity={[2, 5].includes(i) ? 0.18 : 0.9} />)}</G>}
  </Svg>;
}
