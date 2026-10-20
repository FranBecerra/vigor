/** Recognisable technical equipment drawings, kept editable and theme-aware. No people. */
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { Equipment } from '@/models';
import { useTheme } from '@/theme/useTheme';

export function EquipmentIllustration({ equipment }: { equipment: Equipment }) {
  const { colors, sectionAccent } = useTheme();
  const ink = colors.textPrimary; const accent = sectionAccent.train;
  let drawing: React.ReactNode;
  switch (equipment) {
    case Equipment.BARBELL:
      drawing = <G rotation={-16} origin="60,48"><Line x1={9} y1={48} x2={111} y2={48} />
        {[20, 91].map((x) => <G key={x}><Rect x={x} y={26} width={9} height={44} rx={3} fill={colors.muscleNeutral} />
          <Rect x={x - 7} y={33} width={7} height={30} rx={2} fill={accent} /></G>)}
        <Line x1={42} y1={45} x2={77} y2={45} stroke={colors.textMuted} /></G>;
      break;
    case Equipment.SAFETY_BAR:
      drawing = <><Path d="M8 61 L30 54 L40 29 Q60 23 80 29 L90 54 L112 61" />
        <Path d="M46 45 L40 77 M74 45 L80 77" stroke={accent} strokeWidth={5} />
        <Rect x={42} y={24} width={12} height={32} rx={5} fill={colors.muscleNeutral} />
        <Rect x={66} y={24} width={12} height={32} rx={5} fill={colors.muscleNeutral} />
        <Rect x={51} y={22} width={18} height={10} rx={4} fill={accent} />
        <Path d="M14 47 L10 70 M106 47 L110 70" strokeWidth={7} /></>;
      break;
    case Equipment.TRAP_BAR:
      drawing = <><Path d="M20 51 L41 27 L80 27 L101 51 L80 75 L41 75 Z" />
        <Path d="M30 51 L45 51 M76 51 L91 51" stroke={accent} strokeWidth={5} />
        <Path d="M4 51 L20 51 M101 51 L116 51" />
        <Path d="M9 37 L9 65 M111 37 L111 65" strokeWidth={7} /></>;
      break;
    case Equipment.LANDMINE:
      drawing = <><Path d="M7 82 L35 82 L30 73 L13 73 Z" fill={colors.muscleNeutral} />
        <Circle cx={24} cy={74} r={5} fill={accent} /><Path d="M25 71 L97 20" strokeWidth={4} />
        <G rotation={-35} origin="88,26"><Ellipse cx={88} cy={26} rx={6} ry={21} fill={colors.muscleNeutral} />
          <Ellipse cx={96} cy={26} rx={6} ry={21} fill={accent} /></G></>;
      break;
    case Equipment.DUMBBELL:
      drawing = <>{[{ x: 39, y: 36 }, { x: 79, y: 63 }].map(({ x, y }) => <G key={x} rotation={-25} origin={`${x},${y}`}>
        <Line x1={x - 20} y1={y} x2={x + 20} y2={y} strokeWidth={5} />
        <Rect x={x - 27} y={y - 16} width={13} height={32} rx={4} fill={accent} />
        <Rect x={x + 14} y={y - 16} width={13} height={32} rx={4} fill={colors.muscleNeutral} />
      </G>)}</>;
      break;
    case Equipment.MACHINE:
      drawing = <><Path d="M17 83 L104 83 M24 83 L24 17 L42 17 M32 83 L54 60 L79 60" />
        <Rect x={43} y={31} width={11} height={29} rx={4} fill={colors.muscleNeutral} />
        <Rect x={51} y={57} width={30} height={9} rx={3} fill={accent} />
        <Path d="M78 63 L91 76 L106 58" /><Circle cx={78} cy={63} r={4} fill={accent} />
        <Rect x={98} y={51} width={15} height={9} rx={4} fill={colors.muscleNeutral} />
        {[36, 43, 50, 57].map((y) => <Rect key={y} x={10} y={y} width={20} height={5} rx={1} />)}</>;
      break;
    case Equipment.CABLE:
      drawing = <><Path d="M15 85 L15 12 L63 12 L63 85 M8 85 L73 85" />
        <Circle cx={49} cy={20} r={6} /><Circle cx={49} cy={74} r={5} />
        <Path d="M29 47 L29 20 L49 20 L96 45 L96 56" stroke={accent} />
        {[47, 53, 59, 65, 71].map((y) => <Rect key={y} x={21} y={y} width={23} height={4} rx={1} fill={colors.muscleNeutral} />)}
        <Path d="M88 56 L104 56 L107 66 L85 66 Z" /></>;
      break;
    case Equipment.SMITH_MACHINE:
      drawing = <><Path d="M17 85 L17 11 L103 11 L103 85 M9 85 L110 85" />
        <Path d="M31 18 L31 79 M89 18 L89 79" stroke={colors.textMuted} />
        <Path d="M7 42 L113 42" stroke={accent} strokeWidth={4} />
        <Rect x={18} y={29} width={8} height={26} rx={2} fill={colors.muscleNeutral} />
        <Rect x={94} y={29} width={8} height={26} rx={2} fill={colors.muscleNeutral} />
        <Path d="M43 81 L48 65 L77 65 L82 81" /><Rect x={42} y={60} width={41} height={7} rx={3} fill={accent} /></>;
      break;
    case Equipment.BODYWEIGHT:
      drawing = <><Path d="M24 82 L24 18 L96 18 L96 82 M15 82 L34 82 M86 82 L105 82" />
        <Path d="M20 18 L100 18" stroke={accent} strokeWidth={5} />
        <Path d="M30 36 L42 36 L42 52 M90 36 L78 36 L78 52" />
        <Path d="M39 88 L76 88 L85 78 L49 78 Z" fill={colors.muscleNeutral} /></>;
      break;
    case Equipment.ROMAN_CHAIR:
      drawing = <><Path d="M12 83 L107 83 M27 83 L78 37 M54 58 L76 83 M20 81 L20 61" />
        <G rotation={-38} origin="78,37"><Rect x={61} y={29} width={34} height={17} rx={5} fill={accent} />
          <Line x1={78} y1={30} x2={78} y2={44} /></G>
        <Rect x={9} y={53} width={29} height={12} rx={6} fill={colors.muscleNeutral} />
        <Path d="M26 72 L39 72 L39 78" /></>;
      break;
    case Equipment.STABILITY_BALL:
      drawing = <><Circle cx={60} cy={48} r={34} fill={colors.muscleNeutral} />
        <Ellipse cx={60} cy={48} rx={15} ry={34} stroke={accent} />
        <Path d="M28 37 Q60 51 92 37 M27 55 Q60 69 93 55 M35 24 Q60 35 85 24 M35 73 Q60 83 85 73" /></>;
      break;
    case Equipment.KETTLEBELL:
      drawing = <><Path d="M42 38 Q25 7 60 7 Q95 7 78 38 L68 35 Q80 18 60 18 Q40 18 52 35 Z" fill={colors.muscleNeutral} />
        <Path d="M43 32 Q18 45 29 74 Q60 92 91 74 Q102 45 77 32 Z" fill={accent} />
        <Path d="M39 49 Q32 61 39 69" stroke={colors.bgElevated} strokeWidth={3} /></>;
      break;
    case Equipment.BANDS:
      drawing = <><Ellipse cx={46} cy={48} rx={21} ry={35} rotation={22} origin="46,48" stroke={accent} strokeWidth={8} />
        <Ellipse cx={77} cy={51} rx={18} ry={29} rotation={-20} origin="77,51" stroke={colors.textMuted} strokeWidth={6} /></>;
      break;
    case Equipment.UNSPECIFIED:
      drawing = <><Rect x={30} y={22} width={60} height={54} rx={8} strokeDasharray="5 5" />
        <Path d="M49 39 Q50 28 63 33 Q76 39 61 49 L61 55" /><Circle cx={61} cy={64} r={1} /></>;
  }
  return <Svg testID={`equipment-art-${equipment}`} width={90} height={76} viewBox="0 0 120 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">{drawing}</G>
  </Svg>;
}
