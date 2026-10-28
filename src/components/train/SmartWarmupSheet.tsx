import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { smartWarmup, WARMUP_TEMPLATE } from '@/services/training/smartWarmup';
import { NumericField } from './NumericField';
import { useTrainingUnits } from '@/hooks/useTrainingUnits';

export function SmartWarmupSheet({ name, reference, workingLoad, onAdd, onClose }: {
  name: string; reference?: number; workingLoad?: number; onAdd: (rows: { weight: number; reps: number }[]) => void; onClose: () => void;
}) {
  const { t } = useTranslation(); const { surfaces, colors, radius, typography, sectionAccent } = useTheme(); const insets = useSafeAreaInsets();
  const [rm, setRM] = useState(reference); const [increment, setIncrement] = useState<number | undefined>(2.5);
  const units = useTrainingUnits();
  const [steps, setSteps] = useState<{ percent: number; reps: number }[]>(WARMUP_TEMPLATE.map((step) => ({ ...step })));
  const preview = smartWarmup(rm ?? 0, increment ?? 0, workingLoad, steps);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={{ flex: 1, backgroundColor: '#0007' }} onPress={onClose} accessibilityLabel={t('generate.cancel')} />
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%', ...surfaces.sheet, backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 12 }}>
      <Text style={[typography.title, { color: colors.textPrimary }]}>{t('trainingUpdates.warmup')}</Text><Text style={{ color: colors.textPrimary }}>{name}</Text>
      <Text style={{ color: colors.textMuted }}>{t('trainingUpdates.warmupHint')}</Text>
      <Text style={{ color: colors.textSecondary }}>{t(reference ? 'trainingUpdates.estimatedRM' : 'trainingUpdates.referenceManual')}</Text>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>{t('trainingUpdates.referenceRM').replace(/\bkg\b/gi, units.unit)}</Text><NumericField compact decimal value={units.display(rm)} accessibilityLabel={t('trainingUpdates.referenceRM')} onChangeValue={(value) => setRM(units.store(value))} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>{t('trainingUpdates.increment').replace(/\bkg\b/gi, units.unit)}</Text><NumericField compact decimal value={units.display(increment)} accessibilityLabel={t('trainingUpdates.increment')} onChangeValue={(value) => setIncrement(units.store(value))} /></View>
      </View>
      {steps.map((step, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: colors.textSecondary, width: 24 }}>W{index + 1}</Text>
        <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>% 1RM</Text><NumericField compact value={step.percent} accessibilityLabel={`% 1RM ${index + 1}`} onChangeValue={(value) => setSteps((old) => old.map((row, i) => i === index ? { ...row, percent: value ?? 0 } : row))} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.textSecondary }}>{t('train.reps')}</Text><NumericField compact value={step.reps} accessibilityLabel={`${t('train.reps')} ${index + 1}`} onChangeValue={(value) => setSteps((old) => old.map((row, i) => i === index ? { ...row, reps: value ?? 0 } : row))} /></View>
      </View>)}
      <Text style={{ color: colors.textPrimary }}>{preview.length ? preview.map((row) => `${units.display(row.weight)?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units.unit} × ${row.reps}`).join('  →  ') : t('trainingUpdates.warmupUnavailable')}</Text>
      <Pressable accessibilityRole="button" disabled={!preview.length} onPress={() => onAdd(preview)} style={{ minHeight: 52, opacity: preview.length ? 1 : 0.4, ...surfaces.primary, backgroundColor: sectionAccent.train, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>{t('trainingUpdates.applyWarmup')}</Text></Pressable>
      <Pressable onPress={onClose} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary }}>{t('generate.cancel')}</Text></Pressable>
    </ScrollView>
  </Modal>;
}
