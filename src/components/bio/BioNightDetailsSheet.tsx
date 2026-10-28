import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { useBioNight } from '@/hooks/useBioNight';
import { useTheme } from '@/theme/useTheme';
import { BioNightCard } from './BioNightCard';

/** Overlay only: opening measurement details must not resize or scroll the Bio overview. */
export function BioNightDetailsSheet({ night, onClose }: { night: ReturnType<typeof useBioNight>; onClose: () => void }) {
  const { t } = useTranslation(), { colors, surfaces, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
    <View accessibilityViewIsModal style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={[typography.h2, { color: colors.textPrimary, flex: 1 }]}>{t('bioNight.connection')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('bio.close')} onPress={onClose}
          style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
          <Text style={[typography.title, { color: colors.bioText }]}>{t('bio.close')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <BioNightCard night={night} />
      </ScrollView>
    </View>
  </Modal>;
}
