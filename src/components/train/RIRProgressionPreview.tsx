import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useExerciseName } from '@/hooks/useExerciseName';
import type { Exercise } from '@/models';
import { SetType } from '@/models';
import type { ProgressionStep } from '@/services/training/rirReplanning';
import { setTypeLabel } from './setTypeLabel';

export function RIRProgressionPreview({ steps, catalogue, busy, onApply, onClose }: {
  steps: readonly ProgressionStep[] | null; catalogue: ReadonlyMap<string, Exercise>; busy: boolean; onApply: () => void; onClose: () => void;
}) {
  const { t } = useTranslation(); const { colors, radius, sectionAccent } = useTheme(); const insets = useSafeAreaInsets(); const name = useExerciseName();
  return <Modal visible={steps !== null} animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', paddingHorizontal: 20 }}>{t('progression.title')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15, padding: 20 }}>{t('progression.hint')}</Text>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {steps?.map((step) => <View key={step.index} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 }}>
          <Text style={{ color: colors.accentText, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{t('home.microcycle')} {step.index + 1}{step.isDeload ? ` · ${t('meso.deloadShort')}` : ''}</Text>
          {step.session.exercises.map((exercise) => <View key={exercise.order} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Text style={{ color: colors.textPrimary, flex: 1, fontSize: 15 }}>{name(exercise.exerciseSnapshot ?? catalogue.get(exercise.exerciseId)) || exercise.exerciseId}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontVariant: ['tabular-nums'] }}>RIR {exercise.sets.filter((set) => set.setType !== SetType.WARMUP && set.setType !== SetType.TOP_SINGLE).map((set) => `${setTypeLabel(set.setType) ? `${setTypeLabel(set.setType)} ` : ''}${set.targetRIR}`).join(' · ')}</Text>
          </View>)}
        </View>)}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('generate.cancel')} disabled={busy} onPress={onClose} style={{ minHeight: 48, padding: 14 }}><Text style={{ color: colors.textSecondary }}>{t('generate.cancel')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('progression.apply')} disabled={busy} onPress={onApply}
          style={{ minHeight: 48, flex: 1, borderRadius: radius.md, backgroundColor: sectionAccent.train, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}><Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 17 }}>{t('progression.apply')}</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
