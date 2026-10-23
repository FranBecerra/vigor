import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useRehabilitation } from '@/hooks/useRehabilitation';
import { useTheme } from '@/theme/useTheme';
import { RehabBlockEditor } from '@/components/train/RehabBlockEditor';
import { RehabRunner } from '@/components/train/RehabRunner';
import { localDateKey, rehabWeekCompletions } from '@/services/training/rehabilitation';
import type { RehabBlock } from '@/models';
import { backToTraining } from '@/services/training/backNavigation';

export default function RehabScreen() {
  const { t } = useTranslation();
  const { blocks, logs, ready, error, saveBlock } = useRehabilitation();
  const { colors, spacing, radius, sectionAccent } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [editing, setEditing] = useState<RehabBlock | 'new' | null>(null);
  const [running, setRunning] = useState<RehabBlock | null>(null);
  const [failed, setFailed] = useState(false);
  const today = localDateKey(new Date());
  return <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, backgroundColor: colors.bg,
      paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120 }}>
      <Pressable onPress={() => backToTraining(router)}><Text style={{ color: colors.accentText }}>{t('rehab.back')}</Text></Pressable>
      <Text style={{ color: colors.textPrimary, fontSize: 27, fontWeight: '700', marginVertical: 18 }}>{t('rehab.title')}</Text>
      <Text style={{ color: colors.textMuted }}>{t('rehab.userPrescription')}</Text>
      {(!ready || error || failed) && <Text style={{ color: colors.textPrimary }}>{t(error || failed ? 'rehab.saveFailed' : 'custom.loading')}</Text>}
      {blocks.filter((block) => block.archivedAt === undefined).map((block) => <ReactBlock key={block.id} block={block}
        completed={rehabWeekCompletions(block, logs, today)} onEdit={() => setEditing(block)} onStart={() => setRunning(block)}
        onPause={() => { void saveBlock({ ...block, active: !block.active, updatedAt: Date.now() }).catch(() => setFailed(true)); }} />)}
      <Pressable onPress={() => setEditing('new')} style={{ padding: 18, marginVertical: 16,
        backgroundColor: sectionAccent.train, borderRadius: radius.md }}>
        <Text style={{ color: colors.onAccent, textAlign: 'center', fontWeight: '700' }}>{t('rehab.newBlock')}</Text>
      </Pressable>
    </ScrollView>
    {editing !== null && <RehabBlockEditor initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    {running && <RehabRunner block={running} onClose={() => setRunning(null)} />}
  </>;
}
function ReactBlock({ block, completed, onEdit, onStart, onPause }: {
  block: RehabBlock; completed: number; onEdit: () => void; onStart: () => void; onPause: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, sectionAccent } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.lg }}>
    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '600' }}>{block.name}</Text>
    <Text style={{ color: colors.textMuted, marginVertical: 6 }}>{t('rehab.weekProgress', { count: completed })}
      {block.schedule.kind === 'WEEKLY' ? ` / ${block.schedule.target}` : block.schedule.kind === 'DAYS' ? ` · ${block.schedule.days.map((day) => t(`rehab.day${day}`)).join(' · ')}` : ` · ${t('rehab.ROUTINE')}`}</Text>
    {[['start', onStart], ['edit', onEdit], [block.active ? 'pause' : 'activate', onPause]].map(([label, action]) =>
      <Pressable key={label as string} onPress={action as () => void} style={{ paddingVertical: 10 }}>
        <Text style={{ color: colors.accentText }}>{t(`rehab.${label}`)}</Text>
      </Pressable>)}
  </View>;
}
