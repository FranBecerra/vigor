import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { mesocycleRepository } from '@/services/repositories';
import type { Mesocycle } from '@/models';
import type { TrainingCalendarEntry } from '@/models/routine';
import { calendarEntryKey, calendarRecovery, calendarVolumeRate, calendarFromTemplate, moveCalendarEntry, updateCalendar, type TrainingCalendar } from '@/services/training/trainingCalendar';
import { buildScheduleTemplate, moveRestSlot, templateRecovery, type ScheduleTemplate } from '@/services/training/scheduleTemplate';
import { ScheduleTemplateView } from './ScheduleTemplateView';
import { sessionsForMicrocycle } from '@/services/training/mesocycleEditing';
import { EXERCISE_CATALOGUE } from '@/services/training/exerciseCatalogue';
import { TrainingGoal } from '@/services/training/volumePlan';
import { plannedPresentationFocus } from '@/services/training/sessionCoherence';
import type { durationCalibration } from '@/services/training/sessionDuration';
const CATALOGUE = new Map(EXERCISE_CATALOGUE.map((e) => [e.id, e]));
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Optional schedule; workout completion stays exclusively in the workout runtime. */
export function TrainingCalendarCard({ mesocycleId, microcycleIndex, goal, durationFeedback, onChanged }: {
  mesocycleId: string; microcycleIndex: number; goal: string;
  durationFeedback?: ReturnType<typeof durationCalibration>;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [start, setStart] = useState(today);
  const [days, setDays] = useState('7');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    mesocycleRepository.get(mesocycleId).then((value) => { if (alive) {
      setMesocycle(value); setDays(String(value?.scheduleTemplate?.days ?? 7));
    } })
      .catch(() => { if (alive) setError(t('calendar.saveFailed')); });
    return () => { alive = false; };
  }, [mesocycleId, t]));
  const trainingGoal = goal === TrainingGoal.STRENGTH ? TrainingGoal.STRENGTH : TrainingGoal.HYPERTROPHY;
  const sessions = useMemo(() => mesocycle ? sessionsForMicrocycle(mesocycle, trainingGoal, microcycleIndex)
    .map((session) => trainingGoal === TrainingGoal.HYPERTROPHY
      ? { ...session, focus: plannedPresentationFocus(session, CATALOGUE) } : session) : [],
    [mesocycle, trainingGoal, microcycleIndex]);
  const calendar = mesocycle?.trainingCalendar ?? {};
  const template = mesocycle?.scheduleTemplate ?? buildScheduleTemplate(sessions, CATALOGUE);
  const templateWarnings = templateRecovery(template, sessions, CATALOGUE).filter((p) => p.reviewSuggested);
  const entries = Object.values(calendar).filter((e) => e.microcycleIndex === microcycleIndex).sort((a, b) => a.date.localeCompare(b.date));
  const recovery = mesocycle ? calendarRecovery(calendar, (index) => sessionsForMicrocycle(mesocycle, trainingGoal, index), CATALOGUE) : [];
  const rate = calendarVolumeRate(calendar, microcycleIndex,
    sessions.reduce((sum, s) => sum + s.exercises.reduce((n, e) => n + e.sets.length, 0), 0));
  const persist = async (transform: (current: TrainingCalendar) => TrainingCalendar) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const updated = await mesocycleRepository.updateTrainingCalendar(mesocycleId, transform, Date.now());
      setMesocycle(updated);
      onChanged?.();
    } catch { setError(t('calendar.saveFailed')); }
    finally { setBusy(false); }
  };
  const setEntry = (entry: TrainingCalendarEntry) => void persist((current) => updateCalendar(current, entry));
  const persistTemplate = async (next: ScheduleTemplate) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      setMesocycle(await mesocycleRepository.updateScheduleTemplate(mesocycleId, next, Date.now()));
      setDays(String(next.days)); onChanged?.();
    } catch { setError(t('calendar.saveFailed')); }
    finally { setBusy(false); }
  };
  if (!mesocycle) return error ? <Text style={{ color: colors.textMuted }}>{error}</Text> : null;
  const field = { color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder,
    borderRadius: 8, padding: 8 };
  return <View style={{ marginVertical: spacing.md, padding: spacing.md, borderWidth: 1,
    borderColor: colors.surfaceBorder, borderRadius: 16, gap: spacing.sm }}>
    <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)}>
      <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{t('calendar.title')} · M{microcycleIndex + 1} {expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded && <>
      <Text style={{ color: colors.textMuted }}>{t('calendar.description')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text style={{ color: colors.textSecondary }}>{t('calendar.days')}</Text>
        <TextInput value={days} onChangeText={setDays} keyboardType="number-pad" editable={!busy}
          style={[field, { width: 64 }]} accessibilityLabel={t('calendar.days')}
          onEndEditing={() => {
            if (Number(days) === template.days) return;
            try { void persistTemplate(buildScheduleTemplate(sessions, CATALOGUE, Number(days))); }
            catch { setError(t('calendar.saveFailed')); }
          }} />
      </View>
      <ScheduleTemplateView template={template} sessions={sessions} onMoveRest={busy ? undefined : (from, to) =>
        void persistTemplate(moveRestSlot(template, from, to))} />
      {templateWarnings.map((p) => <Text key={`${p.from}:${p.to}`} style={{ color: colors.textSecondary }}>
        {t('calendar.templateOverlap', { from: p.from + 1, to: p.to + 1 })}</Text>)}
      {durationFeedback && <Text style={{ color: colors.textMuted }}>{durationFeedback.ready
        ? t('calendar.calibration', { count: durationFeedback.sampleCount, percent: Math.round((durationFeedback.observedMultiplier ?? 1) * 100) })
        : t('calendar.calibrationPending', { count: durationFeedback.sampleCount })}</Text>}
      {entries.length === 0 ? <>
        <TextInput value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" accessibilityLabel={t('calendar.startDate')}
          style={field} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => void persist((current) => {
            const proposed = calendarFromTemplate(start, microcycleIndex,
              Number(days) === template.days ? template : buildScheduleTemplate(sessions, CATALOGUE, Number(days)));
            return Object.values(proposed).reduce(updateCalendar, current);
          })}><Text style={{ color: colors.textPrimary }}>{t('calendar.create')}</Text></Pressable>
        </View>
      </> : entries.map((entry) => <View key={entry.kind === 'rest' ? entry.date : entry.sessionIndex}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput defaultValue={entry.date} key={entry.date} editable={!busy}
          style={[field, { flex: 1 }]} accessibilityLabel={t('calendar.startDate')}
          onEndEditing={(event) => {
            const date = event.nativeEvent.text;
            if (date === entry.date) return;
            void persist((current) => moveCalendarEntry(current, calendarEntryKey(entry), date));
          }} />
        {entry.kind === 'rest' ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: entry.checked }}
          disabled={busy || entry.date > today()} onPress={() => setEntry({ ...entry, checked: !entry.checked })}>
          <Text style={{ color: colors.textPrimary }}>{entry.checked ? '☑' : '☐'} {t('calendar.rest')}</Text>
        </Pressable> : <Text style={{ color: colors.textPrimary }}>{t('calendar.session', { number: entry.sessionIndex + 1 })}</Text>}
      </View>)}
      {rate && <Text style={{ color: colors.textMuted }}>{t('calendar.volumeRate', { days: rate.days, sets: Math.round(rate.setsPerSevenDays) })}</Text>}
      {recovery.filter((r) => r.reviewSuggested && r.next.microcycleIndex === microcycleIndex).map((r) =>
        <Text key={r.next.date} style={{ color: colors.textSecondary }}>{t('calendar.overlap', {
          from: r.previous.date, to: r.next.date,
          muscles: r.sharedMuscles.map((m) => t(`muscles.${m}`, { defaultValue: m })).join(', '),
        })}</Text>)}
      {error !== '' && <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{error}</Text>}
    </>}
  </View>;
}
