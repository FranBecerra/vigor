import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { CardioBlock, CardioCycleResponses, CardioWorkout } from '@/models/cardioTraining';
import { confirmCardioCycle, reviewCardioCycle } from '@/services/cardio/cardioProgression';

export function CardioProgressionReview({ block, workouts, enabled, onSave }: {
  block: CardioBlock; workouts: CardioWorkout[]; enabled: boolean; onSave: (next: CardioBlock, previous: CardioBlock) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const [details, setDetails] = useState(false);
  const [responses, setResponses] = useState<CardioCycleResponses>({ easy: 'UNKNOWN', recovered: 'UNKNOWN', symptoms: 'UNKNOWN' });
  const lock = useRef(false), epoch = useRef(0);
  useEffect(() => () => { epoch.current += 1; }, []);
  const { t } = useTranslation(), { colors, surfaces, radius, semantic } = useTheme();
  if (!block.progression || block.endedAt !== null || block.progression.reviews.length >= block.cycles) return null;
  const review = reviewCardioCycle(block, workouts, responses, Date.now());
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label}
    disabled={busy || disabled} onPress={action} style={{ ...surfaces.field, padding: 14, minHeight: 48, borderRadius: radius.md, opacity: disabled ? .45 : 1 }}>
    <Text style={{ color: colors.accentText, fontSize: 17 }}>{label}</Text></Pressable>;
  const save = async (decision: 'INCREASE' | 'REPEAT') => {
    if (lock.current || !enabled) return;
    lock.current = true; setBusy(true); setError(false); const token = epoch.current;
    try {
      const next = confirmCardioCycle(block, workouts, responses, decision, review.fingerprint, Date.now());
      await onSave(next, block);
      if (token === epoch.current) { setOpen(false); setResponses({ easy: 'UNKNOWN', recovered: 'UNKNOWN', symptoms: 'UNKNOWN' }); }
    } catch { if (token === epoch.current) setError(true); }
    finally { lock.current = false; if (token === epoch.current) setBusy(false); }
  };
  return <View style={{ ...surfaces.card, padding: 18, borderRadius: radius.lg, gap: 12, marginVertical: 12 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600' }}>{t('cardioProgression.title', { cycle: review.cycle + 1 })}</Text>
    <Text style={{ color: colors.textSecondary }}>{t('cardioTraining.progress', { done: review.completed, total: review.total })}</Text>
    {button(t('cardioProgression.review'), () => { epoch.current += 1; setOpen(true); setError(false); }, !enabled)}
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60, gap: 16 }}>
        {button(t('generate.cancel'), () => setOpen(false))}
        <Text style={{ color: colors.textPrimary, fontSize: 25, fontWeight: '700' }}>{t('cardioProgression.title', { cycle: review.cycle + 1 })}</Text>
        {(['easy', 'recovered', 'symptoms'] as const).map(key => <View key={key} style={{ gap: 8 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18 }}>{t(`cardioProgression.${key}`)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{(key === 'symptoms' ? ['NONE', 'PRESENT', 'UNKNOWN'] : ['YES', 'NO', 'UNKNOWN']).map(value => <Pressable key={value}
            accessibilityRole="radio" accessibilityState={{ checked: responses[key] === value }} accessibilityLabel={t(`cardioProgression.answer_${key}_${value}`)}
            onPress={() => setResponses(old => ({ ...old, [key]: value }))} disabled={busy}
            style={{ ...surfaces.field, padding: 12, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: responses[key] === value ? colors.accentText : colors.surfaceBorder }}>
            <Text style={{ color: responses[key] === value ? colors.accentText : colors.textPrimary }}>{t(`cardioProgression.answer_${key}_${value}`)}</Text>
          </Pressable>)}</View>
        </View>)}
        {review.reasons.map(reason => <Text key={reason} style={{ color: reason === 'SYMPTOMS' ? semantic.warning : colors.textSecondary }}>{t(`cardioProgression.reason_${reason}`)}</Text>)}
        <Text style={{ color: colors.textPrimary, fontSize: 18 }}>{t('cardioProgression.next', { current: review.current.reduce((n, s) => n + s, 0) / 60, next: review.next.reduce((n, s) => n + s, 0) / 60 })}</Text>
        {button(t('cardioProgression.about'), () => setDetails(value => !value))}
        {details && <Text style={{ color: colors.textSecondary }}>{t('cardioProgression.smallStep')}</Text>}
        {!review.reasons.includes('NO_FUTURE') && button(t('cardioProgression.increase'), () => { void save('INCREASE'); }, !enabled || !review.canIncrease)}
        {button(t(review.reasons.includes('NO_FUTURE') ? 'cardioProgression.finishReview' : 'cardioProgression.repeat'), () => { void save('REPEAT'); }, !enabled || !review.ready)}
        {error && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.saveFailed')}</Text>}
      </ScrollView>
    </Modal>
  </View>;
}
