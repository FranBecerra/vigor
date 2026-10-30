import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import type { CardioBlock, CardioSlot, CardioWorkout } from '@/models/cardioTraining';
import type { SportActivity } from '@/models/sportActivity';
import { coordinateCardioBlock, dateInZone, type DatedStrength } from '@/services/cardio/cardioBlock';
import { shiftCalendarDate } from '@/services/training/trainingCalendar';
import { cardioCycleDoses, cardioSlotPrescription } from '@/services/cardio/cardioProgressionPolicy';

export function CardioTimeline({ block, sports, strength, workouts, onEdit, onOpen }: {
  block: CardioBlock; sports: SportActivity[]; strength: DatedStrength[]; workouts: CardioWorkout[];
  onEdit?: (slot: CardioSlot) => void; onOpen?: (slot: CardioSlot, workout?: CardioWorkout) => void;
}) {
  const [cycle, setCycle] = useState(0); const { t } = useTranslation(); const { colors, surfaces, radius, semantic } = useTheme();
  const rows = coordinateCardioBlock(block, sports, strength), current = Math.min(cycle, block.cycles - 1), doses = cardioCycleDoses(block);
  return <View style={{ gap: 10 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {Array.from({ length: block.cycles }, (_, i) => <Pressable key={i} accessibilityRole="tab" accessibilityState={{ selected: i === current }} onPress={() => setCycle(i)} style={{ borderBottomWidth: 2, borderBottomColor: i === current ? colors.accentText : 'transparent', padding: 12, minHeight: 48 }}>
        <Text style={{ color: i === current ? colors.accentText : colors.textPrimary }}>{t('cardioTraining.cycle', { value: i + 1 })}</Text>
        {block.progression && <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{doses[i].seconds.reduce((n, s) => n + s, 0) / 60} min</Text>}
      </Pressable>)}
    </ScrollView>
    {block.progression && <Text style={{ color: colors.textSecondary }}>{t(doses[current].confirmed ? 'cardioProgression.confirmed' : 'cardioProgression.provisional')}</Text>}
    {Array.from({ length: block.proposal.input.cycleDays }, (_, day) => {
      const date = shiftCalendarDate(block.startDate, current * block.proposal.input.cycleDays + day);
      const slots = rows.filter(r => r.slot.date === date), forecast = block.proposal.input.strength.filter(s => s.dayIndex === day);
      const activities = sports.filter(s => s.discardedAt === null && dateInZone((s.record ?? s.planned)!.startAt, block.timeZone) === date);
      return <View key={date} style={{ ...surfaces.card, borderRadius: radius.lg, padding: 16, gap: 10 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{date}</Text>
        {forecast.map(s => <Text key={s.id} style={{ color: colors.textPrimary, fontSize: 16 }}>{s.name} · {t('cardioTraining.forecast')}</Text>)}
        {strength.filter(s => s.date === date).map(s => <Text key={s.id} style={{ color: colors.textSecondary }}>{t('cardioTraining.assignedStrength')}</Text>)}
        {activities.map(s => <Text key={s.id} style={{ color: colors.bioText, fontSize: 16 }}>{s.name || t(`sportActivities.sports.${s.sport}`)} · {t(`sportActivities.${s.record ? 'recorded' : 'planned'}`)}</Text>)}
        {slots.map(({ slot, issues, coveredBySport }) => {
          const workout = workouts.find(w => w.blockId === block.id && w.slotId === slot.id && w.status === 'FINISHED');
          const locked = workouts.some(w => w.blockId === block.id && w.slotId === slot.id && w.status !== 'DISCARDED');
          const p = workout?.prescription ?? cardioSlotPrescription(block, slot.id, true);
          return <View key={slot.id} style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', textDecorationLine: slot.disposition === 'SKIPPED' ? 'line-through' : 'none' }}>
              {t(`cardioPlan.${p.modality}`)} · {workout ? `${Math.floor(workout.actualSeconds! / 60)}:${String(workout.actualSeconds! % 60).padStart(2, '0')} ✓` : `${p.durationSeconds / 60} min`}
            </Text>
            {workout && <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('cardioTraining.plannedDuration', { minutes: p.durationSeconds / 60 })}</Text>}
            {!workout && block.progression && !doses[slot.cycle].confirmed && <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('cardioProgression.executionFallback', { minutes: cardioSlotPrescription(block, slot.id).durationSeconds / 60 })}</Text>}
            {slot.disposition !== 'CARDIO' && <Text style={{ color: colors.textSecondary }}>{t(slot.disposition === 'SKIPPED' ? 'cardioTraining.skipped' : coveredBySport ? 'cardioTraining.sportRecorded' : 'cardioTraining.sportReserved')}</Text>}
            {issues.map(issue => <Text key={issue} style={{ color: semantic.warning, fontSize: 13 }}>{t(`cardioTraining.issue_${issue}`)}</Text>)}
            <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
              {onOpen && (slot.disposition === 'CARDIO' && block.endedAt === null || workout) && <Pressable accessibilityRole="button" accessibilityLabel={t(workout ? 'cardioTraining.result' : 'cardioTraining.start')} onPress={() => onOpen(slot, workout)} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ color: colors.accentText, fontSize: 16 }}>{t(workout ? 'cardioTraining.result' : 'cardioTraining.start')}</Text>
              </Pressable>}
              {onEdit && !locked && <Pressable accessibilityRole="button" accessibilityLabel={t('cardioTraining.adjust')} onPress={() => onEdit(slot)} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ color: colors.accentText, fontSize: 16 }}>{t('cardioTraining.adjust')}</Text>
              </Pressable>}
            </View>
          </View>;
        })}
        {!slots.length && !forecast.length && !activities.length && !strength.some(s => s.date === date) && <Text style={{ color: colors.textSecondary }}>{t('calendar.rest')}</Text>}
      </View>;
    })}
  </View>;
}

/** An explicit opportunity replacement, not an equivalence estimate or copied workout. */
export function CardioSlotEditor({ block, slot, sports, onSave, onClose }: {
  block: CardioBlock; slot: CardioSlot | null; sports: SportActivity[];
  onSave: (date: string, disposition: CardioSlot['disposition'], sport: SportActivity | null) => Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation(); const { colors, surfaces, radius, semantic } = useTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const lock = useRef(false);
  const execute = async (date: string, disposition: CardioSlot['disposition'], sport: SportActivity | null = null) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(false);
    try { await onSave(date, disposition, sport); onClose(); } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  };
  const button = (label: string, action: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action} style={{ ...surfaces.field, borderRadius: radius.md, padding: 14, minHeight: 48 }}>
    <Text style={{ color: colors.accentText, fontSize: 16 }}>{label}</Text>
  </Pressable>;
  return <Modal visible={!!slot} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60, gap: 14 }}>
      {button(t('generate.cancel'), onClose)}
      <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700' }}>{t('cardioTraining.adjust')}</Text>
      {slot && <>
        <DateTimePicker value={new Date(`${slot.date}T12:00:00`)} mode="date" display="compact"
          minimumDate={new Date(`${block.startDate}T00:00:00`)} maximumDate={new Date(`${shiftCalendarDate(block.startDate, block.cycles * block.proposal.input.cycleDays - 1)}T23:59:59`)}
          onValueChange={(_event, date) => execute(dateInZone(date.getTime(), Intl.DateTimeFormat().resolvedOptions().timeZone), 'CARDIO')} />
        {button(t('cardioTraining.restore'), () => execute(slot.date, 'CARDIO'))}
        {button(t('cardioTraining.skip'), () => execute(slot.date, 'SKIPPED'))}
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>{t('cardioTraining.replaceExplanation')}</Text>
        {sports.filter(s => s.discardedAt === null).filter(s => {
          const date = dateInZone((s.record ?? s.planned)!.startAt, block.timeZone);
          return date >= block.startDate && date <= shiftCalendarDate(block.startDate, block.cycles * block.proposal.input.cycleDays - 1);
        }).map(s => button(`${s.name || t(`sportActivities.sports.${s.sport}`)} · ${dateInZone((s.record ?? s.planned)!.startAt, block.timeZone)}`,
          () => execute(dateInZone((s.record ?? s.planned)!.startAt, block.timeZone), 'SPORT', s)))}
      </>}
      {error && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('cardioTraining.saveFailed')}</Text>}
    </ScrollView>
  </Modal>;
}
