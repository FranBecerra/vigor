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
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { DomainPills } from '@/components/home/HomeHeader';
import { TodayCard } from '@/components/home/TodayCard';
import { RoutineCard } from '@/components/home/RoutineCard';
import { SessionPreviewSheet } from '@/components/home/SessionPreviewSheet';
import { useTheme } from '@/theme/useTheme';
import {
  mockRoutines,
  mockTodaySessionId,
  type TrainingDomain,
} from '@/mocks/home';

export default function TrainHomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [domain, setDomain] = useState<TrainingDomain>('STRENGTH');
  const [selectedSessionId, setSelectedSessionId] = useState(mockTodaySessionId);
  const [expandedRoutineId, setExpandedRoutineId] = useState(
    mockRoutines.find((r) => r.isActive)?.id ?? mockRoutines[0]?.id ?? '',
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  /** Traduce una clave de MuscleGroup a su nombre legible. */
  const muscleLabel = useCallback((muscle: string) => t(`muscle.${muscle}`), [t]);

  const routines = useMemo(
    () => mockRoutines.filter((routine) => routine.domain === domain),
    [domain],
  );

  /** Sesión seleccionada, buscada en el microciclo en curso de cada rutina. */
  const selectedSession = useMemo(() => {
    for (const routine of routines) {
      const current = routine.microcycles[routine.currentMicrocycleIndex];
      const found = current?.sessions.find((s) => s.id === selectedSessionId);
      if (found) return { routine, session: found };
    }
    return null;
  }, [routines, selectedSessionId]);

  const startSession = useCallback(() => {
    setPreviewOpen(false);
    router.push('/session');
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
              onPressPreview={() => setPreviewOpen(true)}
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

        {routines.map((routine) => (
          <View key={routine.id} style={{ marginTop: spacing.sm }}>
            <RoutineCard
              routine={routine}
              expanded={routine.id === expandedRoutineId}
              selectedSessionId={selectedSessionId}
              locale={i18n.language}
              muscleLabel={muscleLabel}
              labels={{
                sessions: t('home.sessions'),
                today: t('home.today'),
                viewMesocycle: t('home.viewMesocycle'),
                microcycleOf: t('home.microcycle'),
              }}
              onToggle={() =>
                setExpandedRoutineId((current) => (current === routine.id ? '' : routine.id))
              }
              onSelectSession={setSelectedSessionId}
              onPressMesocycle={() => router.push('/mesocycle')}
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

      <SessionPreviewSheet
        session={previewOpen && selectedSession ? selectedSession.session : null}
        muscleLabel={muscleLabel}
        labels={{
          volumeByMuscle: t('home.volumeByMuscle'),
          exercises: t('home.exercises'),
          sets: t('home.sets'),
          start: t('home.startWorkout'),
          close: t('home.close'),
        }}
        onClose={() => setPreviewOpen(false)}
        onStart={startSession}
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
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
  },
});
