import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPORT_KINDS, type SportActivity, type SportActivityDraft } from '@/models/sportActivity';
import { sportDraft } from '@/services/cardio/sportActivities';
import { NumericField } from '@/components/train/NumericField';
import { SessionEffortInput } from '@/components/train/SessionEffortInput';
import { useTheme } from '@/theme/useTheme';
import { SportActivityIcon } from '@/components/icons/SportActivityIcon';

/** Staged draft. The only persistence action is the explicit Save button. */
export function SportActivityForm({ activity, mode, onSave, onCancel }: {
  activity: SportActivity | null; mode: SportActivityDraft['mode'];
  onSave: (draft: SportActivityDraft) => Promise<unknown>; onCancel: () => void;
}) {
  const { t, i18n } = useTranslation(); const { colors, surfaces, radius, semantic, spacing, scheme, sectionAccent } = useTheme(); const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => ({ ...sportDraft(activity, mode, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const title = activity?.record || activity && mode === 'PLAN' ? 'edit' : mode === 'PLAN' ? 'plan' : 'record';
  const saving = useRef(false); const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const patch = (change: Partial<SportActivityDraft>) => setDraft((old) => ({ ...old, ...change }));
  const choice = (label: string, selected: boolean, action: () => void) => <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label}
    accessibilityState={{ selected, disabled: busy }} disabled={busy} onPress={action}
    style={{ ...surfaces.field, borderRadius: radius.md, padding: 12, minHeight: 48, borderColor: selected ? colors.accentText : colors.surfaceBorder, borderWidth: 1, flexGrow: 1 }}>
    <Text style={{ color: selected ? colors.accentText : colors.textPrimary, fontSize: 16, fontWeight: selected ? '600' : '400' }}>{label}</Text>
  </Pressable>;
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action}
    style={{ ...surfaces.field, borderRadius: radius.md, minHeight: 48, padding: 12, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 16 }}>{label}</Text></Pressable>;
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, ...surfaces.screen, backgroundColor: colors.bg }}
    contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, gap: 16 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} disabled={busy} onPress={onCancel} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accentText, fontSize: 17 }}>{t('generate.cancel')}</Text></Pressable>
    <Text style={{ color: colors.textPrimary, fontSize: 29, fontWeight: '700' }}>{t(`sportActivities.${title}`)}</Text>
    <View accessibilityRole="radiogroup" style={{ ...surfaces.card, borderRadius: radius.lg, paddingHorizontal: 16 }}>
      {[...SPORT_KINDS].sort((a, b) => t(`sportActivities.sports.${a}`).localeCompare(t(`sportActivities.sports.${b}`), i18n.resolvedLanguage ?? i18n.language)).map((sport, index) => <Pressable key={sport}
        accessibilityRole="radio" accessibilityLabel={t(`sportActivities.sports.${sport}`)} accessibilityState={{ selected: draft.sport === sport, disabled: busy }}
        disabled={busy} onPress={() => patch({ sport })} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14,
          borderTopWidth: index ? .5 : 0, borderColor: colors.surfaceBorder }}>
        <View accessible={false}><SportActivityIcon sport={sport} color={draft.sport === sport ? colors.accentText : colors.textSecondary} /></View>
        <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 17 }}>{t(`sportActivities.sports.${sport}`)}</Text>
        <View accessible={false} style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2,
          borderColor: draft.sport === sport ? colors.accentText : colors.surfaceBorder, justifyContent: 'center', alignItems: 'center' }}>
          {draft.sport === sport && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentText }} />}
        </View>
      </Pressable>)}
    </View>
    <Text style={{ color: colors.textSecondary }}>{t('sportActivities.context')}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['CLASS', 'MATCH', 'FREE'] as const).map((context) => choice(t(`sportActivities.contexts.${context}`), draft.context === context, () => patch({ context })))}</View>
    <Text style={{ color: colors.textSecondary }}>{t(draft.sport === 'OTHER' ? 'sportActivitiesRequiredName' : 'sportActivities.name')}</Text>
    <TextInput accessibilityLabel={t(draft.sport === 'OTHER' ? 'sportActivitiesRequiredName' : 'sportActivities.name')} value={draft.name} editable={!busy} maxLength={80} onChangeText={(name) => patch({ name })}
      placeholder={t(`sportActivities.sports.${draft.sport}`)} placeholderTextColor={colors.textMuted}
      style={{ ...surfaces.field, borderRadius: radius.md, color: colors.textPrimary, fontSize: 17, minHeight: 48, padding: 12 }} />
    <Text style={{ color: colors.textSecondary }}>{t('sportActivities.starts')}</Text>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {button(new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(draft.startAt), () => setPicker(picker === 'date' ? null : 'date'))}
      {button(new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(draft.startAt), () => setPicker(picker === 'time' ? null : 'time'))}
    </View>
    {picker && <DateTimePicker value={new Date(draft.startAt)} mode={picker} display="compact" locale={i18n.language} themeVariant={scheme}
      accentColor={colors.accentText} timeZoneName={draft.timeZone} maximumDate={mode === 'RECORD' ? new Date() : undefined}
      onValueChange={(_event, value) => { patch({ startAt: value.getTime() }); setPicker(null); }} onDismiss={() => setPicker(null)} />}
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{draft.timeZone}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ flex: 1, color: colors.textPrimary, fontSize: 17 }}>{t('sportActivities.duration')}</Text>
      <View style={{ width: 110 }}><NumericField compact value={Number.isFinite(draft.durationMinutes) ? draft.durationMinutes : undefined}
        onChangeValue={(value) => patch({ durationMinutes: value ?? Number.NaN })} accessibilityLabel={t('sportActivities.duration')} editable={!busy} /></View></View>
    {mode === 'RECORD' && <SessionEffortInput value={draft.effort} onChange={(effort) => patch({ effort })} disabled={busy} />}
    <Text style={{ color: colors.textSecondary }}>{t('sportActivities.notes')}</Text>
    <TextInput accessibilityLabel={t('sportActivities.notes')} multiline value={draft.notes} maxLength={2000} editable={!busy} onChangeText={(notes) => patch({ notes })}
      style={{ ...surfaces.field, borderRadius: radius.md, color: colors.textPrimary, fontSize: 17, minHeight: 90, padding: 12, textAlignVertical: 'top' }} />
    {error && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t(error)}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={t('sportActivities.save')} accessibilityState={{ disabled: busy }} disabled={busy} onPress={async () => {
      if (saving.current) return; saving.current = true; setBusy(true); setError(null);
      try { await onSave(draft); } catch (cause) { setError(cause instanceof Error && ['invalidSportActivity', 'invalidSessionFeedback'].includes(cause.message) ? 'sportActivities.invalid' : 'sportActivities.saveFailed'); }
      finally { saving.current = false; setBusy(false); }
    }} style={{ ...surfaces.primary, backgroundColor: sectionAccent.train, minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill }}>
      <Text style={{ color: colors.onAccent, fontSize: 18, fontWeight: '700' }}>{t('sportActivities.save')}</Text>
    </Pressable>
  </ScrollView>;
}
