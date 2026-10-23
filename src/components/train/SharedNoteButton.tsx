import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTrainingNotes } from '@/hooks/useTrainingNotes';
import { useTheme } from '@/theme/useTheme';
import type { SharedNoteScope } from '@/services/training/trainingNotes';
import { WorkoutNotesSheet } from './WorkoutNotesSheet';

export function SharedNoteButton({ scope, targetId, title }: { scope: SharedNoteScope; targetId: string; title: string }) {
  const notes = useTrainingNotes(); const [open, setOpen] = useState(false); const { t } = useTranslation();
  const { typography, colors, sectionAccent, spacing } = useTheme(); const note = notes.get(scope, targetId);
  return <View style={{ marginTop: spacing.md }}>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[typography.body, { color: colors.accentText }]}>{t('train.note')} · {t(`notes.${scope}`)}</Text>
      {!!note && <Text numberOfLines={3} style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{note}</Text>}
    </Pressable>
    {open && <WorkoutNotesSheet open initialScope={scope} allowedScopes={[scope]} exerciseName={title} unavailable={!notes.ready || notes.error}
      values={{ SESSION: '', EXERCISE: scope === 'EXERCISE' ? note : '', MESOCYCLE: scope === 'MESOCYCLE' ? note : '' }}
      onSave={(_scope, text) => notes.save(scope, targetId, text)} onClose={() => setOpen(false)} />}
  </View>;
}
