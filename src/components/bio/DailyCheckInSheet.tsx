import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { DailyCheckInAnswers } from '@/models/dailyCheckIn';
import { DAILY_CHECK_IN_FIELDS, DAILY_CHECK_IN_OPTIONS } from '@/services/bio/dailyCheckIn';
import { useTheme } from '@/theme/useTheme';

interface Props {
  initial: DailyCheckInAnswers;
  onClose: () => void;
  onSave: (answers: DailyCheckInAnswers) => Promise<void>;
  unavailable?: boolean;
  onRetry?: () => void;
}

/** Controlled editor: the caller owns persistence, including synthetic-only previews. */
export function DailyCheckInSheet({ initial, onClose, onSave, unavailable = false, onRetry }: Props) {
  const { t } = useTranslation();
  const { colors, surfaces, typography, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState(initial);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const saving = useRef(false);
  const save = async () => {
    if (saving.current || unavailable || !Object.keys(answers).length) return;
    saving.current = true;
    setBusy(true); setError(false);
    try { await onSave(answers); onClose(); } catch { setError(true); } finally { saving.current = false; setBusy(false); }
  };
  return <Modal transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
      <View accessibilityViewIsModal style={{ ...surfaces.sheet, backgroundColor: colors.bgElevated, maxHeight: '94%',
        borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 20, paddingBottom: Math.max(12, insets.bottom) }}>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={[typography.h2, { flex: 1, color: colors.textPrimary }]}>{t('dailyCheckIn.title')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('bio.close')} disabled={busy} onPress={onClose}
            style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.bioText }]}>{t('bio.close')}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{t('dailyCheckIn.intro')}</Text>
          {DAILY_CHECK_IN_FIELDS.map((field) => <View key={field} style={{ gap: 10 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{t(`dailyCheckIn.${field}`)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DAILY_CHECK_IN_OPTIONS[field].map((value) => <Pressable key={value} accessibilityRole="button"
                accessibilityLabel={`${t(`dailyCheckIn.${field}`)}: ${t(`dailyCheckIn.${value}`)}`}
                accessibilityState={{ selected: answers[field] === value, disabled: busy }} disabled={busy}
                onPress={() => setAnswers((old) => {
                  const next = { ...old }; if (next[field] === value) delete next[field];
                  else Object.assign(next, { [field]: value }); return next;
                })}
                style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', borderRadius: radius.md,
                  borderWidth: 1, borderColor: answers[field] === value ? colors.bioText : colors.controlBorder,
                  backgroundColor: answers[field] === value ? colors.bioTint : colors.bgElevated }}>
                <Text style={[typography.body, { color: answers[field] === value ? colors.bioText : colors.textPrimary }]}>{t(`dailyCheckIn.${value}`)}</Text>
              </Pressable>)}
            </View>
          </View>)}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {unavailable && <>
            <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bio.loadError')}</Text>
            {onRetry && <Pressable accessibilityRole="button" accessibilityLabel={t('bio.retry')} onPress={onRetry} disabled={busy}
              style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[typography.title, { color: colors.bioText }]}>{t('bio.retry')}</Text>
            </Pressable>}
          </>}
          {error && <Text accessibilityRole="alert" style={[typography.body, { color: colors.textPrimary }]}>{t('bio.saveError')}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={t('dailyCheckIn.save')} disabled={busy || unavailable || !Object.keys(answers).length}
            accessibilityState={{ disabled: busy || unavailable || !Object.keys(answers).length }} onPress={() => void save()}
            style={{ ...surfaces.primary, minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md,
              backgroundColor: sectionAccent.train, opacity: busy || unavailable || !Object.keys(answers).length ? 0.45 : 1 }}>
            <Text style={[typography.title, { color: colors.onAccent }]}>{t(busy ? 'custom.saving' : 'dailyCheckIn.save')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
