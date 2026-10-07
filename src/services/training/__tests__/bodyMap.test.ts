import { MuscleGroup } from '@/models';
import { BODY_MAP } from '@/data/bodyMapPaths';
import {
  heatOpacity,
  heatPaint,
  MIN_HEAT_OPACITY,
  REGION_THUMBNAILS,
  regionPaint,
} from '@/services/training/bodyMap';
import { GENERATOR_EMPHASIS_REGIONS } from '@/services/training/emphasisSelection';
import { REGION_OF_MUSCLE, VolumeRegion } from '@/services/training/volumePlan';

const LIME = '#9BE317';

describe('BODY_MAP data', () => {
  const muscles = new Set([...BODY_MAP.front.paths, ...BODY_MAP.back.paths].map((p) => p.muscle));

  it('draws every muscle group', () => {
    expect([...muscles].sort()).toEqual(Object.values(MuscleGroup).sort());
  });

  it('draws every generator emphasis region somewhere', () => {
    const regions = new Set([...muscles].map((m) => REGION_OF_MUSCLE[m]));
    for (const region of GENERATOR_EMPHASIS_REGIONS) expect(regions).toContain(region);
  });

  it('splits each deltoid into a medial and a lateral half that do not overlap', () => {
    for (const [side, medial] of [['front', MuscleGroup.DELTS_FRONT], ['back', MuscleGroup.DELTS_REAR]] as const) {
      const delts = BODY_MAP[side].paths.filter((p) => p.clip !== undefined);
      expect(delts.map((p) => p.muscle).sort())
        .toEqual([medial, medial, MuscleGroup.DELTS_LATERAL, MuscleGroup.DELTS_LATERAL].sort());
      for (const shape of new Set(delts.map((p) => p.d))) {
        const [a, b] = delts.filter((p) => p.d === shape).map((p) => p.clip!);
        const [left, right] = a[0] < b[0] ? [a, b] : [b, a];
        expect(left[0] + left[2]).toBeCloseTo(right[0], 5);
      }
    }
  });

  it('keeps the lateral half away from the midline', () => {
    for (const side of ['front', 'back'] as const) {
      const minX = Number(BODY_MAP[side].viewBox.split(' ')[0]);
      const midline = minX + 362;
      for (const path of BODY_MAP[side].paths.filter((p) => p.muscle === MuscleGroup.DELTS_LATERAL)) {
        const [x, , w] = path.clip!;
        const centre = x + w / 2;
        const sibling = BODY_MAP[side].paths.find((p) => p.d === path.d && p !== path)!.clip!;
        const siblingCentre = sibling[0] + sibling[2] / 2;
        expect(Math.abs(centre - midline)).toBeGreaterThan(Math.abs(siblingCentre - midline));
      }
    }
  });
});

describe('heatOpacity', () => {
  it('leaves untrained muscles neutral', () => {
    expect(heatOpacity(0, 10)).toBe(0);
    expect(heatOpacity(5, 0)).toBe(0);
    expect(heatOpacity(-1, 10)).toBe(0);
  });

  it('ramps from the floor to full on the shared scale', () => {
    expect(heatOpacity(10, 10)).toBe(1);
    expect(heatOpacity(5, 10)).toBeCloseTo(MIN_HEAT_OPACITY + (1 - MIN_HEAT_OPACITY) / 2);
    expect(heatOpacity(0.01, 10)).toBeGreaterThan(MIN_HEAT_OPACITY);
    expect(heatOpacity(20, 10)).toBe(1);
  });
});

describe('heatPaint', () => {
  it('paints by sets relative to the busiest muscle and sums repeated entries', () => {
    const paint = heatPaint([
      { muscle: MuscleGroup.CHEST, sets: 6 },
      { muscle: MuscleGroup.CHEST, sets: 6 },
      { muscle: MuscleGroup.QUADS, sets: 6 },
    ], LIME);
    expect(paint(MuscleGroup.CHEST)).toEqual({ color: LIME, opacity: 1 });
    expect(paint(MuscleGroup.QUADS)?.opacity).toBeCloseTo(heatOpacity(6, 12));
    expect(paint(MuscleGroup.CALVES)).toBeNull();
  });

  it('paints nothing for an empty plan', () => {
    expect(heatPaint([], LIME)(MuscleGroup.CHEST)).toBeNull();
  });
});

describe('REGION_THUMBNAILS', () => {
  it('gives every emphasis button a crop', () => {
    expect(Object.keys(REGION_THUMBNAILS).sort()).toEqual([...GENERATOR_EMPHASIS_REGIONS].sort());
  });

  it('crops inside its view and around a path of the region', () => {
    for (const region of GENERATOR_EMPHASIS_REGIONS) {
      const { side, crop: [x, y, size] } = REGION_THUMBNAILS[region]!;
      const [minX, minY, width, height] = BODY_MAP[side].viewBox.split(' ').map(Number);
      expect(x).toBeGreaterThanOrEqual(minX);
      expect(y).toBeGreaterThanOrEqual(minY);
      expect(x + size).toBeLessThanOrEqual(minX + width);
      expect(y + size).toBeLessThanOrEqual(minY + height);
      expect(size).toBeGreaterThanOrEqual(200);
      const regionPaths = BODY_MAP[side].paths.filter((p) => REGION_OF_MUSCLE[p.muscle] === region);
      expect(regionPaths.length).toBeGreaterThan(0);
      // The first move of a region path must fall inside the crop.
      const inside = regionPaths.some((p) => {
        const [px, py] = p.d.slice(1).split(/[a-zA-Z]/)[0].match(/-?\d*\.?\d+/g)!.map(Number);
        return px >= x && px <= x + size && py >= y && py <= y + size;
      });
      expect(inside).toBe(true);
    }
  });
});

describe('regionPaint', () => {
  it('paints every muscle of the region and nothing else', () => {
    const paint = regionPaint(VolumeRegion.BACK, LIME);
    expect(paint(MuscleGroup.LATS)).toEqual({ color: LIME, opacity: 1 });
    expect(paint(MuscleGroup.MID_BACK)).toEqual({ color: LIME, opacity: 1 });
    expect(paint(MuscleGroup.DELTS_REAR)).toBeNull();
    expect(paint(MuscleGroup.CHEST)).toBeNull();
  });
});
