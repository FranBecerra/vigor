import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useExerciseCatalogue } from '@/hooks/useExerciseCatalogue';
import { mesocycleRepository } from '@/services/repositories';
import type { Mesocycle } from '@/models';
import { sessionsForMicrocycle } from '@/services/training/mesocycleEditing';
import { buildScheduleTemplate } from '@/services/training/scheduleTemplate';
import { moveRoutineDay, orderedRoutineSessions, restDayKey, restDaysTemplate, routineDays, routineRestDays, type RoutineRestDay } from '@/services/training/routineRestDays';
import type { durationCalibration } from '@/services/training/sessionDuration';
import { SwipeableSet } from './SwipeableSet';
import { RoutineDayList, type DayListScroll } from './RoutineDayList';
import { RoutineDayIndicator } from '@/components/home/RoutineDayIndicator';
import type { CardioBlock, CardioWorkout } from '@/models/cardioTraining';
import type { RoutineView } from '@/services/training/routineView';
import { canAdjustCardioHomeSession, cardioCalendarRows, type CardioHomeSession } from '@/services/cardio/cardioHome';
import { CardioSessionRow } from '@/components/cardio/CardioRoutineCard';

/** One atomic workout/rest timeline. Incoming home metadata prevents deferred rest insertion. */
export function TrainingCalendarCard({ mesocycleId, microcycleIndex, goal, onChanged, sessionRows, initialMesocycle, onSessionHold, edgeScroll, cardio, persist }: {
  mesocycleId: string; microcycleIndex: number; goal: string; initialMesocycle?: Mesocycle;
  sessionRows?: readonly { index: number; content: ReactNode }[]; onSessionHold?: (index: number) => void;
  durationFeedback?: ReturnType<typeof durationCalibration>; onChanged?: () => void;
  edgeScroll?: DayListScroll;
  cardio?: { routine: RoutineView; blocks: readonly CardioBlock[]; workouts: readonly CardioWorkout[];
    onOpen(entry: CardioHomeSession): void; onAdjust?(entry: CardioHomeSession): void };
  /** Optional persistence boundary for a memory-only native acceptance fixture. */
  persist?: (patch: Partial<Mesocycle>) => Promise<void>;
}) {
  const { t } = useTranslation(); const { uid } = useAuth();
  const identity = `${uid}:${mesocycleId}:${microcycleIndex}`; const activeIdentity = useRef(identity); activeIdentity.current = identity;
  const { colors, spacing, sectionAccent, semantic } = useTheme();
  const { exercisesById } = useExerciseCatalogue();
  const validInitial = initialMesocycle?.id === mesocycleId && initialMesocycle.userId === uid ? initialMesocycle : null;
  const [loaded, setLoaded] = useState<{ identity: string; meso: Mesocycle | null }>({ identity, meso: validInitial });
  const meso = loaded.identity === identity ? loaded.meso : validInitial;
  const [busy, setBusy] = useState(false); const saving = useRef(false); const [error, setError] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true; setError(false); setBusy(false); saving.current = false;
    if (validInitial) {
      setLoaded({ identity, meso: validInitial });
      return () => { alive = false; };
    }
    mesocycleRepository.get(mesocycleId).then((value) => {
      if (alive && value?.userId === uid) {
        const sessions = orderedRoutineSessions(sessionsForMicrocycle(value, goal, microcycleIndex), value.sessionOrder);
        restDaysTemplate(sessions, routineRestDays({ ...value, scheduleTemplate: value.scheduleTemplate ?? buildScheduleTemplate(sessions, exercisesById) }));
        setLoaded({ identity, meso: value });
      }
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [mesocycleId, uid, microcycleIndex, goal, exercisesById, identity, validInitial]));
  if (!meso || meso.userId !== uid) return <View style={{ minHeight: (sessionRows?.length ?? 1) * 64 }}>
    {error && <Text style={{ color: semantic.warning }}>{t('calendar.saveFailed')}</Text>}</View>;
  const sessions = orderedRoutineSessions(sessionsForMicrocycle(meso, goal, microcycleIndex), meso.sessionOrder);
  const days = routineRestDays({ ...meso, scheduleTemplate: meso.scheduleTemplate ?? buildScheduleTemplate(sessions, exercisesById) });
  const slots = routineDays(sessions, days);
  const extra = cardio && uid ? cardioCalendarRows({ ...cardio.routine, mesocycleSnapshot: meso }, slots, cardio.blocks, cardio.workouts, uid) : new Map<string, CardioHomeSession[]>();
  type CalendarItem = { id: string; kind: string; anchor: number; day?: typeof slots[number]; entry?: CardioHomeSession };
  const displayed: CalendarItem[] = slots.flatMap((day, anchor) => [{ id: day.id, kind: day.kind, anchor, day },
    ...(extra.get(day.id) ?? []).map(entry => ({ id: `${entry.block.id}:${entry.slot.id}`, kind: 'cardio', anchor, entry }))]);
  const save = async (next: RoutineRestDay[], checks = meso.restDayChecks ?? {}, order = sessions.map((session) => session.index)) => {
    if (saving.current || !uid) return false;
    const scheduleTemplate = restDaysTemplate(orderedRoutineSessions(sessions, order), next);
    saving.current = true; setBusy(true); setError(false);
    try {
      let rejected = false;
      const patch = { restDays: next, restDayChecks: checks, sessionOrder: order, scheduleTemplate, updatedAt: Date.now() };
      if (persist) await persist(patch);
      else await mesocycleRepository.updateLocally(mesocycleId, patch, () => {
        rejected = true; if (activeIdentity.current === identity) setError(true);
      });
      if (activeIdentity.current !== identity || rejected) return false;
      setLoaded({ identity, meso: { ...meso, ...patch } }); onChanged?.();
      return true;
    } catch { if (activeIdentity.current === identity) setError(true); return false; }
    finally { if (activeIdentity.current === identity) { saving.current = false; setBusy(false); } }
  };
  const renderRestDay = (day: RoutineRestDay) => {
    const checked = meso.restDayChecks?.[restDayKey(microcycleIndex, day.id)] === true;
    return <SwipeableSet backgroundColor={colors.bgElevated} removeLabel={t('restDays.remove')} onRemove={busy ? undefined : () => save(days.filter((entry) => entry.id !== day.id))}>
      <Pressable testID={`rest-day-${day.id}`} accessibilityRole="checkbox" accessibilityLabel={t('calendar.rest')} accessibilityState={{ checked }} disabled={busy}
        onPress={() => void save(days, { ...meso.restDayChecks, [restDayKey(microcycleIndex, day.id)]: !checked })}
        style={{ minHeight: 64, paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: colors.surfaceBorder,
          flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgElevated }}>
        <RoutineDayIndicator kind="rest" completed={checked} />
        <Text style={{ flex: 1, color: checked ? colors.textSecondary : colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t(extra.has(day.id) ? 'cardioHome.strengthRest' : 'calendar.rest')}</Text>
      </Pressable>
    </SwipeableSet>;
  };
  return <View>
    <RoutineDayList items={displayed} disabled={busy} edgeScroll={edgeScroll} canDrag={item => item.kind !== 'cardio'} onReorder={(from, to) => {
      if (!displayed[from]?.day || !displayed[to] || displayed[from].anchor === displayed[to].anchor) return;
      const next = moveRoutineDay(slots, displayed[from].anchor, displayed[to].anchor); void save(next.restDays, meso.restDayChecks ?? {}, next.sessionOrder);
    }} onHold={onSessionHold ? item => { if (item.day?.kind === 'workout') onSessionHold(item.day.sessionIndex); } : undefined}
      renderItem={item => item.entry && cardio ? <CardioSessionRow entry={item.entry} onOpen={cardio.onOpen}
        onAdjust={canAdjustCardioHomeSession(item.entry, cardio.workouts) ? cardio.onAdjust : undefined} /> : item.day?.kind === 'rest'
        ? renderRestDay(days.find(day => day.id === item.id)!)
        : sessionRows?.find(row => row.index === (item.day?.kind === 'workout' ? item.day.sessionIndex : -1))?.content
          ?? <Text style={{ color: colors.textPrimary }}>{sessions.find(session => item.day?.kind === 'workout' && session.index === item.day.sessionIndex)?.name}</Text>} />
    <Pressable accessibilityRole="button" accessibilityLabel={t('restDays.add')} disabled={busy || slots.length >= 28}
      onPress={() => void save([...days, { id: `rest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, afterSessionIndex: sessions.at(-1)?.index ?? null }])}
      style={{ minHeight: 44, marginTop: spacing.sm, justifyContent: 'center' }}>
      <Text style={{ color: colors.accentText, fontSize: 16, fontWeight: '600' }}>+ {t('calendar.rest')}</Text>
    </Pressable>
    {error && <Text accessibilityRole="alert" style={{ color: semantic.warning }}>{t('calendar.saveFailed')}</Text>}
  </View>;
}
