import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { editNumericDraft } from '@/services/training/workoutExecution';
import { intensityColor, intensityLabel, intensityOptions, type IntensityScale, type IntensityValue } from '@/services/training/intensityScale';
import { parseNumericText } from './NumericField';

/** Compact, shared kg/reps/effort editor. No system keyboard obscures the workout. */
export function SetEntrySheet({ initialField, weight, reps, intensity, scale, onWeight, onReps, onIntensity, onClose }:
  { initialField: 'weight' | 'reps' | 'intensity'; weight?: number; reps?: number; intensity?: IntensityValue;
    scale: IntensityScale; onWeight: (value: number | undefined) => void; onReps: (value: number | undefined) => void;
    onIntensity: (value: IntensityValue) => void; onClose: () => void }) {
  const { colors, sectionAccent, radius, typography } = useTheme();
  const { t } = useTranslation(); const insets = useSafeAreaInsets();
  const [field, setField] = useState(initialField === 'reps' ? 'reps' : 'weight');
  const [drafts, setDrafts] = useState({ weight: weight === undefined ? '' : String(weight), reps: reps === undefined ? '' : String(reps) });
  const [replace, setReplace] = useState(true);
  const [effort, setEffort] = useState(intensity ?? null);
  const accent = sectionAccent.train;
  const enter = (key: string) => {
    const text = editNumericDraft(replace && /^\d$/.test(key) ? '' : drafts[field as 'weight' | 'reps'], key, field === 'weight');
    setReplace(false); setDrafts((old) => ({ ...old, [field]: text }));
    (field === 'weight' ? onWeight : onReps)(parseNumericText(text, field === 'weight'));
  };
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <Pressable accessibilityLabel={t('exerciseWizard.done')} onPress={onClose} style={{ flex: 1, backgroundColor: '#0005' }} />
    <View accessibilityViewIsModal style={{ backgroundColor: colors.bgElevated, paddingHorizontal: 16, paddingTop: 12,
      paddingBottom: Math.max(8, insets.bottom), borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {(['weight', 'reps'] as const).map((name) => <Pressable key={name} accessibilityRole="button"
          accessibilityLabel={t(`train.${name}`)} accessibilityState={{ selected: field === name }}
          onPress={() => { setField(name); setReplace(true); }}
          style={{ flex: 1, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: field === name ? accent : colors.surfaceBorder }}>
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>{t(`train.${name}`)}</Text>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>{drafts[name] || '—'}</Text>
        </Pressable>)}
        <Pressable onPress={onClose} accessibilityRole="button" style={{ padding: 12 }}><Text style={{ color: accent }}>✓</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ color: colors.textMuted, width: 30, fontSize: 10 }}>{scale}</Text>
        {[null, ...intensityOptions(scale)].map((value) => <Pressable key={String(value)} accessibilityRole="button"
          accessibilityLabel={`${scale} ${intensityLabel(value, scale)}`} accessibilityState={{ selected: effort === value }}
          onPress={() => { setEffort(value); onIntensity(value); }}
          style={{ flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: effort === value ? colors.textPrimary : 'transparent', backgroundColor: intensityColor(value, scale) ?? colors.surface }}>
          <Text style={{ color: value === null ? colors.textPrimary : '#16191C', fontWeight: '700' }}>{intensityLabel(value, scale)}</Text>
        </Pressable>)}
      </View>
      {['123', '456', '789', '.0⌫'].map((row) => <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
        {[...row].map((key) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === '⌫' ? t('workout.eraseDigit') : key}
          disabled={key === '.' && field === 'reps'} onPress={() => enter(key === '⌫' ? 'backspace' : key)}
          onLongPress={key === '⌫' ? () => enter('clear') : undefined}
          style={{ flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600' }}>{key === '.' && field === 'reps' ? '' : key}</Text>
        </Pressable>)}
      </View>)}
    </View>
  </Modal>;
}
