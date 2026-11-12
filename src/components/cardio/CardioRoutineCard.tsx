import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { RoutineDayIndicator } from '@/components/home/RoutineDayIndicator';
import { formatSessionDate } from '@/components/home/RoutineCard';
import { MesoRail } from '@/components/home/HomeHeader';
import { CardioHeartIcon } from '@/components/icons/CycleReviewIcons';
import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import type { SportActivity } from '@/models/sportActivity';
import { cardioHomeCycle, cardioHomeSessions, type CardioHomeSession } from '@/services/cardio/cardioHome';

/** Shared 64-point calendar row; opening is a preview, never an implicit workout write. */
export function CardioSessionRow({ entry, onOpen }: { entry: CardioHomeSession; onOpen(entry: CardioHomeSession): void }) {
  const { t, i18n } = useTranslation(), { colors } = useTheme();
  const prescription = entry.workout?.prescription ?? entry.block.proposal.preview.prescriptions.find(p => p.id === entry.slot.prescriptionId)!;
  const status = entry.slot.disposition === 'SKIPPED' ? t('cardioTraining.skipped')
    : entry.slot.disposition === 'SPORT' ? t(entry.resolved ? 'cardioTraining.sportRecorded' : 'cardioTraining.sportReserved') : '';
  const label = [t(`cardioPlan.${prescription.modality}`), formatSessionDate(entry.date, i18n.language), status,
    entry.seconds ? `${Math.round(entry.seconds / 60 * 10) / 10} min` : t('manualCardio.untimed')].filter(Boolean).join(' · ');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => onOpen(entry)}
    style={{ minHeight: 64, height: 64, paddingHorizontal: 4, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8,
      borderBottomWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.bgElevated }}>
    <RoutineDayIndicator kind="cardio" completed={entry.completed || entry.slot.disposition === 'SKIPPED'} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: entry.resolved ? colors.textSecondary : colors.textPrimary, fontSize: 16, fontWeight: '600',
        textDecorationLine: entry.slot.disposition === 'SKIPPED' ? 'line-through' : 'none' }}>{t(`cardioPlan.${prescription.modality}`)}</Text>
      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{formatSessionDate(entry.date, i18n.language)}{status ? ` · ${status}` : ''}</Text>
    </View>
    <View style={{ minWidth: 40, alignItems: 'flex-end', gap: 2 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{entry.seconds ? Math.round(entry.seconds / 60 * 10) / 10 : '—'}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>min</Text>
    </View>
  </Pressable>;
}

/** Cardio remains its own block while sharing the existing routine accordion and rail. */
export function CardioRoutineCard({ block, workouts, sports, onOpen, onOpenBlock, expanded: controlledExpanded, onToggle }: {
  block: CardioBlock; workouts: readonly CardioWorkout[]; sports: readonly SportActivity[];
  onOpen(entry: CardioHomeSession): void; onOpenBlock(cycle: number): void;
  expanded?: boolean; onToggle?: () => void;
}) {
  const { t } = useTranslation(), { colors, surfaces, radius } = useTheme();
  const [localExpanded, setExpanded] = useState(true);
  const expanded = controlledExpanded ?? localExpanded;
  const sessions = cardioHomeSessions(block, workouts, sports), cycle = cardioHomeCycle(block, sessions);
  const micros = Array.from({ length: block.cycles }, (_, i) => ({ id: `${block.id}:${i}`, number: i + 1,
    sessions: [], isDeload: false, isProjected: i > cycle, volumeAdjustmentSets: 0, intensityAdjustmentRIR: 0 }));
  return <View style={{ ...surfaces.card, borderRadius: radius.lg, padding: 16, opacity: expanded ? 1 : .72 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View accessible={false} style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' }}><CardioHeartIcon size={26} color={colors.accentText} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={block.proposal.name} onPress={() => onOpenBlock(cycle)} style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 19, fontWeight: '700' }}>{block.proposal.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>{t(block.endedAt === null ? 'home.activeRoutine' : 'cardioTraining.ended')} · {t('home.cardio')} · {sessions.filter(s => s.slot.cycle === cycle).length} {t('home.sessions')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${block.proposal.name} · ${t('home.sessions')}`} accessibilityState={{ expanded }} onPress={onToggle ?? (() => setExpanded(!expanded))} style={{ padding: 12, minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.textMuted, fontSize: 11 }}>{expanded ? '▲' : '▼'}</Text></Pressable>
    </View>
    {expanded && <>
      <View style={{ marginTop: 8 }}><MesoRail microcycles={micros} currentIndex={cycle} caption={`${t('home.microcycle')} ${cycle + 1}/${block.cycles}`} actionLabel={t('home.viewMesocycle')} onPress={() => onOpenBlock(cycle)} /></View>
      <View style={{ borderTopWidth: 1, borderColor: colors.surfaceBorder, marginTop: 10 }}>{sessions.filter(s => s.slot.cycle === cycle).map(entry => <CardioSessionRow key={entry.slot.id} entry={entry} onOpen={onOpen} />)}</View>
    </>}
  </View>;
}
