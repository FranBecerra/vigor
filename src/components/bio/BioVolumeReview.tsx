import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { BioDoseReview } from '@/services/bio/volumeResponse';

export function BioVolumeReview({ items }: { items: BioDoseReview[] }) {
  const { t } = useTranslation(), { surfaces, colors, typography, radius } = useTheme();
  return <View style={{ ...surfaces.bio, padding: 20, borderRadius: radius.lg, gap: 12, marginBottom: 16 }}>
    <Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bioDose.title')}</Text>
    <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioDose.objective')}</Text>
    {!items.length && <Text style={[typography.body, { color: colors.textSecondary }]}>{t('bioDose.empty')}</Text>}
    {items.map((item) => <View key={item.muscle} style={{ paddingTop: 12, borderTopWidth: 0.5, borderColor: colors.surfaceBorder, gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`muscle.${item.muscle}`)}</Text>
        <Text style={[typography.title, { color: colors.bioText }]}>{t(`bioDose.${item.action}`)}</Text>
      </View>
      <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`bioDose.${item.reason}`)}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioDose.evidence', { count: item.observations,
        cycles: item.cycleIndexes.map((index) => index + 1).join(', ') })}</Text>
    </View>)}
    <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('bioDose.boundary')}</Text>
  </View>;
}
