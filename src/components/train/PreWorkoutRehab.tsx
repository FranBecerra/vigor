import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRehabilitation } from '@/hooks/useRehabilitation';
import { useTheme } from '@/theme/useTheme';
import { localDateKey, rehabIsDue } from '@/services/training/rehabilitation';
import { RehabRunner } from './RehabRunner';
import type { RehabBlock } from '@/models';

export function PreWorkoutRehab({ workoutKey, hasStarted = false, routineId, sessionIndex }: { workoutKey: string; hasStarted?: boolean; routineId?: string; sessionIndex?: number }) {
  const { t } = useTranslation();
  const { blocks, logs, ready, error } = useRehabilitation();
  const { colors, spacing, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const [running, setRunning] = useState<RehabBlock | null>(null);
  const today = localDateKey(new Date());
  const due = blocks.filter((block) => rehabIsDue(block, logs, today, workoutKey, { routineId, sessionIndex }));
  return <>
    <Modal visible={running !== null || (!dismissed && !hasStarted && ((ready && due.length > 0) || error))} animationType="slide" onRequestClose={() => { if (!running) setDismissed(true); }}>
      {running ? <RehabRunner embedded block={running} workoutKey={workoutKey} onClose={() => setRunning(null)} /> :
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, backgroundColor: colors.bg,
        paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 30 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 25, fontWeight: '700', marginBottom: 16 }}>{t('rehab.beforeWorkout')}</Text>
        <Text style={{ color: colors.textMuted }}>{t('rehab.separateLog')}</Text>
        {due.map((block) => <Pressable key={block.id} onPress={() => setRunning(block)}
          style={{ padding: 18, marginVertical: 12, backgroundColor: colors.surface, borderRadius: 16 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 19 }}>{block.name}</Text>
          <Text style={{ color: colors.accentText }}>{t('rehab.start')}</Text>
        </Pressable>)}
        {error && <Text style={{ color: colors.textPrimary }}>{t('rehab.saveFailed')}</Text>}
        <Pressable onPress={() => setDismissed(true)} style={{ padding: 18, backgroundColor: sectionAccent.train, borderRadius: 16, marginTop: 20 }}>
          <Text style={{ color: colors.onAccent, fontWeight: '700', textAlign: 'center' }}>{t('rehab.continueStrength')}</Text>
        </Pressable>
      </ScrollView>}
    </Modal>
  </>;
}
