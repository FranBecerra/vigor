import { MuscleGroup } from '@/models';
import { REGION_OF_MUSCLE } from '@/services/training/volumePlan';
import { REGION_THUMBNAILS } from '@/services/training/bodyMap';
import { BodyMapThumbnail } from './BodyMap';
import { useTheme } from '@/theme/useTheme';

export function MusclePicture({ muscle, size = 42 }: { muscle: MuscleGroup; size?: number }) {
  const { sectionAccent } = useTheme();
  const thumbnail = REGION_THUMBNAILS[REGION_OF_MUSCLE[muscle]];
  return thumbnail ? <BodyMapThumbnail thumbnail={thumbnail} size={size}
    paint={(target) => target === muscle ? { color: sectionAccent.train, opacity: 1 } : null} /> : null;
}
