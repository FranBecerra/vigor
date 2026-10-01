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
import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DomainPills } from '@/components/home/HomeHeader';
import { TodayCard } from '@/components/home/TodayCard';
import { RoutineCard } from '@/components/home/RoutineCard';
import { RenameRoutineSheet } from '@/components/home/RenameRoutineSheet';
import { TrainingCalendarCard } from '@/components/train/TrainingCalendarCard';
import { useTheme } from '@/theme/useTheme';
import { useRoutines } from '@/hooks/useRoutines';
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
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status, routines: allRoutines, reload, activate, rename, remove } = useRoutines();
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
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

        {orderedRoutines.filter((routine) => routine.isActive).map((routine) =>
          <TrainingCalendarCard key={routine.id} mesocycleId={routine.mesocycleId}
            microcycleIndex={routine.currentMicrocycleIndex} goal={routine.generationGoal} durationFeedback={routine.durationFeedback} onChanged={reload} />)}
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
          onPress={() => router.push('/generate')}
          style={[
            styles.emptyWorkout,
            { borderColor: colors.surfaceBorder, borderRadius: radius.md, marginTop: spacing.md },
          ]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
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
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            + {t('home.emptyWorkout')}
          </Text>
        </Pressable>
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
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9 },
  empty: { fontSize: 12 },
  emptyWorkout: {
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
