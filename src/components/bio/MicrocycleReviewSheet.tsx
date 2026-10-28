import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { MicrocycleReviewAnswers } from '@/models/microcycleReview';
import { REVIEW_CONTEXT, REVIEW_MUSCLES, normalizeReviewAnswers } from '@/services/bio/microcycleReview';
import { useTheme } from '@/theme/useTheme';

interface Props {
  initial: MicrocycleReviewAnswers;
  cycleNumber: number;
  onClose: () => void;
  onSave: (answers: MicrocycleReviewAnswers) => Promise<void>;
  onSkip: () => Promise<void>;
}

export function MicrocycleReviewSheet({ initial, cycleNumber, onClose, onSave, onSkip }: Props) {
  const { t } = useTranslation();
  const { surfaces, colors, typography, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<MicrocycleReviewAnswers>(() => normalizeReviewAnswers(initial));
  const [choosingMuscles, setChoosingMuscles] = useState(!!initial.unrecoveredMuscles?.length);
  const [showContext, setShowContext] = useState(!!initial.context?.length);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const answered = ['recovery', 'unrecoveredMuscles', 'discomfort', 'sustainability'].some((key) => key in answers);
  const action = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await operation(); onClose(); } catch { setError(true); } finally { setBusy(false); }
  };
  const choice = (label: string, selected: boolean, onPress: () => void, key = label) => <Pressable key={key}
    accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: busy }} disabled={busy}
    onPress={onPress} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: radius.md, borderWidth: 1, borderColor: selected ? colors.accentText : colors.controlBorder,
      backgroundColor: selected ? colors.surface : colors.bgElevated }}>
    <Text style={[typography.body, { color: selected ? colors.accentText : colors.textPrimary, fontWeight: selected ? '700' : '400' }]}>{label}</Text>
  </Pressable>;
  const musclePicker = (field: 'unrecoveredMuscles' | 'discomfortMuscles') => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
    {REVIEW_MUSCLES.map((muscle) => choice(t(`muscle.${muscle}`), answers[field]?.includes(muscle) ?? false, () => {
      setAnswers((old) => {
        const values = old[field] ?? [];
        return { ...old, [field]: values.includes(muscle) ? values.filter((value) => value !== muscle) : [...values, muscle] };
      });
    }, `${field}:${muscle}`))}
  </View>;
  const question = (title: string, children: ReactNode) => <View style={{ marginBottom: spacing.xl }}>
    <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 10 }]}>{title}</Text>{children}
  </View>;
  return <Modal transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
      <View accessibilityViewIsModal style={{ maxHeight: '94%', paddingTop: 20, paddingBottom: Math.max(12, insets.bottom),
        ...surfaces.screen, backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><Text style={[typography.h2, { color: colors.textPrimary }]}>{t('bio.reviewTitle')}</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>{t('bio.cycle', { count: cycleNumber })}</Text></View>
          {choice(t('bio.close'), false, onClose)}
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {question(t('bio.qRecovery'), <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['WORSE', 'USUAL', 'BETTER'] as const).map((value) => choice(t(`bio.recovery.${value}`), answers.recovery === value,
              () => setAnswers((old) => ({ ...old, recovery: value }))))}
          </View>)}
          {question(t('bio.qMuscles'), <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {choice(t('bio.none'), answers.unrecoveredMuscles?.length === 0 && !choosingMuscles, () => {
                setChoosingMuscles(false); setAnswers((old) => ({ ...old, unrecoveredMuscles: [] }));
              })}
              {choice(t('bio.chooseMuscles'), choosingMuscles, () => setChoosingMuscles(true))}
            </View>{choosingMuscles && musclePicker('unrecoveredMuscles')}
          </>)}
          {question(t('bio.qDiscomfort'), <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['NONE', 'PRESENT'] as const).map((value) => choice(t(`bio.discomfort.${value}`), answers.discomfort === value,
                () => setAnswers((old) => normalizeReviewAnswers({ ...old, discomfort: value }))))}
            </View>{answers.discomfort === 'PRESENT' && musclePicker('discomfortMuscles')}
          </>)}
          {question(t('bio.qSustainable'), <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['YES', 'TIGHT', 'NO'] as const).map((value) => choice(t(`bio.sustainability.${value}`), answers.sustainability === value,
              () => setAnswers((old) => ({ ...old, sustainability: value }))))}
          </View>)}
          {choice(t('bio.contextTitle'), showContext, () => setShowContext(!showContext))}
          {showContext && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {REVIEW_CONTEXT.map((value) => choice(t(`bio.context.${value}`), answers.context?.includes(value) ?? false, () => {
              setAnswers((old) => ({ ...old, context: old.context?.includes(value) ? old.context.filter((item) => item !== value) : [...(old.context ?? []), value] }));
            }))}
          </View>}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {error && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bio.saveError')}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={t('bio.save')} disabled={busy || !answered}
            accessibilityState={{ disabled: busy || !answered }} onPress={() => void action(() => onSave(answers))}
            style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.accentText, opacity: busy || !answered ? 0.45 : 1 }}>
            <Text style={[typography.title, { color: colors.bg }]}>{t(busy ? 'custom.saving' : 'bio.save')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t(Object.keys(initial).length ? 'generate.cancel' : 'bio.skip')} disabled={busy}
            onPress={() => { if (Object.keys(initial).length) onClose(); else void action(onSkip); }}
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t(Object.keys(initial).length ? 'generate.cancel' : 'bio.skip')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
