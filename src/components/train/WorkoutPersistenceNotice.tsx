import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { SaveStatus } from '@/hooks/useSessionPersistence';

/** Routine local saves and queued sync stay silent; actionable failures remain visible. */
export function WorkoutPersistenceNotice({ status, activityUnavailable }: { status: SaveStatus; activityUnavailable: boolean }) {
  const { t } = useTranslation(); const { semantic } = useTheme();
  const key = status === 'error' ? 'train.saveError' : activityUnavailable ? 'workout.activityUnavailable' : null;
  return key ? <Text accessibilityRole="alert" style={{ fontSize: 12, marginTop: 1, color: semantic.warning }}>{t(key)}</Text> : null;
}
