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
import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SymbolView } from 'expo-symbols';
import { LocalChecksEntry } from '@/test-support/LocalChecksEntry';

import { TodayCard } from '@/components/home/TodayCard';
import { RoutineCard } from '@/components/home/RoutineCard';
import { RenameRoutineSheet } from '@/components/home/RenameRoutineSheet';
import { TrainingCalendarCard } from '@/components/train/TrainingCalendarCard';
import { MicrocycleReviewPrompt } from '@/components/bio/MicrocycleReviewPrompt';
import { SavedCardioPlans } from '@/components/cardio/SavedCardioPlans';
import { CardioRoutineCard } from '@/components/cardio/CardioRoutineCard';
import { useCardioBlocks, useCardioWorkouts } from '@/hooks/useCardioTraining';
import { useSportActivities } from '@/hooks/useSportActivities';
import type { CardioHomeSession } from '@/services/cardio/cardioHome';
import { useTheme } from '@/theme/useTheme';
import { useRoutines } from '@/hooks/useRoutines';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { mesocycleRepository, workoutSessionRepository } from '@/services/repositories';
import { skipRoutineDay } from '@/services/training/skipRoutineDay';
import { useAuth } from '@/hooks/useAuth';
import type { DayListScroll } from '@/components/train/RoutineDayList';
import {
  defaultExpandedRoutineId,
  defaultSessionId,
  type RoutineView,
} from '@/services/training/routineView';

/** The session with this id in the running microcycle of any routine. */
function findSession(routines: readonly RoutineView[], sessionId: string) {
  for (const routine of routines) {
    const current = routine.microcycles[routine.currentMicrocycleIndex];
    const found = current?.sessions.find((s) => s.id === sessionId);
    if (found) return { routine, session: found, microcycleIndex: routine.currentMicrocycleIndex };
  }
  return null;
}

export default function TrainHomeScreen() {
  const { t, i18n } = useTranslation();
  const { uid } = useAuth();
  const owner = useRef(uid); owner.current = uid;
  const { surfaces, colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null), scrollOffset = useRef(0), scrollRange = useRef({ content: 0, viewport: 0 });
  const dayScroll = useMemo<DayListScroll>(() => ({ currentOffset: () => scrollOffset.current,
    scrollBy: (delta) => {
      const next = Math.max(0, Math.min(Math.max(0, scrollRange.current.content - scrollRange.current.viewport), scrollOffset.current + delta));
      scrollOffset.current = next; scroll.current?.scrollTo({ y: next, animated: false });
    }, top: insets.top + 70, bottom: height - insets.bottom - 110 }), [height, insets.top, insets.bottom]);
  const router = useRouter();
  const { status, routines: allRoutines, reload, activate, rename, remove } = useRoutines();
  const activeWorkout = useActiveWorkout();
  const cardioBlocks = useCardioBlocks(), cardioWorkouts = useCardioWorkouts(), sportActivities = useSportActivities();
  const activeCardio = cardioBlocks.entries.filter(block => block.userId === uid && block.endedAt === null);
  const resumeGoal = activeWorkout?.trainingGoal ?? allRoutines.find((routine) => routine.mesocycleId === activeWorkout?.mesocycleId)?.generationGoal;
  const [renaming, setRenaming] = useState<RoutineView | null>(null);

  // null until the athlete touches the accordion, so the default follows the data.
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

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
    const active = routines.filter((routine) => routine.isActive);
    return findSession(active, defaultSessionId(active));
  }, [routines, activeWorkout]);
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
          .then(() => setExpandedRoutineId(routine.id))
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
  const expandedId = expandedRoutineId ?? (routines.some(routine => routine.isActive) ? defaultExpandedRoutineId(routines)
    : activeCardio[0] ? `cardio:${activeCardio[0].id}` : defaultExpandedRoutineId(routines));

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
  const showDayActions = (routine: RoutineView, index: number) => {
    const session = routine.microcycles[routine.currentMicrocycleIndex]?.sessions.find((day) => day.plannedSessionIndex === index);
    if (!uid || !routine.isActive || !session || session.completedOn || session.skippedOn
      || activeWorkout?.mesocycleId === routine.mesocycleId && activeWorkout.microcycleIndex === routine.currentMicrocycleIndex && activeWorkout.plannedSessionIndex === index) return;
    Alert.alert(session.name, undefined, [
      { text: t('generate.cancel'), style: 'cancel' },
      { text: t('routine.skipSession'), onPress: () => { void (async () => {
        const [fresh, history] = await Promise.all([mesocycleRepository.get(routine.mesocycleId), workoutSessionRepository.listByUser(uid)]);
        if (!fresh || owner.current !== uid) throw Error('Missing plan');
        await mesocycleRepository.updateLocally(fresh.id, {
          ...skipRoutineDay(fresh, uid, routine.currentMicrocycleIndex, index, history, Date.now()), updatedAt: Date.now() });
        reload();
      })().catch(() => Alert.alert(t('routine.editError'))); } },
    ]);
  };

  const openCardio = (entry: CardioHomeSession) => entry.workout
    ? router.push({ pathname: '/cardio-workout', params: { id: entry.workout.id } })
    : router.push({ pathname: '/cardio-block', params: { id: entry.block.id, cycle: String(entry.slot.cycle) } });
  const cardioCards = activeCardio.map(block => <View key={`cardio:${block.id}`} style={{ marginTop: spacing.sm }}>
    <CardioRoutineCard block={block} workouts={cardioWorkouts.entries} sports={sportActivities.entries} onOpen={openCardio}
      expanded={expandedId === `cardio:${block.id}`} onToggle={() => setExpandedRoutineId(expandedId === `cardio:${block.id}` ? '' : `cardio:${block.id}`)}
      onOpenBlock={cycle => router.push({ pathname: '/cardio-block', params: { id: block.id, cycle: String(cycle) } })} />
  </View>);

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
        ) : activeCardio.length === 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('home.noSession')}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.xl }]}>
          {t('home.routines')}
        </Text>

        {status === 'loading' ? (
          <View style={{ height: 180, marginTop: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgElevated }} />
        ) : null}

        {status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.retry')}
            onPress={reload}
            style={{ marginTop: spacing.sm }}>
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {t('home.routinesLoadFailed')}
            </Text>
            <Text style={[styles.empty, { color: colors.textPrimary, marginTop: 4 }]}>
              {t('home.retry')}
            </Text>
          </Pressable>
        ) : null}

        {status === 'ready' && routines.length === 0 && activeCardio.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('home.noRoutines')}
          </Text>
        ) : null}

        {orderedRoutines.map((routine, index) => (
          <View key={routine.id} style={{ marginTop: spacing.sm }}>
            {/* The one active routine leads; the rest sit under their own label. */}
            {!routine.isActive && (index === 0 || orderedRoutines[index - 1].isActive) ? (<>{cardioCards}
              <Text
                style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                {t('home.otherRoutines')}
              </Text></>
            ) : null}
            <RoutineCard
              renderSessionList={(sessionRows) => <TrainingCalendarCard sessionRows={sessionRows} mesocycleId={routine.mesocycleId}
                initialMesocycle={routine.mesocycleSnapshot} onSessionHold={(index) => showDayActions(routine, index)}
                edgeScroll={dayScroll}
                cardio={routine.isActive && cardioBlocks.ready && cardioWorkouts.ready && !cardioBlocks.error && !cardioWorkouts.error
                  ? { routine, blocks: activeCardio, workouts: cardioWorkouts.entries, onOpen: openCardio } : undefined}
                microcycleIndex={routine.currentMicrocycleIndex} goal={routine.generationGoal} onChanged={reload} />}
              routine={routine}
              expanded={routine.id === expandedId}
              selectedSessionId={selectedSession?.session.id ?? ''}
              locale={i18n.language}
              muscleLabel={muscleLabel}
              labels={{
                sessions: t('home.sessions'),
                sets: t('home.sets'),
                today: t('home.today'),
                viewMesocycle: t('home.viewMesocycle'),
                microcycleOf: t('home.microcycle'),
                activate: t('home.activateRoutine'),
                rename: t('routineEdit'),
                identity: t('routineIdentity.title'),
                remove: t('home.removeRoutine'),
                active: t('home.activeRoutine'),
                skipped: t('routine.skipped'),
              }}
              onToggle={() =>
                setExpandedRoutineId(expandedId === routine.id ? '' : routine.id)
              }
              onPressDetail={() => router.push({ pathname: '/routine', params: { mesocycleId: routine.mesocycleId } })}
              onSelectSession={(sessionId) => {
                const session = routine.microcycles[routine.currentMicrocycleIndex]?.sessions.find(
                  (entry) => entry.id === sessionId);
                if (session) openSessionDetail(routine, session.plannedSessionIndex,
                  routine.currentMicrocycleIndex);
              }}
              onPressMesocycle={() => router.push({ pathname: '/mesocycle', params: { mesocycleId: routine.mesocycleId } })}
              onActivate={routine.isActive ? undefined : () => confirmActivate(routine)}
              onRename={() => router.push({ pathname: '/routine', params: {
                mesocycleId: routine.mesocycleId, microcycleIndex: String(routine.currentMicrocycleIndex),
                plannedSessionIndex: String(routine.microcycles[routine.currentMicrocycleIndex]?.sessions[0]?.plannedSessionIndex ?? 0), edit: '1',
              } })}
              onIdentity={() => setRenaming(routine)}
              onRemove={() => confirmRemove(routine)}
            />
          </View>
        ))}

        {!orderedRoutines.some(routine => !routine.isActive) && cardioCards}
        {cardioBlocks.entries.some(block => block.userId === uid && block.endedAt !== null) && <>
          {!orderedRoutines.some(routine => !routine.isActive) && <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.md }]}>{t('home.otherRoutines')}</Text>}
          {cardioBlocks.entries.filter(block => block.userId === uid && block.endedAt !== null).map(block => <View key={block.id} style={{ marginTop: spacing.sm }}>
            <CardioRoutineCard block={block} workouts={cardioWorkouts.entries} sports={sportActivities.entries} onOpen={openCardio}
              expanded={expandedId === `cardio:${block.id}`} onToggle={() => setExpandedRoutineId(expandedId === `cardio:${block.id}` ? '' : `cardio:${block.id}`)}
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
      </ScrollView>

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
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, paddingTop: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.9 },
  empty: { fontSize: 16 },
  emptyWorkout: {
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
