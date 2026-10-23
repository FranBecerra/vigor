import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { editNumericDraft } from '@/services/training/workoutExecution';
import { intensityColor, intensityLabel, intensityOptions, type IntensityScale, type IntensityValue } from '@/services/training/intensityScale';
import { parseNumericText } from '@/services/training/numericDraft';

/** Compact, shared kg/reps/effort editor. No system keyboard obscures the workout. */
export interface SetEntryValues { weight?: number; reps?: number; intensity: IntensityValue; partialReps?: number }
export function SetEntrySheet({ initialField, weight, reps, intensity, partialReps, scale, onWeight, onReps, onIntensity, onPartialReps, onComplete, onClose }:
  { initialField: 'weight' | 'reps' | 'intensity'; weight?: number; reps?: number; intensity?: IntensityValue;
    scale: IntensityScale; onWeight: (value: number | undefined) => void; onReps: (value: number | undefined) => void;
    partialReps?: number; onPartialReps?: (value: number | undefined) => void; onComplete?: (values: SetEntryValues) => void;
    onIntensity: (value: IntensityValue) => void; onClose: () => void }) {
  const { colors, sectionAccent, radius, typography } = useTheme();
  const { t } = useTranslation(); const insets = useSafeAreaInsets();
  const [field, setField] = useState<'weight' | 'reps' | 'intensity' | 'partialReps'>(initialField);
  const [drafts, setDrafts] = useState({ weight: weight === undefined ? '' : String(weight), reps: reps === undefined ? '' : String(reps), partialReps: partialReps === undefined ? '' : String(partialReps) });
  const [showPartials, setShowPartials] = useState(partialReps !== undefined);
  const [replace, setReplace] = useState(true);
  const [effort, setEffort] = useState(intensity ?? null);
  const accent = sectionAccent.train;
  const enter = (key: string) => {
    if (field === 'intensity') return;
    const text = editNumericDraft(replace && /^\d$/.test(key) ? '' : drafts[field], key, field === 'weight');
    setReplace(false); setDrafts((old) => ({ ...old, [field]: text }));
    (field === 'weight' ? onWeight : field === 'reps' ? onReps : onPartialReps)?.(parseNumericText(text, field === 'weight'));
  };
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <Pressable accessibilityLabel={t('workout.done')} onPress={onClose} style={{ flex: 1, backgroundColor: '#0005' }} />
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
        <Pressable onPress={() => setField('intensity')} accessibilityRole="button" accessibilityLabel={scale}
          style={{ flex: 1, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: field === 'intensity' ? accent : colors.surfaceBorder }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{scale}</Text><Text style={[typography.h2, { color: colors.accentText }]}>{intensityLabel(effort, scale)}</Text>
        </Pressable>
        <Pressable onPress={onClose} accessibilityLabel={t('workout.done')} accessibilityRole="button" style={{ minHeight: 44, padding: 12 }}><Text style={{ color: colors.accentText }}>⌄</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {[null, ...intensityOptions(scale)].map((value) => <Pressable key={String(value)} accessibilityRole="button"
          accessibilityLabel={`${scale} ${intensityLabel(value, scale)}`} accessibilityState={{ selected: effort === value }}
          onPress={() => { setEffort(value); onIntensity(value); }}
          style={{ flexGrow: 1, minWidth: 44, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: effort === value ? colors.textPrimary : 'transparent', backgroundColor: intensityColor(value, scale) ?? colors.surface }}>
          <Text style={{ color: value === null ? colors.textPrimary : '#16191C', fontWeight: '700' }}>{intensityLabel(value, scale)}</Text>
        </Pressable>)}
      </View>
      {onPartialReps && <Pressable accessibilityRole="button" accessibilityLabel={t('workout.partialReps')} onPress={() => { setShowPartials(true); setField('partialReps'); setReplace(true); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: field === 'partialReps' ? colors.accentText : colors.textSecondary, fontSize: 15 }}>{t('workout.partialReps')}{showPartials ? `: ${drafts.partialReps || '—'}` : ' +'}</Text>
      </Pressable>}
      {field !== 'intensity' && ['123', '456', '789', '.0⌫'].map((row) => <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
        {[...row].map((key) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === '⌫' ? t('workout.eraseDigit') : key}
          disabled={key === '.' && field !== 'weight'} onPress={() => enter(key === '⌫' ? 'backspace' : key)}
          onLongPress={key === '⌫' ? () => enter('clear') : undefined}
          style={{ flex: 1, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600' }}>{key === '.' && field !== 'weight' ? '' : key}</Text>
        </Pressable>)}
      </View>)}
      {onComplete && <Pressable accessibilityRole="button" accessibilityLabel={t('workout.completeSet')} onPress={() => {
        onComplete({ weight: parseNumericText(drafts.weight, true), reps: parseNumericText(drafts.reps, false), intensity: effort,
          partialReps: parseNumericText(drafts.partialReps, false) }); onClose();
      }} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: accent }}>
        <Text style={{ color: '#16191C', fontSize: 17, fontWeight: '700' }}>{t('workout.completeSet')} ↵</Text>
      </Pressable>}
    </View>
  </Modal>;
}
