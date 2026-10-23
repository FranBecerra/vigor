import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

export type RerollNotice = 'updated' | 'unchanged' | 'edited' | 'failed';
const MESSAGE: Record<RerollNotice, string> = {
  updated: 'generate.rerollUpdated', unchanged: 'generate.rerollUnchanged',
  edited: 'generate.rerollEdited', failed: 'generate.rerollFailed',
};

/** Keep the result visible even when the changed exercises are below the viewport. */
export function RerollFeedback({ notice }: { notice: RerollNotice | null }) {
  const { t } = useTranslation(); const { colors, typography, spacing } = useTheme();
  return notice ? <Text accessibilityLiveRegion="polite" style={[typography.caption,
    { color: colors.textSecondary, marginVertical: spacing.sm }]}>{t(MESSAGE[notice])}</Text> : null;
}
