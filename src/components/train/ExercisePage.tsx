/**
 * Página de un ejercicio dentro del carrusel de la sesión (PRD §8.5).
 *
 * MEMOIZADA a propósito: el estado de todas las series vive en la pantalla, y
 * sin memoizar por ejercicio cada pulsación re-renderizaba las 5 páginas
 * completas, lo que hacía la interfaz perceptiblemente lenta.
 */
import { memo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SetRow, COLUMN_WIDTHS, type SetRowData } from './SetRow';
import { useTheme } from '@/theme/useTheme';
import { SetType, type Exercise } from '@/models';
import type { MockSetRow } from '@/mocks/session';
import type { IntensityScale, IntensityValue } from '@/services/training/intensityScale';

interface ExercisePageProps {
  exercise: Exercise;
  sets: MockSetRow[];
  scale: IntensityScale;
  width: number;
  bottomInset: number;
  onUpdateSet: (exerciseId: string, setId: string, patch: Partial<MockSetRow>) => void;
  onAddSet: (exerciseId: string) => void;
  onPressSetType: (exerciseId: string, setId: string) => void;
}

function ExercisePageComponent({
  exercise,
  sets,
  scale,
  width,
  bottomInset,
  onUpdateSet,
  onAddSet,
  onPressSetType,
}: ExercisePageProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  const update = useCallback(
    (setId: string, patch: Partial<MockSetRow>) => onUpdateSet(exercise.id, setId, patch),
    [exercise.id, onUpdateSet],
  );

  let normalCount = 0;
  const rows: SetRowData[] = sets.map((s) => {
    if (s.setType === SetType.NORMAL) normalCount += 1;
    return {
      id: s.id,
      setType: s.setType,
      displayNumber: s.setType === SetType.NORMAL ? normalCount : undefined,
      weight: s.actualWeight ?? s.targetWeight,
      reps: s.actualReps ?? s.targetReps,
      intensity: s.actualRIR !== undefined ? s.actualRIR : s.targetRIR,
      extensions: s.extensions,
      // Gris atenuado mientras el valor sea el previsto y no uno introducido.
      weightIsPlanned: s.actualWeight === undefined,
      repsIsPlanned: s.actualReps === undefined,
      isCompleted: s.isCompleted,
      previous: s.previous
        ? { weight: s.previous.weight, reps: s.previous.reps, intensity: s.previous.rir }
        : undefined,
    };
  });

  const completed = sets.filter((s) => s.isCompleted).length;

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ paddingBottom: bottomInset + 110 }}
      keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{exercise.name}</Text>
        <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
          {completed}/{sets.length} {t('train.sets').toLowerCase()}
        </Text>
      </View>

      {/* Cabecera de columnas */}
      <View style={[styles.columnHeader, { paddingHorizontal: spacing.lg }]}>
        <Text style={[styles.columnLabel, { width: COLUMN_WIDTHS.set }]}>SET</Text>
        <Text style={[styles.columnLabel, { flex: 1, paddingLeft: 4 }]}>{t('train.previous')}</Text>
        <Text style={[styles.columnLabel, styles.centered, { width: COLUMN_WIDTHS.weight }]}>
          {t('train.weight')}
        </Text>
        <Text style={[styles.columnLabel, styles.centered, { width: COLUMN_WIDTHS.reps }]}>
          {t('train.reps')}
        </Text>
        <Text style={[styles.columnLabel, styles.centered, { width: COLUMN_WIDTHS.intensity }]}>
          {scale}
        </Text>
        <View style={{ width: COLUMN_WIDTHS.done }} />
      </View>

      {rows.map((row) => (
        <SetRow
          key={row.id}
          data={row}
          scale={scale}
          onPressSetType={() => onPressSetType(exercise.id, row.id)}
          onToggleDone={() =>
            update(row.id, {
              isCompleted: !row.isCompleted,
              actualWeight: row.weight,
              actualReps: row.reps,
              actualRIR: row.intensity,
            })
          }
          onChangeWeight={(value) => update(row.id, { actualWeight: value })}
          onChangeReps={(value) => update(row.id, { actualReps: value })}
          onChangeIntensity={(value: IntensityValue) => update(row.id, { actualRIR: value })}
          onChangeExtensions={(extensions) => update(row.id, { extensions })}
        />
      ))}

      {/* + para añadir serie */}
      <Pressable
        onPress={() => onAddSet(exercise.id)}
        accessibilityRole="button"
        accessibilityLabel={t('train.addSet')}
        style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <View style={[styles.addSetBadge, { backgroundColor: colors.bgElevated }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>+</Text>
        </View>
      </Pressable>

      {/* Acciones centradas */}
      <View style={styles.actions}>
        {[t('train.swap'), t('train.info'), t('train.note')].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[
              styles.actionChip,
              { borderRadius: radius.pill, backgroundColor: colors.bgElevated },
            ]}>
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

export const ExercisePage = memo(ExercisePageComponent);

const styles = StyleSheet.create({
  exerciseName: { fontSize: 20, fontWeight: '700' },
  exerciseMeta: { fontSize: 12, marginTop: 2 },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 12,
    paddingBottom: 8,
  },
  columnLabel: { fontSize: 10, fontWeight: '600', color: '#DCE8C4', letterSpacing: 0.4 },
  centered: { textAlign: 'center' },
  addSetBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingTop: 4 },
  actionChip: { paddingHorizontal: 18, paddingVertical: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },
});
