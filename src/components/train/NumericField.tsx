/**
 * Campo numérico de la tabla de series (KG / REPS).
 *
 * Mantiene el TEXTO que escribe el usuario, no el número: así, al borrar el
 * contenido, el campo queda **vacío** en lugar de rellenarse con un `0`
 * automático. El valor numérico se comunica al padre como `number | undefined`
 * (undefined = vacío).
 *
 * Dos estados visuales además del normal:
 *  - `isPlanned`: el valor mostrado es el PREVISTO, no uno introducido por el
 *    usuario. Se pinta en gris atenuado para que se distinga de un dato real.
 *  - `editable={false}`: serie ya completada. KG y REPS quedan bloqueados (solo
 *    se pueden cambiar el RIR y el tipo de serie), y la caja pierde el borde
 *    para que se lea como dato consolidado y no como campo de entrada.
 *
 * Se resincroniza si el valor llega cambiado desde fuera (p. ej. un ajuste
 * automático por fatiga).
 */
import { useEffect, useState } from 'react';
import { TextInput, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '@/theme/useTheme';

interface NumericFieldProps {
  value: number | undefined;
  onChangeValue: (value: number | undefined) => void;
  /** true para admitir decimales (peso); false para enteros (reps). */
  decimal?: boolean;
  /** false bloquea la edición (serie completada). */
  editable?: boolean;
  /** true cuando el valor mostrado es el previsto, no uno introducido. */
  isPlanned?: boolean;
  accessibilityLabel: string;
}

/** Convierte el texto a número; devuelve undefined si está vacío o no es válido. */
export function parseNumericText(text: string, decimal: boolean): number | undefined {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') return undefined;
  const parsed = decimal ? Number(normalized) : parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function NumericField({
  value,
  onChangeValue,
  decimal = false,
  editable = true,
  isPlanned = false,
  accessibilityLabel,
}: NumericFieldProps) {
  const { colors, radius } = useTheme();
  const [text, setText] = useState(value === undefined ? '' : String(value));

  // Resincroniza si el valor externo cambia y no coincide con lo escrito.
  useEffect(() => {
    const currentAsNumber = parseNumericText(text, decimal);
    if (currentAsNumber !== value) {
      setText(value === undefined ? '' : String(value));
    }
    // Deliberadamente solo depende de `value`: no queremos pisar lo que el
    // usuario está escribiendo en cada pulsación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const keyboardType: KeyboardTypeOptions = decimal ? 'decimal-pad' : 'number-pad';

  return (
    <TextInput
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChangeValue(parseNumericText(next, decimal));
      }}
      editable={editable}
      keyboardType={keyboardType}
      selectTextOnFocus={editable}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.input,
        {
          borderRadius: radius.sm,
          // Serie completada: sin caja, el dato ya está consolidado.
          backgroundColor: editable ? colors.surface : 'transparent',
          borderColor: editable ? colors.surfaceBorder : 'transparent',
          color: isPlanned ? colors.textMuted : colors.textPrimary,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '92%',
    borderWidth: 1,
    paddingVertical: 7,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
