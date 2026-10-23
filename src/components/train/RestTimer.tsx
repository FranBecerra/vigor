import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from '@/components/GlassSurface';
import { useRestAlert } from '@/hooks/useRestAlert';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { REST_STEP_SECONDS, formatRest, isRestFinished, remainingSeconds, type RestTimerState } from '@/services/training/restTimer';
import { NumericField } from './NumericField';

/** Fixed header footprint. Closing controls never cancels or resets the clock. */
export function RestTimer({ state, onAdjust, onRestart, onSetDuration, onCancel, prescribedSeconds, exerciseName, onSetPrescription }: {
  state: RestTimerState; onAdjust: (seconds: number) => void; onRestart: () => void;
  onSetDuration: (seconds: number) => void; onCancel: () => void;
  prescribedSeconds?: number; exerciseName?: string; onSetPrescription?: (seconds: number) => Promise<void>;
}) {
  const { colors, semantic, sectionAccent, radius } = useTheme(); const { t } = useTranslation();
  const insets = useSafeAreaInsets(); const alertUnavailable = useRestAlert(state);
  const [now, setNow] = useState(Date.now); const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState(false);
  const active = state.startedAt !== null;
  useEffect(() => {
    if (!active) return;
    setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [active, state.startedAt]);
  const remaining = remainingSeconds(state, now);
  const tint = !active ? colors.textMuted : isRestFinished(state, now) ? semantic.warning : sectionAccent.train;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('restControls.open', { time: formatRest(remaining) })}
      onPress={() => (active || onSetPrescription) && setOpen((value) => !value)} style={{ minWidth: 88, minHeight: 48 }}>
      <GlassSurface glassEffectStyle="regular" style={{ minWidth: 88, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: radius.lg }}>
        <Animated.Text key={active ? 'active' : 'idle'} entering={FadeIn.duration(220)} exiting={FadeOut.duration(100)}
          style={{ color: tint, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{active ? formatRest(remaining) : '—:—'}</Animated.Text>
      </GlassSurface>
    </Pressable>
    <Modal visible={open && (active || !!onSetPrescription)} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable accessibilityLabel={t('restControls.close')} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: '#0007' }} />
      <View accessibilityViewIsModal style={{ backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
        padding: 20, paddingBottom: insets.bottom + 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>{formatRest(remaining)}</Text>
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t('restControls.close')}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.textPrimary, fontSize: 22 }}>×</Text></Pressable>
        </View>
        {active && <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('restControls.thisRestOnly')}</Text>}
        {alertUnavailable && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('workout.alertUnavailable')}</Text>}
        {active && <View style={{ flexDirection: 'row', gap: 10 }}>
          {[{ label: '−' + REST_STEP_SECONDS + 's', press: () => onAdjust(-REST_STEP_SECONDS) },
            { label: '+' + REST_STEP_SECONDS + 's', press: () => onAdjust(REST_STEP_SECONDS) },
            { label: t('restControls.restart'), press: onRestart }].map((item) => <Pressable key={item.label} accessibilityRole="button"
              onPress={item.press} style={{ flex: 1, minHeight: 48, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{item.label}</Text>
            </Pressable>)}
        </View>}
        {onSetPrescription && <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>{exerciseName}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('restControls.inPlan')}</Text>
        </View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 16, flex: 1 }}>{t('calendar.restSeconds')}</Text>
          <View style={{ width: 100, opacity: saving ? 0.5 : 1 }} pointerEvents={saving ? 'none' : 'auto'}><NumericField compact value={onSetPrescription ? prescribedSeconds : state.durationSeconds} accessibilityLabel={t('calendar.restSeconds')}
            onChangeValue={(value) => {
              if (value === undefined || saving) return;
              if (!onSetPrescription) { onSetDuration(value); return; }
              setSaving(true); setSaveError(false);
              void onSetPrescription(value).catch(() => setSaveError(true)).finally(() => setSaving(false));
            }} /></View>
        </View>
        {saveError && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('calendar.saveFailed')}</Text>}
        {active && <Pressable accessibilityRole="button" accessibilityLabel={t('restControls.cancel')} onPress={() => { onCancel(); setOpen(false); }}
          style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: semantic.danger, fontSize: 16, fontWeight: '600' }}>{t('restControls.cancel')}</Text></Pressable>}
      </View>
    </Modal>
  </>;
}
