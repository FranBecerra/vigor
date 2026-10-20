import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SplitStructure } from '@/models';
import { BodyMap } from '../BodyMap';
import { splitDiagramPaint, splitDiagramSessions } from '@/services/training/generationPresentation';
import { useTheme } from '@/theme/useTheme';

export function SplitDiagram({ split, sessions }: { split: SplitStructure; sessions: number }) {
  const paint = useMemo(() => splitDiagramPaint(split, sessions), [split, sessions]);
  return <View testID={`split-diagram-${split}`}><BodyMap height={104} gap={2} paint={paint} /></View>;
}

export function SplitLegend({ split, sessions }: { split: SplitStructure; sessions: number }) {
  const { t } = useTranslation(); const { colors, typography } = useTheme();
  const entries = splitDiagramSessions(split, sessions);
  return <View accessibilityLabel={t('generate.splitDiagramHint')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {entries.length ? entries.map(({ focus, color }, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{index + 1} · {t(`generate.focus${focus}`)}</Text>
    </View>) : <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('generate.splitDiagramAuto')}</Text>}
  </View>;
}
