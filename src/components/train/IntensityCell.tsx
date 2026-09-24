/**
 * Celda de intensidad (RIR / RPE) con selector emergente (PRD §8.5, §8.7).
 *
 * Dos formas de seleccionar, ambas soportadas:
 *  1. **Dos toques**: un toque en la celda abre el selector; un toque en una
 *     pastilla elige el valor.
 *  2. **Mantener pulsado y soltar**: al mantener pulsado aparece el selector;
 *     sin levantar el dedo se arrastra hasta el valor y al **soltar** se elige.
 *
 * Solo puede haber UN selector abierto en toda la pantalla. Eso se coordina con
 * `IntensityPickerProvider`, que guarda el id de la celda abierta: abrir una
 * cierra automáticamente la anterior. Sin esa coordinación cada celda llevaba su
 * propio estado y se podían desplegar varias filas de pastillas a la vez.
 *
 * Valores: `—` (vacío) + la escala elegida, con el extremo abierto (`+5` / `-5`).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useTheme } from '@/theme/useTheme';
import {
  intensityOptions,
  intensityLabel,
  intensityColor,
  type IntensityScale,
  type IntensityValue,
} from '@/services/training/intensityScale';

/** Geometría fija del selector, usada para mapear la posición del dedo a un valor. */
const OPTION_WIDTH = 34;
const OPTION_GAP = 4;

/** Coordina qué celda tiene el selector abierto (solo una a la vez). */
interface PickerCoordinator {
  openCellId: string | null;
  setOpenCellId: (id: string | null) => void;
}

const PickerContext = createContext<PickerCoordinator>({
  openCellId: null,
  setOpenCellId: () => {},
});

export function IntensityPickerProvider({ children }: { children: ReactNode }) {
  const [openCellId, setOpenCellId] = useState<string | null>(null);
  const value = useMemo(() => ({ openCellId, setOpenCellId }), [openCellId]);
  return <PickerContext.Provider value={value}>{children}</PickerContext.Provider>;
}

interface IntensityCellProps {
  /** Identificador único de la celda (id de la serie). */
  cellId: string;
  value: IntensityValue | undefined;
  scale: IntensityScale;
  onChange: (value: IntensityValue) => void;
}

export function IntensityCell({ cellId, value, scale, onChange }: IntensityCellProps) {
  const { colors, radius } = useTheme();
  const { openCellId, setOpenCellId } = useContext(PickerContext);
  const open = openCellId === cellId;

  const [highlighted, setHighlighted] = useState<number | null>(null);
  /** Posición absoluta del borde izquierdo del selector en pantalla. */
  const pickerLeft = useRef(0);
  /** true solo cuando el selector se abrió MANTENIENDO PULSADO (modo arrastre). */
  const isDragging = useRef(false);

  const options: IntensityValue[] = useMemo(() => [null, ...intensityOptions(scale)], [scale]);
  const current = value === undefined ? null : value;
  const currentColor = intensityColor(current, scale);

  /** Índice de la opción bajo una coordenada X absoluta. */
  const indexAtX = useCallback(
    (absoluteX: number): number | null => {
      const relative = absoluteX - pickerLeft.current;
      if (relative < 0) return null;
      const index = Math.floor(relative / (OPTION_WIDTH + OPTION_GAP));
      return index >= 0 && index < options.length ? index : null;
    },
    [options.length],
  );

  const close = useCallback(() => {
    setOpenCellId(null);
    setHighlighted(null);
    isDragging.current = false;
  }, [setOpenCellId]);

  const select = useCallback(
    (index: number) => {
      onChange(options[index]);
      close();
    },
    [onChange, options, close],
  );

  /** Toque en la celda: abre este selector (y cierra cualquier otro) o lo cierra. */
  const toggle = useCallback(() => {
    isDragging.current = false;
    setOpenCellId(open ? null : cellId);
    setHighlighted(null);
  }, [open, cellId, setOpenCellId]);

  /** Mantener pulsado: abre el selector y entra en modo arrastre. */
  const beginDrag = useCallback(() => {
    isDragging.current = true;
    setOpenCellId(cellId);
  }, [cellId, setOpenCellId]);

  /** Fin del arrastre: solo selecciona si venimos de mantener pulsado. */
  const endDrag = useCallback(
    (absoluteX: number) => {
      if (!isDragging.current) return;
      const index = indexAtX(absoluteX);
      if (index !== null) onChange(options[index]);
      close();
    },
    [indexAtX, onChange, options, close],
  );

  const tap = Gesture.Tap().onEnd((_event, success) => {
    if (success) runOnJS(toggle)();
  });

  const longPress = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => {
      runOnJS(beginDrag)();
    });

  // El arrastre solo resalta/selecciona en modo mantener-pulsado; un toque
  // normal no debe mover nada.
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      runOnJS(setHighlighted)(indexAtX(event.absoluteX));
    })
    .onEnd((event) => {
      runOnJS(endDrag)(event.absoluteX);
    });

  const gesture = useMemo(
    () => Gesture.Simultaneous(longPress, pan, tap),
    [longPress, pan, tap],
  );

  return (
    <View style={styles.container}>
      {open ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          onLayout={(event) => {
            event.target.measureInWindow((x) => {
              pickerLeft.current = x;
            });
          }}
          style={[
            styles.picker,
            {
              backgroundColor: colors.bgElevated,
              borderRadius: radius.md,
              borderColor: colors.surfaceBorder,
            },
          ]}>
          {options.map((option, index) => {
            const background = intensityColor(option, scale);
            const isHighlighted = highlighted === index;
            return (
              // Pressable: es lo que hace funcionar el modo de DOS TOQUES.
              <Pressable
                key={String(option)}
                onPress={() => select(index)}
                accessibilityRole="button"
                accessibilityLabel={`${scale} ${intensityLabel(option, scale)}`}
                style={[
                  styles.option,
                  {
                    borderRadius: radius.sm,
                    backgroundColor: background ?? 'transparent',
                    borderWidth: background ? 0 : 1,
                    borderColor: colors.surfaceBorder,
                    transform: [{ scale: isHighlighted ? 1.18 : 1 }],
                  },
                ]}>
                <Text
                  style={[styles.optionText, { color: background ? '#16191C' : colors.textMuted }]}>
                  {intensityLabel(option, scale)}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <View
          accessibilityRole="button"
          accessibilityLabel={`${scale} ${intensityLabel(current, scale)}`}
          style={[
            styles.cell,
            {
              borderRadius: radius.sm,
              backgroundColor: currentColor ?? 'transparent',
              borderWidth: currentColor ? 0 : 1,
              borderColor: colors.surfaceBorder,
            },
          ]}>
          <Text style={[styles.cellText, { color: currentColor ? '#16191C' : colors.textMuted }]}>
            {intensityLabel(current, scale)}
          </Text>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  cellText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  picker: {
    position: 'absolute',
    bottom: 30,
    right: -6,
    flexDirection: 'row',
    gap: OPTION_GAP,
    padding: 6,
    borderWidth: 1,
    zIndex: 20,
  },
  option: {
    width: OPTION_WIDTH,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: 12, fontWeight: '800' },
});
