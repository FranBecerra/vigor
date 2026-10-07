/**
 * Tarjeta de la sesión de hoy (PRD §8.5).
 *
 * Dos zonas pulsables DISTINTAS, a propósito:
 *  - el cuerpo de la tarjeta abre la previsualización (hoja inferior),
 *  - el botón verde inicia el entrenamiento.
 * Separarlas evita arrancar una sesión por curiosear.
 *
 * Las pastillas de músculo llevan su NÚMERO DE SERIES incorporado, para que el
 * desglose más útil no requiera ninguna interacción.
 */
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ROUTINE_ICONS, type RoutineIconKey } from '@/components/icons';
import { useTheme } from '@/theme/useTheme';
import {
  estimateSessionMinutes,
  formatSetVolume,
  rankedMuscleVolume,
  totalWorkingSets,
  visibleChipCount,
} from '@/services/training/sessionSummary';
import type { MockSession } from '@/mocks/home';

/** Filas de pastillas de músculo con espacio RESERVADO (ver MUSCLE_AREA_HEIGHT). */
const MUSCLE_ROWS = 3;
/** Alto de una fila de pastillas: texto + padding vertical. */
const MUSCLE_ROW_HEIGHT = 26;
/** Separación entre filas. */
const MUSCLE_ROW_GAP = 5;
/**
 * Alto FIJO del área de músculos.
 *
 * Se reserva el espacio de tres filas siempre, aunque la sesión use menos. Sin
 * esto, la tarjeta cambiaba de alto según cuántos grupos musculares tocara la
 * sesión, y al cambiar de rutina el contenido de debajo SALTABA. Las pastillas
 * se ajustan a la anchura en orden de series, y las que no caben en tres filas
 * se resumen en una pastilla "+N" que abre la previsualización.
 */
const MUSCLE_AREA_HEIGHT = MUSCLE_ROWS * MUSCLE_ROW_HEIGHT + (MUSCLE_ROWS - 1) * MUSCLE_ROW_GAP;

interface TodayCardProps {
  session: MockSession;
  routineName: string;
  routineIcon: RoutineIconKey;
  routineColor: string;
  /** Traduce una clave de MuscleGroup a su nombre legible. */
  muscleLabel: (muscle: string) => string;
  labels: { start: string; preview: string; exercises: string; sets: string };
  onPressPreview: () => void;
  onPressStart: () => void;
}

export function TodayCard({
  session,
  routineName,
  routineIcon,
  routineColor,
  muscleLabel,
  labels,
  onPressPreview,
  onPressStart,
}: TodayCardProps) {
  const { colors, radius, spacing } = useTheme();
  const RoutineIcon = ROUTINE_ICONS[routineIcon];

  // TODOS los músculos, ordenados por series; los que no caben se resumen en "+N".
  const muscles = rankedMuscleVolume(session.exercises);
  const workingSets = totalWorkingSets(session.exercises);
  const minutes = estimateSessionMinutes(session.exercises);

  const [bottoms, setBottoms] = useState<Record<string, number>>({});
  const measured = muscles.map((entry) => bottoms[entry.muscle]);
  // Hasta medir, se pintan todas y el área recorta lo que sobre.
  const visible = measured.every((bottom) => bottom !== undefined)
    ? visibleChipCount(measured as number[], MUSCLE_AREA_HEIGHT)
    : muscles.length;
  const hidden = muscles.length - visible;

  const chipText = (entry: (typeof muscles)[number]) => (
    <Text style={[styles.chipLabel, { color: colors.textSecondary }]}>
      {muscleLabel(entry.muscle)}{' '}
      <Text style={styles.chipCount}>{formatSetVolume(entry.sets)}</Text>
    </Text>
  );

  return (
    <View
      style={[styles.card, { backgroundColor: colors.bgElevated, borderRadius: radius.lg }]}>
      {/* Cuerpo pulsable → previsualización */}
      <Pressable
        onPress={onPressPreview}
        accessibilityRole="button"
        accessibilityLabel={labels.preview}>
        <View style={styles.header}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: routineColor, borderRadius: radius.sm },
            ]}>
            <RoutineIcon size={18} color="#16191C" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.sessionName, { color: colors.textPrimary }]}>
              {session.name}
            </Text>
            <Text style={[styles.routineName, { color: colors.textMuted }]}>{routineName}</Text>
            {session.scheduledOn && <Text style={[styles.routineName, { color: colors.textMuted }]}>{session.scheduledOn}</Text>}
          </View>
        </View>
      </Pressable>

      {/* Área de músculos de ALTO FIJO: el contenido de debajo nunca salta. */}
      <View style={[styles.muscleArea, { marginTop: spacing.sm }]}>
        {/* Capa invisible que mide dónde cae cada pastilla al ajustarse a la anchura. */}
        <View style={[styles.muscleWrap, styles.measureLayer]} pointerEvents="none">
          {muscles.map((entry) => (
            <View
              key={entry.muscle}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                setBottoms((prev) => (prev[entry.muscle] === y + height
                  ? prev : { ...prev, [entry.muscle]: y + height }));
              }}
              style={styles.chip}>
              {chipText(entry)}
            </View>
          ))}
        </View>

        <View style={styles.muscleWrap}>
          {muscles.slice(0, visible).map((entry) => (
            <View
              key={entry.muscle}
              style={[styles.chip, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
              {chipText(entry)}
            </View>
          ))}
          {hidden > 0 ? (
            <Pressable
              onPress={onPressPreview}
              accessibilityRole="button"
              accessibilityLabel={labels.preview}
              style={[styles.chip, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
              <Text style={[styles.chipLabel, styles.chipCount, { color: colors.textSecondary }]}>
                +{hidden}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={onPressPreview}
        accessibilityRole="button"
        accessibilityLabel={labels.preview}>
        <Text style={[styles.meta, { color: colors.textMuted, marginTop: spacing.xs }]}>
          {session.exercises.length} {labels.exercises} · {workingSets} {labels.sets} · ~{minutes}
          {' min'}
        </Text>
      </Pressable>

      {/* Acción primaria, separada del cuerpo */}
      <Pressable
        onPress={onPressStart}
        accessibilityRole="button"
        accessibilityLabel={labels.start}
        style={[
          styles.startButton,
          { backgroundColor: routineColor, borderRadius: radius.pill, marginTop: spacing.md },
        ]}>
        <Text style={styles.startLabel}>{labels.start}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  sessionName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  routineName: { fontSize: 11, marginTop: 1 },
  muscleArea: { height: MUSCLE_AREA_HEIGHT, overflow: 'hidden' },
  muscleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: MUSCLE_ROW_GAP },
  measureLayer: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  chip: { paddingHorizontal: 9, justifyContent: 'center', height: MUSCLE_ROW_HEIGHT },
  chipLabel: { fontSize: 11 },
  chipCount: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  meta: { fontSize: 11 },
  startButton: { paddingVertical: 12, alignItems: 'center' },
  startLabel: { fontSize: 14, fontWeight: '800', color: '#16191C' },
});
