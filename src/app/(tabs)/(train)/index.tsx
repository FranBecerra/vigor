/**
 * E1 — Inicio/Hoy de la pestaña Entrenamiento (PRD §8.5).
 *
 * Pantalla de inicio de la pestaña. Estructura (opción E acordada):
 *  1. Shared strength and cardio active routines.
 *  2. Tarjeta de la sesión de hoy: cuerpo pulsable → previsualización;
 *     botón verde → inicia el entrenamiento.
 *  3. Acordeón de rutinas, con el raíl del mesociclo y las sesiones del
 *     microciclo en curso (fechas reales en las completadas).
 *  4. Entrenamiento vacío.
 *
 * Solo orquesta: los cálculos viven en services/training/sessionSummary
 * (lógica pura, 100 % cubierta).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Modal, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SymbolView } from 'expo-symbols';
import { LocalChecksEntry } from '@/test-support/LocalChecksEntry';

import { TodayCard } from '@/components/home/TodayCard';
import { MesoRail } from '@/components/home/HomeHeader';
import { RoutineCard } from '@/components/home/RoutineCard';
import { RenameRoutineSheet } from '@/components/home/RenameRoutineSheet';
import { TrainingCalendarCard } from '@/components/train/TrainingCalendarCard';
import { MicrocycleReviewPrompt } from '@/components/bio/MicrocycleReviewPrompt';
import { SavedCardioPlans } from '@/components/cardio/SavedCardioPlans';
import { CardioRoutineCard } from '@/components/cardio/CardioRoutineCard';
import { RoutineActionsSheet, type RoutineActions } from '@/components/train/RoutineActionsSheet';
import { AgendaActionSheet } from '@/components/train/AgendaActionSheet';
import { TrainingAgenda } from '@/components/train/TrainingAgenda';
import { RoutineBadgeIcon } from '@/components/icons/RoutineBadgeIcon';
import { CardioHeartIcon } from '@/components/icons/CycleReviewIcons';
import { ACCENTS } from '@/theme/accent';
import { agendaMoveTo, movableAgendaEntry, trainingAgenda, type AgendaMove, type AgendaEntry } from '@/services/training/trainingAgenda';
import { createLinkedCardioWorkout, cardioHealthCandidates } from '@/services/cardio/cardioHealthLink';
import { saveCardioHealthLink } from '@/services/cardio/cardioHealthLinkRepository';
import { useCardioHealthReview } from '@/hooks/useCardioHealthReview';
import { cardioSlotPrescription } from '@/services/cardio/cardioProgressionPolicy';
import { readAgendaPreference, removeAgendaRest, writeAgendaPreference, type AgendaPreference } from '@/services/training/agendaOrderPreference';
import type { CardioBlock } from '@/models/cardioTraining';
import { startCardioWorkout } from '@/services/cardio/cardioWorkout';
import { useCardioBlocks, useCardioWorkouts } from '@/hooks/useCardioTraining';
import { useSportActivities } from '@/hooks/useSportActivities';
import { canAdjustCardioHomeSession, cardioHomeCycle, cardioHomeSessions, cardioProgressSegments, type CardioHomeSession } from '@/services/cardio/cardioHome';
import { archiveCardioBlock, changeCardioSlot, cardioStartContext, datedStrength, dateInZone } from '@/services/cardio/cardioBlock';
import { useTheme } from '@/theme/useTheme';
import { useRoutines } from '@/hooks/useRoutines';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
import { restDayKey, routineRestDays } from '@/services/training/routineRestDays';
import { skipRoutineDay } from '@/services/training/skipRoutineDay';
import { useAuth } from '@/hooks/useAuth';
import type { DayListScroll } from '@/components/train/RoutineDayList';
import {
  DEFAULT_PROJECTED_MICROCYCLES,
  defaultExpandedRoutineId,
  type RoutineView,
} from '@/services/training/routineView';

export default function TrainHomeScreen() {
  const { t, i18n } = useTranslation();
  const { uid } = useAuth();
  const owner = useRef(uid); owner.current = uid;
  const { surfaces, colors, spacing, radius, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null), scrollOffset = useRef(0), scrollRange = useRef({ content: 0, viewport: 0 });
  const scrollContent = useRef<View>(null), agendaAnchor = useRef<View>(null), agendaY = useRef(0);
  const pendingAnchor = useRef<{ y: number; offset: number; owner: string } | null>(null);
  const dayScroll = useMemo<DayListScroll>(() => ({ currentOffset: () => scrollOffset.current,
    scrollBy: (delta) => {
      const next = Math.max(0, Math.min(Math.max(0, scrollRange.current.content - scrollRange.current.viewport), scrollOffset.current + delta));
      scrollOffset.current = next; scroll.current?.scrollTo({ y: next, animated: false });
    }, top: insets.top + 70, bottom: height - insets.bottom - 110 }), [height, insets.top, insets.bottom]);
  const router = useRouter();
  const { status, routines: allRoutines, reload, activate, rename, remove } = useRoutines();
  const activeWorkout = useActiveWorkout();
  const cardioBlocks = useCardioBlocks(), cardioWorkouts = useCardioWorkouts(), sportActivities = useSportActivities();
  const [routineMenu, setRoutineMenu] = useState<{ owner: string; target: RoutineActions } | null>(null);
  const cardioStarting = useRef(false);
  const activeCardio = cardioBlocks.entries.filter(block => block.userId === uid && block.endedAt === null);
  const resumeGoal = activeWorkout?.trainingGoal ?? allRoutines.find((routine) => routine.mesocycleId === activeWorkout?.mesocycleId)?.generationGoal;
  const [renaming, setRenaming] = useState<RoutineView | null>(null);

  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [agendaAction, setAgendaAction] = useState<{ owner: string; id: string; mode: 'session' | 'health' } | null>(null);
  const [managingRoutine, setManagingRoutine] = useState<string | null>(null);
  const health = useCardioHealthReview();
  const today = dateInZone(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [agendaOverride, setAgendaOverride] = useState<{ owner: string; preference: AgendaPreference } | null>(null);
  const savedOrder = useMemo(() => uid ? readAgendaPreference(uid) : { moves: [], rests: [] }, [uid]);
  const agendaPreference = agendaOverride?.owner === uid && agendaOverride ? agendaOverride.preference : savedOrder;
  const saveAgendaPreference = (preference: AgendaPreference) => {
    if (!uid || owner.current !== uid) throw Error('staleAgendaOwner');
    setAgendaOverride({ owner: uid, preference: writeAgendaPreference(uid, preference) });
  };
  const projectedAgenda = useMemo(() => trainingAgenda(uid ?? '', allRoutines, cardioBlocks.entries,
    cardioWorkouts.entries, sportActivities.entries, today, agendaPreference.moves, agendaPreference.rests, agendaPreference.removedRestIds),
  [uid, allRoutines, cardioBlocks.entries, cardioWorkouts.entries, sportActivities.entries, today, agendaPreference]);
  const [restChecks, setRestChecks] = useState<{ owner: string; values: Record<string, boolean> } | null>(null);
  const restSaves = useRef(new Set<string>());
  useEffect(() => {
    setRestChecks(previous => {
      if (!previous || previous.owner !== uid) return null;
      const pending = Object.entries(previous.values).filter(([id, checked]) => {
        const row = projectedAgenda.rows.find(entry => entry.id === id);
        return row?.kind === 'rest' && row.checked !== checked;
      });
      return pending.length === Object.keys(previous.values).length ? previous : { owner: previous.owner, values: Object.fromEntries(pending) };
    });
  }, [uid, projectedAgenda]);
  const agenda = useMemo(() => !restChecks || restChecks.owner !== uid ? projectedAgenda : {
    ...projectedAgenda, rows: projectedAgenda.rows.map(row => row.kind === 'rest' && restChecks.values[row.id] !== undefined
      ? { ...row, checked: restChecks.values[row.id] } : row),
  }, [uid, projectedAgenda, restChecks]);


  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const content = scrollContent.current;
    if (!content) return;
    agendaAnchor.current?.measureLayout(content, (_x, y) => {
      if (owner.current !== anchor.owner) return;
      agendaY.current = y;
      const offset = anchor.offset;
      if (offset <= anchor.y - scrollRange.current.viewport || y === anchor.y) return;
      const nextOffset = Math.max(0, offset + y - anchor.y);
      scrollOffset.current = nextOffset;
      scroll.current?.scrollTo({ y: nextOffset, animated: false });
    }, () => {});
  }, [agenda.rows]);

  /** Traduce una clave de MuscleGroup a su nombre legible. */
  const muscleLabel = useCallback((muscle: string) => t(`muscle.${muscle}`), [t]);

  const routines = useMemo(
    () => allRoutines.filter((routine) => routine.domain === 'STRENGTH'),
    [allRoutines],
  );

  /** The first pending session of the active routine is today's workout. */
  const selectedSession = useMemo(() => {
    if (activeWorkout) {
      const routine = routines.find(item => item.mesocycleId === activeWorkout.mesocycleId);
      const session = routine?.microcycles[activeWorkout.microcycleIndex]?.sessions
        .find(item => item.plannedSessionIndex === activeWorkout.plannedSessionIndex);
      if (routine && session) return { routine, session: { ...session, name: activeWorkout.sessionName ?? session.name },
        microcycleIndex: activeWorkout.microcycleIndex };
      return null;
    }
    const next = agenda.rows.find(entry => entry.id === agenda.nextId);
    return next?.kind === 'strength' ? { routine: next.routine, session: next.session, microcycleIndex: next.routine.currentMicrocycleIndex } : null;
  }, [routines, activeWorkout, agenda]);
  const orderedRoutines = useMemo(
    () => [...routines].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [routines],
  );

  /**
   * Switching routines ends today's plan for the current one, so it is confirmed.
   * With nothing active there is nothing to lose, and no question.
   */
  const confirmActivate = useCallback(
    (routine: RoutineView) => {
      const run = () => {
        activate(routine.id)
          .then(() => setExpandedById(previous => ({ ...previous, [routine.id]: true })))
          .catch((error: unknown) => {
            console.error('[routines] activate failed', error);
            Alert.alert(t('home.activateFailed'));
          });
      };
      const current = routines.find((candidate) => candidate.isActive);
      if (current === undefined) {
        run();
        return;
      }
      Alert.alert(
        t('home.activateTitle', { name: routine.name }),
        t('home.activateMessage', { current: current.name }),
        [
          { text: t('generate.cancel'), style: 'cancel' },
          { text: t('home.activateRoutine'), onPress: run },
        ],
      );
    },
    [activate, routines, t],
  );

  /** Deleting is irreversible, so it always asks, and says what goes and what stays. */
  const confirmRemove = useCallback(
    (routine: RoutineView) => {
      Alert.alert(
        t('home.removeTitle', { name: routine.name }),
        t(routine.isActive ? 'home.removeMessageActive' : 'home.removeMessage'),
        [
          { text: t('generate.cancel'), style: 'cancel' },
          {
            text: t('home.removeRoutine'),
            style: 'destructive',
            onPress: () => {
              remove(routine.id).catch((error: unknown) => {
                console.error('[routines] remove failed', error);
                Alert.alert(t('home.removeFailed'));
              });
            },
          },
        ],
      );
    },
    [remove, t],
  );
  const defaultExpandedId = routines.some(routine => routine.isActive) ? defaultExpandedRoutineId(routines)
    : activeCardio[0] ? `cardio:${activeCardio[0].id}` : defaultExpandedRoutineId(routines);
  const isExpanded = (id: string) => expandedById[id] ?? (defaultExpandedId === id);
  const toggleExpanded = (id: string) => setExpandedById(previous => ({
    ...previous, [id]: !(previous[id] ?? (defaultExpandedId === id)),
  }));

  const startSession = useCallback(() => {
    if (selectedSession === null) return;
    router.push({
      pathname: '/session',
      params: {
        mesocycleId: selectedSession.routine.mesocycleId,
        goal: selectedSession.routine.generationGoal,
        microcycleIndex: String(selectedSession.microcycleIndex),
        plannedSessionIndex: String(selectedSession.session.plannedSessionIndex),
      },
    });
  }, [router, selectedSession]);

  const openSessionDetail = useCallback((routine: RoutineView, plannedSessionIndex: number,
    microcycleIndex: number) => {
    router.push({ pathname: '/routine', params: {
      mesocycleId: routine.mesocycleId,
      microcycleIndex: String(microcycleIndex),
      plannedSessionIndex: String(plannedSessionIndex),
    } });
  }, [router]);
  const persistStrengthSkip = async (routine: RoutineView, index: number) => {
    if (!uid) throw Error('staleAgendaOwner');
    const [fresh, history] = await Promise.all([mesocycleRepository.get(routine.mesocycleId), workoutSessionRepository.listByUser(uid)]);
    if (!fresh || owner.current !== uid) throw Error('Missing plan');
    const now = Date.now();
    await mesocycleRepository.updateLocally(fresh.id, {
      ...skipRoutineDay(fresh, uid, routine.currentMicrocycleIndex, index, history, now), updatedAt: now });
    reload();
  };
  const showDayActions = (routine: RoutineView, index: number) => {
    const session = routine.microcycles[routine.currentMicrocycleIndex]?.sessions.find((day) => day.plannedSessionIndex === index);
    if (!uid || !routine.isActive || !session || session.completedOn || session.skippedOn
      || activeWorkout?.mesocycleId === routine.mesocycleId && activeWorkout.microcycleIndex === routine.currentMicrocycleIndex && activeWorkout.plannedSessionIndex === index) return;
    Alert.alert(session.name, undefined, [
      { text: t('generate.cancel'), style: 'cancel' },
      { text: t('routine.skipSession'), onPress: () => { void persistStrengthSkip(routine, index)
        .catch(() => Alert.alert(t('routine.editError'))); } },
    ]);
  };

  const openCardio = (entry: CardioHomeSession, relative = false) => entry.workout
    ? router.push({ pathname: '/cardio-workout', params: { id: entry.workout.id } })
    : router.push({ pathname: '/cardio-block', params: { id: entry.block.id, cycle: String(entry.slot.cycle), ...(relative ? { relative: '1' } : {}) } });
  const canEditCardio = cardioBlocks.ready && !cardioBlocks.error && cardioWorkouts.ready && !cardioWorkouts.error;
  const canMove = (entry: AgendaEntry) => entry.kind === 'cardio' ? !entry.upcoming && canEditCardio && canAdjustCardioHomeSession(entry.session, cardioWorkouts.entries)
    : entry.kind === 'strength' && !!uid && status === 'ready' && !entry.session.completedOn && !entry.session.skippedOn
      && !(activeWorkout?.mesocycleId === entry.routine.mesocycleId && activeWorkout.microcycleIndex === entry.routine.currentMicrocycleIndex
        && activeWorkout.plannedSessionIndex === entry.session.plannedSessionIndex);
  const canLink = (entry: AgendaEntry) => Platform.OS === 'ios' && entry.kind === 'cardio' && canMove(entry);
  const openAgenda = (entry: AgendaEntry) => {
    if (entry.kind === 'sport' || entry.kind === 'cardio' && entry.sport) {
      const sport = entry.sport;
      if (sport) router.push({ pathname: '/activity', params: { id: sport.id } });
    } else if (entry.kind === 'cardio') {
      if (canMove(entry)) showAction(entry, 'session'); else openCardio(entry.session, !entry.upcoming);
    }
    if (entry.kind === 'strength') openSessionDetail(entry.routine, entry.session.plannedSessionIndex, entry.routine.currentMicrocycleIndex);
  };
  const showAction = (entry: AgendaEntry, mode: 'session' | 'health') => {
    if (!uid || !canMove(entry)) return;
    setAgendaAction({ owner: uid, id: entry.id, mode });
    if (mode === 'health') void health.read(false, 'week');
  };
  const closeAction = () => { setAgendaAction(null); health.clear(); };
  const actionEntry = agendaAction?.owner === uid ? agenda.rows.find(entry => entry.id === agendaAction?.id) : undefined;
  const actionCardio = actionEntry?.kind === 'cardio' ? actionEntry.session : null;
  const candidates = actionCardio && agendaAction?.mode === 'health' && health.data
    ? cardioHealthCandidates(actionCardio.block, actionCardio.slot.id, health.data, cardioWorkouts.entries, Date.now()) : [];
  const canDrag = (entry: AgendaEntry) => !!uid && movableAgendaEntry(entry)
    && (entry.kind === 'rest' || entry.kind === 'cardio' && entry.session.completed || canMove(entry));
  const persistAgendaMove = (change: AgendaMove | null) => {
    if (!change || !uid) return;
    pendingAnchor.current = { y: agendaY.current, offset: scrollOffset.current, owner: uid };
    try {
      const ids = new Set(agenda.rows.map(row => row.id));
      const prior = agendaPreference.moves.filter(move => ids.has(move.id) && ids.has(move.anchor));
      saveAgendaPreference({ ...agendaPreference, moves: [...prior, change] });
    } catch {
      pendingAnchor.current = null;
      Alert.alert(t('calendar.saveFailed'));
    }
  };
  const reorder = (from: number, to: number) => {
    const source = agenda.rows[from], target = agenda.rows[to];
    if (!source || !target || !canDrag(source) || !canDrag(target)) return;
    persistAgendaMove(agendaMoveTo(agenda.rows, from, to));
  };
  const accessibleMove = (id: string, direction: -1 | 1) => {
    const from = agenda.rows.findIndex(entry => entry.id === id);
    if (from < 0 || !canDrag(agenda.rows[from])) return;
    for (let to = from + direction; to >= 0 && to < agenda.rows.length; to += direction) {
      if (!canDrag(agenda.rows[to]) || !agendaMoveTo(agenda.rows, from, to)) continue;
      reorder(from, to);
      return;
    }
  };
  const addRest = () => {
    if (!agenda.restScope) return;
    const rests = agendaPreference.rests.filter(rest => rest.scope === agenda.restScope);
    if (rests.length >= 28) return;
    const id = `extra-rest:${agenda.restScope}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    try { saveAgendaPreference({ ...agendaPreference, rests: [...rests, { id, scope: agenda.restScope, checked: false }] }); }
    catch { Alert.alert(t('calendar.saveFailed')); }
  };
  const removeRest = (entry: Extract<AgendaEntry, { kind: 'rest' }>) => {
    try {
      saveAgendaPreference(removeAgendaRest(agendaPreference, entry));
      return true;
    } catch {
      Alert.alert(t('restDays.saveFailed'));
      return false;
    }
  };
  const startCardio = (entry: CardioHomeSession) => {
    const { block, slot } = entry;
    if (!uid || activeWorkout || !canEditCardio || activeCardio.length !== 1
      || cardioWorkouts.entries.some(w => w.status === 'RUNNING' || w.status === 'PAUSED')
      || !canAdjustCardioHomeSession(entry, cardioWorkouts.entries) || cardioStarting.current) return;
    closeAction();
    const launch = async () => {
      if (cardioStarting.current || owner.current !== uid) return;
      cardioStarting.current = true;
      try {
        const workout = startCardioWorkout(block, slot.id, Date.now(), cardioWorkouts.newId());
        await cardioWorkouts.save(workout, null);
        if (owner.current === uid) router.push({ pathname: '/cardio-workout', params: { id: workout.id } });
      } catch { if (owner.current === uid) Alert.alert(t('cardioTraining.saveFailed')); }
      finally { cardioStarting.current = false; }
    };
    const context = cardioStartContext(block, slot.id, Date.now(), sportActivities.entries,
      datedStrength(routines.find(r => r.isActive), block.timeZone), true);
    if (context.review) Alert.alert(t('cardioTraining.startNow'), context.issues.map(issue => t(`cardioTraining.issue_${issue}`)).join('\n'), [
      { text: t('generate.cancel'), style: 'cancel' }, { text: t('routine.startSession'), onPress: () => { void launch(); } },
    ]);
    else void launch();
  };
  const skip = async (entry: AgendaEntry) => {
    if (!uid || owner.current !== uid || !canMove(entry)) throw Error('lockedAgendaSession');
    if (entry.kind === 'cardio') {
      const { block, slot } = entry.session;
      await cardioBlocks.save(changeCardioSlot(block, slot.id, slot.date, 'SKIPPED', null, cardioWorkouts.entries, Date.now()), block);
    } else if (entry.kind === 'strength') await persistStrengthSkip(entry.routine, entry.session.plannedSessionIndex);
  };
  const toggleRest = async (entry: Extract<AgendaEntry, { kind: 'rest' }>) => {
    if (!uid || restSaves.current.has(entry.id)) return;
    const checked = !entry.checked;
    if (entry.extra) {
      try { saveAgendaPreference({ ...agendaPreference, rests: agendaPreference.rests.map(rest => rest.id === entry.id ? { ...rest, checked } : rest) }); }
      catch { Alert.alert(t('restDays.saveFailed')); }
      return;
    }
    restSaves.current.add(entry.id);
    const paint = (value?: boolean) => setRestChecks(previous => {
      if (owner.current !== uid) return previous;
      const values = previous?.owner === uid ? { ...previous.values } : {};
      if (value === undefined) delete values[entry.id]; else values[entry.id] = value;
      return { owner: uid, values };
    });
    paint(checked);
    const failed = () => {
      if (owner.current !== uid) return;
      paint(); reload(); Alert.alert(t('restDays.saveFailed'));
    };
    try {
      const fresh = await mesocycleRepository.get(entry.mesocycleId);
      if (!fresh || fresh.userId !== uid || owner.current !== uid || fresh.currentMicrocycleIndex > entry.cycle
        || entry.cycle >= Math.max(fresh.currentMicrocycleIndex + 1, fresh.projectedMicrocycles ?? DEFAULT_PROJECTED_MICROCYCLES)
        || !routineRestDays(fresh).some(rest => rest.id === entry.restDayId)) throw Error('staleAgendaRest');
      await mesocycleRepository.updateLocally(fresh.id, { restDayChecks: { [restDayKey(entry.cycle, entry.restDayId)]: checked },
        updatedAt: Date.now() }, failed);
      if (owner.current === uid) reload();
    } catch { failed(); }
    finally { restSaves.current.delete(entry.id); }
  };
  const link = async (entry: CardioHomeSession, recordId: string) => {
    if (!uid || uid !== entry.block.userId || !health.data || health.owner !== uid || !canEditCardio || cardioWorkouts.pending) throw Error('healthCardioUnavailable');
    const workout = createLinkedCardioWorkout(entry.block, entry.slot.id, recordId, health.data, cardioWorkouts.entries, Date.now(), cardioWorkouts.newId());
    await saveCardioHealthLink(workout, entry.block, () => owner.current === uid);
  };
  const activeStrength = orderedRoutines.filter(routine => routine.isActive);
  const inactiveStrength = orderedRoutines.filter(routine => !routine.isActive);
  const endedCardio = cardioBlocks.entries.filter(block => block.userId === uid && block.endedAt !== null && block.archivedAt === undefined);
  const managed = activeStrength.find(routine => routine.id === managingRoutine);
  const editStrength = (routine: RoutineView) => {
    setManagingRoutine(null);
    router.push({ pathname: '/routine', params: { mesocycleId: routine.mesocycleId,
      microcycleIndex: String(routine.currentMicrocycleIndex),
      plannedSessionIndex: String(routine.microcycles[routine.currentMicrocycleIndex]?.sessions[0]?.plannedSessionIndex ?? 0), edit: '1' } });
  };
  const showRoutineMenu = (target: RoutineActions) => { if (uid) setRoutineMenu({ owner: uid, target }); };
  const strengthActions = (routine: RoutineView) => showRoutineMenu({
    name: routine.name, active: routine.isActive,
    activate: () => { if (owner.current === uid) confirmActivate(routine); },
    edit: () => { if (owner.current === uid) editStrength(routine); },
    remove: () => { if (owner.current === uid) confirmRemove(routine); },
    removeDisabled: activeWorkout?.mesocycleId === routine.mesocycleId,
  });
  const cardioActions = (block: CardioBlock, cycle: number) => showRoutineMenu({
    name: block.proposal.name, active: block.endedAt === null,
    activate: () => { if (owner.current === uid) router.push({ pathname: '/cardio-block', params: { id: block.id, activate: '1' } }); },
    edit: () => { if (owner.current === uid) router.push({ pathname: '/cardio-block', params: { id: block.id, cycle: String(cycle), edit: '1' } }); },
    removeDisabled: !canEditCardio || cardioWorkouts.entries.some(w => w.blockId === block.id && (w.status === 'RUNNING' || w.status === 'PAUSED')),
    remove: () => Alert.alert(t('home.removeTitle', { name: block.proposal.name }), t('cardioTraining.confirmEnd'), [
      { text: t('generate.cancel'), style: 'cancel' },
      { text: t('home.removeRoutine'), style: 'destructive', onPress: () => {
        if (owner.current !== uid) return;
        void (async () => { await cardioBlocks.save(archiveCardioBlock(block, cardioWorkouts.entries, Date.now()), block); })()
          .catch(() => Alert.alert(t('home.removeFailed')));
      } },
    ]),
  });
  const routineCard = (routine: RoutineView, management = false) => <RoutineCard
    renderSessionList={(sessionRows) => <TrainingCalendarCard sessionRows={sessionRows} mesocycleId={routine.mesocycleId}
      initialMesocycle={routine.mesocycleSnapshot} onSessionHold={(index) => showDayActions(routine, index)}
      edgeScroll={management ? undefined : dayScroll} microcycleIndex={routine.currentMicrocycleIndex} goal={routine.generationGoal} onChanged={reload} />}
    routine={routine} expanded={management || isExpanded(routine.id)} selectedSessionId={selectedSession?.session.id ?? ''}
    locale={i18n.language} muscleLabel={muscleLabel}
    labels={{ sessions: t('home.sessions'), sets: t('home.sets'), today: t('home.today'), viewMesocycle: t('home.viewMesocycle'),
      microcycleOf: t('home.microcycle'), activate: t('home.activateRoutine'), rename: t('routineEdit'), identity: t('routineIdentity.title'),
      remove: t('home.removeRoutine'), active: t('home.activeRoutine'), skipped: t('routine.skipped') }}
    onToggle={() => management ? setManagingRoutine(null) : toggleExpanded(routine.id)}
    onPressDetail={() => { setManagingRoutine(null); router.push({ pathname: '/routine', params: { mesocycleId: routine.mesocycleId } }); }}
    onSelectSession={(sessionId) => {
      const session = routine.microcycles[routine.currentMicrocycleIndex]?.sessions.find(s => s.id === sessionId);
      if (session) { setManagingRoutine(null); openSessionDetail(routine, session.plannedSessionIndex, routine.currentMicrocycleIndex); }
    }}
    onPressMesocycle={() => { setManagingRoutine(null); router.push({ pathname: '/mesocycle', params: { mesocycleId: routine.mesocycleId } }); }}
    onActivate={routine.isActive ? undefined : () => confirmActivate(routine)}
    onRename={() => editStrength(routine)}
    onActions={management ? undefined : () => strengthActions(routine)}
    onIdentity={() => { setManagingRoutine(null); setRenaming(routine); }}
    onRemove={() => confirmRemove(routine)}
  />;
  const routineShortcut = (id: string, name: string, badge: React.ReactNode, open: () => void, progress: React.ReactNode, actions: () => void, manage?: () => void) => (
    <View key={id} style={{ paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.surfaceBorder }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={open} onLongPress={manage}
          accessibilityActions={manage ? [{ name: 'manage', label: t('trainingAgenda.manage', { name }) }] : undefined}
          onAccessibilityAction={manage ? event => { if (event.nativeEvent.actionName === 'manage') manage(); } : undefined}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 54, gap: 9 }}>
          {badge}<Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16, flex: 1 }}>{name}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('trainingAgenda.manage', { name })} onPress={actions}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>···</Text>
        </Pressable>
      </View>
      {progress}
    </View>
  );

  return (
    <View style={[styles.screen, { ...surfaces.screen, backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        ref={scroll} scrollEventThrottle={16}
        onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
        onLayout={(event) => { scrollRange.current.viewport = event.nativeEvent.layout.height; }}
        onContentSizeChange={(_width, content) => { scrollRange.current.content = content; }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}>
        <View ref={scrollContent} collapsable={false}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tabs.train')}</Text>
        <LocalChecksEntry />

        {!activeWorkout && <MicrocycleReviewPrompt routines={routines} />}
        {activeWorkout && !selectedSession && resumeGoal && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/session', params: {
          mesocycleId: activeWorkout.mesocycleId, goal: resumeGoal,
          microcycleIndex: String(activeWorkout.microcycleIndex), plannedSessionIndex: String(activeWorkout.plannedSessionIndex),
        } })} style={{ ...surfaces.hero, padding: 20, marginTop: spacing.lg, borderRadius: radius.lg }}>
          <Text style={{ color: colors.textSecondary }}>{t('workout.inProgress')}</Text>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginVertical: 6 }}>{activeWorkout.sessionName ?? t('tabs.train')}</Text>
          <Text style={{ color: colors.textPrimary }}>{t('workout.resume')} →</Text>
        </Pressable>}
        {selectedSession !== null ? (
          <View style={{ marginTop: spacing.lg }}>
            <TodayCard
              session={selectedSession.session}
              routineName={selectedSession.routine.name}
              routineIcon={selectedSession.routine.icon}
              routineColor={selectedSession.routine.color}
              muscleLabel={muscleLabel}
              labels={{
                start: t(activeWorkout ? 'workout.resume' : 'home.startWorkout'),
                preview: t('home.previewWorkout'),
                exercises: t('home.exercises'),
                sets: t('home.sets'),
              }}
              onPressPreview={() => openSessionDetail(selectedSession.routine,
                selectedSession.session.plannedSessionIndex,
                selectedSession.microcycleIndex)}
              onPressStart={startSession}
            />
          </View>
        ) : status === 'loading' ? (
          <View accessibilityLabel={t('home.routines')} style={{ height: 180, backgroundColor: colors.bgElevated, borderRadius: radius.lg, marginTop: spacing.lg }} />
        ) : agenda.rows.length === 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('home.noSession')}</Text>
          </View>
        ) : null}

        <View ref={agendaAnchor} collapsable={false} onLayout={event => { agendaY.current = event.nativeEvent.layout.y; }}>
          <TrainingAgenda agenda={agenda} onOpen={openAgenda}
            onLink={entry => showAction(entry, 'health')} canMove={canDrag} onReorder={reorder} onAccessibleMove={accessibleMove}
            edgeScroll={dayScroll} onAddRest={agenda.restScope ? addRest : undefined}
            canLink={entry => canLink(entry) && entry.id === agenda.nextId} onToggleRest={entry => void toggleRest(entry)} onRemoveRest={uid ? removeRest : undefined} />
        </View>
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>{t('home.routines')}</Text>
        {status === 'loading' && <View style={{ height: 64, borderRadius: radius.lg, backgroundColor: colors.bgElevated }} />}
        {status === 'error' && <Pressable accessibilityRole="button" onPress={reload} style={{ minHeight: 44 }}>
          <Text style={{ color: colors.textMuted }}>{t('home.routinesLoadFailed')} · {t('home.retry')}</Text></Pressable>}
        {status === 'ready' && !orderedRoutines.length && !activeCardio.length && !endedCardio.length
          && <Text style={{ color: colors.textMuted }}>{t('home.noRoutines')}</Text>}
        {(activeStrength.length > 0 || activeCardio.length > 0) && <View style={{ ...surfaces.card, borderRadius: radius.lg, paddingHorizontal: 12 }}>
          {activeStrength.map(routine => routineShortcut(routine.id, routine.name,
            <View style={[styles.routineBadge, { backgroundColor: colors.accentTint }]}><RoutineBadgeIcon icon={routine.icon} size={19} /></View>,
            () => router.push({ pathname: '/routine', params: { mesocycleId: routine.mesocycleId } }),
            routine.microcycles.length > 0 && <MesoRail microcycles={routine.microcycles} currentIndex={routine.currentMicrocycleIndex}
              caption={`${t('home.microcycle')} ${routine.currentMicrocycleIndex + 1}/${routine.microcycles.length}`}
              actionLabel={t('home.viewMesocycle')} accessibilityLabel={`${t('home.viewMesocycle')} · ${routine.name}`}
              onPress={() => router.push({ pathname: '/mesocycle', params: { mesocycleId: routine.mesocycleId } })} />,
            () => strengthActions(routine), () => setManagingRoutine(routine.id)))}
          {activeCardio.map(block => {
            const visible = agenda.rows.find(row => row.kind === 'cardio' && row.session.block.id === block.id);
            const cycle = visible?.kind === 'cardio' ? visible.session.slot.cycle
              : cardioHomeCycle(block, cardioHomeSessions(block, cardioWorkouts.entries, sportActivities.entries));
            const open = () => router.push({ pathname: '/cardio-block', params: { id: block.id, cycle: String(cycle) } });
            return routineShortcut(`cardio:${block.id}`, block.proposal.name,
              <View style={[styles.routineBadge, { backgroundColor: scheme === 'light' ? ACCENTS.sky.tintLight : ACCENTS.sky.tintDark }]}>
                <CardioHeartIcon size={18} color={ACCENTS.sky[scheme]} /></View>,
              open, <MesoRail microcycles={cardioProgressSegments(block, cycle)} currentIndex={cycle}
                caption={`${t('home.microcycle')} ${cycle + 1}/${block.cycles}`}
                actionLabel={t('home.viewMesocycle')} accessibilityLabel={`${t('home.viewMesocycle')} · ${block.proposal.name}`}
                segmentColor={ACCENTS.sky.fill} onPress={open} />, () => cardioActions(block, cycle));
          })}
        </View>}
        {(inactiveStrength.length > 0 || endedCardio.length > 0) && <>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>{t('home.otherRoutines')}</Text>
          {inactiveStrength.map(routine => <View key={routine.id} style={{ marginTop: spacing.sm }}>{routineCard(routine)}</View>)}
          {endedCardio.map(block => <View key={block.id} style={{ marginTop: spacing.sm }}>
            <CardioRoutineCard block={block} workouts={cardioWorkouts.entries} sports={sportActivities.entries} onOpen={entry => openCardio(entry)}
              onActions={() => cardioActions(block, cardioHomeCycle(block, cardioHomeSessions(block, cardioWorkouts.entries, sportActivities.entries)))}
              expanded={isExpanded(`cardio:${block.id}`)} onToggle={() => toggleExpanded(`cardio:${block.id}`)}
              onOpenBlock={cycle => router.push({ pathname: '/cardio-block', params: { id: block.id, cycle: String(cycle) } })} />
          </View>)}
        </>}
        {(activeCardio.length > 1 || cardioWorkouts.entries.filter(w => w.status === 'RUNNING' || w.status === 'PAUSED').length > 1) &&
          <Text accessibilityRole="alert" style={{ color: colors.textSecondary, marginTop: 12 }}>{t('cardioTraining.conflict')}</Text>}
        {(cardioBlocks.error || cardioWorkouts.error || sportActivities.error) && <Pressable accessibilityRole="button" accessibilityLabel={t('home.retry')}
          onPress={() => { cardioBlocks.reload(); cardioWorkouts.reload(); sportActivities.reload(); }} style={{ minHeight: 44, marginTop: 12 }}>
          <Text accessibilityRole="alert" style={{ color: colors.textSecondary }}>{t('cardioTraining.saveFailed')} · {t('home.retry')}</Text>
        </Pressable>}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.newRoutine')}
          onPress={() => router.push('/create-routine')}
          style={[
            styles.emptyWorkout,
            { borderColor: colors.surfaceBorder, borderRadius: radius.md, marginTop: spacing.md },
          ]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
            + {t('home.newRoutine')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.emptyWorkout')}
          style={[
            styles.emptyWorkout,
            { borderColor: colors.surfaceBorder, borderRadius: radius.md, marginTop: spacing.md },
          ]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
            + {t('home.emptyWorkout')}
          </Text>
        </Pressable>
        <SavedCardioPlans />
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.md }]}>{t('library.tools')}</Text>
        <View style={{ ...surfaces.card, borderRadius: radius.lg, paddingHorizontal: spacing.lg }}>
          {([
            { route: 'exercises', icon: 'books.vertical', label: 'library.title' },
            { route: 'history', icon: 'clock.arrow.circlepath', label: 'workout.history' },
            { route: 'activities', icon: 'figure.run', label: 'sportActivities.title' },
            { route: 'cardio-health', icon: 'heart.text.square', label: 'cardioHealth.title' },
            { route: 'rehab', icon: 'bandage', label: 'rehab.title' },
          ] as const).map(({ route, icon, label }, index) => <Pressable key={route} accessibilityRole="button" accessibilityLabel={t(label)} onPress={() => router.push(`/${route}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, borderTopWidth: index ? 0.5 : 0, borderTopColor: colors.surfaceBorder }}>
            <SymbolView name={icon} tintColor={colors.textSecondary} size={24} />
            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>{t(label)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
          </Pressable>)}
        </View>
        </View>
      </ScrollView>

      {actionEntry && agendaAction && <AgendaActionSheet key={actionEntry.id} mode={agendaAction.mode}
        name={actionEntry.kind === 'strength' ? actionEntry.session.name : actionCardio
          ? t(`cardioPlan.${cardioSlotPrescription(actionCardio.block, actionCardio.slot.id).modality}`) : t('calendar.rest')}
        onClose={closeAction} start={actionCardio && !activeWorkout && activeCardio.length === 1
          && !cardioWorkouts.entries.some(w => w.status === 'RUNNING' || w.status === 'PAUSED') ? () => startCardio(actionCardio) : undefined}
        subtitle={actionCardio ? [actionCardio.block.proposal.name, actionCardio.seconds ? `${Math.round(actionCardio.seconds / 6) / 10} min` : t('manualCardio.untimed')].join(' · ') : undefined}
        skip={canMove(actionEntry) ? () => skip(actionEntry) : undefined}
        onOpenHealth={canLink(actionEntry) ? () => showAction(actionEntry, 'health') : undefined}
        health={actionCardio && agendaAction.mode === 'health' ? { state: health.state, rows: candidates,
          planned: actionCardio.seconds ? `${Math.round(actionCardio.seconds / 6) / 10} min` : t('manualCardio.untimed'),
          load: authorize => { void health.read(authorize, 'week'); }, save: id => link(actionCardio, id) } : undefined} />}
      {managed && <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setManagingRoutine(null)}>
        <ScrollView style={{ ...surfaces.sheet, flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 26, paddingBottom: 48 }}>
          <Pressable accessibilityRole="button" onPress={() => setManagingRoutine(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.accentText }}>{t('generate.back')}</Text></Pressable>
          {routineCard(managed, true)}
        </ScrollView>
      </Modal>}
      <RoutineActionsSheet target={routineMenu && routineMenu.owner === uid ? routineMenu.target : null} onClose={() => setRoutineMenu(null)} />
      <RenameRoutineSheet
        currentName={renaming?.name ?? null}
        currentIdentity={renaming ? { icon: renaming.icon, color: renaming.color } : undefined}
        otherNames={allRoutines.filter((routine) => routine.id !== renaming?.id).map((routine) => routine.name)}
        labels={{
          title: t('editorFlow.identity'),
          save: t('home.renameSave'),
          cancel: t('generate.cancel'),
          duplicate: t('generate.nameDuplicate'),
        }}
        onClose={() => setRenaming(null)}
        onSave={(name, identity) => {
          const target = renaming;
          setRenaming(null);
          if (target === null) return;
          rename(target.id, name, identity).catch((error: unknown) => {
            console.error('[routines] rename failed', error);
            Alert.alert(t('home.renameFailed'));
          });
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  routineBadge: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, paddingTop: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.9 },
  empty: { fontSize: 16 },
  emptyWorkout: {
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
