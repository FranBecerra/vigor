import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';

const stages = ['SETUP', 'STRENGTH', 'CARDIO', 'REVIEW'] as const;
export type HybridStage = typeof stages[number];

export function HybridProgress({ stage }: { stage: HybridStage }) {
  const { t } = useTranslation();
  const { colors, sectionAccent } = useTheme();
  const current = stages.indexOf(stage);
  return <View
    testID="hybrid-progress"
    accessible
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 1, max: stages.length, now: current + 1, text: t(`hybridProgress.${stage}`) }}
    style={{ flexDirection: 'row', gap: 6, marginBottom: 22 }}
  >
    {stages.map((entry, index) => <View key={entry} style={{ flex: 1, minWidth: 0, gap: 7 }}>
      <View style={{
        height: 4, borderRadius: 2,
        backgroundColor: index <= current ? sectionAccent.train : colors.surfaceBorder,
        opacity: index < current ? 0.45 : 1,
      }} />
      <Text style={{ fontSize: 11, color: index === current ? colors.accentText : colors.textSecondary, fontWeight: index === current ? '700' : '400' }}>
        {t(`hybridProgress.${entry}`)}
      </Text>
    </View>)}
  </View>;
}
