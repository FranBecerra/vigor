/**
 * Hoja de previsualización de la sesión (PRD §8.5).
 *
 * Se abre desde el CUERPO de la tarjeta de hoy, nunca desde el botón verde, así
 * que curiosear no arranca un entrenamiento.
 *
 * Se eligió hoja inferior frente a expandir la tarjeta porque el acordeón de
 * rutinas queda justo debajo: expandir ambos alargaría el scroll hasta perder la
 * orientación. Además es la superficie donde encajarán después el swap y la
 * edición previa (E6) sin rediseñar nada.
 */
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';
import { rirColor } from '@/components/train/rirColor';
import { setTypeLabel } from '@/components/train/setTypeLabel';
import {
  countWorkingSets,
  estimateSessionMinutes,
  formatSetVolume,
  rankedMuscleVolume,
  totalWorkingSets,
} from '@/services/training/sessionSummary';
import type { MockSession } from '@/mocks/home';

interface SessionPreviewSheetProps {
  session: MockSession | null;
  muscleLabel: (muscle: string) => string;
  labels: {
    volumeByMuscle: string;
    exercises: string;
    sets: string;
    start: string;
    close: string;
  };
  onClose: () => void;
  onStart: () => void;
}

export function SessionPreviewSheet({
  session,
  muscleLabel,
  labels,
  onClose,
  onStart,
}: SessionPreviewSheetProps) {
  const { colors, sectionAccent, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  if (session === null) return null;

  const muscles = rankedMuscleVolume(session.exercises);
  const maxVolume = muscles.length > 0 ? muscles[0].sets : 1;
  const workingSets = totalWorkingSets(session.exercises);
  const minutes = estimateSessionMinutes(session.exercises);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={labels.close} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom + 90,
          },
        ]}>
        <View style={[styles.grabber, { backgroundColor: colors.surfaceBorder }]} />

        <Text style={[styles.title, { color: colors.textPrimary }]}>{session.name}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {session.exercises.length} {labels.exercises} · {workingSets} {labels.sets} · ~{minutes}
          {' min'}
        </Text>

        <ScrollView
          style={{ marginTop: spacing.md }}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}>
          {/* Series por músculo, en barras */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {labels.volumeByMuscle}
          </Text>
          <View style={{ marginBottom: spacing.lg }}>
            {muscles.map((entry) => (
              <View key={entry.muscle} style={styles.volumeRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.volumeName, { color: colors.textSecondary }]}>
                  {muscleLabel(entry.muscle)}
                </Text>
                <View style={[styles.volumeTrack, { backgroundColor: colors.surface }]}>
                  <View
                    style={[
                      styles.volumeFill,
                      {
                        backgroundColor: sectionAccent.train,
                        width: `${(entry.sets / maxVolume) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.volumeValue, { color: colors.textPrimary }]}>
                  {formatSetVolume(entry.sets)}
                </Text>
              </View>
            ))}
          </View>

          {/* Lista de ejercicios */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {labels.exercises}
          </Text>
          {session.exercises.map((exercise) => {
            const type = exercise.sets[exercise.sets.length - 1]?.setType;
            const typeCode = type ? setTypeLabel(type) : '';
            return (
              <View
                key={exercise.exerciseId}
                style={[
                  styles.exerciseRow,
                  { backgroundColor: colors.bgElevated, borderRadius: radius.md },
                ]}>
                <View style={styles.exerciseText}>
                  <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>
                    {exercise.name}
                  </Text>
                  <Text style={[styles.exerciseMuscle, { color: colors.textMuted }]}>
                    {muscleLabel(exercise.primaryMuscle)}
                    {typeCode !== '' ? ` · ${typeCode}` : ''}
                  </Text>
                </View>
                <Text style={[styles.exercisePrescription, { color: colors.textSecondary }]}>
                  {countWorkingSets(exercise.sets)}×{exercise.repRange}
                </Text>
                <View
                  style={[
                    styles.rirBadge,
                    { backgroundColor: rirColor(exercise.targetRIR), borderRadius: radius.sm },
                  ]}>
                  <Text style={styles.rirText}>{exercise.targetRIR}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={labels.start}
          style={[
            styles.startButton,
            { backgroundColor: sectionAccent.train, borderRadius: radius.pill },
          ]}>
          <Text style={styles.startLabel}>{labels.start}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '82%', paddingHorizontal: 18, paddingTop: 10 },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  meta: { fontSize: 11, marginTop: 2 },
  sectionLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.9, marginBottom: 9 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  volumeName: { width: 86, fontSize: 11 },
  volumeTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  volumeFill: { height: 7, borderRadius: 4 },
  volumeValue: { width: 30, fontSize: 11, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    marginBottom: 5,
  },
  exerciseText: { flex: 1 },
  exerciseName: { fontSize: 12.5, fontWeight: '600' },
  exerciseMuscle: { fontSize: 9.5, marginTop: 1 },
  exercisePrescription: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rirBadge: { minWidth: 24, paddingVertical: 3, alignItems: 'center' },
  rirText: { fontSize: 10.5, fontWeight: '800', color: '#16191C' },
  startButton: { paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  startLabel: { fontSize: 14, fontWeight: '800', color: '#16191C' },
});
