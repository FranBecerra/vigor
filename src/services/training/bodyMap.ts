/** Colour rules and crops for the body map: emphasis buttons and mesocycle heat. PURE LOGIC. */
import { MuscleGroup } from '@/models';
import { REGION_OF_MUSCLE, VolumeRegion } from './volumePlan';

export interface BodyMapPaint {
  color: string;
  opacity: number;
}

/** Lowest opacity of a muscle with any volume, so one set still reads as worked. */
export const MIN_HEAT_OPACITY = 0.2;

export function heatOpacity(sets: number, maxSets: number): number {
  if (sets <= 0 || maxSets <= 0) return 0;
  return MIN_HEAT_OPACITY + (1 - MIN_HEAT_OPACITY) * Math.min(1, sets / maxSets);
}

/** Paint per muscle on the shared scale of the volume bars; absent muscles stay neutral. */
export function heatPaint(
  volumes: readonly { muscle: MuscleGroup; sets: number }[],
  color: string,
): (muscle: MuscleGroup) => BodyMapPaint | null {
  const sets = new Map<MuscleGroup, number>();
  for (const entry of volumes) sets.set(entry.muscle, (sets.get(entry.muscle) ?? 0) + entry.sets);
  const maxSets = Math.max(0, ...sets.values());
  return (muscle) => {
    const opacity = heatOpacity(sets.get(muscle) ?? 0, maxSets);
    return opacity > 0 ? { color, opacity } : null;
  };
}

export interface RegionThumbnail {
  side: 'front' | 'back';
  /** Square crop [x, y, size] in that view's coordinates. */
  crop: readonly [number, number, number];
}

/**
 * Crop of each emphasis button's picture: the bounding box of the region's paths (one side
 * for limbs), squared with 30 % margin and at least 200 units so a shoulder head keeps the
 * arm and torso around it. Measured once from BODY_MAP; re-measure if its paths change.
 */
export const REGION_THUMBNAILS: Readonly<Partial<Record<VolumeRegion, RegionThumbnail>>> = {
  [VolumeRegion.CHEST]: { side: 'front', crop: [222, 234, 283] },
  [VolumeRegion.BACK]: { side: 'back', crop: [896, 254, 374] },
  [VolumeRegion.DELTS_LATERAL]: { side: 'front', crop: [116, 250, 200] },
  [VolumeRegion.DELTS_REAR]: { side: 'back', crop: [865, 255, 200] },
  [VolumeRegion.DELTS_FRONT]: { side: 'front', crop: [158, 250, 200] },
  [VolumeRegion.NECK]: { side: 'front', crop: [260, 174, 209] },
  [VolumeRegion.BICEPS]: { side: 'front', crop: [103, 350, 200] },
  [VolumeRegion.TRICEPS]: { side: 'back', crop: [831, 359, 200] },
  [VolumeRegion.ERECTORS]: { side: 'back', crop: [954, 433, 261] },
  [VolumeRegion.CORE]: { side: 'front', crop: [170, 372, 389] },
  [VolumeRegion.QUADS]: { side: 'front', crop: [101, 625, 365] },
  [VolumeRegion.HAMSTRINGS]: { side: 'back', crop: [836, 701, 346] },
  [VolumeRegion.GLUTES]: { side: 'back', crop: [944, 559, 279] },
  [VolumeRegion.ADDUCTORS]: { side: 'front', crop: [201, 609, 327] },
  [VolumeRegion.CALVES]: { side: 'back', crop: [799, 923, 415] },
};

/** Paints the muscles of one region and leaves the rest neutral. */
export function regionPaint(
  region: VolumeRegion,
  color: string,
): (muscle: MuscleGroup) => BodyMapPaint | null {
  return (muscle) => (REGION_OF_MUSCLE[muscle] === region ? { color, opacity: 1 } : null);
}
