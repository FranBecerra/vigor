/**
 * Fila de serie de la tabla de registro (PRD §8.5, §8.8).
 *
 * Columnas: SET · PREVIOUS · KG · REPS · INTENSIDAD · ✓.
 * Las series avanzadas (Drop Set, Rest Pause, Myo-Rep) despliegan debajo sus
 * tramos extra. No se esconden detrás de otro modal: al elegir el tipo aparecen
 * los parámetros que hay que registrar durante la ejecución.
 *
 * Memoizada: editar una fila no debe repintar las demás páginas del carrusel.
 */
import { memo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { SetType, type SetExtension } from '@/models';
import { supportsExtensions } from '@/services/training/advancedSets';
import { useTheme } from '@/theme/useTheme';
import { setTypeLabel } from './setTypeLabel';
import { NumericField } from './NumericField';
import { IntensityCell } from './IntensityCell';
import { SetExtensionsEditor } from './SetExtensionsEditor';
import { intensityLabel, type IntensityScale, type IntensityValue } from '@/services/training/intensityScale';

/** Anchos de columna compartidos entre cabecera y filas (alineación tabular). */
export const COLUMN_WIDTHS = {
  set: 36,
  weight: 62,
  reps: 56,
  intensity: 44,
  done: 30,
} as const;

export interface SetRowData {
  id: string;
  setType: SetType;
  displayNumber?: number;
  weight: number | undefined;
  reps: number | undefined;
  intensity: IntensityValue | undefined;
  /** Tramos extra de Drop Set / Rest Pause / Myo-Rep. */
  extensions?: SetExtension[];
  /** true si el peso mostrado es el PREVISTO, no uno introducido por el usuario. */
  weightIsPlanned: boolean;
  /** true si las reps mostradas son las PREVISTAS, no introducidas. */
  repsIsPlanned: boolean;
  isCompleted: boolean;
  previous?: { weight: number; reps: number; intensity: IntensityValue };
}

interface SetRowProps {
  data: SetRowData;
  scale: IntensityScale;
  onPressSetType: () => void;
  onToggleDone: () => void;
  onChangeWeight: (value: number | undefined) => void;
  onChangeReps: (value: number | undefined) => void;
  onChangeIntensity: (value: IntensityValue) => void;
  onChangeExtensions: (extensions: SetExtension[]) => void;
}

function SetRowComponent({
  data,
  scale,
  onPressSetType,
  onToggleDone,
  onChangeWeight,
  onChangeReps,
  onChangeIntensity,
  onChangeExtensions,
}: SetRowProps) {
  const { colors, sectionAccent, motion } = useTheme();
  const accent = sectionAccent.train;

  const done = useSharedValue(data.isCompleted ? 1 : 0);
  useEffect(() => {
    done.value = withTiming(data.isCompleted ? 1 : 0, { duration: motion.normal });
  }, [data.isCompleted, done, motion.normal]);

  const animatedRow = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      done.value,
      [0, 1],
      ['rgba(155,227,23,0)', 'rgba(155,227,23,0.09)'],
    ),
  }));

  const animatedCheckbox = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(done.value, [0, 1], ['rgba(155,227,23,0)', accent]),
    borderColor: interpolateColor(done.value, [0, 1], [colors.surfaceBorder, accent]),
  }));

  const hasExtraFields = supportsExtensions(data.setType);

  return (
    <View>
      <Animated.View style={[styles.row, animatedRow]}>
        {/* SET */}
        <Pressable
          onPress={onPressSetType}
          style={{ width: COLUMN_WIDTHS.set }}
          accessibilityRole="button"
          accessibilityLabel="Tipo de serie">
          <View style={[styles.setBadge, { backgroundColor: colors.surface }]}>
            <Text
              style={[
                styles.setBadgeText,
                { color: data.setType === SetType.NORMAL ? accent : colors.textSecondary },
              ]}>
              {data.setType === SetType.NORMAL
                ? (data.displayNumber ?? '-')
                : setTypeLabel(data.setType)}
            </Text>
          </View>
        </Pressable>

        {/* PREVIOUS */}
        <View style={styles.previous}>
          {data.previous ? (
            <>
              <Text style={[styles.previousMain, { color: colors.textSecondary }]}>
                {data.previous.weight} kg × {data.previous.reps}
              </Text>
              <Text style={[styles.previousSub, { color: colors.textMuted }]}>
                {intensityLabel(data.previous.intensity, scale)} {scale}
              </Text>
            </>
          ) : (
            <Text style={[styles.previousMain, { color: colors.textMuted }]}>—</Text>
          )}
        </View>

        {/* KG — bloqueado al completar */}
        <View style={{ width: COLUMN_WIDTHS.weight, alignItems: 'center' }}>
          <NumericField
            value={data.weight}
            onChangeValue={onChangeWeight}
            decimal
            editable={!data.isCompleted}
            isPlanned={data.weightIsPlanned}
            accessibilityLabel="Peso en kilogramos"
          />
        </View>

        {/* REPS — bloqueado al completar */}
        <View style={{ width: COLUMN_WIDTHS.reps, alignItems: 'center' }}>
          <NumericField
            value={data.reps}
            onChangeValue={onChangeReps}
            editable={!data.isCompleted}
            isPlanned={data.repsIsPlanned}
            accessibilityLabel="Repeticiones"
          />
        </View>

        {/* INTENSIDAD — sigue editable incluso en una serie completada */}
        <View style={{ width: COLUMN_WIDTHS.intensity, alignItems: 'center' }}>
          <IntensityCell
            cellId={data.id}
            value={data.intensity}
            scale={scale}
            onChange={onChangeIntensity}
          />
        </View>

        {/* ✓ */}
        <Pressable
          onPress={onToggleDone}
          style={{ width: COLUMN_WIDTHS.done, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Completar serie">
          <Animated.View style={[styles.checkbox, animatedCheckbox]}>
            {data.isCompleted ? <Text style={styles.checkMark}>✓</Text> : null}
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Los parámetros aparecen justo al seleccionar un tipo avanzado. */}
      {hasExtraFields ? (
        <SetExtensionsEditor
          setType={data.setType}
          extensions={data.extensions ?? [{}]}
          mainWeight={data.weight}
          editable={!data.isCompleted}
          onChange={onChangeExtensions}
        />
      ) : null}
    </View>
  );
}

export const SetRow = memo(SetRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  setBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBadgeText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  previous: { flex: 1, paddingLeft: 4 },
  previousMain: { fontSize: 12, fontVariant: ['tabular-nums'] },
  previousSub: { fontSize: 10, fontVariant: ['tabular-nums'] },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 13, fontWeight: '800', color: '#16191C' },
});
