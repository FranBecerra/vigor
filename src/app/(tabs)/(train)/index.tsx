/**
 * E1 — Inicio/Hoy de la pestaña Entrenamiento (PRD §8.5).
 *
 * Pantalla de inicio de la pestaña. Estructura (opción E acordada):
 *  1. Pastillas Fuerza / Cardio.
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

import { DomainPills } from '@/components/home/HomeHeader';
import { TodayCard } from '@/components/home/TodayCard';
import { RoutineCard } from '@/components/home/RoutineCard';
import { RenameRoutineSheet } from '@/components/home/RenameRoutineSheet';
import { TrainingCalendarCard } from '@/components/train/TrainingCalendarCard';
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
  type TrainingDomain,
} from '@/services/training/routineView';

/** The session with this id in the running microcycle of any routine. */
function findSession(routines: readonly RoutineView[], sessionId: string) {
  for (const routine of routines) {
    const current = routine.microcycles[routine.currentMicrocycleIndex];
    const found = current?.sessions.find((s) => s.id === sessionId);
    if (found) return { routine, session: found };
  }
  return null;
}

export default function TrainHomeScreen() {
  const { t, i18n } = useTranslation();
  const { uid } = useAuth();
  const owner = useRef(uid); owner.current = uid;
  const { colors, spacing, radius } = useTheme();
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
  const resumeGoal = activeWorkout?.trainingGoal ?? allRoutines.find((routine) => routine.mesocycleId === activeWorkout?.mesocycleId)?.generationGoal;
  const [renaming, setRenaming] = useState<RoutineView | null>(null);

  const [domain, setDomain] = useState<TrainingDomain>('STRENGTH');
  // null until the athlete touches the accordion, so the default follows the data.
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);

  /** Traduce una clave de MuscleGroup a su nombre legible. */
  const muscleLabel = useCallback((muscle: string) => t(`muscle.${muscle}`), [t]);

  const routines = useMemo(
    () => allRoutines.filter((routine) => routine.domain === domain),
    [allRoutines, domain],
  );

  /** The first pending session of the active routine is today's workout. */
  const selectedSession = useMemo(() => {
    const active = routines.filter((routine) => routine.isActive);
    return findSession(active, defaultSessionId(active));
  }, [routines]);
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
  const expandedId = expandedRoutineId ?? defaultExpandedRoutineId(routines);

  const startSession = useCallback(() => {
    if (selectedSession === null) return;
    router.push({
      pathname: '/session',
      params: {
        mesocycleId: selectedSession.routine.mesocycleId,
        goal: selectedSession.routine.generationGoal,
        microcycleIndex: String(selectedSession.routine.currentMicrocycleIndex),
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
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

        <View style={{ marginTop: spacing.md }}>
          <DomainPills
            value={domain}
            onChange={setDomain}
            labels={{ strength: t('home.strength'), cardio: t('home.cardio') }}
          />
        </View>

        {activeWorkout && resumeGoal && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/session', params: {
          mesocycleId: activeWorkout.mesocycleId, goal: resumeGoal,
          microcycleIndex: String(activeWorkout.microcycleIndex), plannedSessionIndex: String(activeWorkout.plannedSessionIndex),
        } })} style={{ padding: 20, marginTop: spacing.lg, backgroundColor: colors.bgElevated, borderRadius: radius.lg }}>
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
                start: t('home.startWorkout'),
                preview: t('home.previewWorkout'),
                exercises: t('home.exercises'),
                sets: t('home.sets'),
              }}
              onPressPreview={() => openSessionDetail(selectedSession.routine,
                selectedSession.session.plannedSessionIndex,
                selectedSession.routine.currentMicrocycleIndex)}
              onPressStart={startSession}
            />
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.empty, { color: colors.textMuted }]}>{t('home.noSession')}</Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.xl }]}>
          {t('home.routines')}
        </Text>

        {status === 'loading' ? (
          <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.textMuted} />
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

        {status === 'ready' && routines.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {t('home.noRoutines')}
          </Text>
        ) : null}

        {orderedRoutines.map((routine, index) => (
          <View key={routine.id} style={{ marginTop: spacing.sm }}>
            {/* The one active routine leads; the rest sit under their own label. */}
            {!routine.isActive && (index === 0 || orderedRoutines[index - 1].isActive) ? (
              <Text
                style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                {t('home.otherRoutines')}
              </Text>
            ) : null}
            <RoutineCard
              renderSessionList={(sessionRows) => <TrainingCalendarCard sessionRows={sessionRows} mesocycleId={routine.mesocycleId}
                initialMesocycle={routine.mesocycleSnapshot} onSessionHold={(index) => showDayActions(routine, index)}
                edgeScroll={dayScroll}
                microcycleIndex={routine.currentMicrocycleIndex} goal={routine.generationGoal} onChanged={reload} />}
              routine={routine}
              expanded={routine.id === expandedId}
              selectedSessionId={selectedSession?.session.id ?? ''}
              locale={i18n.language}
              muscleLabel={muscleLabel}
              labels={{
                sessions: t('home.sessions'),
                today: t('home.today'),
                viewMesocycle: t('home.viewMesocycle'),
                microcycleOf: t('home.microcycle'),
                activate: t('home.activateRoutine'),
                rename: t('home.renameRoutine'),
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
              onRename={() => setRenaming(routine)}
              onRemove={() => confirmRemove(routine)}
            />
          </View>
        ))}

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
        <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.md }]}>{t('library.tools')}</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg }}>
          {([
            { route: 'exercises', icon: 'books.vertical', label: 'library.title' },
            { route: 'history', icon: 'clock.arrow.circlepath', label: 'workout.history' },
            { route: 'rehab', icon: 'bandage', label: 'rehab.title' },
          ] as const).map(({ route, icon, label }, index) => <Pressable key={route} accessibilityRole="button" onPress={() => router.push(`/${route}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, borderTopWidth: index ? 0.5 : 0, borderTopColor: colors.surfaceBorder }}>
            <SymbolView name={icon} tintColor={colors.textSecondary} size={24} />
            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 17, fontWeight: '600' }}>{t(label)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 22 }}>›</Text>
          </Pressable>)}
        </View>
      </ScrollView>

      <RenameRoutineSheet
        currentName={renaming?.name ?? null}
        otherNames={allRoutines.filter((routine) => routine.id !== renaming?.id).map((routine) => routine.name)}
        labels={{
          title: t('home.renameRoutine'),
          save: t('home.renameSave'),
          cancel: t('generate.cancel'),
          duplicate: t('generate.nameDuplicate'),
        }}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          const target = renaming;
          setRenaming(null);
          if (target === null) return;
          rename(target.id, name).catch((error: unknown) => {
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
