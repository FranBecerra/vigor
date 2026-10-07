/**
 * Body silhouettes with each muscle painted by the caller (PRD §8.9): the full front and
 * back map for the mesocycle heat, and a cropped picture per emphasis button.
 *
 * Hidden from VoiceOver: every screen that shows it also names the same muscles as text.
 */
import { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { MuscleGroup } from '@/models';
import { BODY_MAP } from '@/data/bodyMapPaths';
import type { BodyMapPaint, RegionThumbnail } from '@/services/training/bodyMap';
import { useTheme } from '@/theme/useTheme';

type Paint = (muscle: MuscleGroup) => BodyMapPaint | null;

function Silhouette({ side, viewBox, width, height, paint }: {
  side: 'front' | 'back';
  viewBox: string;
  width: number;
  height: number;
  paint: Paint;
}) {
  const { colors } = useTheme();
  // Several thumbnails share a screen, so clip ids must not collide between them.
  const idPrefix = useId().replace(/:/g, '');
  const view = BODY_MAP[side];
  return (
    <Svg width={width} height={height} viewBox={viewBox}>
      <Defs>
        {view.paths.map((path, index) => path.clip && (
          <ClipPath key={index} id={`${idPrefix}-${index}`}>
            <Rect x={path.clip[0]} y={path.clip[1]} width={path.clip[2]} height={path.clip[3]} />
          </ClipPath>
        ))}
      </Defs>
      <Path d={view.outline} fill="none" stroke={colors.textMuted} strokeOpacity={0.45}
        strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {view.paths.map((path, index) => {
        const fill = paint(path.muscle);
        // Colour goes over the neutral tone, so a faint heat level reads darker than none.
        return (
          <G key={index} clipPath={path.clip ? `url(#${idPrefix}-${index})` : undefined}>
            <Path d={path.d} fill={colors.muscleNeutral} />
            {fill && <Path d={path.d} fill={fill.color} fillOpacity={fill.opacity} />}
          </G>
        );
      })}
    </Svg>
  );
}

export function BodyMap({ paint, height }: {
  paint: Paint;
  /** Height of each silhouette; the width follows the 1:2 drawing. */
  height: number;
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={[styles.row, { gap: spacing.md }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {(['front', 'back'] as const).map((side) => (
        <Silhouette key={side} side={side} viewBox={BODY_MAP[side].viewBox}
          width={height / 2} height={height} paint={paint} />
      ))}
    </View>
  );
}

export function BodyMapThumbnail({ thumbnail, size, paint }: {
  thumbnail: RegionThumbnail;
  size: number;
  paint: Paint;
}) {
  const [x, y, crop] = thumbnail.crop;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Silhouette side={thumbnail.side} viewBox={`${x} ${y} ${crop} ${crop}`}
        width={size} height={size} paint={paint} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
});
