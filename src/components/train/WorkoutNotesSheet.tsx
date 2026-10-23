import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { normalizeWorkoutNote, type WorkoutNoteScope } from '@/services/training/trainingNotes';

export function WorkoutNotesSheet({ open, exerciseName, values, initialScope = 'SESSION', unavailable = false, allowedScopes = ['SESSION', 'EXERCISE', 'MESOCYCLE'], executionNote, onSave, onClose }: {
  open: boolean; exerciseName: string; values: Record<WorkoutNoteScope, string>; initialScope?: WorkoutNoteScope; unavailable?: boolean;
  allowedScopes?: readonly WorkoutNoteScope[]; executionNote?: string;
  onSave: (scope: WorkoutNoteScope, note: string, executionNote?: string) => Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation(); const { colors, typography, spacing, radius, sectionAccent, semantic } = useTheme(); const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<WorkoutNoteScope>(initialScope); const [drafts, setDrafts] = useState(values);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  useEffect(() => { if (open) { setScope(initialScope); setDrafts(values); setError(false); setBusy(false); } }, [open, exerciseName, initialScope]);
  const save = async () => {
    if (busy || (scope !== 'SESSION' && unavailable)) return; setBusy(true); setError(false);
    try {
      for (const value of allowedScopes) if (drafts[value] !== values[value]) {
        await onSave(value, normalizeWorkoutNote(drafts[value]), undefined);
      }
      onClose();
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Text style={[typography.h2, { flex: 1, color: colors.textPrimary }]}>{t('train.note')}</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[typography.body, { color: colors.accentText }]}>{t('generate.cancel')}</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        {allowedScopes.map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={t(`notes.${value}`)} accessibilityState={{ selected: value === scope }}
          disabled={busy} onPress={() => setScope(value)} style={{ flex: 1, minHeight: 52, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: value === scope ? sectionAccent.train : colors.surfaceBorder }}>
          <Text style={[typography.body, { textAlign: 'center', fontWeight: '600', color: value === scope ? colors.textPrimary : colors.textMuted }]}>{t(`notes.${value}`)}</Text>
        </Pressable>)}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: spacing.lg }}>
        {scope === 'EXERCISE' && <Text style={[typography.title, { color: colors.textPrimary, marginBottom: spacing.md }]}>{exerciseName}</Text>}
        <TextInput multiline editable={!busy && (scope === 'SESSION' || !unavailable)} value={drafts[scope]} onChangeText={(text) => setDrafts((old) => ({ ...old, [scope]: text }))} maxLength={2000}
          accessibilityLabel={t(`notes.${scope}`)} placeholder={t('train.note')} placeholderTextColor={colors.textMuted}
          style={[typography.body, { color: colors.textPrimary, textAlignVertical: 'top', minHeight: 180, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface }]} />
        <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'right', marginTop: spacing.sm }]}>{drafts[scope].length}/2000</Text>
        {(error || (unavailable && scope !== 'SESSION')) && <Text accessibilityRole="alert" style={[typography.body, { color: semantic.danger, marginVertical: spacing.md }]}>{t('notes.saveFailed')}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || (scope !== 'SESSION' && unavailable)} onPress={() => { void save(); }} style={{ minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: sectionAccent.train, borderRadius: radius.md, marginTop: spacing.lg }}>
          <Text style={[typography.body, { color: colors.onAccent, fontWeight: '700' }]}>{t(busy ? 'custom.saving' : 'custom.save')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
