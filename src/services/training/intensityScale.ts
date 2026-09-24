/**
 * Escala de intensidad: RIR o RPE (PRD §8.5).
 *
 * El usuario elige la escala en los ajustes de su perfil:
 *  - **RIR** (Reps In Reserve): cuenta hacia abajo. 0 = fallo. `+5` es el valor
 *    ABIERTO ("5 o más en reserva"), útil al calentar, cuando no se sabe
 *    cuántas repeticiones quedan.
 *  - **RPE** (Rate of Perceived Exertion): cuenta hacia arriba. 10 = fallo.
 *    Su valor abierto es `-5` ("5 o menos"), el extremo fácil.
 *
 * El valor puede estar **vacío** (`null`): serie sin intensidad registrada.
 *
 * El color se deriva de la DISTANCIA AL FALLO (0 = fallo, 5 = muy lejos), de
 * modo que ambas escalas comparten la misma rampa rojo → verde.
 *
 * Funciones puras (objetivo 100% cobertura).
 */
import { RIR_COLORS } from '@/components/train/rirColor';

export type IntensityScale = 'RIR' | 'RPE';

/** Valor de intensidad; `null` = sin registrar. */
export type IntensityValue = number | null;

/** Valor a partir del cual la escala se considera ABIERTA (`+5` / `-5`). */
export const OPEN_ENDED_RIR = 5;
export const OPEN_ENDED_RPE = 5;

/** Máxima distancia al fallo representable en la rampa de color. */
const MAX_DISTANCE = RIR_COLORS.length - 1; // 5

/**
 * Opciones seleccionables, en el orden en que se muestran al usuario
 * (de más cerca del fallo a más lejos).
 */
export function intensityOptions(scale: IntensityScale): number[] {
  return scale === 'RIR' ? [0, 1, 2, 3, 4, 5] : [10, 9, 8, 7, 6, 5];
}

/**
 * Distancia al fallo (0 = fallo, 5 = muy lejos). Base del color.
 * Valores fuera de rango se recortan.
 */
export function distanceToFailure(value: number, scale: IntensityScale): number {
  if (!Number.isFinite(value)) return MAX_DISTANCE;
  const raw = scale === 'RIR' ? value : 10 - value;
  return Math.min(Math.max(Math.round(raw), 0), MAX_DISTANCE);
}

/** Etiqueta visible de un valor. `null` → guion; el extremo abierto → `+5` / `-5`. */
export function intensityLabel(value: IntensityValue, scale: IntensityScale): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (scale === 'RIR' && value >= OPEN_ENDED_RIR) return `+${OPEN_ENDED_RIR}`;
  if (scale === 'RPE' && value <= OPEN_ENDED_RPE) return `-${OPEN_ENDED_RPE}`;
  return String(value);
}

/** Color del valor según su distancia al fallo. `null` → sin color (transparente). */
export function intensityColor(value: IntensityValue, scale: IntensityScale): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return RIR_COLORS[distanceToFailure(value, scale)];
}
