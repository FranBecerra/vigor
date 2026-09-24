/**
 * Vista del mesociclo (PRD §8.7).
 *
 * Resume la sesión elegida por microciclo con dos métricas comparables —volumen
 * (series) e intensidad media (RIR)— y permite SELECCIONAR cualquier microciclo
 * para inspeccionar su prescripción real, serie a serie.
 *
 * No mezcla las series de ejercicios distintos como si fueran una progresión
 * única: esa representación no explicaba nada y se retiró.
 */
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { rirColor } from '@/components/train/rirColor';
import { countWorkingSets } from '@/services/training/sessionSummary';
import { maxVolume, sessionMicrocycleMetrics } from '@/services/training/sessionProgression';
import { adjustSetRIRs, deriveSetRIRs } from '@/services/training/setIntensity';
import { mockActiveRoutine } from '@/mocks/home';

const PROJECTED_OPACITY = 0.4;
const COMPLETED_OPACITY = 0.62;
/** Alto máximo de la barra de volumen. Compacto a propósito: antes sobraba espacio. */
const MAX_BAR_HEIGHT = 56;

export default function MesocycleScreen() {
  const { t } = useTranslation();
  const { colors, sectionAccent, semantic, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routine = mockActiveRoutine;

  const [sessionIndex, setSessionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(routine.currentMicrocycleIndex);

  const sessionNames = routine.microcycles[0].sessions.map((session) => session.name);
  const metrics = useMemo(
    () => sessionMicrocycleMetrics(routine.microcycles, sessionIndex),
    [routine, sessionIndex],
  );
  const volumeCeiling = maxVolume(metrics);

  const selectedMicrocycle = routine.microcycles[selectedIndex];
  const selectedSession = selectedMicrocycle.sessions[sessionIndex];

  const completedSessions = routine.microcycles
    .flatMap((microcycle) => microcycle.sessions)
    .filter((session) => session.completedOn !== undefined).length;
  const totalSessions = routine.microcycles.length * routine.microcycles[0].sessions.length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backRow}>
            <Text style={[styles.back, { color: colors.textSecondary }]}>‹ {t('tabs.train')}</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{routine.objective}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{routine.name}</Text>

          <View style={[styles.statRow, { marginTop: spacing.md }]}>
            <View style={[styles.stat, { backgroundColor: colors.bgElevated, borderRadius: radius.md }]}>
              <Text style={[styles.statValue, { color: sectionAccent.train }]}>{completedSessions}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('meso.ofSessions', { total: totalSessions })}
              </Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.bgElevated, borderRadius: radius.md }]}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                {routine.currentMicrocycleIndex + 1}/{routine.microcycles.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t('home.microcycle').toLowerCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Sesión */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 16 }}
          style={{ marginTop: spacing.lg }}>
          {sessionNames.map((name, index) => {
            const active = index === sessionIndex;
            return (
              <Pressable
                key={name}
                onPress={() => setSessionIndex(index)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.sessionTab, active && { borderBottomColor: sectionAccent.train }]}>
                <Text
                  style={[
                    styles.sessionTabText,
                    { color: active ? colors.textPrimary : colors.textMuted },
                    active && styles.bold,
                  ]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Progresión: compacta y SELECCIONABLE */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={[styles.chart, { backgroundColor: colors.bgElevated, borderRadius: radius.lg }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                {t('meso.progression')}
              </Text>
              <Text style={[styles.chartHint, { color: colors.textMuted }]}>
                {t('meso.volume')} · {t('train.rir')} {t('meso.average')}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.columns}>
              {metrics.map((metric, index) => {
                const selected = index === selectedIndex;
                const opacity = metric.isProjected
                  ? PROJECTED_OPACITY
                  : index === routine.currentMicrocycleIndex
                    ? 1
                    : COMPLETED_OPACITY;
                const barHeight = Math.max(5, (metric.volumeSets / volumeCeiling) * MAX_BAR_HEIGHT);
                return (
                  <Pressable
                    key={metric.id}
                    onPress={() => setSelectedIndex(index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.column,
                      { borderRadius: radius.md, opacity },
                      selected && {
                        backgroundColor: colors.surface,
                        borderColor: sectionAccent.train,
                        borderWidth: 1.5,
                        opacity: 1,
                      },
                    ]}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.columnLabel,
                        {
                          color: metric.isDeload
                            ? semantic.deload
                            : selected
                              ? sectionAccent.train
                              : colors.textMuted,
                        },
                      ]}>
                      {metric.isDeload ? t('meso.deloadShort') : `M${metric.number}`}
                    </Text>
                    <View style={styles.barArea}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: metric.isDeload ? semantic.deload : sectionAccent.train,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.volumeValue, { color: colors.textPrimary }]}>
                      {metric.volumeSets}
                    </Text>
                    <View
                      style={[
                        styles.rirBadge,
                        { backgroundColor: rirColor(metric.averageRIR), borderRadius: radius.sm },
                      ]}>
                      <Text style={styles.rirText}>{metric.averageRIR.toFixed(1)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Ejercicios del microciclo SELECCIONADO, con RIR por serie */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={styles.listHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {t('home.exercises').toUpperCase()}
            </Text>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {selectedMicrocycle.isDeload
                ? t('meso.deload')
                : `${t('home.microcycle')} ${selectedMicrocycle.number}`}
            </Text>
          </View>

          {selectedSession.exercises.map((exercise) => {
            const workingSets = countWorkingSets(exercise.sets);
            const setRIRs = adjustSetRIRs(
              deriveSetRIRs(exercise.targetRIR, workingSets),
              selectedMicrocycle.intensityAdjustmentRIR,
            );
            return (
              <View
                key={exercise.exerciseId}
                style={[
                  styles.exerciseCard,
                  { backgroundColor: colors.bgElevated, borderRadius: radius.md },
                ]}>
                <View style={styles.exerciseTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[styles.exerciseMuscle, { color: colors.textMuted }]}>
                      {t(`muscle.${exercise.primaryMuscle}`)}
                    </Text>
                  </View>
                  <Text style={[styles.prescription, { color: colors.textSecondary }]}>
                    {workingSets}×{exercise.repRange}
                  </Text>
                </View>

                {/* RIR de CADA serie, no un valor fijo del ejercicio */}
                <View style={styles.setRirRow}>
                  {setRIRs.map((rir, index) => (
                    <View key={index} style={styles.setRir}>
                      <Text style={[styles.setIndex, { color: colors.textMuted }]}>{index + 1}</Text>
                      <View
                        style={[
                          styles.setRirBadge,
                          { backgroundColor: rirColor(rir), borderRadius: radius.sm },
                        ]}>
                        <Text style={styles.rirText}>
                          {Number.isInteger(rir) ? rir : rir.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <Text style={[styles.setRirCaption, { color: colors.textMuted }]}>
                    {t('meso.perSetIntensity')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backRow: { paddingVertical: 6 },
  back: { fontSize: 13 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, padding: 10 },
  statValue: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 9.5, marginTop: 1 },
  sessionTab: { paddingBottom: 7, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sessionTabText: { fontSize: 13 },
  bold: { fontWeight: '800' },
  chart: { padding: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chartTitle: { fontSize: 13, fontWeight: '800' },
  chartHint: { fontSize: 9 },
  columns: { gap: 8, paddingTop: 12, alignItems: 'flex-start' },
  column: { width: 58, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  /** Alturas FIJAS: si una etiqueta o cifra creciera, desalinearía toda la fila. */
  columnLabel: { fontSize: 9.5, fontWeight: '800', height: 13, textAlign: 'center' },
  barArea: { height: MAX_BAR_HEIGHT, justifyContent: 'flex-end', marginTop: 6 },
  bar: { width: 22, borderRadius: 4 },
  volumeValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
    height: 17,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rirBadge: { minWidth: 34, paddingVertical: 2, alignItems: 'center', marginTop: 5 },
  rirText: { color: '#16191C', fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'] },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9 },
  exerciseCard: { padding: 11, marginBottom: 6 },
  exerciseTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  exerciseName: { fontSize: 12.5, fontWeight: '600' },
  exerciseMuscle: { fontSize: 9.5, marginTop: 1 },
  prescription: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  setRirRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' },
  setRir: { alignItems: 'center', gap: 2 },
  setIndex: { fontSize: 8, fontWeight: '700' },
  setRirBadge: { minWidth: 26, paddingVertical: 2, alignItems: 'center' },
  setRirCaption: { fontSize: 8.5, marginLeft: 2 },
});
