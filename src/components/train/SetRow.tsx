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
import { memo, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { SetType, type SetExtension, type ExerciseRecording } from '@/models';
import { supportsExtensions } from '@/services/training/advancedSets';
import { useTheme } from '@/theme/useTheme';
import { setTypeLabel } from './setTypeLabel';
import { SetEntrySheet } from './SetEntrySheet';
import type { SetEntryValues } from './SetEntrySheet';
import { SwipeableSet } from './SwipeableSet';
import { TrophyIcon } from '@/components/icons/ActionIcons';
import { useTranslation } from 'react-i18next';
import { useTrainingUnits } from '@/hooks/useTrainingUnits';
import { WheelNumber } from './WheelNumber';
import { SetExtensionsEditor } from './SetExtensionsEditor';
import { intensityLabel, type IntensityScale, type IntensityValue } from '@/services/training/intensityScale';

/** Anchos de columna compartidos entre cabecera y filas (alineación tabular). */
export const COLUMN_WIDTHS = {
  set: 36,
  weight: 62,
  reps: 56,
  intensity: 44,
  done: 30,
  remove: 32,
} as const;

export interface SetRowData {
  personalRecord?: boolean;
  id: string;
  setType: SetType;
  displayNumber?: number;
  weight: number | undefined;
  reps: number | undefined;
  partialReps?: number;
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
  recording?: ExerciseRecording;
  data: SetRowData;
  scale: IntensityScale;
  onPressSetType: () => void;
  onToggleDone: () => void;
  onChangeWeight: (value: number | undefined) => void;
  onChangeReps: (value: number | undefined) => void;
  onChangeIntensity: (value: IntensityValue) => void;
  onChangeExtensions: (extensions: SetExtension[]) => void;
  onChangePartialReps?: (value: number | undefined) => void;
  onComplete?: (values: SetEntryValues) => void;
  onRemove?: () => void;
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
  onRemove,
  onChangePartialReps,
  onComplete,
  recording,
}: SetRowProps) {
  const { colors, sectionAccent, motion } = useTheme();
  const accent = sectionAccent.train;
  const { t } = useTranslation();
  const units = useTrainingUnits();
  const hasLoad = recording?.load !== 'NONE'; const timed = recording?.measure === 'SECONDS';
  const display = recording?.load === 'LEVEL' ? (value: number | undefined) => value : units.display;
  const store = recording?.load === 'LEVEL' ? (value: number | undefined) => value : units.store;
  const loadLabel = recording?.load === 'LEVEL' ? t('custom.LEVEL') : units.unit.toUpperCase();
  const repsLabel = timed ? t('rehab.seconds') : t('train.reps');
  const previousLabel = data.previous
    ? `${hasLoad ? `${display(data.previous.weight)?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${recording?.load === 'LEVEL' ? t('custom.LEVEL') : units.unit} × ` : ''}${data.previous.reps}${timed ? ' s' : ''}${!timed && data.previous.intensity !== null ? ` @ ${scale} ${intensityLabel(data.previous.intensity, scale)}` : ''}`
    : '—';
  const [editing, setEditing] = useState<'weight' | 'reps' | 'intensity' | null>(null);

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
    borderColor: interpolateColor(done.value, [0, 1], [colors.controlBorder, accent]),
  }));

  const hasExtraFields = supportsExtensions(data.setType);

  return (
    <SwipeableSet onRemove={onRemove}>
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
                { color: data.setType === SetType.NORMAL ? colors.accentText : colors.textSecondary },
              ]}>
              {data.setType === SetType.NORMAL
                ? (data.displayNumber ?? '-')
                : setTypeLabel(data.setType)}
            </Text>
          </View>
        </Pressable>

        {/* PREVIOUS */}
        <View style={styles.previous}>
          <Text accessibilityLabel={previousLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}
            style={[styles.previousMain, { color: data.previous ? colors.textSecondary : colors.textMuted }]}>
            {previousLabel}
          </Text>
        </View>

        {/* KG — bloqueado al completar */}
        <View style={{ width: COLUMN_WIDTHS.weight, alignItems: 'center' }}>
          {hasLoad && <WheelNumber value={display(data.weight)} step={recording?.load === 'LEVEL' ? 1 : units.increment} maximum={10000} label={loadLabel} onChange={(value) => onChangeWeight(store(value))} onPress={() => setEditing('weight')}
            style={{ paddingVertical: 10, width: '92%', borderRadius: 8, backgroundColor: colors.surface }}>
            <Text style={{ textAlign: 'center', color: data.weightIsPlanned ? colors.textMuted : colors.textPrimary, fontWeight: '700' }}>{display(data.weight)?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? '—'}</Text>
          </WheelNumber>}
        </View>

        {/* REPS — bloqueado al completar */}
        <View style={{ width: COLUMN_WIDTHS.reps, alignItems: 'center' }}>
          <WheelNumber value={data.reps} step={1} maximum={timed ? 3600 : 999} label={repsLabel} onChange={onChangeReps} onPress={() => setEditing('reps')}
            style={{ paddingVertical: 10, width: '92%', borderRadius: 8, backgroundColor: colors.surface }}>
            <Text style={{ textAlign: 'center', color: data.repsIsPlanned ? colors.textMuted : colors.textPrimary, fontWeight: '700' }}>{data.reps ?? '—'}{data.partialReps ? ` +${data.partialReps}P` : ''}</Text>
          </WheelNumber>
        </View>

        {/* INTENSIDAD — sigue editable incluso en una serie completada */}
        <View style={{ width: COLUMN_WIDTHS.intensity, alignItems: 'center' }}>
          {!timed && <Pressable onPress={() => setEditing('intensity')} accessibilityRole="button" accessibilityLabel={scale} style={{ minHeight: 44, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.accentText, fontWeight: '700' }}>{intensityLabel(data.intensity ?? null, scale)}</Text>
          </Pressable>}
        </View>

        {/* ✓ */}
        <Pressable
          onPress={onToggleDone}
          style={{ width: COLUMN_WIDTHS.done, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={data.personalRecord && data.isCompleted ? t('workout.recordSet') : t('workout.completeSet')}>
          <Animated.View style={[styles.checkbox, animatedCheckbox]}>
            {data.isCompleted ? data.personalRecord
              ? <Animated.View key="record" entering={FadeIn.duration(180)} accessibilityLabel="PR"><TrophyIcon size={18} color={colors.onAccent} /></Animated.View>
              : <Text style={styles.checkMark}>✓</Text> : null}
          </Animated.View>
        </Pressable>
      </Animated.View>
      {editing && <SetEntrySheet initialField={editing} weight={display(data.weight)} reps={data.reps} intensity={data.intensity} partialReps={data.partialReps} scale={scale}
        weightLabel={loadLabel} repsLabel={repsLabel} showWeight={hasLoad} showIntensity={!timed}
        onWeight={(value) => onChangeWeight(store(value))} onReps={onChangeReps} onIntensity={onChangeIntensity} onPartialReps={timed ? undefined : onChangePartialReps}
        onComplete={onComplete ? (values) => onComplete({ ...values, weight: store(values.weight) }) : undefined} onClose={() => setEditing(null)} />}

      {/* Los parámetros aparecen justo al seleccionar un tipo avanzado. */}
      {hasExtraFields ? (
        <SetExtensionsEditor
          setType={data.setType}
          extensions={data.extensions ?? [{}]}
          mainWeight={data.weight}
          editable
          onChange={onChangeExtensions}
        />
      ) : null}
    </View>
    </SwipeableSet>
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
  previous: { flex: 1, minWidth: 0, paddingLeft: 4, paddingRight: 4 },
  previousMain: { fontSize: 13, fontVariant: ['tabular-nums'] },
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
